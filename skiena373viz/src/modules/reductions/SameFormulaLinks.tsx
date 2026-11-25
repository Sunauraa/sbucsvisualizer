/** Links to the other views that keep the formula, because the shell's own view tabs start from the default. */
const VIEWS: readonly (readonly [id: string, label: string])[] = [
  ['construct', 'Build the graph'],
  ['certificates', 'Certificates'],
  ['solver', 'Solver'],
  ['direction', 'Which way does it go?'],
];

export function SameFormulaLinks({ text, current }: { readonly text: string; readonly current: string }) {
  const query = new URLSearchParams({ f: text }).toString();
  return (
    <nav className="panel" aria-label="Same formula in other views">
      <h3>Keep this formula</h3>
      <p className="muted small">The tabs at the top start from the default formula. These links keep yours.</p>
      <ul className="legend" style={{ gap: '6px 16px' }}>
        {VIEWS.filter(([id]) => id !== current).map(([id, label]) => (
          <li key={id}><a href={`#/reductions/${id}?${query}`}>{label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
