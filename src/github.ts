import type { Project } from "./config.ts";
import type { PlannedFile } from "./plan.ts";

export const SYNC_BRANCH = "otonom/sync";
const API = "https://api.github.com";

export type Change = { path: string; action: "create" | "update" | "delete" };

export interface SyncResult {
  changes: Change[];
  pullRequestUrl?: string;
}

export class GitHub {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new GitHubError(res.status, `${method} ${path} → ${res.status}: ${await res.text()}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  /** Like request(), but resolves to undefined on 404. */
  async find<T>(path: string): Promise<T | undefined> {
    try {
      return await this.request<T>("GET", path);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return undefined;
      throw err;
    }
  }
}

export class GitHubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Compares planned files against the project's default branch and lists what must change. */
export async function diffProject(gh: GitHub, project: Project, files: PlannedFile[]): Promise<{ base: string; changes: (Change & { content: string | null })[] }> {
  const repo = `/repos/${project.owner}/${project.name}`;
  const { default_branch: base } = await gh.request<{ default_branch: string }>("GET", repo);

  const changes: (Change & { content: string | null })[] = [];
  for (const file of files) {
    const existing = await gh.find<{ content: string; encoding: string }>(
      `${repo}/contents/${encodePath(file.path)}?ref=${encodeURIComponent(base)}`,
    );
    if (file.content === null) {
      if (existing) changes.push({ path: file.path, action: "delete", content: null });
    } else if (!existing) {
      changes.push({ path: file.path, action: "create", content: file.content });
    } else if (file.mode === "overwrite" && decode(existing) !== file.content) {
      changes.push({ path: file.path, action: "update", content: file.content });
    }
  }
  return { base, changes };
}

/**
 * Brings a project in line with the plan: commits all changes as a single commit on
 * SYNC_BRANCH (recreated from the default branch each time) and opens a PR if none is open.
 */
export async function syncProject(gh: GitHub, project: Project, files: PlannedFile[], centralRepo: string): Promise<SyncResult> {
  const repo = `/repos/${project.owner}/${project.name}`;
  const { base, changes } = await diffProject(gh, project, files);
  if (changes.length === 0) return { changes };

  const baseRef = await gh.request<{ object: { sha: string } }>("GET", `${repo}/git/ref/heads/${encodePath(base)}`);
  const baseSha = baseRef.object.sha;
  const baseCommit = await gh.request<{ tree: { sha: string } }>("GET", `${repo}/git/commits/${baseSha}`);

  const tree = await gh.request<{ sha: string }>("POST", `${repo}/git/trees`, {
    base_tree: baseCommit.tree.sha,
    tree: changes.map((c) =>
      c.content === null
        ? { path: c.path, mode: "100644", type: "blob", sha: null }
        : { path: c.path, mode: "100644", type: "blob", content: c.content },
    ),
  });
  const commit = await gh.request<{ sha: string }>("POST", `${repo}/git/commits`, {
    message: `chore: ai-otonom senkronizasyonu\n\n${changes.map((c) => `- ${c.action}: ${c.path}`).join("\n")}`,
    tree: tree.sha,
    parents: [baseSha],
  });

  const branchPath = `${repo}/git/refs/heads/${encodePath(SYNC_BRANCH)}`;
  if (await gh.find(branchPath)) {
    await gh.request("PATCH", branchPath, { sha: commit.sha, force: true });
  } else {
    await gh.request("POST", `${repo}/git/refs`, { ref: `refs/heads/${SYNC_BRANCH}`, sha: commit.sha });
  }

  const open = await gh.request<{ html_url: string }[]>(
    "GET",
    `${repo}/pulls?state=open&head=${encodeURIComponent(`${project.owner}:${SYNC_BRANCH}`)}`,
  );
  if (open[0]) return { changes, pullRequestUrl: open[0].html_url };

  const pr = await gh.request<{ html_url: string }>("POST", `${repo}/pulls`, {
    title: "ai-otonom: Claude otomasyonunu kur/güncelle",
    head: SYNC_BRANCH,
    base,
    body: pullRequestBody(changes, centralRepo),
  });
  return { changes, pullRequestUrl: pr.html_url };
}

function pullRequestBody(changes: Change[], centralRepo: string): string {
  return [
    `Bu PR [${centralRepo}](https://github.com/${centralRepo}) tarafından otomatik açıldı.`,
    "",
    "## Değişiklikler",
    ...changes.map((c) => `- \`${c.path}\` (${c.action})`),
    "",
    "## Birleştirmeden önce",
    "- [ ] Claude GitHub App bu depoya kurulu: https://github.com/apps/claude",
    "- [ ] Depo ayarlarında `ANTHROPIC_API_KEY` veya `CLAUDE_CODE_OAUTH_TOKEN` secret'ı tanımlı",
    "- [ ] `CLAUDE.md` projeye göre dolduruldu (komutlar, kurallar)",
  ].join("\n");
}

function decode(file: { content: string; encoding: string }): string {
  if (file.encoding !== "base64") throw new Error(`Beklenmeyen kodlama: ${file.encoding}`);
  return Buffer.from(file.content, "base64").toString("utf8");
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
