import { useId } from 'react';
import type { ReactNode } from 'react';

/** A labelled control with a visible, announced error. Render the control from the given props. */
export function Field({ label, error, hint, children }: {
  readonly label: string;
  readonly error?: string | null;
  readonly hint?: string;
  readonly children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint ?? '';
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': note === '' ? undefined : noteId })}
      <p id={noteId} className={error ? 'field-error' : 'field-hint'} role={error ? 'alert' : undefined}>
        {error ? <span aria-hidden="true">⚠ </span> : null}{note}
      </p>
    </div>
  );
}

/** A calm, visible explanation: rejected input, truncated trace, or an aside. */
export function Notice({ tone = 'info', children }: { readonly tone?: 'info' | 'warning' | 'error'; readonly children: ReactNode }) {
  const name = { info: 'Note', warning: 'Careful', error: 'Problem' }[tone];
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'note'}><strong>{name}: </strong>{children}</div>;
}
