import type { ViewProps } from '@core';
import GraphPage from './GraphPage';

export default function PrimView(props: ViewProps) {
  return <GraphPage kind="prim" {...props} />;
}
