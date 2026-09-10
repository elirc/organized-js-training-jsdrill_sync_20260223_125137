// ─────────────────────────────────────────────────────────────
// Content model
// ─────────────────────────────────────────────────────────────

/** Every drill item is one of these shapes. */
export type ItemType =
  | "mcq" // single correct choice
  | "multi" // several correct choices
  | "predict" // "what does this print?" — free text, normalised compare
  | "fill" // fill the ___ blanks in a snippet, in order
  | "order" // put the steps in the right order
  | "code" // write JS, run against test cases
  | "explain"; // say it out loud — keyword-scored, then self-rated

export type Language = "js" | "ts" | "jsx" | "tsx" | "csharp" | "sql" | "bash" | "json" | "http" | "text";

/** Roughly where an item sits on the noob → mid-level ramp. */
export type Level = "foundation" | "working" | "professional";

export type TestCase = {
  /** Arguments applied to the entry function. Omit when using `call`. */
  input?: unknown[];
  /**
   * Body of a driver function receiving the entry point as `fn`, for exercises
   * whose result isn't a plain return value — a factory returning an object of
   * methods, or a wrapper you have to invoke twice. Takes precedence over
   * `input`.
   */
  call?: string;
  expected: unknown;
  description: string;
  isEdgeCase: boolean;
};

export type Track = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string; // tailwind-ish token, see lib/theme
  sortOrder: number;
};

export type Module = {
  id: string;
  trackId: string;
  name: string;
  slug: string;
  summary: string;
  level: Level;
  /** The 4–8 things a mid-level dev is expected to be able to say about this. */
  keyPoints: string[];
  /** What an interviewer is really probing for here. */
  interviewAngle: string;
  sortOrder: number;
};

export type Item = {
  id: string;
  moduleId: string;
  trackId: string;
  type: ItemType;
  /** 1 = foundation, 2 = working, 3 = professional */
  difficulty: 1 | 2 | 3;
  /** 1 = niche, 2 = common, 3 = asked constantly */
  frequency: 1 | 2 | 3;
  tags: string[];
  prompt: string;
  code: string;
  language: Language;
  choices: string[];
  /**
   * mcq   → number (index)
   * multi → number[] (indices)
   * predict → string (canonical output)
   * fill  → string[] (blanks, in order)
   * order → number[] (choices in correct order)
   * code / explain → unused
   */
  answer: unknown;
  explanation: string;
  /** The question the interviewer asks next if you get it right. */
  followUp: string;
  /** explain-type: concepts a good answer touches. */
  keywords: string[];
  modelAnswer: string;
  starterCode: string;
  solutionCode: string;
  testCases: TestCase[];
  estSeconds: number;
  sortOrder: number;
};

/** An item plus the context the drill UI needs to render it. */
export type DrillItem = Item & {
  trackName: string;
  trackSlug: string;
  trackAccent: string;
  moduleName: string;
  moduleSlug: string;
  isReview: boolean;
  /** ISO date this card is next due, if it has been seen. */
  due: string | null;
  reps: number;
};

// ─────────────────────────────────────────────────────────────
// Answering + grading
// ─────────────────────────────────────────────────────────────

/** Whatever the learner produced, in a shape the grader understands. */
export type Response =
  | { kind: "choice"; index: number }
  | { kind: "choices"; indices: number[] }
  | { kind: "text"; text: string }
  | { kind: "blanks"; blanks: string[] }
  | { kind: "order"; order: number[] }
  | { kind: "code"; code: string }
  | { kind: "selfRated"; text: string; rating: Rating };

export type Verdict = "correct" | "partial" | "incorrect";

export type Grade = {
  verdict: Verdict;
  /** 0..1 — partial credit for multi / fill / order / explain. */
  score: number;
  /** Per-part correctness, for highlighting which blank or choice was wrong. */
  detail: boolean[];
  /** explain-type: which key concepts were hit and missed. */
  hits: string[];
  misses: string[];
  /** code-type: individual test outcomes. */
  tests: TestResult[];
  message: string;
};

export type TestResult = {
  passed: boolean;
  result?: unknown;
  expected?: unknown;
  error?: string;
  testCase: TestCase;
};

export type ExecutionResult = {
  allPassed: boolean;
  results: TestResult[];
  logs: string[];
  errorType: string | null;
};

// ─────────────────────────────────────────────────────────────
// Scheduling
// ─────────────────────────────────────────────────────────────

/** FSRS ratings. */
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

export type SessionMode = "mixed" | "module" | "track" | "weak" | "interview";

export type SessionMeta = {
  mode: SessionMode;
  /** How the queue was assembled, for the UI to explain itself. */
  reviewCount: number;
  newCount: number;
  label: string;
};

export type DrillSession = {
  items: DrillItem[];
  meta: SessionMeta;
};

// ─────────────────────────────────────────────────────────────
// Progress
// ─────────────────────────────────────────────────────────────

export type ModuleProgress = {
  moduleId: string;
  moduleName: string;
  moduleSlug: string;
  trackId: string;
  trackSlug: string;
  level: Level;
  sortOrder: number;
  totalItems: number;
  seenItems: number;
  /** 0..1 — weighted by FSRS stability, so it decays if you stop reviewing. */
  mastery: number;
  dueItems: number;
  status: "locked" | "available" | "in-progress" | "mastered";
};

export type TrackProgress = {
  trackId: string;
  trackName: string;
  trackSlug: string;
  icon: string;
  accent: string;
  tagline: string;
  totalItems: number;
  seenItems: number;
  mastery: number;
  dueItems: number;
  modules: ModuleProgress[];
};

export type DayActivity = { date: string; count: number; correct: number };

export type WeakSpot = {
  tag: string;
  attempts: number;
  correct: number;
  accuracy: number;
  trackSlug: string;
  trackName: string;
};

export type DashboardData = {
  tracks: TrackProgress[];
  activity: DayActivity[];
  weakSpots: WeakSpot[];
  stats: {
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    itemsSeen: number;
    itemsTotal: number;
    dueToday: number;
    streak: number;
    minutesPracticed: number;
    /** Overall readiness 0..1 across the whole roadmap. */
    readiness: number;
  };
  recentInterviews: InterviewSummary[];
};

export type InterviewSummary = {
  id: string;
  createdAt: string;
  trackSlugs: string[];
  total: number;
  correct: number;
  score: number;
  durationSeconds: number;
};

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
