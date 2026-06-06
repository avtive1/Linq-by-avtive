export const AUDIT_QUERIES = [
  {
    name: "events_by_owner",
    sql: `SELECT e.id, e.name, e.short_id, COUNT(a.id)::int AS attendee_count
          FROM public.events e
          LEFT JOIN public.attendees a ON a.event_id = e.id
          WHERE e.user_id = $1::uuid
          GROUP BY e.id
          ORDER BY MAX(e.created_at) DESC
          LIMIT 50`,
    params: (env) => [
      env.AUDIT_USER_ID || "00000000-0000-0000-0000-000000000001",
    ],
  },
  {
    name: "attendees_by_event",
    sql: `SELECT * FROM public.attendees WHERE event_id = $1::uuid ORDER BY created_at DESC LIMIT 100`,
    params: (env) => [
      env.AUDIT_EVENT_ID || "00000000-0000-0000-0000-000000000002",
    ],
  },
  {
    name: "pending_registrations_by_event",
    sql: `SELECT id, status, created_at
          FROM public.registration_requests
          WHERE event_id = $1::uuid AND status = 'PENDING'
          ORDER BY created_at DESC
          LIMIT 50`,
    params: (env) => [
      env.AUDIT_EVENT_ID || "00000000-0000-0000-0000-000000000002",
    ],
  },
  {
    name: "org_member_permission_check",
    sql: `SELECT id FROM public.organization_members
          WHERE member_user_id = $1::uuid AND org_owner_user_id = $2::uuid AND status = 'active'
          LIMIT 1`,
    params: (env) => [
      env.AUDIT_MEMBER_ID || "00000000-0000-0000-0000-000000000003",
      env.AUDIT_OWNER_ID || "00000000-0000-0000-0000-000000000001",
    ],
  },
  {
    name: "access_requests_pending_by_event",
    sql: `SELECT id, requester_user_id, status, created_at
          FROM public.access_requests
          WHERE event_id = $1::uuid AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 50`,
    params: (env) => [
      env.AUDIT_EVENT_ID || "00000000-0000-0000-0000-000000000002",
    ],
  },
  {
    name: "auth_user_by_email",
    sql: `SELECT au.user_id, au.email
          FROM public.auth_users au
          WHERE au.email_normalized = $1
          LIMIT 1`,
    params: () => ["audit@example.com"],
  },
  {
    name: "short_link_by_slug",
    sql: `SELECT id, target_path FROM public.short_links WHERE slug = $1 LIMIT 1`,
    params: () => ["abc123"],
  },
];

function extractPlanMetrics(plan) {
  const root = Array.isArray(plan)
    ? plan[0]?.Plan
    : plan?.Plan;

  const nodeTypes = [];

  function walk(node) {
    if (!node) return;

    if (node["Node Type"]) {
      nodeTypes.push(node["Node Type"]);
    }

    for (const child of node.Plans || []) {
      walk(child);
    }
  }

  walk(root);

  const top = Array.isArray(plan) ? plan[0] : plan;

  return {
    executionTimeMs: top?.["Execution Time"],
    planningTimeMs: top?.["Planning Time"],
    nodeTypes,
  };
}

async function main() {
  const { explainAnalyzeQuery } = await import("../../src/lib/neon-db.ts");

  const env = process.env;
  const outDir = new URL("./", import.meta.url);
  const results = [];

  console.log("Running EXPLAIN ANALYZE audit...\n");

  for (const q of AUDIT_QUERIES) {
    const params = q.params(env);
    const started = performance.now();

    try {
      const plan = await explainAnalyzeQuery(q.sql, params);
      const metrics = extractPlanMetrics(plan);
      const elapsed = performance.now() - started;

      const usesSeqScan = metrics.nodeTypes.includes("Seq Scan");

      const entry = {
        query: q.name,
        elapsedMs: Math.round(elapsed),
        executionTimeMs: metrics.executionTimeMs,
        planningTimeMs: metrics.planningTimeMs,
        nodeTypes: metrics.nodeTypes,
        usesSeqScan,
        plan,
      };

      results.push(entry);

      console.log(
        `[${q.name}] ${Math.round(elapsed)}ms | nodes: ${metrics.nodeTypes.join(" → ")} | seq scan: ${usesSeqScan}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        query: q.name,
        error: message,
      });

      console.error(`[${q.name}] ERROR: ${message}`);
    }
  }

  const reportPath = new URL("./explain-report.json", outDir);

  const fs = await import("node:fs/promises");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results,
      },
      null,
      2
    )
  );

  console.log(`\nReport written to ${reportPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});