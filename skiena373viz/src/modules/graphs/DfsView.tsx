import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function DfsView(props: ViewProps) {
  return <GraphPage kind="dfs" {...props} />;
}
