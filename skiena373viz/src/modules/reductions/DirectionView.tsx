import { useState } from 'react';
import type { ViewProps } from '@core';
import { QUESTIONS } from './algorithms/questions';
import type { Question } from './algorithms/questions';
import { useFormula } from './FormulaField';
import { SameFormulaLinks } from './SameFormulaLinks';
import css from './reductions.module.css';

function QuestionCard({ question, number }: { readonly question: Question; readonly number: number }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const option = question.options.find((candidate) => candidate.id === chosen);
  const right = question.options.find((candidate) => candidate.correct);
  return (
    <fieldset className={css['question']}>
      <legend>Question {number}</legend>
      <p><strong>{question.prompt}</strong></p>
      {question.options.map((candidate) => (
        <label key={candidate.id}>
          <input type="radio" name={question.id} checked={chosen === candidate.id} onChange={() => setChosen(candidate.id)} />
          <span>{candidate.text}</span>
        </label>
      ))}
      <div aria-live="polite">
        {option ? (
          <p className={`${css['explain']} ${option.correct ? '' : css['explainBad']}`}>
            <strong>{option.correct ? '✓ Correct. ' : '✗ Not quite. '}</strong>
            {option.why}
            {option.correct || !right ? '' : ` The right answer is: ${right.text} ${right.why}`}
          </p>
        ) : null}
      </div>
      {chosen !== null ? <button type="button" onClick={() => setChosen(null)}>Try again</button> : null}
    </fieldset>
  );
}

export default function DirectionView({ params }: ViewProps) {
  const input = useFormula(params);
  return (
    <div className={css['page']}>
      <div className={css['prose']}>
        <h2>Which way does the reduction go?</h2>
        <p>
          A reduction from problem A to problem B, written A ≤<sub>p</sub> B, is a polynomial-time translation of every instance of A into an instance of B with the same yes or no
          answer. If you can solve B fast, translating and solving solves A fast. So B is <strong>at least as hard as</strong> A.
        </p>
        <p>
          Here A is 3-SAT and B is Vertex Cover: a formula becomes a graph G and a number k, and the formula is satisfiable exactly when G has a vertex cover with at most k
          vertices. The picture to keep is the arrow: <strong>the known hard problem goes in, the new problem comes out</strong>.
        </p>

        <h3>Three separate jobs</h3>
        <div className={css['compare']}>
          <div>
            <h3>1. Hardness</h3>
            <p>Reduce a known NP-hard problem <em>to</em> the new one. Here: 3-SAT ≤<sub>p</sub> Vertex Cover, so Vertex Cover is NP-hard.</p>
          </div>
          <div>
            <h3>2. Membership in NP</h3>
            <p>
              Show that a yes answer has a short certificate that is checked in polynomial time. Here the certificate is a set of at most k vertices, and the check is: count
              them, and test every edge for an endpoint in the set.
            </p>
          </div>
          <div>
            <h3>3. Both together</h3>
            <p>A problem that is in NP and NP-hard is NP-complete. Vertex Cover is, because 1 and 2 both hold.</p>
          </div>
        </div>

        <h3>What the other direction would and would not show</h3>
        <p>
          A reduction from Vertex Cover <em>to</em> 3-SAT would show that 3-SAT is at least as hard as Vertex Cover, which is an upper bound on Vertex Cover&apos;s difficulty, not
          a lower bound. Such a reduction exists, and it is useful: it tells you how to solve Vertex Cover with a 3-SAT solver. But it cannot prove Vertex Cover is hard,
          because a very easy problem reduces to 3-SAT too. To prove a new problem hard you always reduce <em>from</em> a problem you already know is hard.
        </p>

        <h3>What a correct reduction must do</h3>
        <ol>
          <li>Run in polynomial time. Here it builds 2n + 3m vertices and n + 6m edges from n variables and m clauses.</li>
          <li>Carry yes to yes. A satisfying assignment becomes a cover of size k (Certificates view, assignment to cover).</li>
          <li>Carry yes back. A cover of size at most k becomes a satisfying assignment (cover to assignment). Without this half, a graph with a small cover might come from a formula nobody can satisfy.</li>
        </ol>
        <p>
          The construction never asks whether the formula is satisfiable; it only reads the shape of the formula. That is why a fast Vertex Cover algorithm would decide
          satisfiability: all the work of finding the answer is left to it.
        </p>

        <h3>Check yourself</h3>
        {QUESTIONS.map((question, i) => <QuestionCard key={question.id} question={question} number={i + 1} />)}
      </div>
      <SameFormulaLinks text={input.text} current="direction" />
    </div>
  );
}
