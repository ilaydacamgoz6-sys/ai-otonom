import { readFile } from "node:fs/promises";

export interface ProjectOptions {
  mention: boolean;
  review: boolean;
  maintenance: boolean;
  maintenanceCron: string;
  language: string;
}

export interface Project extends ProjectOptions {
  owner: string;
  name: string;
}

export interface Config {
  central: { repo: string; ref: string };
  projects: Project[];
}

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Validates raw projects.json content and merges each project with the defaults. */
export function parseConfig(raw: unknown): Config {
  if (!isObject(raw)) throw new Error("projects.json bir nesne olmalı");

  const central = raw.central;
  if (!isObject(central) || typeof central.repo !== "string" || !REPO_PATTERN.test(central.repo)) {
    throw new Error('central.repo "sahip/depo" biçiminde olmalı');
  }
  const ref = typeof central.ref === "string" && central.ref ? central.ref : "main";

  const defaults = parseOptions(raw.defaults ?? {}, "defaults", {
    mention: true,
    review: true,
    maintenance: false,
    maintenanceCron: "0 6 * * 1",
    language: "Türkçe",
  });

  if (!Array.isArray(raw.projects)) throw new Error("projects bir dizi olmalı");
  const seen = new Set<string>();
  const projects = raw.projects.map((entry, i): Project => {
    const where = `projects[${i}]`;
    const repo = typeof entry === "string" ? entry : isObject(entry) ? entry.repo : undefined;
    if (typeof repo !== "string" || !REPO_PATTERN.test(repo)) {
      throw new Error(`${where}.repo "sahip/depo" biçiminde olmalı`);
    }
    if (repo === central.repo) throw new Error(`${where}: merkezi depo proje olarak eklenemez`);
    if (seen.has(repo.toLowerCase())) throw new Error(`${where}: ${repo} birden fazla kez tanımlı`);
    seen.add(repo.toLowerCase());

    const [owner, name] = repo.split("/") as [string, string];
    const options = parseOptions(typeof entry === "string" ? {} : entry, where, defaults);
    return { owner, name, ...options };
  });

  return { central: { repo: central.repo, ref }, projects };
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(JSON.parse(await readFile(path, "utf8")));
}

function parseOptions(raw: unknown, where: string, base: ProjectOptions): ProjectOptions {
  if (!isObject(raw)) throw new Error(`${where} bir nesne olmalı`);
  const result = { ...base };
  for (const key of ["mention", "review", "maintenance"] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "boolean") throw new Error(`${where}.${key} true/false olmalı`);
    result[key] = raw[key];
  }
  if (raw.maintenanceCron !== undefined) {
    if (typeof raw.maintenanceCron !== "string" || raw.maintenanceCron.trim().split(/\s+/).length !== 5) {
      throw new Error(`${where}.maintenanceCron 5 alanlı bir cron ifadesi olmalı`);
    }
    result.maintenanceCron = raw.maintenanceCron.trim();
  }
  if (raw.language !== undefined) {
    if (typeof raw.language !== "string" || !raw.language || /["\n]/.test(raw.language)) {
      throw new Error(`${where}.language geçerli bir dil adı olmalı`);
    }
    result.language = raw.language;
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
