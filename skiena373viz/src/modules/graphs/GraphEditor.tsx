/** The graph editor shared by all six views: canvas (mouse, touch, keyboard), switches, presets and the graph as text. */
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { formatGraph, GRAPH_HEIGHT, GRAPH_WIDTH } from '@core';
import type { Preset } from '@core';
import { Field, toSvgPoint } from '@ui';
import { applyEdit, MAX_EDGES, MAX_VERTICES, modelFromText } from './algorithms/editor';
import type { EditAction, Focus } from './algorithms/editor';
import type { GraphInput } from './algorithms/types';
import { GraphCanvas } from './GraphCanvas';
import type { EdgeMark, VertexMark } from './GraphCanvas';
import styles from './graphs.module.css';

type Mode = 'select' | 'vertex' | 'edge' | 'delete';

const MODES: readonly { readonly id: Mode; readonly label: string; readonly hint: string }[] = [
  { id: 'select', label: 'Select / move', hint: 'Click a vertex or an edge to select it. Drag a vertex to move it, or focus it and use the arrow keys.' },
  { id: 'vertex', label: 'Add vertex', hint: 'Click empty space to add a vertex. The "Add vertex" button does the same without the mouse.' },
  { id: 'edge', label: 'Add edge', hint: 'Click a vertex, then the vertex it should connect to. Click the first vertex again to cancel.' },
  { id: 'delete', label: 'Delete', hint: 'Click a vertex or an edge to delete it, along with any edges that touch the vertex.' },
];

const KEY_STEP = 12;

export interface GraphEditorProps {
  readonly input: GraphInput;
  readonly onChange: (next: GraphInput) => void;
  readonly presets: readonly Preset<GraphInput>[];
  /** Whether the current algorithm uses a start vertex. */
  readonly usesStart: boolean;
  readonly needs: string;
}

export function GraphEditor({ input, onChange, presets, usesStart, needs }: GraphEditorProps) {
  const { graph } = input;
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>('select');
  const [pending, setPending] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [weightText, setWeightText] = useState<{ edge: string; text: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: string; pointerId: number; svg: SVGSVGElement; dx: number; dy: number } | null>(null);
  const latestPreview = useRef<{ id: string; x: number; y: number } | null>(null);
  const panelId = useId();
  const modeName = useId();

  const apply = (action: EditAction): void => {
    const outcome = applyEdit(input, action);
    setMessage(outcome.message ?? '');
    if (outcome.focus !== undefined) setFocus(outcome.focus);
    if (outcome.changed) {
      setDraft(null);
      setTextError(null);
      onChange(outcome.input);
    }
  };

  const commitMove = (): void => {
    const at = latestPreview.current;
    latestPreview.current = null;
    setPreview(null);
    if (at) apply({ type: 'move-vertex', id: at.id, x: at.x, y: at.y });
  };
  const commitLatest = useEffectEvent(commitMove);

  // Dragging with the mouse or a finger: listeners live on the window while a drag lasts.
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event: globalThis.PointerEvent): void => {
      const d = drag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      const point = toSvgPoint(d.svg, event.clientX, event.clientY);
      if (!point) return;
      const next = { id: d.id, x: point.x + d.dx, y: point.y + d.dy };
      latestPreview.current = next;
      setPreview(next);
    };
    const up = (event: globalThis.PointerEvent): void => {
      const d = drag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      drag.current = null;
      setDragging(false);
      commitLatest();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging]);

  // Arrow-key moves are collected and applied once the keys have been quiet for a moment.
  useEffect(() => {
    if (!preview || dragging) return undefined;
    const timer = setTimeout(commitLatest, 350);
    return () => clearTimeout(timer);
  }, [preview, dragging]);

  const shown = useMemo(() => (preview
    ? { ...graph, nodes: graph.nodes.map((n) => (n.id === preview.id ? { ...n, x: Math.round(preview.x), y: Math.round(preview.y) } : n)) }
    : graph), [graph, preview]);

  const selectedVertex = focus?.kind === 'vertex' && graph.nodes.some((n) => n.id === focus.id) ? focus.id : null;
  const selectedEdge = focus?.kind === 'edge' ? graph.edges.find((e) => e.id === focus.id) ?? null : null;
  const pendingSource = pending !== null && graph.nodes.some((n) => n.id === pending) ? pending : null;
  const label = (id: string): string => graph.nodes.find((n) => n.id === id)?.label ?? id;

  const vertices: Record<string, VertexMark> = {};
  for (const node of graph.nodes) {
    const isStart = usesStart && input.start === node.id;
    const tone = node.id === pendingSource ? 'compare' : node.id === selectedVertex ? 'active' : isStart ? 'target' : 'idle';
    const tag = node.id === pendingSource ? 'from' : node.id === selectedVertex ? 'selected' : isStart ? 'start' : undefined;
    vertices[node.id] = { tone, ...(tag ? { tag } : {}) };
  }
  const edges: Record<string, EdgeMark> = selectedEdge ? { [selectedEdge.id]: { tone: 'active', focus: true } } : {};

  const onVertex = (id: string): void => {
    if (mode === 'select' || mode === 'vertex') {
      setFocus({ kind: 'vertex', id });
      setMessage(`Selected vertex ${label(id)}.`);
    } else if (mode === 'delete') {
      apply({ type: 'delete-vertex', id });
    } else if (pendingSource === null) {
      setPending(id);
      setMessage(`Edge from ${label(id)}: now choose the vertex it goes to.`);
    } else if (pendingSource === id) {
      setPending(null);
      setMessage('Cancelled the new edge.');
    } else {
      setPending(null);
      apply({ type: 'add-edge', source: pendingSource, target: id });
    }
  };
  const onEdge = (id: string): void => {
    if (mode === 'delete') apply({ type: 'delete-edge', id });
    else {
      setFocus({ kind: 'edge', id });
      const edge = graph.edges.find((e) => e.id === id);
      setMessage(edge ? `Selected the edge ${label(edge.source)}${graph.directed ? '→' : '-'}${label(edge.target)}.` : '');
    }
  };
  const onBackground = (x: number, y: number): void => {
    if (mode === 'vertex') apply({ type: 'add-vertex', x, y });
    else {
      setFocus(null);
      setPending(null);
    }
  };
  const onVertexPointerDown = (id: string, event: PointerEvent<SVGGElement>): void => {
    if (mode !== 'select' || event.button !== 0) return;
    const svg = event.currentTarget.ownerSVGElement;
    const node = graph.nodes.find((n) => n.id === id);
    const point = svg ? toSvgPoint(svg, event.clientX, event.clientY) : null;
    if (!svg || !node || !point) return;
    drag.current = { id, pointerId: event.pointerId, svg, dx: node.x - point.x, dy: node.y - point.y };
    setDragging(true);
  };
  const onVertexKeyDown = (id: string, event: KeyboardEvent<SVGGElement>): void => {
    if (mode !== 'select') return;
    const step = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[event.key];
    if (!step || event.target !== event.currentTarget.querySelector('[role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    const from = latestPreview.current?.id === id ? latestPreview.current : node;
    const next = {
      id,
      x: Math.min(GRAPH_WIDTH - 30, Math.max(30, from.x + (step[0] ?? 0))),
      y: Math.min(GRAPH_HEIGHT - 30, Math.max(30, from.y + (step[1] ?? 0))),
    };
    latestPreview.current = next;
    setFocus({ kind: 'vertex', id });
    setPreview(next);
  };

  const text = draft ?? formatGraph(graph);
  const onText = (value: string): void => {
    setDraft(value);
    const parsed = modelFromText(value, input);
    if (!parsed.ok) {
      setTextError(parsed.message);
      return;
    }
    setTextError(null);
    setFocus(null);
    onChange(parsed.value);
  };

  const hint = MODES.find((m) => m.id === mode)?.hint ?? '';
  const weightValue = selectedEdge ? (weightText?.edge === selectedEdge.id ? weightText.text : String(selectedEdge.weight ?? '')) : '';

  return (
    <section aria-label="Graph editor">
      <div className={styles['editorHead']}>
        <h2>Graph</h2>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>{open ? 'Hide editor' : 'Show editor'}</button>
      </div>
      <p className={styles['needs']}>{needs}</p>
      <div id={panelId} className={styles['editor']} hidden={!open}>
        <div className={styles['canvasCol']}>
          <fieldset className={styles['modes']}>
            <legend>Editing mode</legend>
            {MODES.map((m) => (
              <label key={m.id} className={styles['mode']}>
                <input type="radio" name={modeName} value={m.id} checked={mode === m.id} onChange={() => { setMode(m.id); setPending(null); }} />
                <span>{m.label}</span>
              </label>
            ))}
          </fieldset>
          <GraphCanvas graph={shown} title="Graph editor canvas" vertices={vertices} edges={edges}
            onVertex={onVertex} onEdge={onEdge} onBackground={onBackground}
            onVertexPointerDown={mode === 'select' ? onVertexPointerDown : undefined} onVertexKeyDown={onVertexKeyDown}
            emptyText="Empty: choose Add vertex, then click here" />
          <p className={styles['hint']}>{hint}</p>
          <p className={styles['message']} role="status" aria-live="polite">{message}</p>
        </div>
        <div className={styles['sideCol']}>
          <div className={styles['switches']}>
            <label><input type="checkbox" checked={graph.directed} onChange={(e) => apply({ type: 'set-directed', directed: e.target.checked })} />Directed</label>
            <label><input type="checkbox" checked={graph.weighted} onChange={(e) => apply({ type: 'set-weighted', weighted: e.target.checked })} />Weighted</label>
          </div>
          <div className={styles['buttons']}>
            <button type="button" onClick={() => apply({ type: 'add-vertex' })}>Add vertex</button>
            <button type="button" onClick={() => apply({ type: 'layout' })}>Auto layout</button>
            <button type="button" onClick={() => { setFocus(null); setPending(null); apply({ type: 'clear' }); }}>Clear</button>
            {selectedVertex !== null ? (
              <>
                <button type="button" onClick={() => apply({ type: 'add-edge', source: selectedVertex, target: selectedVertex })}>Add self-loop at {label(selectedVertex)}</button>
                <button type="button" onClick={() => apply({ type: 'delete-vertex', id: selectedVertex })}>Delete {label(selectedVertex)}</button>
              </>
            ) : null}
            {selectedEdge ? <button type="button" onClick={() => apply({ type: 'delete-edge', id: selectedEdge.id })}>Delete this edge</button> : null}
          </div>
          <div className="field-row">
            <Field label="Example">
              {(props) => (
                <select {...props} value="" onChange={(event) => {
                  const preset = presets.find((p) => p.id === event.target.value);
                  if (!preset) return;
                  setFocus(null);
                  setPending(null);
                  setDraft(null);
                  setTextError(null);
                  setMessage(`Loaded: ${preset.label}.`);
                  onChange(preset.input);
                }}>
                  <option value="">Choose an example</option>
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              )}
            </Field>
            {usesStart ? (
              <Field label="Start vertex" hint={graph.nodes.length === 0 ? 'Add a vertex first' : undefined}>
                {(props) => (
                  <select {...props} value={input.start ?? ''} disabled={graph.nodes.length === 0}
                    onChange={(event) => apply({ type: 'set-start', id: event.target.value === '' ? null : event.target.value })}>
                    <option value="">First label (default)</option>
                    {graph.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                )}
              </Field>
            ) : null}
          </div>
          {selectedEdge && graph.weighted ? (
            <Field label={`Weight of ${label(selectedEdge.source)}${graph.directed ? '→' : '-'}${label(selectedEdge.target)}`} hint="A whole number from -999 to 999">
              {(props) => (
                <input {...props} type="text" inputMode="numeric" value={weightValue}
                  onChange={(event) => { setWeightText({ edge: selectedEdge.id, text: event.target.value }); apply({ type: 'set-weight', id: selectedEdge.id, text: event.target.value }); }}
                  onBlur={() => setWeightText(null)} />
              )}
            </Field>
          ) : null}
          <Field label="Graph as text" error={textError}
            hint={`Edges A-B (A>B when directed), weights A-B:4, a lone letter for a vertex. Up to ${MAX_VERTICES} vertices and ${MAX_EDGES} edges.`}>
            {(props) => (
              <textarea {...props} className={styles['text']} rows={3} spellCheck={false} autoCapitalize="characters" value={text}
                onChange={(event) => onText(event.target.value)}
                onBlur={() => { setDraft(null); setTextError(null); }} />
            )}
          </Field>
        </div>
      </div>
    </section>
  );
}
