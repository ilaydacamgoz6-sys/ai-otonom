import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfig } from "../src/config.ts";

const central = { repo: "me/ai-otonom", ref: "main" };

test("projeler varsayılanlarla birleştirilir", () => {
  const config = parseConfig({
    central,
    defaults: { review: false, language: "English" },
    projects: ["me/a", { repo: "me/b", maintenance: true, maintenanceCron: "0 3 * * *" }],
  });
  assert.deepEqual(config.projects, [
    { owner: "me", name: "a", mention: true, review: false, maintenance: false, maintenanceCron: "0 6 * * 1", language: "English" },
    { owner: "me", name: "b", mention: true, review: false, maintenance: true, maintenanceCron: "0 3 * * *", language: "English" },
  ]);
});

test("ref verilmezse main kullanılır", () => {
  assert.equal(parseConfig({ central: { repo: "me/x" }, projects: [] }).central.ref, "main");
});

test("geçersiz yapılandırmalar reddedilir", () => {
  const cases: [unknown, RegExp][] = [
    [{ central: { repo: "yok" }, projects: [] }, /central.repo/],
    [{ central, projects: ["bozuk"] }, /projects\[0\].repo/],
    [{ central, projects: ["me/a", "ME/a"] }, /birden fazla/],
    [{ central, projects: ["me/ai-otonom"] }, /merkezi depo/],
    [{ central, projects: [{ repo: "me/a", review: "evet" }] }, /review/],
    [{ central, projects: [{ repo: "me/a", maintenanceCron: "her gün" }] }, /cron/],
    [{ central, projects: [{ repo: "me/a", language: 'a"b' }] }, /language/],
  ];
  for (const [raw, error] of cases) assert.throws(() => parseConfig(raw), error);
});
