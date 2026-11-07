import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { userInfo } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGIN_ENV_MARKER } from "@thinkrail/shared/shellEnv";

/** 依指定 PATH 的順序尋找執行檔，並固定為不受代理工作目錄影響的絕對路徑。 */
function resolveFromPath(name: string, env: NodeJS.ProcessEnv): string | undefined {
	return (env.PATH ?? "")
		.split(delimiter)
		.filter(Boolean)
		.map((directory) => resolve(directory, name))
		.find(existsSync);
}

export function resolveBunExecutable(env: NodeJS.ProcessEnv = process.env): string {
	const name = process.platform === "win32" ? "bun.exe" : "bun";
	const executable = resolveFromPath(name, env);
	if (!executable) throw new Error("bun executable not found for the e2e host");
	return executable;
}

export function resolveGitExecutable(env: NodeJS.ProcessEnv = process.env): string {
	const name = process.platform === "win32" ? "git.exe" : "git";
	const executable = resolveFromPath(name, env);
	if (!executable) throw new Error("git executable not found for the e2e host");
	return executable;
}

/** 以 lstat 拒絕快取連結；POSIX 同時限制擁有者與可寫權限，私有目錄只允許目前 uid 存取。 */
function safeGitCacheEntry(path: string, kind: "ancestor" | "directory" | "file"): boolean {
	const entry = lstatSync(path, { throwIfNoEntry: false });
	if (!entry) return false;
	if (entry.isSymbolicLink() || (kind === "file" ? !entry.isFile() : !entry.isDirectory())) {
		throw new Error(`Unsafe e2e Git cache entry: ${path}`);
	}
	if (process.platform !== "win32") {
		const uid = userInfo().uid;
		const ownerAllowed = entry.uid === uid || (kind === "ancestor" && entry.uid === 0);
		const deniedPermissions = kind === "directory" ? 0o077 : 0o022;
		const stickyAncestor = kind === "ancestor" && (entry.mode & 0o1000) !== 0;
		if (!ownerAllowed || ((entry.mode & deniedPermissions) !== 0 && !stickyAncestor)) {
			throw new Error(`Unsafe e2e Git cache permissions: ${path}`);
		}
	}
	return true;
}

/** 在 OS 帳號 home 下建立私有快取，保留並拒絕不可信的既有目錄，不讀寫舊的共享暫存快取。 */
function privateGitCacheRoot(): string {
	const home = userInfo().homedir;
	const ancestors = [home];
	if (process.platform !== "win32") {
		for (let path = dirname(home); path !== ancestors[0]; path = dirname(path)) {
			ancestors.unshift(path);
		}
	}
	for (const path of ancestors) {
		if (!safeGitCacheEntry(path, "ancestor")) {
			throw new Error(`Unsafe e2e Git cache ancestor: ${path}`);
		}
	}
	const root = join(home, ".thinkrail-e2e-git");
	try {
		mkdirSync(root, { mode: 0o700 });
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
	}
	if (!safeGitCacheEntry(root, "directory")) {
		throw new Error(`Unsafe e2e Git cache directory: ${root}`);
	}
	return root;
}

/** 僅重用完整且未經連結轉向的私有快取；已發布卻缺少 Git 的目錄視為不可信。 */
function gitCacheReady(directory: string, name: string): boolean {
	if (!safeGitCacheEntry(directory, "directory")) return false;
	if (!safeGitCacheEntry(join(directory, name), "file")) {
		throw new Error(`Unsafe e2e Git cache executable missing: ${directory}`);
	}
	return true;
}

/** 發布只含 Git 的不可變代理目錄，避免加入整個安裝目錄並在資料重設後繼續供宿主使用。 */
function prepareGitProxy(env: NodeJS.ProcessEnv): string {
	const gitExecutable = resolveGitExecutable(env);
	const bunExecutable = process.platform === "win32" ? resolveBunExecutable(env) : undefined;
	const sourcePath = fileURLToPath(new URL("./gitProxy.ts", import.meta.url));
	const source = bunExecutable
		? readFileSync(sourcePath, "utf8")
		: `#!/bin/sh\nexec ${shellQuote(gitExecutable)} "$@"\n`;
	const buildArgs = [
		"build",
		"--compile",
		"--compile-exec-argv=--no-orphans",
		"--no-compile-autoload-bunfig",
		"--no-compile-autoload-dotenv",
		"--define",
		`E2E_GIT_EXECUTABLE=${JSON.stringify(gitExecutable)}`,
	];
	const executables = bunExecutable ? [gitExecutable, bunExecutable] : [gitExecutable];
	const identities = executables.map((executable) => {
		const stat = statSync(executable);
		return [executable, stat.size, stat.mtimeMs];
	});
	const key = createHash("sha256")
		.update(JSON.stringify([process.platform, process.arch, source, buildArgs, identities]))
		.digest("hex");
	const cacheRoot = privateGitCacheRoot();
	const directory = join(cacheRoot, key);
	const name = bunExecutable ? "git.exe" : "git";
	if (gitCacheReady(directory, name)) return directory;
	const staging = mkdtempSync(join(cacheRoot, `${key}-build-`));
	try {
		if (bunExecutable) {
			execFileSync(bunExecutable, [...buildArgs, "--outfile", join(staging, name), sourcePath], {
				cwd: staging,
				env,
				windowsHide: true,
				stdio: ["ignore", "ignore", "inherit"],
			});
		} else {
			writeFileSync(join(staging, name), source, { mode: 0o755 });
		}
		try {
			renameSync(staging, directory);
		} catch (error) {
			if (!gitCacheReady(directory, name)) throw error;
		}
	} finally {
		rmSync(staging, { recursive: true, force: true, maxRetries: 3 });
	}
	return directory;
}

/** 保持 fixture 命令優先，只額外公開選定的 Git 代理與既有 POSIX 基本工具。 */
export function hermeticE2ePath(fakeBinDir: string, env: NodeJS.ProcessEnv = process.env): string {
	return [fakeBinDir, prepareGitProxy(env), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(
		delimiter,
	);
}

export function hermeticE2eShell(fakeBinDir: string): string {
	return join(fakeBinDir, "login-shell");
}

export function writeHermeticE2eShell(fakeBinDir: string, realShell: string): void {
	const script = [
		"#!/bin/sh",
		'case "$*" in',
		`\t*${shellQuote(LOGIN_ENV_MARKER)}*) printf '%sPATH=%s\\0' ${shellQuote(LOGIN_ENV_MARKER)} ${shellQuote(hermeticE2ePath(fakeBinDir))}; exit 0 ;;`,
		"esac",
		`exec ${shellQuote(realShell)} "$@"`,
		"",
	].join("\n");
	const target = hermeticE2eShell(fakeBinDir);
	writeFileSync(target, script);
	chmodSync(target, 0o755);
}

export function writeFakeGh(fakeBinDir: string, scenarioPath: string, logPath: string): void {
	const source = fileURLToPath(new URL("./fakeGh.ts", import.meta.url));
	const script = [
		"#!/bin/sh",
		`exec ${[resolveBunExecutable(), source, scenarioPath, logPath].map(shellQuote).join(" ")} "$@"`,
		"",
	].join("\n");
	const target = join(fakeBinDir, "gh");
	writeFileSync(target, script);
	chmodSync(target, 0o755);
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}
