/**
 * The quiz panel. It only ever renders `question.prompt` and the kind: the answer fields of a question stay in memory
 * until the learner answers or presses "Show me".
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '@ui';
import type { Player } from '@ui';
import { DIR_MARK, DIR_NAME, DIRS } from './algorithms/editDistance';
import type { Dir } from './algorithms/editDistance';
import { KIND_LABEL, score } from './algorithms/quiz';
import type { QuestionKind, QuizState, Question } from './algorithms/quiz';
import styles from './dp.module.css';

export interface Feedback {
  /** The gated frame the feedback belongs to. */
  readonly index: number;
  readonly tone: 'wrong' | 'right' | 'shown' | 'info';
  readonly message: string;
}

export interface QuizPanelProps {
  readonly player: Player;
  /** The open question at the current frame, or null. */
  readonly question: Question | null;
  readonly state: QuizState;
  /** Total questions in this run. */
  readonly total: number;
  /** 1-based position of the open question among all questions. */
  readonly position: number;
  readonly feedback: Feedback | null;
  readonly rows: number;
  readonly cols: number;
  readonly onNumber: (text: string) => void;
  readonly onCell: (row: string, col: string) => void;
  readonly onMove: (dir: Dir) => void;
  readonly onShow: () => void;
  readonly onRetake: () => void;
}

const FEEDBACK_CLASS = { wrong: 'feedbackWrong', right: 'feedbackRight', shown: 'feedbackInfo', info: 'feedbackInfo' } as const;
const KINDS: readonly QuestionKind[] = ['cell', 'value', 'base', 'move'];

export function QuizPanel(props: QuizPanelProps) {
  const { player, question, state, total, position, feedback, onShow, onRetake } = props;
  const tally = score(state);
  const wrong = question ? (state.open[question.index] ?? 0) : 0;
  const here = feedback !== null && feedback.index === player.index ? feedback : null;
  const resolved = here !== null && (here.tone === 'right' || here.tone === 'shown');
  const canContinue = resolved && !player.atGate && !player.atEnd;
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (canContinue) continueButton.current?.focus();
  }, [feedback, canContinue]);

  const finished = total > 0 && tally.answered >= total;
  return (
    <section className={`panel ${styles['quiz']}`} aria-label="Quiz">
      <h3>Quiz mode</h3>
      <dl className={styles['quizStats']}>
        <div><dt>Right first time</dt><dd>{tally.firstTry} of {tally.answered} answered</dd></div>
        <div><dt>Streak</dt><dd>{state.streak} (best {state.bestStreak})</dd></div>
        <div><dt>Questions</dt><dd>{tally.answered} of {total} done</dd></div>
        {KINDS.map((kind) => (
          <div key={kind}><dt>{KIND_LABEL[kind]}</dt><dd>{tally.byKind[kind].firstTry} of {tally.byKind[kind].answered}</dd></div>
        ))}
      </dl>

      {player.atGate && question ? (
        <div className={styles['question']} role="group" aria-label={`Question ${position} of ${total}`}>
          <p className="eyebrow">Question {position} of {total}. The player is paused here.</p>
          <p className={styles['prompt']} aria-live="polite">{question.prompt}</p>
          <Answer key={question.index} {...props} question={question} />
          {player.held ? <p className="muted small">Answer this question, or press Show me, to go on.</p> : null}
          <div className={styles['actions']}>
            {wrong >= 2 ? <button type="button" onClick={onShow}>Show me</button> : null}
          </div>
        </div>
      ) : (
        <div className={styles['questionDone']}>
          {finished
            ? <p>Quiz complete: {tally.firstTry} of {total} right on the first try. Retake to ask them again.</p>
            : total === 0
              ? <p>There is nothing to ask for these strings. Try longer ones, or ask about every cell.</p>
              : <p>The player stops at each question. Press Step or Play to reach the next one.</p>}
        </div>
      )}

      <p className={`${styles['feedback']} ${here ? styles[FEEDBACK_CLASS[here.tone]] : ''}`} role="status" aria-live="polite">
        {here ? here.message : ''}
      </p>
      <div className={styles['actions']}>
        {canContinue ? <button type="button" className="primary" ref={continueButton} onClick={player.forward}>Continue: step forward</button> : null}
        <button type="button" onClick={onRetake}>Retake</button>
      </div>
    </section>
  );
}

function Answer({ question, rows, cols, onNumber, onCell, onMove }: QuizPanelProps & { readonly question: Question }) {
  switch (question.kind) {
    case 'cell':
      return <CellAnswer rows={rows} cols={cols} onCell={onCell} />;
    case 'move':
      return (
        <div className={styles['moves']} role="group" aria-label="Choose the move">
          {DIRS.map((dir) => (
            <button key={dir} type="button" onClick={() => onMove(dir)}>
              <span aria-hidden="true">{DIR_MARK[dir]} </span>{DIR_NAME[dir]}{dir === 'diag' ? ' (keep or substitute)' : dir === 'left' ? ' (insert)' : ' (delete)'}
            </button>
          ))}
        </div>
      );
    default:
      return <NumberAnswer onNumber={onNumber} />;
  }
}

function NumberAnswer({ onNumber }: { readonly onNumber: (text: string) => void }) {
  const [text, setText] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onNumber(text);
    box.current?.select();
  };
  return (
    <form className={styles['answerRow']} onSubmit={submit}>
      <Field label="Your answer">
        {(props) => <input {...props} ref={box} type="text" inputMode="numeric" autoComplete="off" value={text} onChange={(event) => setText(event.target.value)} />}
      </Field>
      <button type="submit" className="primary">Check</button>
    </form>
  );
}

function CellAnswer({ rows, cols, onCell }: { readonly rows: number; readonly cols: number; readonly onCell: (row: string, col: string) => void }) {
  const [row, setRow] = useState('');
  const [col, setCol] = useState('');
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onCell(row, col);
  };
  return (
    <form className={styles['answerRow']} onSubmit={submit}>
      <p className="muted small" style={{ flexBasis: '100%', margin: 0 }}>Click the cell in the table, or type its row and column.</p>
      <Field label={`Row (0 to ${rows - 1})`}>
        {(props) => <input {...props} type="text" inputMode="numeric" autoComplete="off" value={row} onChange={(event) => setRow(event.target.value)} />}
      </Field>
      <Field label={`Column (0 to ${cols - 1})`}>
        {(props) => <input {...props} type="text" inputMode="numeric" autoComplete="off" value={col} onChange={(event) => setCol(event.target.value)} />}
      </Field>
      <button type="submit" className="primary">Check</button>
    </form>
  );
}
