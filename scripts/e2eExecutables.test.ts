import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { delimiter, dirname, join } from "node:path";
import {
	hermeticE2ePath,
	resolveBunExecutable,
	resolveGitExecutable,
} from "../e2e/fixtures/executables";

/** 保存本組測試建立的來源執行檔與 lane 資料，結束後整棵清除。 */
const root = mkdtempSync(join(tmpdir(), "thinkrail-e2e-executables-"));
/** 模擬同時安裝 Git、central 與 pi 的開發者工具目錄。 */
const sourceBin = join(root, "developer bin & tools");
/** 模擬會被 global setup 重設的 lane 資料根目錄。 */
const dataDir = join(root, "data");
/** 保留 fixture 命令優先權的 lane 內部目錄。 */
const fakeBin = join(dataDir, ".bun", "bin");
/** 使用目前平台可依 git 名稱尋找的執行檔名稱。 */
const gitName = process.platform === "win32" ? "git.exe" : "git";
/** 固定測試開始時選定的真實 Git，供來源代理呼叫。 */
const realGit = resolveGitExecutable();
/** 固定既有 Bun 的絕對路徑，供 Windows fixture 編譯使用。 */
const realBun = resolveBunExecutable();
/** 僅公開帶有 sentinel 的來源目錄與編譯工具，讓測試不依賴其他開發者 PATH。 */
const sourceEnv = { ...process.env, PATH: [sourceBin, dirname(realBun)].join(delimiter) };
/** 限定只能清除本組 Git 身分產生、位於目前 OS 帳號 home 下的代理快取。 */
const cacheRoot = join(userInfo().homedir, ".thinkrail-e2e-git");
/** 共用準備完成的宿主 PATH，供隔離、參數與生命週期斷言重用。 */
let hostPath: string;

beforeAll(() => {
	mkdirSync(sourceBin, { recursive: true });
	mkdirSync(fakeBin, { recursive: true });
	if (process.platform === "win32") {
		const source = join(root, "selected-git.ts");
		writeFileSync(
			source,
			`import { spawnSync } from "node:child_process";\nconst result = spawnSync(${JSON.stringify(realGit)}, process.argv.slice(2), { stdio: "inherit", windowsHide: true });\nprocess.exit(result.status ?? 1);\n`,
		);
		execFileSync(
			realBun,
			[
				"build",
				"--compile",
				"--compile-exec-argv=--no-orphans",
				"--no-compile-autoload-bunfig",
				"--no-compile-autoload-dotenv",
				"--outfile",
				join(sourceBin, gitName),
				source,
			],
			{ cwd: root, windowsHide: true, stdio: ["ignore", "ignore", "inherit"] },
		);
	} else {
		writeFileSync(
			join(sourceBin, gitName),
			`#!/bin/sh\nexec '${realGit.replaceAll("'", `'\\''`)}' "$@"\n`,
			{ mode: 0o755 },
		);
	}
	for (const command of ["central", "pi"]) {
		const target = join(sourceBin, `${command}${process.platform === "win32" ? ".exe" : ""}`);
		writeFileSync(target, "#!/bin/sh\nexit 87\n");
		chmodSync(target, 0o755);
	}
	hostPath = hermeticE2ePath(fakeBin, sourceEnv);
});

afterAll(() => {
	const shimDir = hostPath?.split(delimiter)[1];
	if (shimDir && dirname(shimDir) === cacheRoot) {
		rmSync(shimDir, { recursive: true, force: true });
	}
	rmSync(root, { recursive: true, force: true });
});

test("host PATH excludes central and pi next to the selected git", () => {
	for (const command of ["central", "pi"]) {
		expect(Bun.which(command, { PATH: sourceEnv.PATH })).not.toBeNull();
		expect(Bun.which(command, { PATH: hostPath })).toBeNull();
	}
	expect(hostPath.split(delimiter)).not.toContain(sourceBin);
});

test("git by name preserves special argv and the selected Git's nonzero exit", () => {
	const env = { ...sourceEnv, PATH: hostPath };
	const value = "spaces & %PATH% ! ^ ; \"quotes\" 'single'";
	const result = spawnSync(
		"git",
		["-C", "", "-c", `fixture.value=${value}`, "config", "--get", "fixture.value"],
		{
			env,
			cwd: root,
			encoding: "utf8",
			windowsHide: true,
		},
	);
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout.trimEnd()).toBe(value);
	const failure = spawnSync("git", ["-C", join(root, "missing"), "rev-parse", "--git-dir"], {
		env,
		cwd: root,
		encoding: "utf8",
		windowsHide: true,
	});
	expect(failure.error).toBeUndefined();
	expect(failure.status).toBe(128);
	expect(failure.stderr).toContain("missing");
});

test("the Git proxy inherits stdin without changing stdout", () => {
	const input = "Git stdin & %PATH%\n";
	const expected = execFileSync(realGit, ["hash-object", "--stdin"], {
		input,
		encoding: "utf8",
		windowsHide: true,
	});
	const result = spawnSync("git", ["hash-object", "--stdin"], {
		env: { ...sourceEnv, PATH: hostPath },
		cwd: root,
		input,
		encoding: "utf8",
		windowsHide: true,
	});
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout).toBe(expected);
});

test("fake-bin retains precedence over the Git proxy", () => {
	const fakeGit = join(fakeBin, gitName);
	copyFileSync(join(sourceBin, gitName), fakeGit);
	try {
		expect(Bun.which("git", { PATH: hostPath })).toBe(fakeGit);
	} finally {
		rmSync(fakeGit);
	}
});

test("Git remains available after global setup clears the lane data directory", () => {
	rmSync(dataDir, { recursive: true, force: true });
	const result = spawnSync("git", ["--version"], {
		env: { ...sourceEnv, PATH: hostPath },
		cwd: root,
		encoding: "utf8",
		windowsHide: true,
	});
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout).toMatch(/^git version /);
	mkdirSync(fakeBin, { recursive: true });
	expect(hermeticE2ePath(fakeBin, sourceEnv)).toBe(hostPath);
});

test("the proxy cache stays under the OS account home despite environment overrides", () => {
	expect(dirname(hostPath.split(delimiter)[1] ?? "")).toBe(cacheRoot);
	expect(
		hermeticE2ePath(fakeBin, {
			...sourceEnv,
			HOME: root,
			USERPROFILE: root,
			TMP: root,
			TEMP: root,
		}),
	).toBe(hostPath);
});

test("a preplaced cache directory link is rejected before Git can run", () => {
	const proxyDir = hostPath.split(delimiter)[1];
	if (!proxyDir) throw new Error("expected a prepared proxy directory");
	const original = `${proxyDir}-test-backup`;
	const attacker = join(root, "untrusted-proxy");
	mkdirSync(attacker);
	writeFileSync(join(attacker, gitName), "untrusted git executable");
	renameSync(proxyDir, original);
	let linked = false;
	try {
		symlinkSync(attacker, proxyDir, process.platform === "win32" ? "junction" : "dir");
		linked = true;
		expect(() => hermeticE2ePath(fakeBin, sourceEnv)).toThrow(/unsafe.*cache/i);
	} finally {
		if (linked) unlinkSync(proxyDir);
		renameSync(original, proxyDir);
	}
});

test("a cached Git entry that is a directory is rejected", () => {
	const proxyDir = hostPath.split(delimiter)[1];
	if (!proxyDir) throw new Error("expected a prepared proxy directory");
	const executable = join(proxyDir, gitName);
	const original = `${executable}-test-backup`;
	renameSync(executable, original);
	try {
		mkdirSync(executable);
		expect(() => hermeticE2ePath(fakeBin, sourceEnv)).toThrow(/unsafe.*cache/i);
	} finally {
		rmSync(executable, { recursive: true, force: true });
		renameSync(original, executable);
	}
});

test.skipIf(process.platform === "win32")(
	"a POSIX cache accessible to other users is rejected",
	() => {
		const proxyDir = hostPath.split(delimiter)[1];
		if (!proxyDir) throw new Error("expected a prepared proxy directory");
		chmodSync(proxyDir, 0o755);
		try {
			expect(() => hermeticE2ePath(fakeBin, sourceEnv)).toThrow(/unsafe.*cache.*permissions/i);
		} finally {
			chmodSync(proxyDir, 0o700);
		}
	},
);

test("parallel preparation publishes one complete Git proxy", async () => {
	const proxyDir = hostPath.split(delimiter)[1];
	if (!proxyDir || dirname(proxyDir) !== cacheRoot) {
		throw new Error("expected a disposable proxy cache for this fixture's selected Git");
	}
	rmSync(proxyDir, { recursive: true, force: true });
	const moduleUrl = new URL("../e2e/fixtures/executables.ts", import.meta.url).href;
	const script = `import { hermeticE2ePath } from ${JSON.stringify(moduleUrl)};\nprocess.stdout.write(hermeticE2ePath(${JSON.stringify(fakeBin)}));\n`;
	const children = Array.from({ length: 2 }, () =>
		Bun.spawn([realBun, "--eval", script], {
			cwd: root,
			env: sourceEnv,
			stdout: "pipe",
			stderr: "pipe",
			windowsHide: true,
		}),
	);
	const results = await Promise.all(
		children.map(async (child) => {
			const [exitCode, path, stderr] = await Promise.all([
				child.exited,
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
			]);
			return { exitCode, path, stderr };
		}),
	);
	expect(results).toEqual([
		{ exitCode: 0, path: hostPath, stderr: "" },
		{ exitCode: 0, path: hostPath, stderr: "" },
	]);
	const result = spawnSync("git", ["--version"], {
		env: { ...sourceEnv, PATH: hostPath },
		cwd: root,
		encoding: "utf8",
		windowsHide: true,
	});
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout).toMatch(/^git version /);
});
