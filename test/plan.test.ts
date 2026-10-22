import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfig } from "../src/config.ts";
import { planProject, render } from "../src/plan.ts";

test("render değişkenleri doldurur ve bilinmeyenleri reddeder", () => {
  assert.equal(render("{{A}}-{{B}}", { A: "1", B: "2" }), "1-2");
  assert.throws(() => render("{{C}}", {}), /C/);
});

test("gerçek şablonlar eksiksiz render edilir", async () => {
  const config = parseConfig({
    central: { repo: "me/ai-otonom", ref: "v1" },
    projects: [{ repo: "me/app", maintenance: true }],
  });
  const files = await planProject(config, config.projects[0]!);
  assert.deepEqual(
    files.map((f) => f.path),
    [".github/workflows/claude.yml", ".github/workflows/claude-review.yml", ".github/workflows/claude-maintenance.yml", "CLAUDE.md"],
  );
  for (const file of files) {
    assert.ok(file.content, file.path);
    assert.doesNotMatch(file.content, /\{\{/, file.path);
  }
  const mention = files[0]!.content!;
  assert.match(mention, /uses: me\/ai-otonom\/\.github\/workflows\/claude-mention\.yml@v1/);
  assert.match(mention, /secrets: inherit/);
  assert.match(files[2]!.content!, /cron: "0 6 \* \* 1"/);
  assert.equal(files[3]!.mode, "create-only");
});

test("kapatılan özelliklerin dosyaları silinmek üzere planlanır", async () => {
  const config = parseConfig({ central: { repo: "me/ai-otonom" }, projects: [{ repo: "me/app", review: false }] });
  const files = await planProject(config, config.projects[0]!, async () => "x");
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
  assert.equal(byPath[".github/workflows/claude-review.yml"], null);
  assert.equal(byPath[".github/workflows/claude-maintenance.yml"], null);
  assert.equal(byPath[".github/workflows/claude.yml"], "x");
});
