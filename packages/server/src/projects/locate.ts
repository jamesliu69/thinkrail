import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Project } from "@thinkrail/contracts";
import { CodedError } from "@thinkrail/shared/codedError";
import { getProjects } from "./projects";

export const LOCATE_BUDGET_MS = 1500;
export const LOCATE_MAX_RESULTS = 8;
export const LOCATE_MAX_VISITED_DIRS = 25_000;
export const LOCATE_MAX_DEPTH = 2;

const SKIP_DIR_NAMES = new Set(
	[
		"node_modules",
		".git",
		".cache",
		".npm",
		".pnpm-store",
		".next",
		"dist",
		"build",
		"target",
		"vendor",
		"out",
		"AppData",
		"Library",
		"Application Support",
		"Windows",
		"Program Files",
		"Program Files (x86)",
		"ProgramData",
		"$Recycle.Bin",
		"System Volume Information",
		"proc",
		"sys",
		"dev",
		"run",
		"tmp",
		"var",
		"usr",
		"etc",
		"boot",
		"lost+found",
		"media",
		"mnt",
		"volumes",
	].map((name) => name.toLowerCase()),
);

const CODE_CONTAINER_NAMES = [
	"projects",
	"code",
	"dev",
	"src",
	"repos",
	"work",
	"workspaces",
	"Developer",
	"Documents",
];

const caseInsensitiveFs = process.platform !== "linux";

function folderKey(path: string): string {
	return caseInsensitiveFs ? path.toLowerCase() : path;
}

function nameEquals(a: string, b: string): boolean {
	return caseInsensitiveFs ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function invalidName(message: string): never {
	throw new CodedError("LOCATE_INVALID_NAME", message);
}

function hasControlCharacter(value: string): boolean {
	for (const char of value) {
		const code = char.codePointAt(0);
		if (code === undefined) continue;
		if (code <= 0x1f || code === 0x7f) return true;
	}
	return false;
}

export function validateFolderName(raw: string): string {
	if (typeof raw !== "string") invalidName("Enter a folder name.");
	const name = raw.trim();
	if (name === "" || name === "." || name === "..")
		invalidName("Enter a folder name, not a relative path.");
	if (name.length > 200) invalidName("That folder name is too long.");
	if (/[/\\]/.test(name)) invalidName("Enter a folder name, not a path.");
	if (hasControlCharacter(name)) invalidName("That folder name has control characters.");
	if (process.platform === "win32") {
		if (/[<>:"|?*]/.test(name)) invalidName("That folder name has characters Windows forbids.");
		if (/[. ]$/.test(name)) invalidName("That folder name ends with a dot or space.");
	}
	return name;
}

export interface LocateSearchRoot {
	root: string;
	depth: number;
}

export async function locateSearchRoots(
	projects: readonly Pick<Project, "path">[],
	options?: { home?: string },
): Promise<LocateSearchRoot[]> {
	const home = options?.home ?? homedir();
	const byKey = new Map<string, LocateSearchRoot>();
	const add = (root: string, depth: number) => {
		const key = folderKey(resolve(root));
		const existing = byKey.get(key);
		if (existing) existing.depth = Math.max(existing.depth, depth);
		else byKey.set(key, { root: resolve(root), depth });
	};
	for (const project of projects) add(dirname(project.path), LOCATE_MAX_DEPTH);
	add(home, 4);
	const containers = await Promise.all(
		CODE_CONTAINER_NAMES.map(async (name) => {
			const candidate = join(home, name);
			return stat(candidate)
				.then(() => candidate)
				.catch(() => null);
		}),
	);
	for (const container of containers) if (container) add(container, LOCATE_MAX_DEPTH);
	if (process.platform === "win32") {
		const drives = await Promise.all(
			"CDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(async (letter) => {
				const drive = `${letter}:/`;
				return stat(drive)
					.then(() => drive)
					.catch(() => null);
			}),
		);
		for (const drive of drives) if (drive) add(drive, LOCATE_MAX_DEPTH);
	} else {
		add("/", LOCATE_MAX_DEPTH);
	}
	return [...byKey.values()];
}

export async function searchFoldersByName(
	roots: readonly LocateSearchRoot[],
	name: string,
	options?: { budgetMs?: number; maxResults?: number },
): Promise<string[]> {
	const deadline = Date.now() + (options?.budgetMs ?? LOCATE_BUDGET_MS);
	const maxResults = options?.maxResults ?? LOCATE_MAX_RESULTS;
	const matches: string[] = [];
	const matchKeys = new Set<string>();
	const seenDirs = new Set<string>();
	let visitedDirs = 0;

	for (const { root, depth: maxDepth } of roots) {
		let frontier: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
		while (frontier.length > 0) {
			if (matches.length >= maxResults || visitedDirs >= LOCATE_MAX_VISITED_DIRS) {
				frontier = [];
				break;
			}
			const next: { dir: string; depth: number }[] = [];
			for (const { dir, depth } of frontier) {
				if (matches.length >= maxResults || visitedDirs >= LOCATE_MAX_VISITED_DIRS) break;
				if (Date.now() > deadline) break;
				const key = folderKey(dir);
				if (seenDirs.has(key)) continue;
				seenDirs.add(key);
				visitedDirs += 1;
				let entries: Dirent[];
				try {
					entries = await readdir(dir, { withFileTypes: true });
				} catch {
					continue;
				}
				for (const entry of entries) {
					if (!entry.isDirectory()) continue;
					if (entry.name.startsWith(".") || SKIP_DIR_NAMES.has(entry.name.toLowerCase())) continue;
					const child = resolve(dir, entry.name);
					if (nameEquals(entry.name, name)) {
						const childKey = folderKey(child);
						if (!matchKeys.has(childKey)) {
							matchKeys.add(childKey);
							matches.push(child);
						}
					}
					if (depth + 1 < maxDepth) next.push({ dir: child, depth: depth + 1 });
				}
			}
			frontier = next;
		}
		if (Date.now() > deadline) break;
		if (matches.length >= maxResults) break;
	}
	return matches;
}

export async function locateProjectFolders(name: string): Promise<string[]> {
	const folder = validateFolderName(name);
	const roots = await locateSearchRoots(getProjects());
	return searchFoldersByName(roots, folder);
}
