import { auth, currentUser } from "@clerk/nextjs/server";
import { getInternalUserIdByClerkUserId, linkAuthUserToClerkUser } from "@/lib/auth-db";

function clerkPrimaryEmailLower(user: Awaited<ReturnType<typeof currentUser>>): string {
  if (!user) return "";
  const list = user.emailAddresses ?? [];
  const primary =
    list.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
    user.primaryEmailAddress?.emailAddress ||
    list[0]?.emailAddress;
  return String(primary ?? "").trim().toLowerCase();
}

/**
 * Maps an active Clerk session to your existing `auth_users.user_id`
 * when `clerk_user_id` is set or when Clerk's primary email matches `auth_users.email`.
 */
export async function resolveLinkedInternalUserIdFromClerk(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const byClerk = await getInternalUserIdByClerkUserId(userId);
  if (byClerk) return byClerk;

  const clerkUser = await currentUser();
  const email = clerkPrimaryEmailLower(clerkUser);
  if (!email) return null;

  return linkAuthUserToClerkUser(userId, email);
}
