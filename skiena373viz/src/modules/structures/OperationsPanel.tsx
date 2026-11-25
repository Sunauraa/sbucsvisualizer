import { useEffect, useRef } from 'react';
import type { OperationLog } from './algorithms/operations';
import css from './structures.module.css';

/** The operation list with the one being run marked, and the outcome of each finished one. */
export function OperationsPanel({ log }: { readonly log: OperationLog }) {
  const box = useRef<HTMLOListElement>(null);
  const { current } = log;
  useEffect(() => {
    const list = box.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="step"]');
    // Scroll only the list itself, never the page.
    if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.clientHeight / 2);
  }, [current]);
  return (
    <section className="panel" aria-label="Operations">
      <h3>Operations</h3>
      {log.texts.length === 0 ? (
        <p className="muted">No operations yet: add some above.</p>
      ) : (
        <ol ref={box} className={css['opsList']}>
          {log.texts.map((text, i) => (
            <li key={i} aria-current={log.current === i ? 'step' : undefined}>
              <span className={css['opNumber']}>{i + 1}.</span>
              <span className={css['opText']}>{text}</span>
              <span className={css['opOutcome']}>{log.outcomes[i] ?? (log.current === i ? 'running' : 'waiting')}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
