import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const files = ["test.db", "test.db-journal", ".test-uploads"];

export function setup() {
  for (const f of files) rmSync(f, { recursive: true, force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}

export function teardown() {
  for (const f of files) rmSync(f, { recursive: true, force: true });
}
