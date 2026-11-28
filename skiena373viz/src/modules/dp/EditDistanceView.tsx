import { useCallback, useMemo, useReducer, useState } from 'react';
import { frameAt } from '@core';
import type { ViewProps } from '@core';
import {
  Caption, ComplexityPanel, Field, GrowthPanel, Legend, OpsPanel, PlayerControls, PseudocodePanel, TraceNotices, usePlayer, usePlayerKeys,
} from '@ui';
import { editDistance, experiments, MAX_CHARS, parseEditInput } from './algorithms/editDistance';
import type { Cell, Dir, EditInput } from './algorithms/editDistance';
import { emptyQuiz, judge, parseAnswer, questionAt, quizGates, quizReducer, reveal } from './algorithms/quiz';
import type { Guess, QuizSettings } from './algorithms/quiz';
import { randomPair } from './algorithms/random';
import { EditDetails, EditStage, StageContext } from './EditStage';
import type { StageActions } from './EditStage';
import { Inspector } from './Inspector';
import { QuizPanel } from './QuizPanel';
import type { Feedback } from './QuizPanel';
import styles from './dp.module.css';

const DEFAULT: EditInput = editDistance.presets[0]?.input ?? { pattern: 'kitten', text: 'sitting' };
const EVERY = [1, 2, 3, 4, 5, 6] as const;
const EVERY_LABEL: Readonly<Record<(typeof EVERY)[number], string>> = { 1: 'cell', 2: '2nd cell', 3: '3rd cell', 4: '4th cell', 5: '5th cell', 6: '6th cell' };

const toInt = (text: string | undefined, fallback: number, min: number, max: number): number => {
  const n = Number(text);
  return text !== undefined && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export default function EditDistanceView({ params, setParams }: ViewProps) {
  const patternText = params['p'] ?? DEFAULT.pattern;
  const textText = params['t'] ?? DEFAULT.text;
  const quizOn = params['quiz'] === '1';
  const every = toInt(params['k'], 3, 1, 6);
  const seed = toInt(params['qs'], 1, 1, 9999);
  const randomSeed = toInt(params['r'], 0, 0, 999_999);

  const parsed = useMemo(() => parseEditInput(patternText, textText), [patternText, textText]);
  // While the input is invalid, keep showing the last valid run and say what is wrong.
  const [lastGood, setLastGood] = useState<EditInput>(parsed.ok ? parsed.value : DEFAULT);
  if (parsed.ok && parsed.value !== lastGood) setLastGood(parsed.value);
  const trace = useMemo(() => editDistance.run(lastGood), [lastGood]);
  const settings = useMemo<QuizSettings>(() => ({ every, seed }), [every, seed]);
  const message = parsed.ok ? null : parsed.message;

  return (
    <div className="workbench">
      <section className="workbench-inputs" aria-label="Input">
        <div className="field-row">
          <Field label="Pattern (rows)" error={message?.startsWith('The pattern') ? message : null} hint={`Up to ${MAX_CHARS} characters; spaces count`}>
            {(props) => <input {...props} type="text" value={patternText} autoComplete="off" spellCheck={false} onChange={(event) => setParams({ p: event.target.value })} />}
          </Field>
          <Field label="Text (columns)" error={message?.startsWith('The text') ? message : null} hint="What the pattern must become">
            {(props) => <input {...props} type="text" value={textText} autoComplete="off" spellCheck={false} onChange={(event) => setParams({ t: event.target.value })} />}
          </Field>
          <Field label="Try an example">
            {(props) => (
              <select {...props} value="" onChange={(event) => {
                const preset = editDistance.presets.find((p) => p.id === event.target.value);
                if (preset) setParams({ p: preset.input.pattern, t: preset.input.text });
              }}>
                <option value="">Choose an example</option>
                {editDistance.presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
          </Field>
        </div>
        <div className={styles['settings']}>
          <button type="button" onClick={() => {
            const next = randomSeed + 1;
            const pair = randomPair(next);
            setParams({ r: String(next), p: pair.pattern, t: pair.text });
          }}>New random input</button>
          <button type="button" onClick={() => setParams({ p: textText, t: patternText })}>Swap the two strings</button>
          <label className={styles['toggle']}>
            <input type="checkbox" checked={quizOn} onChange={(event) => setParams({ quiz: event.target.checked ? '1' : null })} />
            Quiz mode
          </label>
          {quizOn ? (
            <>
              <Field label="Ask about every">
                {(props) => (
                  <select {...props} value={String(every)} onChange={(event) => setParams({ k: event.target.value })}>
                    {EVERY.map((k) => <option key={k} value={k}>{EVERY_LABEL[k]}</option>)}
                  </select>
                )}
              </Field>
              <button type="button" onClick={() => setParams({ qs: String(seed + 1) })}>New questions</button>
            </>
          ) : null}
        </div>
      </section>
      <EditPage key={`${lastGood.pattern}\u0000${lastGood.text}\u0000${quizOn ? `${every}/${seed}` : 'off'}`} trace={trace} quizOn={quizOn} settings={settings} />
    </div>
  );
}

function EditPage({ trace, quizOn, settings }: { readonly trace: ReturnType<typeof editDistance.run>; readonly quizOn: boolean; readonly settings: QuizSettings }) {
  const gates = useMemo(() => (quizOn ? quizGates(trace, settings) : []), [trace, quizOn, settings]);
  const gateSet = useMemo(() => new Set(gates), [gates]);
  const gated = useCallback((index: number) => gateSet.has(index), [gateSet]);
  const player = usePlayer({ frameCount: trace.frames.length, source: trace, ...(quizOn ? { gated } : {}) });
  usePlayerKeys(player);
  const frame = frameAt(trace.frames, player.index);
  const previous = player.index > 0 ? frameAt(trace.frames, player.index - 1) : null;

  const [quiz, dispatch] = useReducer(quizReducer, emptyQuiz);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const question = useMemo(() => (quizOn && player.atGate ? questionAt(trace, player.index) : null), [quizOn, player.atGate, player.index, trace]);

  const info = (index: number, text: string): void => setFeedback({ index, tone: 'info', message: text });

  const answer = (guess: Guess): void => {
    if (!question) return;
    const wrongBefore = quiz.open[question.index] ?? 0;
    const verdict = judge(trace, question, guess, wrongBefore);
    if (verdict.correct) {
      dispatch({ type: 'correct', index: question.index, kind: question.kind });
      setFeedback({ index: question.index, tone: 'right', message: verdict.message });
      player.release();
    } else {
      dispatch({ type: 'wrong', index: question.index });
      setFeedback({ index: question.index, tone: 'wrong', message: `Not quite (try ${wrongBefore + 1}). ${verdict.message}` });
    }
  };
  const rows = frame.state.table.length;
  const cols = frame.state.table[0]?.length ?? 1;
  const guessCell = (row: number, col: number): void => answer({ kind: 'cell', cell: [row, col] });
  const guessCellText = (row: string, col: string): void => {
    const r = Number(row);
    const c = Number(col);
    if (row.trim() === '' || col.trim() === '' || !Number.isInteger(r) || !Number.isInteger(c)) {
      if (question) info(question.index, 'Type a whole-number row and a whole-number column, or click the cell in the table.');
      return;
    }
    guessCell(r, c);
  };
  const onNumber = (text: string): void => {
    const parsed = parseAnswer(text);
    if (!parsed.ok) {
      if (question) info(question.index, parsed.message);
      return;
    }
    answer({ kind: 'number', value: parsed.value });
  };
  const onMove = (dir: Dir): void => answer({ kind: 'move', dir });
  const onShow = (): void => {
    if (!question) return;
    dispatch({ type: 'shown', index: question.index, kind: question.kind });
    setFeedback({ index: question.index, tone: 'shown', message: reveal(question) });
    player.release();
  };
  const onRetake = (): void => {
    dispatch({ type: 'retake' });
    setFeedback(null);
    player.rearm();
    player.reset();
  };

  const clickable = quizOn
    ? (question?.kind === 'cell' ? guessCell : undefined)
    : (row: number, col: number): void => setSelected((current) => (current && current[0] === row && current[1] === col ? null : [row, col]));
  const stage: StageActions = { quizOn, selected: quizOn ? null : selected, ...(clickable ? { onCell: clickable } : {}) };

  return (
    <>
      <div className="workbench-grid">
        <div className="workbench-main">
          <section className="stage" aria-label="Edit distance: current step">
            <StageContext.Provider value={stage}>
              <EditStage frame={frame} previous={previous} trace={trace} />
            </StageContext.Provider>
          </section>
          <PlayerControls player={player} />
          <div className={styles['captionSlot']}><Caption text={frame.explanation} playing={player.playing} /></div>
          <TraceNotices trace={trace} atEnd={player.atEnd} />
          {quizOn ? (
            <QuizPanel
              player={player} question={question} state={quiz} total={gates.length} position={question ? gates.indexOf(question.index) + 1 : 0}
              feedback={feedback} rows={rows} cols={cols} onNumber={onNumber} onCell={guessCellText} onMove={onMove} onShow={onShow} onRetake={onRetake}
            />
          ) : <Inspector state={frame.state} selected={selected} onSelect={setSelected} />}
          <section className="stage" aria-label="Edit distance: recurrence, alignment and script">
            <EditDetails frame={frame} previous={previous} trace={trace} />
          </section>
          <Legend
            tones={['active', 'compare', 'target', 'done']}
            labels={{
              active: 'the cell being filled, or the traceback position',
              compare: 'a neighbour it reads (and the characters being compared)',
              target: 'a parent: the neighbour the value comes from, or the cell you picked',
              done: 'on the traceback path',
            }}
          />
          <p className={styles['legendNote']}>
            Marks in a cell list its parents: ↖ diagonal, ← left, ↑ up. When parents tie, the first one listed is the one the traceback follows.
            In the fill, arrows point from a neighbour into the cell; in the traceback they point from a cell to its parent.
          </p>
        </div>
        <div className="workbench-side">
          <PseudocodePanel pseudocode={editDistance.pseudocode} lit={frame.lines} />
          <OpsPanel ops={editDistance.ops} counts={frame.ops} />
          <ComplexityPanel claims={editDistance.complexity} />
        </div>
      </div>
      <GrowthPanel experiments={experiments} />
    </>
  );
}
