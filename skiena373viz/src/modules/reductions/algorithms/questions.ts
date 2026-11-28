/** The self-check questions of the "which way does it go?" view. Plain data, so a test can check each has one right answer. */

export interface QuestionOption {
  readonly id: string;
  readonly text: string;
  readonly correct: boolean;
  /** Said when this option is chosen, right or wrong. */
  readonly why: string;
}

export interface Question {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly QuestionOption[];
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'what-it-shows',
    prompt: 'You have a polynomial-time reduction from 3-SAT to Vertex Cover. What does it show?',
    options: [
      {
        id: 'vc-at-least-as-hard', correct: true, text: 'Vertex Cover is at least as hard as 3-SAT.',
        why: 'A fast Vertex Cover algorithm would decide 3-SAT quickly too: build the graph, ask the algorithm whether a cover of size k exists, and copy the answer.',
      },
      {
        id: 'sat-at-least-as-hard', correct: false, text: '3-SAT is at least as hard as Vertex Cover.',
        why: 'That is the claim a reduction in the other direction, from Vertex Cover to 3-SAT, would make. Here the formula is translated into a graph, never the reverse.',
      },
      {
        id: 'vc-in-np', correct: false, text: 'Vertex Cover is in NP.',
        why: 'Membership in NP is a separate fact with a separate proof: a short certificate, the chosen vertices, that can be checked in polynomial time. A reduction says nothing about it.',
      },
      {
        id: 'vc-needs-exponential', correct: false, text: 'Vertex Cover cannot be solved in polynomial time.',
        why: 'A reduction transfers difficulty; it does not create it. It shows that Vertex Cover is hard if 3-SAT is, and nobody has proved that 3-SAT needs more than polynomial time (that is P versus NP).',
      },
    ],
  },
  {
    id: 'which-direction',
    prompt: 'You know 3-SAT is NP-hard and you want to show a new problem X is NP-hard. Which reduction do you build?',
    options: [
      {
        id: 'x-to-sat', correct: false, text: 'From X to 3-SAT: translate every instance of X into a formula.',
        why: 'That shows X is no harder than 3-SAT, which is an upper bound. It cannot show X is hard: a trivial problem reduces to 3-SAT as well.',
      },
      {
        id: 'sat-to-x', correct: true, text: 'From 3-SAT to X: translate every formula into an instance of X.',
        why: 'Then a fast algorithm for X would give a fast algorithm for 3-SAT, so X is at least as hard as the known hard problem. This is exactly what the graph construction does for Vertex Cover.',
      },
      {
        id: 'either', correct: false, text: 'Either one, the two directions prove the same thing.',
        why: 'The directions prove different things. Only a reduction from the known hard problem into the new one transfers hardness to the new problem.',
      },
    ],
  },
  {
    id: 'membership',
    prompt: 'Where does "Vertex Cover is in NP" come from?',
    options: [
      {
        id: 'from-reduction', correct: false, text: 'From the reduction from 3-SAT.',
        why: 'The reduction gives hardness. It cannot give membership: many problems that are far harder than NP also have reductions from 3-SAT.',
      },
      {
        id: 'from-certificate', correct: true, text: 'From a short certificate, a set of at most k vertices, that is checked in polynomial time.',
        why: 'The check is two steps: count the vertices and test that every edge has an endpoint in the set. Both take time proportional to the size of the graph.',
      },
      {
        id: 'from-sat', correct: false, text: 'From 3-SAT being NP-complete.',
        why: 'Knowing that 3-SAT is in NP says nothing about Vertex Cover being in NP, unless you also reduce Vertex Cover to 3-SAT, which is a different, extra argument.',
      },
    ],
  },
];
