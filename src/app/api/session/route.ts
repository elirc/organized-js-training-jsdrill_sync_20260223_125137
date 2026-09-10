import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/db";
import { buildSession } from "@/lib/session";
import type { SessionMode } from "@/types";

const MODES: SessionMode[] = ["mixed", "module", "track", "weak", "interview"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMode = searchParams.get("mode") ?? "mixed";
  const mode = (MODES as string[]).includes(rawMode) ? (rawMode as SessionMode) : "mixed";
  const size = Number.parseInt(searchParams.get("size") ?? "12", 10);

  try {
    const session = buildSession({
      userId: DEFAULT_USER_ID,
      mode,
      size: Number.isFinite(size) ? size : 12,
      moduleSlug: searchParams.get("module") ?? undefined,
      trackSlug: searchParams.get("track") ?? undefined,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error("Failed to build session:", error);
    return NextResponse.json(
      { success: false, error: "Could not build a session" },
      { status: 500 }
    );
  }
}
