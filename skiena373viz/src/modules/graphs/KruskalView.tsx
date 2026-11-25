import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function KruskalView(props: ViewProps) {
  return <GraphPage kind="kruskal" {...props} />;
}
