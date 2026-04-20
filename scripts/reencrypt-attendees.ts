import { createClient } from "@supabase/supabase-js";
import { decryptAttendeeSensitiveFields } from "../src/lib/security/attendee-sensitive";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  let page = 0;
  const pageSize = 200;
  let updated = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("attendees")
      .select("id, card_email, linkedin")
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const { migrationPatch } = decryptAttendeeSensitiveFields(row);
      if (Object.keys(migrationPatch).length === 0) continue;
      const { error: upErr } = await supabase
        .from("attendees")
        .update(migrationPatch)
        .eq("id", row.id);
      if (upErr) {
        console.error(`failed id=${row.id}`, upErr.message);
        continue;
      }
      updated++;
    }
    page++;
  }
  console.log(`Re-encryption complete. updated=${updated}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
