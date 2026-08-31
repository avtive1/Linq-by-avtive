import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonAuth } from "@/auth";
import { verifyPassword, registerUser, getAuthSessionPayloadByUserId } from "@/lib/auth-db";
import { createSessionToken, verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session-token";

const neonHandler = neonAuth.handler() as Record<string, any>;

async function resolveEndpoint(req: Request, props?: { params?: Promise<{ path?: string[] }> | { path?: string[] } }): Promise<string> {
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

async function parseRequestBody(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    try {
      const text = await req.text();
      return text ? (JSON.parse(text) as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
}

export async function GET(req: Request, props: { params: Promise<{ path?: string[] }> }) {
  const endpoint = await resolveEndpoint(req, props);

  if (endpoint === "get-session" || endpoint === "session") {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const verified = await verifySessionToken(token);
      if (verified?.userId) {
        const payload = await getAuthSessionPayloadByUserId(verified.userId);
        if (payload) {
          return NextResponse.json({
            data: {
              session: {
                id: verified.userId,
                userId: verified.userId,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              },
              user: {
                id: payload.userId,
                email: payload.email,
                name: payload.username || payload.email,
                role: payload.role || "user",
                organizationName: payload.organizationName || "",
              },
            },
          });
        }
      }
    }
  }

  try {
    return await neonHandler.GET(req, props);
  } catch {
    return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
  }
}

export async function POST(req: Request, props: { params: Promise<{ path?: string[] }> }) {
  const endpoint = await resolveEndpoint(req, props);

  if (endpoint === "sign-in/email" || endpoint === "signin/email" || endpoint === "sign-in") {
    try {
      const body = await parseRequestBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json(
          { error: { message: "Email and password are required." } },
          { status: 400 },
        );
      }

      const user = await verifyPassword(email, password);
      if (!user) {
        return NextResponse.json(
          { error: { message: "Incorrect email or password." } },
          { status: 401 },
        );
      }

      const token = await createSessionToken(user.user_id, user.email);
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });

      return NextResponse.json({
        data: {
          session: {
            id: user.user_id,
            userId: user.user_id,
            token,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          user: {
            id: user.user_id,
            email: user.email,
            name: user.username || user.email,
            role: user.role || "user",
            organizationName: user.organization_name || "",
          },
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      return NextResponse.json({ error: { message } }, { status: 500 });
    }
  }

  if (endpoint === "migrate-legacy-login") {
    try {
      const body = await parseRequestBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }

      const user = await verifyPassword(email, password);
      if (!user) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }

      return NextResponse.json({
        data: {
          canMigrate: true,
          name: user.username || user.email,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Migration failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (endpoint === "sign-up/email" || endpoint === "signup/email" || endpoint === "sign-up") {
    try {
      const body = await parseRequestBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || email.split("@")[0] || "User").trim();

      if (!email || !password) {
        return NextResponse.json(
          { error: { message: "Email and password are required." } },
          { status: 400 },
        );
      }

      const registered = await registerUser({
        email,
        password,
        username: name,
        organizationName: name,
      });

      const token = await createSessionToken(registered.userId, registered.email);
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });

      return NextResponse.json({
        data: {
          session: {
            id: registered.userId,
            userId: registered.userId,
            token,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          user: {
            id: registered.userId,
            email: registered.email,
            name: name || registered.email,
            role: "user",
            organizationName: name,
          },
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-up failed.";
      return NextResponse.json({ error: { message } }, { status: 400 });
    }
  }

  if (endpoint === "sign-out" || endpoint === "signout") {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    return NextResponse.json({ data: { success: true } });
  }

  try {
    return await neonHandler.POST(req, props);
  } catch {
    return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
  }
}

export const PUT = neonHandler.PUT;
export const DELETE = neonHandler.DELETE;
export const PATCH = neonHandler.PATCH;
