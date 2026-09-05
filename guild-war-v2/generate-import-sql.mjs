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
  ...statements.map(({ sql: statement, params }) => {
    let index = 0;
    return statement.replaceAll("?", () => literal(params[index++])) + ";";
  }),
  "",
].join("\n");

fs.writeFileSync("guild-war-v2/generated-import.sql", sql);
fs.writeFileSync("guild-war-v2/generated-import-report.json", JSON.stringify({
  counts: report.counts,
  issueCount: report.issues.length,
  statements: statements.length,
}, null, 2));
console.log("Generated validated D1 import SQL.");
