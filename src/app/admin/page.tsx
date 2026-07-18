"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { tierLabel, tierColor } from "@/lib/utils";

type ProblemRow = {
  id: string;
  title: string;
  tier: number;
  categoryId: string;
  categoryName: string;
  authorId: string | null;
  isPublished: boolean;
  patternIds: string[];
};

export default function AdminProblemsPage() {
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProblems = () => {
    setLoading(true);
    fetch("/api/problems")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setProblems(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProblems();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/problems/${id}`, { method: "DELETE" });
      loadProblems();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Problems ({problems.length})
        </h1>
        <Link href="/admin/problems/new">
          <Button>+ New Problem</Button>
        </Link>
      </div>

      <div className="space-y-2">
        {problems.map((p) => (
          <Card key={p.id} padding="sm" className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${tierColor(p.tier)}`}
              >
                T{p.tier}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {p.title}
                </div>
                <div className="text-xs text-gray-500">
                  {p.categoryName}
                  {p.authorId === null ? "" : " · User-created"}
                  {!p.isPublished && " · Draft"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/admin/problems/${p.id}/edit`}>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(p.id, p.title)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
