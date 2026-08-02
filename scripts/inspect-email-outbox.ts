import dotenv from "dotenv";
import path from "node:path";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type OutboxStatus = {
  status: string;
  count: string;
  newest_created_at: string | null;
  last_error: string | null;
};

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_DIRECT?.trim();
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_DIRECT.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'true', true)");
    const { rows } = await client.query<OutboxStatus>(
      `SELECT status,
              COUNT(*)::text AS count,
              MAX(created_at)::text AS newest_created_at,
              MAX(last_error) AS last_error
       FROM public.email_outbox
       GROUP BY status
       ORDER BY status`,
    );
    await client.query("COMMIT");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
