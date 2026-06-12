import { Pool } from "pg";
import { decryptAttendeeSensitiveFields } from "../src/lib/security/attendee-sensitive";
import { logger } from "./lib/logger";

const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

if (!connectionString) {
  logger.error("Missing DATABASE_URL/DATABASE_URL_DIRECT.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 5,
});

async function run() {
  let page = 0;
  const pageSize = 200;
  let updated = 0;
  while (true) {
    const from = page * pageSize;
    const { rows: data } = await pool.query(
      `SELECT id, card_email, linkedin
       FROM public.attendees
       ORDER BY created_at ASC
       OFFSET $1 LIMIT $2`,
      [from, pageSize],
    );
    if (!data || data.length === 0) break;

    for (const row of data) {
      const { migrationPatch } = decryptAttendeeSensitiveFields(row);
      if (Object.keys(migrationPatch).length === 0) continue;
      const keys = Object.keys(migrationPatch);
      const setSql = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const values = [...keys.map((k) => (migrationPatch as Record<string, unknown>)[k]), row.id];
      try {
        await pool.query(`UPDATE public.attendees SET ${setSql} WHERE id = $${keys.length + 1}`, values);
      } catch (upErr) {
        const message = upErr instanceof Error ? upErr.message : "update_failed";
        logger.error({ attendeeId: row.id, message }, "Attendee re-encryption update failed");
        continue;
      }
      updated++;
    }
    page++;
  }
  logger.info({ updated }, "Re-encryption complete");
}

run().catch((err) => {
  logger.error({ err }, "Re-encryption script failed");
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
