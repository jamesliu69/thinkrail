import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGIN_ENV_MARKER } from "@thinkrail/shared/shellEnv";

export function resolveBunExecutable(env: NodeJS.ProcessEnv = process.env): string {
	const name = process.platform === "win32" ? "bun.exe" : "bun";
	const executable = (env.PATH ?? "")
		.split(delimiter)
		.filter(Boolean)
		.map((directory) => join(directory, name))
		.find(existsSync);
	if (!executable) throw new Error("bun executable not found for the e2e host");
	return executable;
}

/** 從 runner 的 PATH 取得 Git 絕對路徑，供 fake-bin 代理器呼叫。 */
function resolveGitExecutable(env: NodeJS.ProcessEnv = process.env): string {
	const executable = (env.PATH ?? "")
		.split(delimiter)
		.filter(Boolean)
		.map((directory) => join(directory, "git.exe"))
		.find(existsSync);
	if (!executable) throw new Error("git executable not found for the Windows e2e host");
	return executable;
}

/** 建立只代理 Git 的 Windows 執行檔，讓 Git 安裝目錄不必進入 host PATH。 */
export function writeHermeticGitProxy(fakeBinDir: string): void {
	if (process.platform !== "win32") return;
	const source = join(fakeBinDir, "git-proxy.ts");
	const target = join(fakeBinDir, "git.exe");
	writeFileSync(
		source,
		[
			`const gitExecutable = ${JSON.stringify(resolveGitExecutable())};`,
			"const result = Bun.spawnSync([gitExecutable, ...process.argv.slice(2)], {",
			'\tstdin: "inherit", stdout: "inherit", stderr: "inherit",',
			"});",
			"process.exitCode = result.exitCode ?? 1;",
			"",
		].join("\n"),
	);
	try {
		const build = spawnSync(
			resolveBunExecutable(),
			["build", "--compile", source, "--outfile", target],
			{ encoding: "utf8", windowsHide: true },
		);
		if (build.error || build.status !== 0) {
			throw new Error(
				`Could not compile the isolated Git proxy: ${build.error?.message ?? build.stderr ?? ""}`,
			);
		}
	} finally {
		rmSync(source, { force: true });
	}
}

/** 建立僅含 fake-bin 與必要系統目錄的 E2E PATH，不沿用 runner PATH。 */
export function hermeticE2ePath(fakeBinDir: string, env: NodeJS.ProcessEnv = process.env): string {
	if (process.platform === "win32") {
		const systemRoot = env.SystemRoot ?? env.WINDIR;
		const systemPathEntries = systemRoot
			? [join(systemRoot, "System32")].filter((directory) => existsSync(directory))
			: [];
		const executableExtensions = [
			"",
			".com",
			".exe",
			".bat",
			".cmd",
			".ps1",
			...(env.PATHEXT ?? "").split(delimiter).filter(Boolean),
		];
		const forbiddenCommands = [
			"central",
			"pi",
			"code",
			"emacs",
			"idea",
			"webstorm",
			"pycharm",
			"goland",
			"rider",
			"clion",
			"phpstorm",
			"rubymine",
			"vim",
		];
		const safeSystemPaths = systemPathEntries.filter(
			(directory) =>
				!forbiddenCommands.some((command) =>
					executableExtensions.some((extension) =>
						existsSync(join(directory, `${command}${extension}`)),
					),
				),
		);
		return [fakeBinDir, ...safeSystemPaths].join(delimiter);
	}
	return [fakeBinDir, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(delimiter);
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
