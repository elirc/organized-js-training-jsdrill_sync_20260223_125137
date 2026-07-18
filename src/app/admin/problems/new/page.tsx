"use client";

import { ProblemForm } from "@/components/admin/ProblemForm";

export default function NewProblemPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Problem</h1>
      <ProblemForm mode="create" />
    </div>
  );
}
