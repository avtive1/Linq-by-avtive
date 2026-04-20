import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { username?: string };
    const nextUsername = String(body?.username || "").trim().toLowerCase();

    if (!nextUsername) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }
    if (nextUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (!USERNAME_REGEX.test(nextUsername)) {
      return NextResponse.json({ error: "Use letters, numbers, underscore, or dot only." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      },
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();
    const userId = session.user.id;

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", nextUsername)
      .neq("id", userId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ username: nextUsername })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ data: { username: nextUsername } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update username." }, { status: 500 });
  }
}
