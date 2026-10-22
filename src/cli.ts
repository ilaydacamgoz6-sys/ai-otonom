import { parseArgs } from "node:util";
import { loadConfig } from "./config.ts";
import { diffProject, GitHub, syncProject } from "./github.ts";
import { planProject } from "./plan.ts";

const USAGE = `Kullanım: npm run onboard -- [seçenekler]

projects.json'daki her projeye Claude otomasyon dosyalarını ekleyen/güncelleyen PR açar.

Seçenekler:
  --dry-run          Hiçbir şey yazmadan yapılacak değişiklikleri göster
  --repo <s/d>       Yalnızca bu projeyi işle (birden fazla verilebilir)
  --config <yol>     Yapılandırma dosyası (varsayılan: projects.json)
  -h, --help         Bu yardımı göster

Ortam değişkeni: OTONOM_GH_TOKEN veya GITHUB_TOKEN
  (Contents, Pull requests ve Workflows yazma yetkisi gerekir)`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      repo: { type: "string", multiple: true },
      config: { type: "string", default: "projects.json" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const config = await loadConfig(values.config);
  const only = values.repo?.map((r) => r.toLowerCase());
  const projects = only ? config.projects.filter((p) => only.includes(`${p.owner}/${p.name}`.toLowerCase())) : config.projects;
  if (projects.length === 0) {
    console.log("İşlenecek proje yok. projects.json içindeki \"projects\" listesine depo ekleyin.");
    return 0;
  }

  const token = process.env.OTONOM_GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("OTONOM_GH_TOKEN veya GITHUB_TOKEN tanımlı değil.");
    return 1;
  }
  const gh = new GitHub(token);

  let failed = 0;
  for (const project of projects) {
    const name = `${project.owner}/${project.name}`;
    try {
      const files = await planProject(config, project);
      if (values["dry-run"]) {
        const { changes } = await diffProject(gh, project, files);
        report(name, changes.length ? changes.map((c) => `${c.action} ${c.path}`).join(", ") : "güncel");
        continue;
      }
      const result = await syncProject(gh, project, files, config.central.repo);
      report(name, result.pullRequestUrl ? `${result.changes.length} değişiklik → ${result.pullRequestUrl}` : "güncel");
    } catch (err) {
      failed++;
      report(name, `HATA: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed ? 1 : 0;
}

function report(repo: string, message: string): void {
  console.log(`${repo}: ${message}`);
}

process.exitCode = await main();
