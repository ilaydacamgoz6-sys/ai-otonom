import { readFile } from "node:fs/promises";
import type { Config, Project } from "./config.ts";

/**
 * "overwrite": merkez tarafından yönetilir, her senkronizasyonda güncellenir.
 * "create-only": yalnızca yoksa oluşturulur; proje sahibi sonradan düzenleyebilir.
 */
export type FileMode = "overwrite" | "create-only";

export interface PlannedFile {
  path: string;
  /** null: özellik kapatılmış, merkez tarafından yönetilen dosya varsa silinmeli. */
  content: string | null;
  mode: FileMode;
}

interface TemplateSpec {
  template: string;
  path: string;
  mode: FileMode;
  enabled: (p: Project) => boolean;
}

const TEMPLATES: TemplateSpec[] = [
  { template: "claude.yml", path: ".github/workflows/claude.yml", mode: "overwrite", enabled: (p) => p.mention },
  { template: "claude-review.yml", path: ".github/workflows/claude-review.yml", mode: "overwrite", enabled: (p) => p.review },
  {
    template: "claude-maintenance.yml",
    path: ".github/workflows/claude-maintenance.yml",
    mode: "overwrite",
    enabled: (p) => p.maintenance,
  },
  { template: "CLAUDE.md", path: "CLAUDE.md", mode: "create-only", enabled: () => true },
];

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Şablonda bilinmeyen değişken: ${match}`);
    return value;
  });
}

/** Returns the desired state of every managed file in a project, rendered from templates/. */
export async function planProject(
  config: Config,
  project: Project,
  readTemplate: (name: string) => Promise<string> = defaultReadTemplate,
): Promise<PlannedFile[]> {
  const vars = {
    CENTRAL_REPO: config.central.repo,
    CENTRAL_REF: config.central.ref,
    PROJECT_NAME: project.name,
    LANGUAGE: project.language,
    MAINTENANCE_CRON: project.maintenanceCron,
  };
  const files: PlannedFile[] = [];
  for (const spec of TEMPLATES) {
    if (!spec.enabled(project)) {
      if (spec.mode === "overwrite") files.push({ path: spec.path, mode: spec.mode, content: null });
      continue;
    }
    files.push({ path: spec.path, mode: spec.mode, content: render(await readTemplate(spec.template), vars) });
  }
  return files;
}

function defaultReadTemplate(name: string): Promise<string> {
  return readFile(new URL(`../templates/${name}`, import.meta.url), "utf8");
}
