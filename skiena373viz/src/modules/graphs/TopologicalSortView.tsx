import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function TopologicalSortView(props: ViewProps) {
  return <GraphPage kind="topological-sort" {...props} />;
}
