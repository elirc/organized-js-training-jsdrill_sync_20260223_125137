"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type ApproachPromptProps = {
  onSubmit: (text: string) => void;
};

export function ApproachPrompt({ onSubmit }: ApproachPromptProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim().length < 10) return;
    onSubmit(text.trim());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📝</span>
        <h3 className="text-sm font-semibold text-gray-700">
          What&apos;s your approach?
        </h3>
      </div>
      <p className="text-xs text-gray-500">
        In 1-2 sentences, describe how you plan to solve this. This builds the
        think-first habit that separates strong candidates in interviews.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="I'll iterate through the array and..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {text.trim().length < 10
            ? `${10 - text.trim().length} more characters needed`
            : "Ready to code"}
        </span>
        <Button
          onClick={handleSubmit}
          disabled={text.trim().length < 10}
          size="sm"
        >
          Unlock Editor →
        </Button>
      </div>
    </div>
  );
}
