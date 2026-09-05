import fs from "node:fs";
import { buildImportPlan } from "./import-plan.mjs";

const snapshot = JSON.parse(fs.readFileSync("guild-war-v2/import-snapshot-2026-09-05.json", "utf8"));
const { report, statements } = buildImportPlan(snapshot);

function literal(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  return "'" + String(value).replaceAll("'", "''") + "'";
}

const sql = [
  "PRAGMA foreign_keys = ON;",
  "BEGIN TRANSACTION;",
  ...statements.map(({ sql: statement, params }) => statement.replaceAll("?", () => literal(params.shift())) + ";"),
  "COMMIT;",
  "",
].join("\n");

fs.writeFileSync("guild-war-v2/generated-import.sql", sql);
console.log(JSON.stringify({ counts: report.counts, issues: report.issues, statements: statements.length }, null, 2));
