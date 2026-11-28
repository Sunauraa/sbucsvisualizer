/** One page for all six algorithms: editor, stage, player, structure panel, growth plot. */
import { useMemo } from 'react';
import { frameAt } from '@core';
import type { ViewProps } from '@core';
import { GrowthPanel, Notice, Workbench } from '@ui';
import { applyEdit } from './algorithms/editor';
import type { EditAction } from './algorithms/editor';
import type { AlgoKind, GraphInput } from './algorithms/types';
import { GraphEditor } from './GraphEditor';
import { GraphLegend } from './GraphLegend';
import { GraphRenderer } from './GraphRenderer';
import { growthFor, KINDS } from './kinds';
import { slotsFor, StructurePanel } from './StructurePanel';
import { useGraphModel } from './useGraphModel';
import styles from './graphs.module.css';

const EMPTY: GraphInput = { graph: { directed: false, weighted: false, nodes: [], edges: [] }, start: null };

export default function GraphPage({ kind, params, setParams }: ViewProps & { readonly kind: AlgoKind }) {
  const config = KINDS[kind];
  const fallback = config.algorithm.presets[0]?.input ?? EMPTY;
  const { model, setModel, linkError } = useGraphModel(params, setParams, fallback);
  const trace = useMemo(() => config.algorithm.run(model), [config, model]);
  const slots = useMemo(() => slotsFor(trace.frames), [trace]);
  const experiments = useMemo(() => growthFor(kind), [kind]);
  const refused = trace.status === 'rejected';
  const fixes = refused ? config.fixes(model) : [];
  const reason = refused ? frameAt(trace.frames, trace.frames.length - 1).explanation : '';
  const fix = (action: EditAction): void => setModel(applyEdit(model, action).input);

  return (
    <Workbench
      algorithm={config.algorithm}
      trace={trace}
      Renderer={GraphRenderer}
      legend={<GraphLegend config={config} />}
      inputs={
        <>
          {linkError ? <Notice tone="warning">{linkError} Showing the last graph that could be read.</Notice> : null}
          {refused ? (
            <Notice tone="warning">
              <strong>This run is refused.</strong> {reason}
              {fixes.length > 0 ? (
                <span className={styles['fixes']}>
                  {fixes.map((f) => <button key={f.label} type="button" onClick={() => fix(f.action)}>{f.label}</button>)}
                </span>
              ) : null}
            </Notice>
          ) : null}
          <GraphEditor input={model} onChange={setModel} presets={config.algorithm.presets} usesStart={config.usesStart} needs={config.needs} />
        </>
      }
      aside={({ frame }) => <StructurePanel state={frame.state} slots={slots} />}
    >
      <GrowthPanel experiments={experiments} />
    </Workbench>
  );
}
