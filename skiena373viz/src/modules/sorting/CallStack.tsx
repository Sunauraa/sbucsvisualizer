import type { CallNode } from './algorithms/common';
import css from './sorting.module.css';

/** The calls that are running now, outermost first. Reserves room for the deepest stack, so nothing jumps. */
export function CallStackPanel({ nodes, stack, rows }: { readonly nodes: readonly CallNode[]; readonly stack: readonly number[]; readonly rows: number }) {
  const open = stack.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CallNode => node !== undefined);
  return (
    <section className="panel" aria-label="Call stack">
      <h3>Call stack (outermost first)</h3>
      <ol className={css['stackList']} style={{ minHeight: `${Math.min(rows, 12) * 1.45 + 0.4}em` }}>
        {open.length === 0 ? <li>no call is running</li> : open.map((node) => (
          <li key={node.id}>A[{node.lo}..{node.hi - 1}] ({node.hi - node.lo} {node.hi - node.lo === 1 ? 'item' : 'items'})</li>
        ))}
      </ol>
      <p className={css['stateLine']}>Depth now: {open.length}</p>
    </section>
  );
}
