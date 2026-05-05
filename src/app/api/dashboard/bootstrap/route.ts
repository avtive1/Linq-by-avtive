import { NextResponse } from "next/server";

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

async function safeFetchJson<T>(url: string, cookieHeader: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const payload = (await res.json().catch(() => null)) as
      | { data?: T; error?: string }
      | null;
    return {
      ok: res.ok,
      status: res.status,
      data: payload && typeof payload === "object" && "data" in payload ? (payload.data ?? null) : null,
      error:
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error || "")
          : res.ok
            ? null
            : `Request failed (${res.status})`,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 500,
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") || "";

    const auth = await safeFetchJson<{ userId: string }>(`${origin}/api/auth/me`, cookieHeader);
    const userId = String(auth.data?.userId || "").trim();
    if (!userId) {
      return NextResponse.json(
        {
          data: {
            userId: "",
            isAdmin: false,
            profile: null,
            member: null,
            ownerSignals: null,
            ownerOnboarding: null,
            myAccessRequests: [],
            myJoinRequests: [],
            inboxRequests: [],
            orgJoinInbox: [],
            failedNotifications: [],
          },
        },
        { status: 200 },
      );
    }

    const [
      adminState,
      profile,
      member,
      ownedEvents,
      ownedMembers,
      ownerState,
      myAccessRequests,
      myJoinRequests,
      inboxRequests,
      orgJoinInbox,
      failedNotifications,
      ownerOnboarding,
    ] = await Promise.all([
      safeFetchJson<{ isAdmin: boolean }>(`${origin}/api/auth/admin-state`, cookieHeader),
      safeFetchJson<{ username?: string; organizationName?: string }>(`${origin}/api/profile/username`, cookieHeader),
      safeFetchJson<{
        org_owner_user_id?: string;
        role_label?: string;
        permissions?: string[];
      }>(`${origin}/api/organization-members/me`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/events?ownerId=${encodeURIComponent(userId)}`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/organization-members`, cookieHeader),
      safeFetchJson<{ isOwner?: boolean }>(`${origin}/api/organization-owner/me`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/access-requests/mine`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/organization-join-requests/mine`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/access-requests/inbox`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/organization-join-requests/inbox`, cookieHeader),
      safeFetchJson<unknown[]>(`${origin}/api/access-requests/failed-notifications`, cookieHeader),
      safeFetchJson<{
        shouldShowOnboarding?: boolean;
        teamStepCompleted?: boolean;
        needsProfileSetup?: boolean;
      }>(`${origin}/api/onboarding/organization-owner`, cookieHeader),
    ]);

    const ownerSignals = {
      hasOwnedEvents: Array.isArray(ownedEvents.data) && ownedEvents.data.length > 0,
      hasOwnedMembers: Array.isArray(ownedMembers.data) && ownedMembers.data.length > 0,
      ownerByRegistry: Boolean(ownerState.data?.isOwner),
    };

    return NextResponse.json(
      {
        data: {
          userId,
          isAdmin: Boolean(adminState.data?.isAdmin),
          profile: profile.data || null,
          member: member.data || null,
          ownerSignals,
          ownerOnboarding: ownerOnboarding.data || null,
          myAccessRequests: Array.isArray(myAccessRequests.data) ? myAccessRequests.data : [],
          myJoinRequests: Array.isArray(myJoinRequests.data) ? myJoinRequests.data : [],
          inboxRequests: Array.isArray(inboxRequests.data) ? inboxRequests.data : [],
          orgJoinInbox: Array.isArray(orgJoinInbox.data) ? orgJoinInbox.data : [],
          failedNotifications: Array.isArray(failedNotifications.data) ? failedNotifications.data : [],
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard bootstrap.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
