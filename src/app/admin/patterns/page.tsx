"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Pattern = {
  id: string;
  name: string;
  slug: string;
  description: string;
  explanation: string;
};

export default function AdminPatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [explanation, setExplanation] = useState("");

  const load = () => {
    fetch("/api/patterns")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPatterns(json.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, explanation }),
    });
    setName("");
    setSlug("");
    setDescription("");
    setExplanation("");
    setShowForm(false);
    load();
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
          Patterns ({patterns.length})
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Pattern"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="name"
                label="Name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                placeholder="e.g., Sliding Window"
              />
              <Input
                id="slug"
                label="Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                placeholder="e.g., sliding-window"
              />
            </div>
            <Textarea
              id="desc"
              label="Short Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="One-line description of the pattern..."
            />
            <Textarea
              id="explanation"
              label="Full Explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={4}
              placeholder="Detailed explanation of when and how to use this pattern..."
            />
            <Button type="submit" size="sm">
              Create Pattern
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {patterns.map((pat) => (
          <Card key={pat.id} padding="sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {pat.name}
                </div>
                <div className="text-xs text-gray-400 font-mono">{pat.slug}</div>
                <div className="text-xs text-gray-600 mt-1">{pat.description}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
