"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SessionProgress } from "@/components/drill/SessionProgress";
import { ProblemCard } from "@/components/drill/ProblemCard";
import { ApproachPrompt } from "@/components/drill/ApproachPrompt";
import { CodeEditor } from "@/components/drill/CodeEditor";
import { TestResults } from "@/components/drill/TestResults";
import { PostSolve } from "@/components/drill/PostSolve";
import { executeUserCode } from "@/lib/executor";
import type { SessionProblem, ExecutionResult, DrillPhase } from "@/types";

export default function DrillPage() {
  const [problems, setProblems] = useState<SessionProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<DrillPhase>("approach");
  const [approachText, setApproachText] = useState("");
  const [code, setCode] = useState("");
  const [results, setResults] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [problemStartTime, setProblemStartTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentProblem = problems[currentIndex];

  const startSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/session?size=10");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setProblems(json.data);
        setCurrentIndex(0);
        setPhase("approach");
        setApproachText("");
        setCode(json.data[0].starterCode);
        setResults(null);
        setSessionComplete(false);
        setTimeElapsed(0);
        setProblemStartTime(Date.now());
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Timer
  useEffect(() => {
    if (phase === "coding" || phase === "approach") {
      timerRef.current = setInterval(() => {
        setTimeElapsed((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleApproachSubmit = (text: string) => {
    setApproachText(text);
    setPhase("coding");
  };

  const handleRunTests = () => {
    if (!currentProblem) return;
    const executionResults = executeUserCode(code, currentProblem.testCases);
    setResults(executionResults);
    setPhase("results");
  };

  const handleSubmit = async () => {
    if (!currentProblem || !results) return;

    const timeSpent = Math.floor((Date.now() - problemStartTime) / 1000);

    // Record attempt via API
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: currentProblem.id,
          code,
          approachText,
          passed: results.allPassed,
          timeSpent,
          timedMode: false,
          errorType: results.errorType,
        }),
      });
    } catch (err) {
      console.error("Failed to record attempt:", err);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("post-solve");
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= problems.length) {
      setSessionComplete(true);
      return;
    }

    setCurrentIndex(nextIndex);
    setPhase("approach");
    setApproachText("");
    setCode(problems[nextIndex].starterCode);
    setResults(null);
    setTimeElapsed(0);
    setProblemStartTime(Date.now());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500">Building your session...</p>
        </div>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card padding="lg" className="text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            No problems available
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            There are no problems to practice right now. Add some via the Admin
            panel or check back later.
          </p>
          <Button onClick={startSession}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card padding="lg" className="text-center max-w-md">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Session Complete!
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            You finished {problems.length} problems. Check your dashboard to see
            your progress.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={startSession}>New Session</Button>
            <Button
              variant="secondary"
              onClick={() => (window.location.href = "/app/dashboard")}
            >
              View Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session progress bar */}
      <SessionProgress
        current={currentIndex + (phase === "post-solve" ? 1 : 0)}
        total={problems.length}
        timeElapsed={timeElapsed}
      />

      {/* Problem card */}
      <Card>
        <ProblemCard problem={currentProblem} />
      </Card>

      {/* Approach phase */}
      {phase === "approach" && (
        <Card>
          <ApproachPrompt onSubmit={handleApproachSubmit} />
        </Card>
      )}

      {/* Coding phase */}
      {(phase === "coding" || phase === "results") && (
        <div className="space-y-4">
          <Card padding="none">
            <CodeEditor
              initialCode={code}
              onChange={setCode}
            />
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={handleRunTests}>
              Run Tests
            </Button>
            {results && (
              <Button onClick={handleSubmit}>
                Submit
              </Button>
            )}
          </div>

          {/* Test results */}
          {results && (
            <Card>
              <TestResults results={results} />
            </Card>
          )}
        </div>
      )}

      {/* Post-solve phase */}
      {phase === "post-solve" && results && (
        <Card>
          <PostSolve
            problem={currentProblem}
            results={results}
            approachText={approachText}
            timeSpent={Math.floor((Date.now() - problemStartTime) / 1000)}
            onNext={handleNext}
            isLastProblem={currentIndex === problems.length - 1}
          />
        </Card>
      )}
    </div>
  );
}
