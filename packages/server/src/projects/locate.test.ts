import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodedError } from "@thinkrail/shared/codedError";
import {
	LOCATE_MAX_DEPTH,
	locateSearchRoots,
	searchFoldersByName,
	validateFolderName,
} from "./locate";

let fixture: string;

beforeEach(() => {
	fixture = mkdtempSync(join(tmpdir(), "trpi-locate-test-"));
});

afterEach(() => {
	rmSync(fixture, { recursive: true, force: true });
});

function dir(...segments: string[]): string {
	const path = join(fixture, ...segments);
	mkdirSync(path, { recursive: true });
	return path;
}

function project(path: string): { path: string } {
	return { path };
}

test("validateFolderName accepts a plain folder name", () => {
	expect(validateFolderName("my-project")).toBe("my-project");
	expect(validateFolderName("a b.c")).toBe("a b.c");
});

if (process.platform === "win32") {
	test("validateFolderName does not trim Windows-invalid trailing spaces", () => {
		expect(() => validateFolderName("my-project ")).toThrow(CodedError);
	});
} else {
	test("validateFolderName preserves legal leading and trailing POSIX spaces", async () => {
		const name = " my-project ";
		const found = dir("scan", name);
		const validated = validateFolderName(name);

		expect(validated).toBe(name);
		expect(
			await searchFoldersByName([{ root: join(fixture, "scan"), depth: 1 }], validated),
		).toEqual([found]);
	});
}

test("validateFolderName refusals carry LOCATE_INVALID_NAME", () => {
	for (const bad of ["", ".", "..", "a/b", "a\\b", "a\u0000b", "x".repeat(201)]) {
		try {
			validateFolderName(bad);
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(CodedError);
			expect((err as CodedError).code).toBe("LOCATE_INVALID_NAME");
		}
	}
});

if (process.platform === "win32") {
	test("validateFolderName refuses Windows-forbidden characters and a trailing dot", () => {
		expect(() => validateFolderName("a<b")).toThrow(CodedError);
		expect(() => validateFolderName("a:b")).toThrow(CodedError);
		expect(() => validateFolderName('a"b')).toThrow(CodedError);
		expect(() => validateFolderName("a|b")).toThrow(CodedError);
		expect(() => validateFolderName("a?b")).toThrow(CodedError);
		expect(() => validateFolderName("a*b")).toThrow(CodedError);
		expect(() => validateFolderName("name.")).toThrow(CodedError);
		expect(() => validateFolderName("name ")).toThrow(CodedError);
	});
}

test("validateFolderName deliberately accepts Windows device names (read-only search)", () => {
	expect(validateFolderName("CON")).toBe("CON");
});

test("locateSearchRoots puts project parents first, then home at depth 4", async () => {
	const parentA = dir("alpha");
	const parentB = dir("beta");
	const roots = await locateSearchRoots(
		[project(join(parentA, "repo")), project(join(parentB, "site"))],
		{
			home: dir("home-root"),
		},
	);

	expect(roots[0]).toMatchObject({ root: parentA, depth: LOCATE_MAX_DEPTH });
	expect(roots[1]).toMatchObject({ root: parentB, depth: LOCATE_MAX_DEPTH });
	const homeRoot = roots.find((r) => r.depth === 4);
	expect(homeRoot).toBeDefined();
});

test("locateSearchRoots keeps the deeper depth when a project sits directly in home", async () => {
	const home = dir("home-root");
	const roots = await locateSearchRoots([project(join(home, "repo"))], { home });

	const homeRoots = roots.filter((r) => r.root.toLowerCase() === home.toLowerCase());
	expect(homeRoots).toHaveLength(1);
	expect(homeRoots[0]).toMatchObject({ depth: 4 });
});

test("locateSearchRoots includes only existing code containers", async () => {
	const home = dir("home-root");
	dir("home-root", "code");
	dir("home-root", "Documents");
	const roots = await locateSearchRoots([], { home });

	const names = roots.map((r) => r.root);
	expect(names).toContain(join(home, "code"));
	expect(names).toContain(join(home, "Documents"));
	expect(names.some((n) => n === join(home, "repos"))).toBe(false);
});

test("searchFoldersByName finds same-named folders in discovery order", async () => {
	const first = dir("scan", "target-app");
	const second = dir("scan", "nested", "deeper", "target-app");
	dir("scan", "other");

	const matches = await searchFoldersByName(
		[{ root: join(fixture, "scan"), depth: 3 }],
		"target-app",
	);

	expect(matches).toEqual([first, second]);
});

test("searchFoldersByName matches only directories, never files", async () => {
	const root = dir("scan");
	writeFileSync(join(root, "lookalike"), "not a folder");
	dir("scan", "lookalike2");

	const matches = await searchFoldersByName([{ root, depth: 1 }], "lookalike");

	expect(matches).toEqual([]);
});

test("searchFoldersByName respects the per-root depth bound", async () => {
	const root = dir("scan");
	const tooDeep = dir("scan", "one", "two", "three", "needle");

	const within = await searchFoldersByName([{ root, depth: 2 }], "needle");
	expect(within).toEqual([]);

	const reached = await searchFoldersByName([{ root, depth: 4 }], "needle");
	expect(reached).toEqual([tooDeep]);
});

test("searchFoldersByName skips noise directories and dot directories", async () => {
	const root = dir("scan");
	dir("scan", "node_modules", "needle");
	dir("scan", ".git", "needle");
	dir("scan", ".hidden", "needle");
	dir("scan", "dist", "needle");
	dir("scan", "build", "needle");
	dir("scan", "keep", "needle");

	const matches = await searchFoldersByName([{ root, depth: 2 }], "needle");

	expect(matches).toEqual([join(root, "keep", "needle")]);
});

test("searchFoldersByName does not follow symlinks", async () => {
	const root = dir("scan");
	const real = dir("scan", "real", "needle");
	if (process.platform === "win32") {
		try {
			symlinkSync(real, join(root, "needle-link"), "dir");
		} catch {
			// Windows without symlink privilege: the directory match below still proves the point.
		}
	} else {
		symlinkSync(real, join(root, "needle-link"), "dir");
	}

	const matches = await searchFoldersByName([{ root, depth: 2 }], "needle");

	expect(matches).toEqual([real]);
	expect(matches.some((m) => m.includes("needle-link"))).toBe(false);
});

test("searchFoldersByName dedupes folders reachable through two roots", async () => {
	const shared = dir("shared", "needle");
	dir("shared");

	const matches = await searchFoldersByName(
		[
			{ root: fixture, depth: 1 },
			{ root: join(fixture, "shared"), depth: 1 },
		],
		"needle",
	);

	expect(matches).toEqual([shared]);
});

test("searchFoldersByName revisits an overlapping root when it has more remaining depth", async () => {
	const root = dir("scan");
	const overlappingRoot = dir("scan", "overlap");
	const expected = dir("scan", "overlap", "one", "needle");

	const matches = await searchFoldersByName(
		[
			{ root, depth: 2 },
			{ root: overlappingRoot, depth: 3 },
		],
		"needle",
	);

	expect(matches).toEqual([expected]);
});

test("searchFoldersByName stops at maxResults", async () => {
	const root = dir("scan");
	dir("scan", "n1", "needle");
	dir("scan", "n2", "needle");
	dir("scan", "n3", "needle");

	const matches = await searchFoldersByName([{ root, depth: 2 }], "needle", { maxResults: 2 });

	expect(matches).toHaveLength(2);
});

test("searchFoldersByName honours an exhausted time budget and returns what it has", async () => {
	const root = dir("scan");
	dir("scan", "a", "needle");

	const matches = await searchFoldersByName([{ root, depth: 2 }], "needle", { budgetMs: -1000 });

	expect(matches).toEqual([]);
});

if (process.platform !== "linux") {
	test("searchFoldersByName matches case-insensitively on win32 and darwin", async () => {
		const found = dir("scan", "MyApp");
		const matches = await searchFoldersByName([{ root: join(fixture, "scan"), depth: 1 }], "myapp");
		expect(matches).toEqual([found]);
	});
} else {
	test("searchFoldersByName matches case-sensitively on linux", async () => {
		dir("scan", "MyApp");
		const matches = await searchFoldersByName([{ root: join(fixture, "scan"), depth: 1 }], "myapp");
		expect(matches).toEqual([]);
	});
}
