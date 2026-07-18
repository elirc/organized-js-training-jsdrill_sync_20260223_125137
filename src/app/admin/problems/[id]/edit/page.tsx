"use client";

import { useState, useEffect, use } from "react";
import { ProblemForm } from "@/components/admin/ProblemForm";
import { Card } from "@/components/ui/Card";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditProblemPage({ params }: PageProps) {
  const { id } = use(params);
  const [problemData, setProblemData] = useState<{
    id: string;
    title: string;
    description: string;
    starterCode: string;
    solutionCode: string;
    testCases: { input: unknown[]; expected: unknown; description: string; isEdgeCase: boolean }[];
    tier: number;
    categoryId: string;
    hints: string[];
    timeLimit: number;
    patternIds: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/problems/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setProblemData(json.data);
        } else {
          setError(json.error || "Problem not found");
        }
      })
      .catch(() => setError("Failed to load problem"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !problemData) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-red-600">{error || "Problem not found"}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Problem</h1>
      <ProblemForm mode="edit" initialData={problemData} />
    </div>
  );
}
