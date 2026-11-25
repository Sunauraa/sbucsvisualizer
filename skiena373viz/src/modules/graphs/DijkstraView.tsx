import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function DijkstraView(props: ViewProps) {
  return <GraphPage kind="dijkstra" {...props} />;
}
