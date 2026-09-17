import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sourcePath = new URL("../src/GuildWarTeamBuilder.tsx", import.meta.url);
const pickerPath = new URL("../src/GuildWarRoundPicker.tsx", import.meta.url);

test("round picker renders warning badges in a right-side custom menu", async () => {
  const source = await readFile(sourcePath, "utf8");
  const picker = await readFile(pickerPath, "utf8");
  assert.match(picker, /gw-round-picker-menu/);
  assert.doesNotMatch(source, /count>0\?\`⚠ \$\{count\} · \`/);
  assert.match(picker, /aria-haspopup="listbox"/);
  assert.match(picker, /role="option"/);
});
