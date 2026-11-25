import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function BfsView(props: ViewProps) {
  return <GraphPage kind="bfs" {...props} />;
}
