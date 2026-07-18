import { NextResponse } from "next/server";
import { buildSession } from "@/lib/sessionBuilder";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get("size") || "10", 10);
  const clampedSize = Math.max(1, Math.min(size, 20));

  try {
    const problems = await buildSession(clampedSize);
    return NextResponse.json({ success: true, data: problems });
  } catch (error) {
    console.error("Session build error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to build session" },
      { status: 500 }
    );
  }
}
