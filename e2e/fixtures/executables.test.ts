import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { hermeticE2ePath, writeHermeticGitProxy } from "./executables";

const windowsOnly = test.skipIf(process.platform !== "win32");

/** 為子程序複製環境並替換 PATH，避免測試改動目前程序的環境。 */
function envWithPath(path: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path"),
	);
	env.PATH = path;
	return env;
}

windowsOnly("hermetic Windows E2E PATH resolves Git but not pi", () => {
	const fakeBinDir = mkdtempSync(join(tmpdir(), "thinkrail-e2e-path-"));
	try {
		writeHermeticGitProxy(fakeBinDir);
		const path = hermeticE2ePath(fakeBinDir);
		expect(path.split(delimiter)[0]).toBe(fakeBinDir);
		const env = envWithPath(path);

		const git = spawnSync("git", ["--version"], { env, encoding: "utf8", windowsHide: true });
		expect(git.error).toBeUndefined();
		expect(git.status).toBe(0);
		expect(git.stdout).toMatch(/^git version /);
		const repoDir = join(fakeBinDir, "repo");
		mkdirSync(repoDir);
		const init = spawnSync("git", ["init", "--quiet", repoDir], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		expect(init.error).toBeUndefined();
		expect(init.status).toBe(0);
		const root = spawnSync("git", ["-C", repoDir, "rev-parse", "--show-toplevel"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		expect(root.error).toBeUndefined();
		expect(root.status).toBe(0);

		const central = spawnSync("where.exe", ["central"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		const editor = spawnSync("where.exe", ["code"], { env, encoding: "utf8", windowsHide: true });
		const jetbrains = spawnSync("where.exe", ["idea"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		const gitGui = spawnSync("where.exe", ["git-gui"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		expect([central.status, editor.status, jetbrains.status, gitGui.status]).toEqual([1, 1, 1, 1]);

		const pi = spawnSync("pi", ["--version"], { env, encoding: "utf8", windowsHide: true });
		const piErrorCode = pi.error && "code" in pi.error ? pi.error.code : undefined;
		expect(piErrorCode).toBe("ENOENT");
	} finally {
		rmSync(fakeBinDir, { recursive: true, force: true });
	}
});

windowsOnly("hermetic Windows E2E PATH does not expose the runner's Git directory", () => {
	const tempDir = mkdtempSync(join(tmpdir(), "thinkrail-e2e-path-"));
	try {
		const gitDirectory = (process.env.PATH ?? "")
			.split(delimiter)
			.find((directory) => existsSync(join(directory, "git.exe")));
		expect(gitDirectory).toBeDefined();
		if (!gitDirectory) throw new Error("Git for Windows must be available on the runner PATH");

		expect(hermeticE2ePath(tempDir, envWithPath(gitDirectory)).split(delimiter)).not.toContain(
			gitDirectory,
		);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

windowsOnly("hermetic Windows E2E PATH does not expose Central or editor executables", () => {
	const tempDir = mkdtempSync(join(tmpdir(), "thinkrail-e2e-path-"));
	const appDir = join(tempDir, "real-apps");
	try {
		mkdirSync(appDir);
		writeFileSync(join(appDir, "central.exe"), "not launched");
		writeFileSync(join(appDir, "code.exe"), "not launched");
		writeFileSync(join(appDir, "idea.exe"), "not launched");

		const path = hermeticE2ePath(tempDir, envWithPath(appDir));
		const env = envWithPath(path);
		const central = spawnSync("where.exe", ["central"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		const editor = spawnSync("where.exe", ["code"], { env, encoding: "utf8", windowsHide: true });
		const jetbrains = spawnSync("where.exe", ["idea"], {
			env,
			encoding: "utf8",
			windowsHide: true,
		});
		expect([central.status, editor.status, jetbrains.status]).toEqual([1, 1, 1]);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

windowsOnly("writeHermeticGitProxy runs under Node like Playwright globalSetup", () => {
	const fakeBinDir = mkdtempSync(join(tmpdir(), "thinkrail-e2e-node-git-"));
	try {
		const nodeExecutable = (process.env.PATH ?? "")
			.split(delimiter)
			.map((directory) => join(directory, "node.exe"))
			.find(existsSync);
		expect(nodeExecutable).toBeDefined();
		if (!nodeExecutable) throw new Error("Node.js must be available on the runner PATH");

		const sourceUrl = new URL("./executables.ts", import.meta.url).href;
		const script = `import { writeHermeticGitProxy } from ${JSON.stringify(sourceUrl)}; writeHermeticGitProxy(${JSON.stringify(fakeBinDir)});`;
		const result = spawnSync(nodeExecutable, ["--input-type=module", "--eval", script], {
			encoding: "utf8",
			windowsHide: true,
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(existsSync(join(fakeBinDir, "git.exe"))).toBe(true);
	} finally {
		rmSync(fakeBinDir, { recursive: true, force: true });
	}
});
