/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

console.log("🔍 Running TruffleHog scan...");

let output;

try {
  output = execSync("trufflehog filesystem . --json", {
    encoding: "utf-8",
  });
} catch (err) {
  output = err.stdout || "";
}

// If nothing found
if (!output) {
  console.log("✅ No secrets found");
  process.exit(0);
}

const lines = output.trim().split("\n");

let hasRealSecret = false;

function isGitIgnored(filePath) {
  try {
    // git check-ignore returns exit code 0 if ignored
    execSync(`git check-ignore "${filePath}"`);
    return true;
  } catch {
    return false; // NOT ignored
  }
}

for (const line of lines) {
  try {
    const result = JSON.parse(line);

    const filePath =
      result?.SourceMetadata?.Data?.Filesystem?.file;

    if (!filePath) continue;

    // 🔥 IMPORTANT: use Git itself
    if (isGitIgnored(filePath)) {
      console.log(`⚠️ Ignored by git: ${filePath}`);
      continue;
    }

    console.log(`❌ REAL SECRET FOUND: ${filePath}`);
    hasRealSecret = true;

  } catch {
    // ignore invalid JSON lines
  }
}

if (hasRealSecret) {
  console.log("🚨 Commit blocked: real secrets detected!");
  process.exit(1);
}

console.log("✅ Only ignored files contain secrets. Commit allowed.");
process.exit(0);