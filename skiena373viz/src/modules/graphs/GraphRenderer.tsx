/** The stage: the graph as one frame shows it, with the frame's key facts underneath. A pure function of one frame. */
import type { RendererProps } from '@ui';
import type { GraphState } from './algorithms/types';
import { GraphCanvas } from './GraphCanvas';
import { edgeMarks, vertexMarks } from './marks';
import styles from './graphs.module.css';

const TITLES: Readonly<Record<GraphState['kind'], string>> = {
  bfs: 'Breadth-first search', dfs: 'Depth-first search', 'topological-sort': 'Topological sort', prim: "Prim's algorithm",
  kruskal: "Kruskal's algorithm", dijkstra: "Dijkstra's algorithm",
};

export function GraphRenderer({ frame }: RendererProps<GraphState>) {
  const state = frame.state;
  const focus = state.focusVertex === null ? '' : `, working on ${state.vertices.find((v) => v.id === state.focusVertex)?.label ?? ''}`;
  return (
    <>
      <GraphCanvas graph={state.graph} title={`${TITLES[state.kind]}, step ${frame.index + 1}${focus}`}
        vertices={vertexMarks(state)} edges={edgeMarks(state)} />
      <dl className={styles['facts']}>
        {state.facts.map((fact) => (
          <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        ))}
      </dl>
    </>
  );
}
