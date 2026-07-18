// ─── Test Case Types ───
export type TestCase = {
  input: unknown[];
  expected: unknown;
  description: string;
  isEdgeCase: boolean;
};

// ─── Execution Types ───
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
  errorType: string | null;
};

// ─── FSRS Types ───
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

// ─── Session Types ───
export type SessionProblem = {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCases: TestCase[];
  tier: number;
  categoryId: string;
  categoryName: string;
  hints: string[];
  timeLimit: number;
  patterns: { id: string; name: string; slug: string }[];
  isReview: boolean;
};

export type Session = {
  problems: SessionProblem[];
  sessionSize: number;
  currentIndex: number;
};

// ─── Drill State ───
export type DrillPhase =
  | "approach"
  | "coding"
  | "running"
  | "results"
  | "post-solve";

// ─── API Response Types ───
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ─── Dashboard Types ───
export type CategoryProgress = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  currentTier: number;
  totalProblems: number;
  solvedProblems: number;
  averageStability: number;
};

export type PatternStrength = {
  patternId: string;
  patternName: string;
  patternSlug: string;
  totalProblems: number;
  solvedProblems: number;
  averageStability: number;
  strength: "none" | "weak" | "learning" | "strong";
};

export type DayActivity = {
  date: string;
  count: number;
};
