// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRenderer } from '@ui/testing';
import { certificates } from './algorithms/certificates';
import { threeSatToVertexCover } from './algorithms/construct';
import { formatFormula, formulaFrom } from './algorithms/formula';
import CertificatesView, { CertificateRenderer } from './CertificatesView';
import ConstructView, { ConstructRenderer } from './ConstructView';
import DirectionView from './DirectionView';
import SolverView from './SolverView';
import manifest from './index';

afterEach(cleanup);

const noop = () => undefined;
const SAT = '(x1 | !x2 | x3) & (!x1 | x2 | x2)';
const UNSAT = '(x1 | x1 | x1) & (!x1 | !x1 | !x1)';

describe('renderers draw every frame of every preset without leaking raw values or moving the viewBox', () => {
  it.each(threeSatToVertexCover.presets.map((p) => [p.id, p.input] as const))('construct: %s', (_id, input) => {
    checkRenderer(ConstructRenderer, threeSatToVertexCover.run(input));
  });
  it.each(certificates.presets.map((p) => [p.id, p.input] as const))('certificates: %s', (_id, input) => {
    checkRenderer(CertificateRenderer, certificates.run(input));
  });
});

describe('construct view', () => {
  it('shows the formula and the graph side by side and starts at frame 0', () => {
    render(<ConstructView params={{ f: SAT }} setParams={noop} />);
    expect(screen.getByRole('region', { name: 'Formula' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Graph built so far: 0 vertices and 0 edges/ })).toBeInTheDocument();
    expect(screen.getByText(/The formula has 2 clauses over 3 variables/)).toBeInTheDocument();
  });

  it('stepping builds the graph: the first variable gadget adds two vertices and an edge', async () => {
    render(<ConstructView params={{ f: SAT }} setParams={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /Step forward|Step/ }));
    expect(screen.getByRole('img', { name: /2 vertices and 1 edges/ })).toBeInTheDocument();
    expect(screen.getByText(/Variable x1 gets the vertices x1 and ¬x1/)).toBeInTheDocument();
  });

  it('pointing at a literal outlines its corner, its literal vertex and the cross edge, and explains in words', async () => {
    const { container } = render(<ConstructView params={{ f: '(x1 | !x2 | x3)' }} setParams={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    const literal = screen.getByRole('button', { name: 'literal ¬x2, clause 1, position 2' });
    await userEvent.hover(literal);
    const linked = [...container.querySelectorAll('[data-linked="true"]')].map((el) => el.getAttribute('data-vertex') ?? el.getAttribute('data-edge'));
    expect(linked).toContain('c1.2');
    expect(linked).toContain('!x2');
    expect(linked).toContain('cross:1.2');
    expect(screen.getByText(/Literal ¬x2 at position 2 of clause C1 is corner 2/)).toBeInTheDocument();
    await userEvent.unhover(literal);
    expect(container.querySelectorAll('[data-linked="true"]')).toHaveLength(0);
  });

  it('keyboard focus does the same as hover, and Enter selects until cleared', async () => {
    const { container } = render(<ConstructView params={{ f: '(x1 | !x2 | x3)' }} setParams={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    const literal = screen.getByRole('button', { name: 'literal x3, clause 1, position 3' });
    act(() => literal.focus());
    expect(container.querySelector('[data-vertex="c1.3"]')).toHaveAttribute('data-linked', 'true');
    await userEvent.keyboard('{Enter}');
    expect(literal).toHaveAttribute('aria-pressed', 'true');
    act(() => literal.blur());
    expect(container.querySelector('[data-vertex="c1.3"]')).toHaveAttribute('data-linked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(container.querySelector('[data-vertex="c1.3"]')).not.toHaveAttribute('data-linked');
  });

  it('clicking a vertex selects it, and its formula counterpart is outlined', async () => {
    const { container } = render(<ConstructView params={{ f: '(x1 | !x2 | x3)' }} setParams={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    const vertex = container.querySelector('[data-vertex="x1"]');
    expect(vertex).not.toBeNull();
    fireEvent.click(vertex as Element);
    expect(screen.getByRole('button', { name: 'literal x1, clause 1, position 1' }).closest('button')).toHaveAttribute('data-linked', 'true');
  });

  it('explains a malformed formula with its position and keeps the last valid picture', () => {
    render(<ConstructView params={{ f: '(x1 | x2 |' }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Position 11');
    expect(screen.getByText(/still show the last valid formula/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Formula' })).toBeInTheDocument();
  });

  it('a short clause is explained and a button pads it', async () => {
    const setParams = vi.fn();
    render(<ConstructView params={{ f: '(x1 | x2 | x3) & (x1 | !x2)' }} setParams={setParams} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Clause 2 (starting at position 18) has two literals');
    await userEvent.click(screen.getByRole('button', { name: 'Pad clause 2' }));
    expect(setParams).toHaveBeenCalledWith({ f: '(x1 | x2 | x3) & (x1 | !x2 | !x2)' });
  });

  it('refuses four literals and too many variables with a message, not a crash', () => {
    const { rerender } = render(<ConstructView params={{ f: '(a | b | c | d)' }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('has four literals');
    rerender(<ConstructView params={{ f: '(a | b | c) & (d | e | f)' }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('uses 6 variables');
  });

  it('the empty formula shows a labelled empty state and an empty graph', () => {
    render(<ConstructView params={{ f: '' }} setParams={noop} />);
    expect(screen.getByText(/No clauses. The empty formula is satisfied/)).toBeInTheDocument();
    expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
  });

  it('writes the formula to the URL, and a preset replaces it', async () => {
    const setParams = vi.fn();
    render(<ConstructView params={{}} setParams={setParams} />);
    fireEvent.change(screen.getByLabelText('Formula (3-CNF)'), { target: { value: '(a | a | a)' } });
    expect(setParams).toHaveBeenLastCalledWith({ f: '(a | a | a)' });
    await userEvent.selectOptions(screen.getByLabelText('Try an example'), 'unsatisfiable');
    expect(setParams).toHaveBeenLastCalledWith({ f: UNSAT });
  });

  it('keyboard: arrows step the trace when no control has focus', async () => {
    render(<ConstructView params={{ f: SAT }} setParams={noop} />);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByText('3 / 18')).toBeInTheDocument();
    await userEvent.keyboard('{Home}');
    expect(screen.getByText('1 / 18')).toBeInTheDocument();
  });
});

describe('certificates view', () => {
  it('assignment to cover: toggling a variable writes the bit string and the live panel names the cover', async () => {
    const setParams = vi.fn();
    render(<CertificatesView params={{ f: SAT, a: '110' }} setParams={setParams} />);
    expect(screen.getByText('x1 = T, x2 = T, x3 = F')).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 clauses are satisfied/)).toBeInTheDocument();
    expect(screen.getByText(/Exactly k: a vertex cover of the required size/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'x2 true' }));
    expect(setParams).toHaveBeenLastCalledWith({ a: '100' });
  });

  it('the variable check boxes keep one fixed name whatever their value, and never say "is false" (R17)', () => {
    const { rerender } = render(<CertificatesView params={{ f: SAT, a: '110' }} setParams={noop} />);
    expect(screen.getByRole('checkbox', { name: 'x2 true' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'x3 true' })).not.toBeChecked();
    rerender(<CertificatesView params={{ f: SAT, a: '001' }} setParams={noop} />);
    expect(screen.getByRole('checkbox', { name: 'x2 true' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'x3 true' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /is false|is true/ })).toBeNull();
  });

  it('a wrong assignment fails at a named clause, and the cover attempt is too big', () => {
    render(<CertificatesView params={{ f: SAT, a: '100' }} setParams={noop} />);
    expect(screen.getByText(/1 of 2 clauses are satisfied/)).toBeInTheDocument();
    expect(screen.getByText(/Unsatisfied: C2 = \(¬x1 ∨ x2 ∨ x2\)/)).toBeInTheDocument();
    expect(screen.getByText(/k \+ 1 = 8/)).toBeInTheDocument();
  });

  it('cover to assignment: clicking a vertex toggles it in the URL and the report explains an uncovered edge', async () => {
    const setParams = vi.fn();
    const good = 'x1,x2,!x3,c1.2,c1.3,c2.1,c2.3';
    const { container } = render(<CertificatesView params={{ f: SAT, dir: 'cover', s: good }} setParams={setParams} />);
    expect(screen.getByText(/It induces|it induces x1 = T, x2 = T, x3 = F/)).toBeInTheDocument();
    expect(screen.getByText(/It satisfies all 2 clauses/)).toBeInTheDocument();
    const vertex = container.querySelector('[data-vertex="c2.3"]');
    fireEvent.click(vertex as Element);
    expect(setParams).toHaveBeenLastCalledWith({ s: 'x1,x2,!x3,c1.2,c1.3,c2.1' });
  });

  it('cover to assignment: vertices are keyboard operable buttons that say whether they are in the cover', async () => {
    const setParams = vi.fn();
    render(<CertificatesView params={{ f: SAT, dir: 'cover', s: 'x1' }} setParams={setParams} />);
    const inCover = screen.getByRole('button', { name: 'vertex x1, in the cover' });
    expect(inCover).toHaveAttribute('aria-pressed', 'true');
    const out = screen.getByRole('button', { name: 'vertex ¬x1, not in the cover' });
    act(() => out.focus());
    await userEvent.keyboard('{Enter}');
    expect(setParams).toHaveBeenLastCalledWith({ s: 'x1,!x1' });
  });

  it('cover to assignment: an incomplete cover lists the uncovered edges and says why there is no assignment', () => {
    render(<CertificatesView params={{ f: SAT, dir: 'cover', s: 'x1,x2' }} setParams={noop} />);
    expect(screen.getByText(/uncovered edges?:/)).toBeInTheDocument();
    expect(screen.getByText(/is not a vertex cover.*induces no assignment/)).toBeInTheDocument();
  });

  it('the unsatisfiable formula refuses every assignment', () => {
    render(<CertificatesView params={{ f: UNSAT, a: '1' }} setParams={noop} />);
    expect(screen.getByText(/1 of 2 clauses are satisfied/)).toBeInTheDocument();
    expect(screen.getByText(/First satisfying/)).toBeDisabled();
  });

  it('the trace plays: the last frame of a valid conversion says the cover has exactly k vertices', async () => {
    render(<CertificatesView params={{ f: SAT, a: '110' }} setParams={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(screen.getByText(/which equals k = 7/)).toBeInTheDocument();
  });
});

describe('solver view', () => {
  it('lists every assignment and says satisfiable or not', () => {
    render(<SolverView params={{ f: SAT }} setParams={noop} />);
    expect(screen.getByText(/Tried all/)).toHaveTextContent('= 8 assignments');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(9);
    expect(screen.getByText('satisfiable')).toBeInTheDocument();
  });

  it('unsatisfiable: every attempt is more than k, and a chosen assignment shows the failing clause', async () => {
    const setParams = vi.fn();
    render(<SolverView params={{ f: UNSAT }} setParams={setParams} />);
    expect(screen.getByText('unsatisfiable')).toBeInTheDocument();
    expect(screen.getByText(/more than k = 5, so no cover of size k comes from any assignment/)).toBeInTheDocument();
    expect(screen.getByText(/has no true literal, so all three corners/)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: 'Show' })[0] as HTMLElement);
    expect(setParams).toHaveBeenCalledWith({ a: '1' });
  });

  it('the empty formula has exactly one (empty) assignment', () => {
    render(<SolverView params={{ f: '' }} setParams={noop} />);
    expect(screen.getByText(/Tried all/)).toHaveTextContent('= 1 assignments');
  });
});

describe('the formula follows the learner through the shell tabs', () => {
  it('the manifest carries exactly the formula, not the view-specific keys', () => {
    expect(manifest.carryParams).toEqual(['f']);
  });

  it.each([
    ['construct', ConstructView],
    ['certificates', CertificatesView],
    ['solver', SolverView],
    ['direction', DirectionView],
  ] as const)('%s no longer renders its own row of "Keep this formula" links', (_id, View) => {
    render(<View params={{ f: SAT }} setParams={noop} />);
    expect(screen.queryByText(/Keep this formula/)).toBeNull();
    expect(screen.queryByRole('navigation', { name: /Same formula/ })).toBeNull();
  });
});

describe('direction view', () => {
  it('says why a fast Vertex Cover algorithm would decide 3-SAT: polynomial construction that keeps the answer', () => {
    render(<DirectionView params={{}} setParams={noop} />);
    const paragraph = screen.getByText(/The construction only reads the shape of the formula/);
    expect(paragraph).toHaveTextContent('polynomial time');
    expect(paragraph).toHaveTextContent('keeps the yes/no answer');
    expect(paragraph).not.toHaveTextContent('never asks');
  });

  it('shows three questions; a wrong answer is explained, the right one is confirmed', async () => {
    render(<DirectionView params={{}} setParams={noop} />);
    expect(screen.getAllByRole('group').filter((group) => /Question/.test(group.textContent ?? ''))).toHaveLength(3);
    const first = screen.getAllByRole('group')[0] as HTMLElement;
    await userEvent.click(within(first).getByRole('radio', { name: '3-SAT is at least as hard as Vertex Cover.' }));
    expect(within(first).getByText(/Not quite/)).toBeInTheDocument();
    expect(within(first).getByText(/The right answer is: Vertex Cover is at least as hard as 3-SAT/)).toBeInTheDocument();
    await userEvent.click(within(first).getByRole('radio', { name: 'Vertex Cover is at least as hard as 3-SAT.' }));
    expect(within(first).getByText(/Correct/)).toBeInTheDocument();
  });
});

it('every preset formula survives its own text', () => {
  for (const preset of threeSatToVertexCover.presets) {
    expect(formulaFrom(formatFormula(preset.input))).toEqual(preset.input);
  }
});
