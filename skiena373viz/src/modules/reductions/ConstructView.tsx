import { useMemo } from 'react';
import type { ViewProps } from '@core';
import { GrowthPanel } from '@ui';
import type { RendererProps } from '@ui';
import { threeSatToVertexCover } from './algorithms/construct';
import type { ConstructState } from './algorithms/construct';
import { experiments } from './algorithms/experiments';
import { formulaVariables } from './algorithms/formula';
import { FormulaField, useFormula } from './FormulaField';
import { ReductionPage } from './ReductionPage';
import { ReductionStage } from './ReductionStage';
import { SameFormulaLinks } from './SameFormulaLinks';
import { constructStage } from './stages';
import css from './reductions.module.css';

/** Renderer for one frame (also what the tests draw). Pointing is handled by the page around it. */
export function ConstructRenderer({ frame }: RendererProps<ConstructState>) {
  return <ReductionStage data={constructStage(frame.state)} graphTitle="Graph built so far" emptyText="Nothing built yet" />;
}

export default function ConstructView({ params, setParams }: ViewProps) {
  const input = useFormula(params);
  const { formula } = input;
  const trace = useMemo(() => threeSatToVertexCover.run(formula), [formula]);
  const n = formulaVariables(formula).length;
  const m = formula.clauses.length;
  return (
    <ReductionPage
      algorithm={threeSatToVertexCover}
      trace={trace}
      stageOf={constructStage}
      graphTitle="Graph built so far"
      legend={{ tones: ['active'], labels: { active: 'this step: built or counted just now' } }}
      legendNote="Squares are literal vertices, circles are the corners of clause triangles, dashed lines are cross edges. A dashed outline marks what stands for the thing you point at."
      inputs={<FormulaField state={input} onText={(text) => setParams({ f: text })} />}
      notes={({ frame, words }) => (
        <>
          {words}
          <section className="panel" aria-label="Sizes">
            <h3>Sizes</h3>
            <dl className={css['sizes']}>
              <div><dt>Variables n</dt><dd>{n}</dd></div>
              <div><dt>Clauses m</dt><dd>{m}</dd></div>
              <div><dt>Vertices 2n + 3m</dt><dd>{2 * n + 3 * m} <small>built {frame.ops['vertices']}</small></dd></div>
              <div><dt>Edges n + 6m</dt><dd>{n + 6 * m} <small>built {frame.ops['edges']}</small></dd></div>
              <div>
                <dt>Bound k = n + 2m</dt>
                <dd>{n + 2 * m} <small>{frame.state.kTerms.length > 0 ? `so far ${frame.state.kTerms.map((term) => term.value).join(' + ')} = ${frame.state.k}` : 'not assembled yet'}</small></dd>
              </div>
            </dl>
            {frame.state.kTerms.length > 0 ? (
              <ul className={css['list']}>
                {frame.state.kTerms.map((term, i) => <li key={i}>{term.label}: +{term.value}</li>)}
              </ul>
            ) : null}
          </section>
          <details className="panel">
            <summary>The graph so far, as text</summary>
            <p className="small"><strong>Vertices:</strong> {frame.state.nodes.map((node) => (node.kind === 'corner' ? `C${(node.clause ?? 0) + 1}.${(node.position ?? 0) + 1}(${node.label})` : node.label)).join(', ') || 'none'}</p>
            <p className="small"><strong>Edges:</strong> {frame.state.edges.map((edge) => `${edge.source} — ${edge.target}`).join(', ') || 'none'}</p>
          </details>
          <SameFormulaLinks text={input.text} current="construct" />
        </>
      )}
    >
      <GrowthPanel experiments={experiments} />
    </ReductionPage>
  );
}
