// Tiny JSON-file persistence so ledger/transaction state survives restarts.
// (A real deployment would use Postgres; this keeps the sandbox site self-contained.)

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function saveState(file, state) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file); // atomic replace
}
