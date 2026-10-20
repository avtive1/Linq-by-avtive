import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session-token";

async function resolveEndpoint(
  req: Request,
  props?: { params?: Promise<{ path?: string[] }> | { path?: string[] } },
): Promise<string> {
  try {
    const paramsObj = await Promise.resolve(props?.params);
    if (paramsObj?.path && Array.isArray(paramsObj.path) && paramsObj.path.length > 0) {
      return paramsObj.path.join("/");
    }
  } catch {}

  try {
    const pathname = new URL(req.url).pathname;
    return pathname.replace(/^\/api\/auth\/?/, "").replace(/\/$/, "");
  } catch {
    return "";
  }
}

export async function GET(req: Request, props: { params: Promise<{ path?: string[] }> }) {
  const endpoint = await resolveEndpoint(req, props);

  if (endpoint === "get-session" || endpoint === "session") {
    const session = await getServerAuthSession();
    if (session) {
      return NextResponse.json({
        data: {
          session: {
            id: session.user.id,
            userId: session.user.id,
            expiresAt: session.expires,
          },
          user: session.user,
        },
      });
    }
    return NextResponse.json({ data: null });
  }

  if (endpoint === "sign-out" || endpoint === "signout") {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {}
    const response = NextResponse.json({ data: { success: true } });
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }

  return NextResponse.json({ data: null }, { status: 200 });
}

export async function POST(req: Request, props: { params: Promise<{ path?: string[] }> }) {
  const endpoint = await resolveEndpoint(req, props);

  if (endpoint === "sign-out" || endpoint === "signout") {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {}
    const response = NextResponse.json({ data: { success: true } });
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }

  return NextResponse.json({ data: null }, { status: 200 });
}
