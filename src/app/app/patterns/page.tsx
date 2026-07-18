"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";

type Pattern = {
  id: string;
  name: string;
  slug: string;
  description: string;
  explanation: string;
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selected, setSelected] = useState<Pattern | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patterns")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPatterns(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Patterns</h1>
      <p className="text-sm text-gray-600">
        Patterns are reusable problem-solving strategies. Recognizing patterns is
        the key to coding fluency.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patterns.map((pat) => (
          <Card
            key={pat.id}
            className={`cursor-pointer transition-all hover:border-indigo-300 ${
              selected?.id === pat.id ? "ring-2 ring-indigo-500" : ""
            }`}
            onClick={() => setSelected(selected?.id === pat.id ? null : pat)}
          >
            <h3 className="font-semibold text-gray-900">{pat.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{pat.description}</p>
            {selected?.id === pat.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {pat.explanation}
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
