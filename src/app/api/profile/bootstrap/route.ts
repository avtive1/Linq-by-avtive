import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    void req;
    return NextResponse.json(
      { error: "Profile bootstrap is disabled. Organization creation is restricted to super admin." },
      { status: 403 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
