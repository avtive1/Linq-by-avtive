const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toOrganizationKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

async function clearTable(tableName, filterColumn = "id") {
  const { error } = await admin.from(tableName).delete().not(filterColumn, "is", null);
  if (error) {
    // Some environments may not have all optional tables.
    const msg = String(error.message || "");
    if (msg.includes("does not exist") || msg.includes("Could not find the table")) {
      console.log(`- skip ${tableName} (missing table)`);
      return;
    }
    throw new Error(`Failed clearing ${tableName}: ${msg}`);
  }
  console.log(`- cleared ${tableName}`);
}

async function deleteAllAuthUsers() {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed listing auth users: ${error.message}`);
    const users = data?.users || [];
    if (users.length === 0) break;

    for (const user of users) {
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (delErr) throw new Error(`Failed deleting auth user ${user.email || user.id}: ${delErr.message}`);
      console.log(`- deleted auth user: ${user.email || user.id}`);
    }

    if (users.length < perPage) break;
    page += 1;
  }
}

async function createUser({ email, password, username, role, organizationName }) {
  const userMeta = {
    username,
    role: role || "user",
  };
  if (organizationName) {
    userMeta.organization_name = organizationName;
    userMeta.organization_name_key = toOrganizationKey(organizationName);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMeta,
  });
  if (error || !data?.user?.id) {
    throw new Error(`Failed creating user ${email}: ${error?.message || "unknown error"}`);
  }

  const fullProfilePayload = {
    id: data.user.id,
    username,
    organization_name: organizationName || null,
    organization_name_key: organizationName ? toOrganizationKey(organizationName) : null,
    role: role || "user",
    updated_at: new Date().toISOString(),
  };

  let { error: profileErr } = await admin.from("profiles").upsert(fullProfilePayload, { onConflict: "id" });
  if (profileErr) {
    // Backward-compatible retry for environments where some profile columns do not exist.
    const minimalProfilePayload = {
      id: data.user.id,
      username,
      organization_name: organizationName || null,
    };
    const retry = await admin.from("profiles").upsert(minimalProfilePayload, { onConflict: "id" });
    profileErr = retry.error;
  }
  if (profileErr) {
    throw new Error(`Failed upserting profile for ${email}: ${profileErr.message}`);
  }

  console.log(`- created user: ${email}`);
  return data.user;
}

async function run() {
  console.log("Starting database/auth clear...");

  await clearTable("access_grants", "id");
  await clearTable("access_requests", "id");
  await clearTable("organization_join_requests", "id");
  await clearTable("organization_members", "id");
  await clearTable("organization_role_permission_templates", "org_owner_user_id");
  await clearTable("event_sponsors", "id");
  await clearTable("attendees", "id");
  await clearTable("events", "id");
  await clearTable("profiles", "id");
  await clearTable("organizations", "id");

  await deleteAllAuthUsers();

  console.log("Seeding required users...");

  const rameel = await createUser({
    email: "rameel@refactr.net",
    password: "R@refactr2004",
    username: "rameel",
    role: "user",
    organizationName: "refactr",
  });

  await createUser({
    email: "Syedbadshah00000@gmail.com",
    password: "Syed@00000admin",
    username: "mesumadmin",
    role: "admin",
    organizationName: null,
  });

  const organizationName = "refactr";
  const organizationKey = toOrganizationKey(organizationName);

  const { error: orgErr } = await admin.from("organizations").upsert(
    {
      organization_name: organizationName,
      organization_name_key: organizationKey,
      owner_user_id: rameel.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_name_key" },
  );
  if (orgErr) throw new Error(`Failed assigning organization owner: ${orgErr.message}`);

  const { error: templateErr } = await admin.from("organization_role_permission_templates").upsert(
    {
      org_owner_user_id: rameel.id,
      role_label: "Member",
      permissions: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_owner_user_id,role_label" },
  );
  if (templateErr) throw new Error(`Failed upserting default role template: ${templateErr.message}`);

  console.log("Done.");
  console.log("Result:");
  console.log("- refactr founder: rameel@refactr.net (username: rameel)");
  console.log("- super admin: Syedbadshah00000@gmail.com (username: mesumadmin, role: admin)");
  console.log("- organization 'refactr' owner_user_id points to rameel");
  console.log("- new users with organization 'refactr' will submit join requests to rameel for approval");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

