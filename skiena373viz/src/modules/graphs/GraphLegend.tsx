/** The key under the stage: what each tone means for this algorithm, and what each edge style means. */
import { TONES } from '@core';
import { Legend } from '@ui';
import { ROLE_STYLE } from './marks';
import type { KindConfig } from './kinds';
import type { EdgeRole } from './algorithms/types';
import styles from './graphs.module.css';

const SAMPLES: Readonly<Record<KindConfig['edgeKey'], readonly { readonly role: EdgeRole; readonly text: string }[]>> = {
  tree: [{ role: 'tree', text: 'tree edge (solid)' }],
  classes: [
    { role: 'tree', text: 'tree edge (solid)' },
    { role: 'back', text: 'back edge (dashed)' },
    { role: 'forward', text: 'forward edge (dotted), directed only' },
    { role: 'cross', text: 'cross edge (dash-dot), directed only' },
  ],
  cycle: [
    { role: 'tree', text: 'tree edge (solid)' },
    { role: 'cycle', text: 'edge on the cycle that stops the run (dashed)' },
  ],
  forest: [
    { role: 'tree', text: 'kept edge (solid)' },
    { role: 'rejected', text: 'rejected edge (dashed)' },
  ],
};

export function GraphLegend({ config }: { readonly config: KindConfig }) {
  return (
    <div>
      <Legend tones={config.tones} labels={config.toneLabels} />
      <ul className={styles['edgeKey']} aria-label="Edge styles">
        {SAMPLES[config.edgeKey].map(({ role, text }) => {
          const style = ROLE_STYLE[role];
          return (
            <li key={role}>
              <svg width="40" height="10" aria-hidden="true" focusable="false">
                <line x1="1" y1="5" x2="39" y2="5" stroke={TONES[style.tone].color} strokeWidth="3.5" strokeDasharray={style.dash} />
              </svg>
              {text}
            </li>
          );
        })}
      </ul>
      <p className={styles['needs']}>
        {config.kind === 'bfs' ? 'L2 under a vertex is its level.' : null}
        {config.kind === 'dfs' || config.kind === 'topological-sort' ? '3/8 under a vertex is its entry and exit time (– while still open).' : null}
        {config.kind === 'prim' ? 'k=4 under a vertex is its key: the lightest edge found so far that joins it to the tree.' : null}
        {config.kind === 'dijkstra' ? 'd=7 under a vertex is its distance from the start (∞ until a route is found).' : null}
        {config.kind === 'kruskal' ? '{A} under a vertex names its set: the label of the set’s root.' : null}
      </p>
    </div>
  );
}
