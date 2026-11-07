import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { openAppFresh } from "./fixtures/app";
import { git } from "./fixtures/git";
import { E2E_DATA_DIR, E2E_FIXTURE_REPO, E2E_PICK_DIR_POINTER } from "./fixtures/paths";

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function parseWsFrame(message: unknown): Record<string, unknown> | null {
	if (typeof message !== "string") return null;
	try {
		const frame: unknown = JSON.parse(message);
		return frame !== null && typeof frame === "object" ? (frame as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function seedRepo(name: string): string {
	const repo = join(E2E_DATA_DIR, name);
	rmSync(repo, { recursive: true, force: true });
	mkdirSync(repo, { recursive: true });
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.email", "e2e@thinkrail.test");
	git(repo, "config", "user.name", "ThinkRail E2E");
	git(repo, "config", "commit.gpgsign", "false");
	writeFileSync(join(repo, "README.md"), "# second project\n");
	git(repo, "add", "-A");
	git(repo, "commit", "-m", "seed");
	return repo;
}

/** 在隔離路徑建立 Git 測試專案，並透過測試用目錄挑選器開啟它。 */
async function openBaseProject(page: Page, repoDirectory: string): Promise<string> {
	await openAppFresh(page);
	const repo = seedRepo(repoDirectory);
	writeFileSync(E2E_PICK_DIR_POINTER, repo);
	await page.getByTestId("add-project-menu").click();
	await page.getByTestId("menu-open-project").click();
	await expect(page.getByTestId("welcome-title")).toHaveText(basename(repo));
	return repo;
}

interface WireRule {
	key: string;
	method: string;
	parameter: string;
	value: string;
	hold: boolean;
}

async function gateProjectReplies(page: Page, rules: WireRule[]) {
	const states = new Map(
		rules.map((rule) => [
			rule.key,
			{
				rule,
				requestId: null as string | null,
				requested: deferred(),
				response: deferred(),
				acknowledged: deferred(),
				release: deferred(),
				wasRequested: false,
			},
		]),
	);
	const keyByRequest = new Map<string, string>();
	const barrier = deferred();
	let armed = false;
	let barrierArmed = false;
	await page.routeWebSocket(/\/ws(?:\?|$)/, (browserSocket) => {
		const serverSocket = browserSocket.connectToServer();
		browserSocket.onMessage((message) => {
			const frame = parseWsFrame(message);
			const params =
				frame?.params !== null && typeof frame?.params === "object"
					? (frame.params as Record<string, unknown>)
					: null;
			if (armed) {
				for (const [key, state] of states) {
					if (
						frame?.method === state.rule.method &&
						params?.[state.rule.parameter] === state.rule.value &&
						typeof frame.id === "string"
					) {
						state.requestId = frame.id;
						state.wasRequested = true;
						keyByRequest.set(frame.id, key);
						state.requested.resolve();
					}
				}
			}
			if (barrierArmed && frame?.method === "provider.status") {
				barrier.resolve();
			}
			if (Array.isArray(frame?.ack)) {
				for (const requestId of frame.ack) {
					const key = typeof requestId === "string" ? keyByRequest.get(requestId) : undefined;
					if (key) states.get(key)?.acknowledged.resolve();
				}
			}
			serverSocket.send(message);
		});
		serverSocket.onMessage((message) => {
			const frame = parseWsFrame(message);
			const key = typeof frame?.id === "string" ? keyByRequest.get(frame.id) : undefined;
			const state = key ? states.get(key) : undefined;
			if (state) {
				state.response.resolve();
				if (state.rule.hold) {
					void state.release.promise.then(() => browserSocket.send(message));
					return;
				}
			}
			browserSocket.send(message);
		});
	});
	return {
		arm: () => {
			armed = true;
		},
		request: (key: string) => {
			const state = states.get(key);
			if (!state) throw new Error(`Unknown wire rule: ${key}`);
			return state.requested.promise;
		},
		response: (key: string) => {
			const state = states.get(key);
			if (!state) throw new Error(`Unknown wire rule: ${key}`);
			return state.response.promise;
		},
		acknowledged: (key: string) => {
			const state = states.get(key);
			if (!state) throw new Error(`Unknown wire rule: ${key}`);
			return state.acknowledged.promise;
		},
		release: (key: string) => {
			const state = states.get(key);
			if (!state) throw new Error(`Unknown wire rule: ${key}`);
			state.release.resolve();
		},
		wasRequested: (key: string) => states.get(key)?.wasRequested ?? false,
		armBarrier: () => {
			barrierArmed = true;
		},
		barrier: barrier.promise,
	};
}

async function observeProjectOpen(page: Page) {
	const requested = deferred();
	let path: string | null = null;
	await page.routeWebSocket(/\/ws(?:\?|$)/, (browserSocket) => {
		const serverSocket = browserSocket.connectToServer();
		browserSocket.onMessage((message) => {
			const frame = parseWsFrame(message);
			const params =
				frame?.params !== null && typeof frame?.params === "object"
					? (frame.params as Record<string, unknown>)
					: null;
			if (frame?.method === "project.open" && typeof params?.path === "string" && path === null) {
				path = params.path;
				requested.resolve();
			}
			serverSocket.send(message);
		});
		serverSocket.onMessage((message) => browserSocket.send(message));
	});
	return { requested: requested.promise, path: () => path };
}

function dispatchFileDrop(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const dt = new DataTransfer();
		const file = new File(["hello"], "notes.txt", { type: "text/plain" });
		dt.items.add(file);
		const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
		document.body.dispatchEvent(
			new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(
			new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(drop);
		return drop.defaultPrevented;
	});
}

function dispatchFolderDrop(page: Page, name: string): Promise<boolean> {
	return page.evaluate((folderName) => {
		const dt = new DataTransfer();
		dt.items.add(new File([""], folderName));
		Object.defineProperty(DataTransferItem.prototype, "webkitGetAsEntry", {
			configurable: true,
			value: () => ({ name: folderName, isDirectory: true }),
		});
		const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
		document.body.dispatchEvent(
			new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(
			new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(drop);
		return drop.defaultPrevented;
	}, name);
}

test("dropping a file opens no dialog and does not navigate", async ({ page }) => {
	await openBaseProject(page, "file-drop/base-project");
	const urlBefore = page.url();

	expect(await dispatchFileDrop(page)).toBe(false);
	await page.waitForTimeout(1_000);

	await expect(page.getByTestId("located-folders-dialog")).toHaveCount(0);
	await expect(page.getByTestId("open-project-path-dialog")).toHaveCount(0);
	await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
	await expect(page).toHaveURL(urlBefore);
});

test("a file drag shows the drop overlay and clears it after the drop", async ({ page }) => {
	await openBaseProject(page, "overlay/base-project");

	await page.evaluate(() => {
		const dt = new DataTransfer();
		dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
		document.body.dispatchEvent(
			new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
	});
	await expect(page.getByTestId("dropped-folder-overlay")).toBeVisible();

	await dispatchFileDrop(page);
	await expect(page.getByTestId("dropped-folder-overlay")).toBeHidden();
});

test("a modal keeps a folder drop unclaimed", async ({ page }) => {
	const repo = await openBaseProject(page, "modal/base-project");
	await page.getByTestId("open-settings").click();
	await expect(page.getByTestId("settings-dialog")).toBeVisible();

	expect(await dispatchFolderDrop(page, basename(repo))).toBe(false);
	await expect(page.getByTestId("settings-dialog")).toBeVisible();
	await expect(page.getByTestId("located-folders-dialog")).toHaveCount(0);
});

test("submitting a host path preserves its exact whitespace", async ({ page }) => {
	const open = await observeProjectOpen(page);
	await openAppFresh(page);
	await page.getByTestId("add-project-menu").click();
	await page.getByTestId("menu-enter-host-path").click();
	const pathDialog = page.getByTestId("open-project-path-dialog");
	const rawPath = `${E2E_FIXTURE_REPO} `;
	await pathDialog.getByTestId("open-project-path-input").fill(rawPath);
	await pathDialog.getByTestId("open-project-path-submit").click();
	await open.requested;
	expect(open.path()).toBe(rawPath);
});

test("a manual project open supersedes a pending folder lookup", async ({ page }) => {
	const baseRepo = join(E2E_DATA_DIR, "manual-open", "base-project");
	const gate = await gateProjectReplies(page, [
		{
			key: "locate",
			method: "project.locateFolder",
			parameter: "name",
			value: basename(baseRepo),
			hold: true,
		},
		{
			key: "reopen-sample",
			method: "project.open",
			parameter: "path",
			value: baseRepo,
			hold: false,
		},
	]);
	await openBaseProject(page, "manual-open/base-project");
	const manualRepo = seedRepo("manual-open/second-project");
	gate.arm();
	expect(await dispatchFolderDrop(page, basename(baseRepo))).toBe(true);
	await gate.request("locate");
	await gate.response("locate");

	await page.getByTestId("add-project-menu").click();
	await page.getByTestId("menu-enter-host-path").click();
	const pathDialog = page.getByTestId("open-project-path-dialog");
	await pathDialog.getByTestId("open-project-path-input").fill(manualRepo);
	await pathDialog.getByTestId("open-project-path-submit").click();
	await expect(page.getByTestId("welcome-title")).toHaveText(basename(manualRepo));

	gate.release("locate");
	await gate.acknowledged("locate");
	gate.armBarrier();
	await page.getByTestId("open-settings").click();
	await gate.barrier;

	expect(gate.wasRequested("reopen-sample")).toBe(false);
	await expect(page.getByTestId("welcome-title")).toHaveText(basename(manualRepo));
});

test("a later folder drop supersedes an earlier project-open request", async ({ page }) => {
	const secondRepo = join(E2E_DATA_DIR, "later-drop", "second-project");
	const baseRepo = join(E2E_DATA_DIR, "later-drop", "base-project");
	const gate = await gateProjectReplies(page, [
		{
			key: "open-second",
			method: "project.open",
			parameter: "path",
			value: secondRepo,
			hold: true,
		},
		{
			key: "locate-sample",
			method: "project.locateFolder",
			parameter: "name",
			value: basename(baseRepo),
			hold: true,
		},
		{
			key: "open-sample",
			method: "project.open",
			parameter: "path",
			value: baseRepo,
			hold: false,
		},
	]);
	await openBaseProject(page, "later-drop/base-project");
	seedRepo("later-drop/second-project");
	gate.arm();

	expect(await dispatchFolderDrop(page, basename(secondRepo))).toBe(true);
	await gate.request("open-second");
	await gate.response("open-second");
	expect(await dispatchFolderDrop(page, basename(baseRepo))).toBe(true);
	await gate.request("locate-sample");
	await gate.response("locate-sample");

	gate.release("open-second");
	await gate.acknowledged("open-second");
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
	await expect(page.getByTestId("welcome-title")).toHaveText(basename(baseRepo));

	gate.release("locate-sample");
	await gate.acknowledged("locate-sample");
	await gate.request("open-sample");
	await gate.response("open-sample");
	await gate.acknowledged("open-sample");
});
