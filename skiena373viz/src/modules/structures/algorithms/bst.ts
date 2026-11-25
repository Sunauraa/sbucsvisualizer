/**
 * Binary search tree (no balancing): search, insert and delete, one trace for a whole list of
 * operations. Node ids are stable: a key keeps its id for as long as it lives in the tree, so a
 * renderer can follow a node from frame to frame. When a node with two children is deleted, its
 * in-order successor is lifted out (the `held` field), then put in the deleted node's place.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder, Tone } from '@core';
import { newLog, pluralize, describeOperation } from './operations';
import type { KeyedOperation, OperationLog } from './operations';

export type BstOpKind = 'insert' | 'delete' | 'search';
export type BstOperation = KeyedOperation<BstOpKind>;

export interface BstInput {
  /** Keys inserted, in this order and without being traced, before the first operation. */
  readonly start: readonly number[];
  readonly operations: readonly BstOperation[];
}

export interface BstNodeState {
  readonly id: string;
  readonly key: number;
  readonly left: string | null;
  readonly right: string | null;
}

export type DeleteCase = 'leaf' | 'one-child' | 'two-children';

export interface BstState {
  /** Every node in the tree, in key order. A lifted-out successor is in `held`, not here. */
  readonly nodes: readonly BstNodeState[];
  readonly root: string | null;
  /** The successor while it is out of the tree (two-children delete), otherwise null. */
  readonly held: { readonly id: string; readonly key: number } | null;
  /** Tone of each highlighted node id. */
  readonly marks: Readonly<Record<string, Tone>>;
  /** Ids of nodes whose link to their parent was just assigned. */
  readonly changedLinks: readonly string[];
  /** Number of nodes, and height in edges (null for the empty tree). */
  readonly n: number;
  readonly height: number | null;
  /** Which kind of delete the current operation turned out to be. */
  readonly deleteCase: DeleteCase | null;
  readonly log: OperationLog;
}

export interface BstResult {
  /** Final keys in order. */
  readonly keys: readonly number[];
  readonly outcomes: readonly string[];
  readonly height: number | null;
}

const PSEUDOCODE = definePseudocode([
  ['dispatch', 0, 'for each operation (insert, delete or search) with its key'],
  ['start', 1, 'x = root, parent = none'],
  ['compare', 1, 'while x exists: compare key with x.key'],
  ['go-left', 2, 'key < x.key: parent = x, x = x.left'],
  ['go-right', 2, 'key > x.key: parent = x, x = x.right'],
  ['hit', 2, 'key = x.key: stop, x is the match'],
  ['miss', 1, 'x does not exist: the key is absent'],
  ['insert-link', 2, 'insert, key absent: link a new node under parent'],
  ['insert-dup', 2, 'insert, key present: change nothing'],
  ['delete-leaf', 2, 'delete, no children: parent drops x'],
  ['delete-one', 2, 'delete, one child c: parent points to c instead of x'],
  ['delete-two-find', 2, 'delete, two children: s = leftmost node under x.right'],
  ['delete-two-lift', 3, 'lift s out: s.parent points to s.right'],
  ['delete-two-place', 3, 'put s where x was, with x.left and x.right'],
  ['done', 0, 'every operation has run'],
]);

const OPS = defineOps([
  {
    id: 'comparisons',
    label: 'Key comparisons',
    counts: 'One three-way comparison (less, equal, greater) of the operation key with a visited node key. The walk to a successor compares no keys.',
  },
  { id: 'link-changes', label: 'Link changes', counts: 'One each time a child pointer, or the root pointer, is assigned.' },
]);

type T = Recorder<BstState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;
type Side = 'left' | 'right';
interface Node {
  readonly id: string;
  readonly key: number;
  left: Node | null;
  right: Node | null;
}

function inorder(root: Node | null): Node[] {
  const out: Node[] = [];
  const stack: Node[] = [];
  let x = root;
  while (x !== null || stack.length > 0) {
    while (x !== null) {
      stack.push(x);
      x = x.left;
    }
    const top = stack.pop();
    if (top === undefined) break;
    out.push(top);
    x = top.right;
  }
  return out;
}

/** Height in edges; null for the empty tree. */
function heightOf(root: Node | null): number | null {
  if (root === null) return null;
  let best = 0;
  let level: Node[] = [root];
  while (level.length > 0) {
    const next: Node[] = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    if (next.length > 0) best += 1;
    level = next;
  }
  return best;
}

export const bst = defineAlgorithm({
  id: 'structures-bst',
  title: 'Binary search tree',
  summary: 'Search, insert and delete on an unbalanced binary search tree, with the three delete cases.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'worst case, one operation on a tree of height h', bound: 'Θ(h)', why: 'the walk visits one node per level, and some key forces it to the deepest level.' },
    { resource: 'time', when: 'balanced shape (h = ⌊lg n⌋)', bound: 'Θ(log n)', why: 'a tree of n nodes has height at least ⌊lg n⌋, and the best shape reaches it.' },
    { resource: 'time', when: 'degenerate shape (sorted insertions, h = n − 1)', bound: 'Θ(n)', why: 'every node has one child, so the tree is a list and the walk visits up to n nodes.' },
    { resource: 'space', when: 'every case', bound: 'Θ(n)', why: 'one node per stored key; the iterative walk keeps only x and parent.' },
  ],
  presets: [
    {
      id: 'textbook',
      label: 'A mixed sequence: search, insert, three kinds of delete',
      input: {
        start: [50, 30, 70, 20, 40, 60, 80],
        operations: [
          { kind: 'search', key: 60 }, { kind: 'insert', key: 65 }, { kind: 'delete', key: 20 },
          { kind: 'delete', key: 30 }, { kind: 'delete', key: 50 },
        ],
      },
    },
    {
      id: 'successor-is-right-child',
      label: 'Delete a root whose successor is its right child',
      input: { start: [50, 30, 70, 20, 40, 80], operations: [{ kind: 'delete', key: 50 }, { kind: 'delete', key: 70 }] },
    },
    {
      id: 'successor-has-right-child',
      label: 'Delete a node whose successor is deeper and has a right child',
      input: { start: [50, 30, 80, 60, 90, 55, 70, 65, 75], operations: [{ kind: 'delete', key: 50 }] },
    },
    {
      id: 'sorted',
      label: 'Sorted insertions: the tree becomes a list',
      input: { start: [], operations: [1, 2, 3, 4, 5, 6, 7].map((key): BstOperation => ({ kind: 'insert', key })) },
    },
    {
      id: 'missing-and-duplicate',
      label: 'Duplicate insert and a missing delete',
      input: {
        start: [8, 4, 12],
        operations: [{ kind: 'insert', key: 4 }, { kind: 'delete', key: 5 }, { kind: 'search', key: 12 }, { kind: 'search', key: 3 }],
      },
    },
    { id: 'empty', label: 'Empty tree', input: { start: [], operations: [{ kind: 'search', key: 5 }, { kind: 'delete', key: 5 }, { kind: 'insert', key: 5 }] } },
  ],
  execute({ start, operations }: BstInput, t: T): Finished<BstResult> {
    // The root lives in a holder, because assignments inside closures are invisible to type narrowing.
    const tree: { root: Node | null } = { root: null };
    let counter = 0;
    const make = (key: number): Node => {
      counter += 1;
      return { id: `n${counter}`, key, left: null, right: null };
    };
    const insertQuietly = (key: number): boolean => {
      if (tree.root === null) {
        tree.root = make(key);
        return true;
      }
      let x: Node = tree.root;
      for (;;) {
        if (key === x.key) return false;
        const side: Side = key < x.key ? 'left' : 'right';
        const next: Node | null = x[side];
        if (next === null) {
          x[side] = make(key);
          return true;
        }
        x = next;
      }
    };
    const ignored: number[] = [];
    for (const key of start) if (!insertQuietly(key)) ignored.push(key);

    const { texts, outcomes } = newLog(operations);
    let current: number | null = null;
    let held: Node | null = null;
    let deleteCase: DeleteCase | null = null;
    let changed: readonly Node[] = [];
    // Highlights are built only when a frame is recorded, so 'counts' mode stays cheap.
    let marks: () => Record<string, Tone> = () => ({});

    const state = (): BstState => {
      const list = inorder(tree.root);
      return {
        nodes: list.map((node) => ({ id: node.id, key: node.key, left: node.left?.id ?? null, right: node.right?.id ?? null })),
        root: tree.root?.id ?? null,
        held: held ? { id: held.id, key: held.key } : null,
        marks: marks(),
        changedLinks: changed.map((node) => node.id),
        n: list.length,
        height: heightOf(tree.root),
        deleteCase,
        log: { texts, outcomes: [...outcomes], current },
      };
    };
    const show = (focus: readonly [Node, Tone][], path: readonly Node[] = []): void => {
      const nodes = [...path];
      const picked = [...focus];
      marks = () => {
        const out: Record<string, Tone> = {};
        for (const node of nodes) out[node.id] = 'visited';
        for (const [node, tone] of picked) out[node.id] = tone;
        return out;
      };
    };

    const total = operations.length;
    const setup = start.length === 0
      ? 'The tree starts empty'
      : `The tree starts with ${pluralize(start.length - ignored.length, 'key')} inserted in the order given${ignored.length > 0 ? ` (duplicates ignored: ${ignored.join(', ')})` : ''}`;
    t.step({
      lines: ['dispatch'],
      say: total === 0 ? `${setup}, and there are no operations to run.` : `${setup}, and then ${pluralize(total, 'operation')} run.`,
      state,
    });

    for (let i = 0; i < total; i += 1) {
      const op = operations[i];
      if (!op) continue;
      const { key } = op;
      current = i;
      held = null;
      deleteCase = null;
      changed = [];
      show([]);
      t.step({
        lines: ['dispatch', 'start'],
        say: `Operation ${i + 1} of ${total} is ${describeOperation(op)}, and the walk begins at the root.`,
        state,
      });

      // The walk: one three-way comparison per visited node.
      let x: Node | null = tree.root;
      let parent: Node | null = null;
      let side: Side | null = null;
      const path: Node[] = [];
      while (x !== null) {
        const here: Node = x;
        t.count('comparisons');
        t.event('compare', [`node:${here.id}`], `${key} vs ${here.key}`);
        if (key === here.key) {
          if (op.kind === 'search') {
            outcomes[i] = 'found';
            show([[here, 'done']], path);
            t.step({ lines: ['compare', 'hit'], say: `Key ${key} equals the key of this node, so the search succeeds.`, state });
          } else {
            show([[here, 'target']], path);
            t.step({
              lines: ['compare', 'hit'],
              say: op.kind === 'insert'
                ? `Key ${key} equals the key of this node, so the key is already stored.`
                : `Key ${key} equals the key of this node, so this is the node to delete.`,
              state,
            });
          }
          break;
        }
        const goLeft = key < here.key;
        const next: Node | null = goLeft ? here.left : here.right;
        show([[here, 'compare']], path);
        t.step({
          lines: ['compare', goLeft ? 'go-left' : 'go-right'],
          say: `Key ${key} is ${goLeft ? 'less' : 'greater'} than ${here.key}, so go ${goLeft ? 'left' : 'right'}${next === null ? ` (there is no ${goLeft ? 'left' : 'right'} child)` : ''}.`,
          state,
        });
        path.push(here);
        parent = here;
        side = goLeft ? 'left' : 'right';
        x = next;
      }

      if (x === null) {
        // Absent.
        if (op.kind === 'insert') {
          const fresh = make(key);
          if (parent === null || side === null) tree.root = fresh;
          else parent[side] = fresh;
          t.count('link-changes');
          t.event('insert', [`key:${key}`]);
          outcomes[i] = 'inserted';
          changed = [fresh];
          show([[fresh, 'active']], path);
          t.step({
            lines: ['insert-link'],
            say: parent === null || side === null
              ? `The tree is empty, so key ${key} becomes the root.`
              : `Key ${key} is absent, so a new node is linked as the ${side} child of ${parent.key}.`,
            state,
          });
        } else {
          outcomes[i] = op.kind === 'search' ? 'not found' : 'not found, unchanged';
          show([], path);
          t.step({
            lines: ['miss'],
            say: `${path.length === 0 ? 'The tree is empty' : 'The walk reached an empty spot'}, so ${key} is not in the tree${op.kind === 'delete' ? ' and there is nothing to delete' : ''}.`,
            state,
          });
        }
        continue;
      }

      const z: Node = x;
      if (op.kind === 'search') continue;
      if (op.kind === 'insert') {
        outcomes[i] = 'duplicate, unchanged';
        show([[z, 'target']], path);
        t.step({ lines: ['insert-dup'], say: `Insert ${key} changes nothing, because the tree stores each key once.`, state });
        continue;
      }

      // Delete z. `relink` assigns the pointer that used to lead to z.
      const relink = (to: Node | null): void => {
        if (parent === null || side === null) tree.root = to;
        else parent[side] = to;
        t.count('link-changes');
      };
      if (z.left === null && z.right === null) {
        deleteCase = 'leaf';
        relink(null);
        t.event('remove', [`key:${key}`]);
        outcomes[i] = 'deleted (leaf)';
        show(parent ? [[parent, 'swap']] : [], path);
        t.step({
          lines: ['delete-leaf'],
          say: parent === null
            ? `${key} is a leaf and the root, so the root pointer is cleared and the tree becomes empty.`
            : `${key} is a leaf, so its parent ${parent.key} drops it and the node disappears.`,
          state,
        });
      } else if (z.left === null || z.right === null) {
        deleteCase = 'one-child';
        const child: Node = z.left ?? z.right ?? z;
        const childSide = z.left === null ? 'right' : 'left';
        relink(child);
        t.event('remove', [`key:${key}`]);
        outcomes[i] = 'deleted (one child)';
        changed = [child];
        show([[child, 'active']], path);
        t.step({
          lines: ['delete-one'],
          say: `${key} has only a ${childSide} child, ${child.key}, so ${parent === null ? 'the root pointer' : `its parent ${parent.key}`} now points straight to ${child.key} and ${key} disappears.`,
          state,
        });
      } else {
        deleteCase = 'two-children';
        // Find the successor: the leftmost node of the right subtree. No keys are compared here.
        let s: Node = z.right;
        let sParent: Node = z;
        const walked: Node[] = [];
        for (;;) {
          const upto = [...path, z, ...walked];
          show([[z, 'swap'], [s, s.left === null ? 'target' : 'compare']], upto);
          const first = walked.length === 0;
          t.step({
            lines: ['delete-two-find'],
            say: s.left === null
              ? `${first ? `${key} has two children, so look for its successor in the right subtree; ` : ''}${s.key} has no left child, so it is the successor, the smallest key above ${key}.`
              : `${first ? `${key} has two children, so look for its successor in the right subtree; ` : ''}${s.key} has a left child, ${s.left.key}, so the successor lies further left.`,
            state,
          });
          if (s.left === null) break;
          walked.push(s);
          sParent = s;
          s = s.left;
        }
        // Lift s out: its parent points to s.right.
        if (sParent === z) z.right = s.right;
        else sParent.left = s.right;
        t.count('link-changes');
        held = s;
        changed = s.right ? [s.right] : [];
        show([[z, 'swap']], [...path]);
        t.step({
          lines: ['delete-two-lift'],
          say: `Lift ${s.key} out of the tree: its parent ${sParent.key} now points to ${s.right ? s.right.key : 'nothing'}, and ${s.key} waits in transit.`,
          state,
        });
        // Put s where z was.
        s.left = z.left;
        s.right = z.right;
        relink(s);
        t.count('link-changes', 2);
        held = null;
        t.event('remove', [`key:${key}`]);
        outcomes[i] = 'deleted (two children)';
        changed = [s, ...(s.left ? [s.left] : []), ...(s.right ? [s.right] : [])];
        show([[s, 'active']], path);
        t.step({
          lines: ['delete-two-place'],
          say: `${s.key} takes the place of ${key} and adopts its children, and ${key} disappears.`,
          state,
        });
      }
    }

    current = null;
    held = null;
    deleteCase = null;
    changed = [];
    show([]);
    const keys = inorder(tree.root).map((node) => node.key);
    const height = heightOf(tree.root);
    return t.finish({
      lines: ['done'],
      say: total === 0
        ? 'There were no operations, so the tree is unchanged.'
        : keys.length === 0
          ? `All ${total} operations are done, and the tree is empty.`
          : `All ${total} operations are done, and the tree holds ${pluralize(keys.length, 'key')} with height ${height}.`,
      state,
      result: { keys, outcomes: outcomes.map((o) => o ?? ''), height },
    });
  },
});

// ---------------------------------------------------------------------------------------------
// Layout, shared by the renderer and its tests. A node's horizontal position is its rank in key
// order, so the picture is stable and left/right always mean smaller/larger.

export interface BstPlace {
  readonly slot: number;
  readonly depth: number;
}

export function bstPlaces(state: BstState): Readonly<Record<string, BstPlace>> {
  const slotOf = new Map(state.nodes.map((node, i) => [node.id, i]));
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  const places: Record<string, BstPlace> = {};
  const queue: [string, number][] = state.root === null ? [] : [[state.root, 0]];
  for (let head = 0; head < queue.length; head += 1) {
    const entry = queue[head];
    if (!entry) break;
    const [id, depth] = entry;
    const node = byId.get(id);
    if (!node) continue;
    places[id] = { slot: slotOf.get(id) ?? 0, depth };
    if (node.left) queue.push([node.left, depth + 1]);
    if (node.right) queue.push([node.right, depth + 1]);
  }
  return places;
}

/** The most nodes and levels any frame of a trace shows: the stage is sized once from these. */
export function bstExtent(frames: readonly { readonly state: BstState }[]): { readonly slots: number; readonly levels: number } {
  let slots = 1;
  let levels = 1;
  for (const { state } of frames) {
    slots = Math.max(slots, state.n);
    levels = Math.max(levels, (state.height ?? -1) + 1);
  }
  return { slots, levels };
}
