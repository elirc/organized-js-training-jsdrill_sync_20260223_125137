"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Category = {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");

  const load = () => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCategories(json.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        icon,
        sortOrder: categories.length + 1,
      }),
    });
    setName("");
    setDescription("");
    setIcon("");
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
          Categories ({categories.length})
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Category"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                id="name"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Strings"
              />
              <Input
                id="icon"
                label="Icon (emoji or text)"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g., Aa"
              />
            </div>
            <Textarea
              id="desc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <Button type="submit" size="sm">
              Create Category
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <Card key={cat.id} padding="sm" className="flex items-center gap-3">
            <span className="text-lg font-mono w-8 text-center">{cat.icon}</span>
            <div>
              <div className="text-sm font-medium text-gray-900">{cat.name}</div>
              <div className="text-xs text-gray-500">{cat.description}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
