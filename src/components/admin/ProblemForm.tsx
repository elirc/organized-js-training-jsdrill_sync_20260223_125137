"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import type { TestCase } from "@/types";

type Category = { id: string; name: string };
type Pattern = { id: string; name: string; slug: string };

type ProblemFormProps = {
  initialData?: {
    id?: string;
    title: string;
    description: string;
    starterCode: string;
    solutionCode: string;
    testCases: TestCase[];
    tier: number;
    categoryId: string;
    hints: string[];
    timeLimit: number;
    patternIds: string[];
  };
  mode: "create" | "edit";
};

export function ProblemForm({ initialData, mode }: ProblemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [starterCode, setStarterCode] = useState(initialData?.starterCode || "function solution() {\n  // your code here\n}");
  const [solutionCode, setSolutionCode] = useState(initialData?.solutionCode || "");
  const [tier, setTier] = useState(initialData?.tier || 1);
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 300);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(initialData?.patternIds || []);
  const [hints, setHints] = useState<string[]>(initialData?.hints || [""]);
  const [testCases, setTestCases] = useState<TestCase[]>(
    initialData?.testCases || [
      { input: [], expected: null, description: "", isEdgeCase: false },
    ]
  );
  const [testCasesJson, setTestCasesJson] = useState(
    JSON.stringify(initialData?.testCases || [], null, 2)
  );
  const [useJsonEditor, setUseJsonEditor] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/patterns").then((r) => r.json()),
    ]).then(([catRes, patRes]) => {
      if (catRes.success) {
        setCategories(catRes.data);
        if (!categoryId && catRes.data.length > 0) {
          setCategoryId(catRes.data[0].id);
        }
      }
      if (patRes.success) setPatterns(patRes.data);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let finalTestCases = testCases;
    if (useJsonEditor) {
      try {
        finalTestCases = JSON.parse(testCasesJson);
      } catch {
        alert("Invalid JSON in test cases");
        setSaving(false);
        return;
      }
    }

    const body = {
      title,
      description,
      starterCode,
      solutionCode,
      testCases: finalTestCases,
      tier,
      categoryId,
      hints: hints.filter((h) => h.trim()),
      timeLimit,
      patternIds: selectedPatterns,
    };

    try {
      const url =
        mode === "create"
          ? "/api/problems"
          : `/api/problems/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        router.push("/admin");
      } else {
        alert(json.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save problem");
    }
    setSaving(false);
  };

  const togglePattern = (patternId: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(patternId)
        ? prev.filter((id) => id !== patternId)
        : [...prev, patternId]
    );
  };

  const addHint = () => setHints([...hints, ""]);
  const removeHint = (i: number) => setHints(hints.filter((_, idx) => idx !== i));
  const updateHint = (i: number, val: string) => {
    const updated = [...hints];
    updated[i] = val;
    setHints(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title & Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g., Reverse a String"
        />
        <Select
          id="category"
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      {/* Tier & Time Limit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          id="tier"
          label="Tier"
          value={tier}
          onChange={(e) => setTier(Number(e.target.value))}
          options={[
            { value: 1, label: "T1 — Foundation" },
            { value: 2, label: "T2 — Combination" },
            { value: 3, label: "T3 — Edge-Aware" },
            { value: 4, label: "T4 — Multi-Step" },
            { value: 5, label: "T5 — Interview-Ready" },
          ]}
        />
        <Input
          id="timeLimit"
          label="Time Limit (seconds)"
          type="number"
          value={timeLimit}
          onChange={(e) => setTimeLimit(Number(e.target.value))}
          min={60}
          max={900}
        />
      </div>

      {/* Description */}
      <Textarea
        id="description"
        label="Problem Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={6}
        required
        placeholder="Describe the problem, including examples..."
      />

      {/* Starter Code */}
      <Textarea
        id="starterCode"
        label="Starter Code"
        value={starterCode}
        onChange={(e) => setStarterCode(e.target.value)}
        rows={4}
        className="font-mono text-sm"
        placeholder="function solution(input) {&#10;  // your code here&#10;}"
      />

      {/* Solution Code */}
      <Textarea
        id="solutionCode"
        label="Solution Code (reference)"
        value={solutionCode}
        onChange={(e) => setSolutionCode(e.target.value)}
        rows={6}
        className="font-mono text-sm"
        placeholder="function solution(input) {&#10;  // reference solution&#10;}"
      />

      {/* Test Cases */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Test Cases</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUseJsonEditor(!useJsonEditor)}
          >
            {useJsonEditor ? "Form Editor" : "JSON Editor"}
          </Button>
        </div>

        {useJsonEditor ? (
          <Textarea
            value={testCasesJson}
            onChange={(e) => setTestCasesJson(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            placeholder='[{"input": [arg1, arg2], "expected": result, "description": "test name", "isEdgeCase": false}]'
          />
        ) : (
          <div className="space-y-4">
            {testCases.map((tc, i) => (
              <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Test Case {i + 1}
                  </span>
                  {testCases.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTestCases(testCases.filter((_, idx) => idx !== i))
                      }
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Description (e.g., 'handles empty array')"
                  value={tc.description}
                  onChange={(e) => {
                    const updated = [...testCases];
                    updated[i] = { ...tc, description: e.target.value };
                    setTestCases(updated);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder='Input args as JSON array, e.g. [[1,2,3]]'
                    value={JSON.stringify(tc.input)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        const updated = [...testCases];
                        updated[i] = { ...tc, input: parsed };
                        setTestCases(updated);
                      } catch {
                        // Let them type
                      }
                    }}
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Expected output as JSON, e.g. 42"
                    value={JSON.stringify(tc.expected)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        const updated = [...testCases];
                        updated[i] = { ...tc, expected: parsed };
                        setTestCases(updated);
                      } catch {
                        // Let them type
                      }
                    }}
                    className="font-mono text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={tc.isEdgeCase}
                    onChange={(e) => {
                      const updated = [...testCases];
                      updated[i] = { ...tc, isEdgeCase: e.target.checked };
                      setTestCases(updated);
                    }}
                  />
                  Edge case
                </label>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setTestCases([
                  ...testCases,
                  { input: [], expected: null, description: "", isEdgeCase: false },
                ])
              }
            >
              + Add Test Case
            </Button>
          </div>
        )}
      </Card>

      {/* Hints */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Hints</h3>
        <div className="space-y-2">
          {hints.map((hint, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={hint}
                onChange={(e) => updateHint(i, e.target.value)}
                placeholder={`Hint ${i + 1}`}
                className="flex-1"
              />
              {hints.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeHint(i)}
                  className="text-xs text-red-500 hover:text-red-700 px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addHint}>
            + Add Hint
          </Button>
        </div>
      </Card>

      {/* Patterns */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Patterns (select 1-2)
        </h3>
        <div className="flex flex-wrap gap-2">
          {patterns.map((pat) => (
            <button
              key={pat.id}
              type="button"
              onClick={() => togglePattern(pat.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                selectedPatterns.includes(pat.id)
                  ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {pat.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create Problem"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
