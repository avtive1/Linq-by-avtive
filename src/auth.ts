import { cookies } from "next/headers";
import { getServerSession, type NextAuthOptions } from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword, getAuthSessionPayloadByUserId } from "@/lib/auth-db";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { resolveLinkedInternalUserIdFromClerk } from "@/lib/clerk-user-bridge";
import {
  consumeLoginOtp,
  isOrganizationAccountUser,
  isOrgLoginEmailOtpGloballyEnabled,
  verifyActiveLoginOtp,
} from "@/lib/auth-login-otp";
import { clearNextAuthSessionCookies, hasNextAuthSessionCookie } from "@/lib/next-auth-cookies";

export const authOptions: NextAuthOptions = {
  get secret() {
    return resolveAuthSecret();
  },
  logger: {
    error(code, metadata) {
      if (code === "JWT_SESSION_ERROR") return;
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "Verification code", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        const otp = String(credentials?.otp || "").trim();
        if (!email || !password) return null;

        const user = await verifyPassword(email, password);
        if (!user) return null;

        const requireEmailOtp =
          isOrgLoginEmailOtpGloballyEnabled() && (await isOrganizationAccountUser(user.user_id));
        if (requireEmailOtp) {
          if (!otp || !(await verifyActiveLoginOtp(user.user_id, otp))) return null;
          await consumeLoginOtp(user.user_id, otp);
        }

        return {
          id: user.user_id,
          email: user.email,
          name: user.username || user.email,
          role: user.role || "user",
          organizationName: user.organization_name || "",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role || "user";
        token.organizationName = (user as { organizationName?: string }).organizationName || "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid || "");
        session.user.role = String(token.role || "user");
        session.user.organizationName = String(token.organizationName || "");
      }
      return session;
    },
  },
};

export async function getServerAuthSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  const existingUserId = String(session?.user?.id || "").trim();
  if (existingUserId) return session;

  const cookieStore = await cookies();
  if (hasNextAuthSessionCookie(cookieStore)) {
    clearNextAuthSessionCookies(cookieStore);
  }

  try {
    const internalId = await resolveLinkedInternalUserIdFromClerk();
    if (!internalId) return session ?? null;

    const payload = await getAuthSessionPayloadByUserId(internalId);
    if (!payload) return session ?? null;

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      expires,
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.username || payload.email,
        role: payload.role,
        organizationName: payload.organizationName || "",
      },
    };
  } catch {
    return session ?? null;
  }
}
