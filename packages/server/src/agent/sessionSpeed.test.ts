import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { readSessionSpeed, writeSessionSpeed } from "./sessionSpeed";

describe("session speed", () => {
	test("defaults to standard and isolates each session", () => {
		const first = SessionManager.inMemory();
		const second = SessionManager.inMemory();
		expect(readSessionSpeed(first)).toBe("standard");
		writeSessionSpeed(first, "fast");
		expect(readSessionSpeed(first)).toBe("fast");
		expect(readSessionSpeed(second)).toBe("standard");
		writeSessionSpeed(first, "standard");
		expect(readSessionSpeed(first)).toBe("standard");
	});

	test("restores the choice from a reopened persisted session", () => {
		const dir = mkdtempSync(join(tmpdir(), "trpi-speed-"));
		try {
			const session = SessionManager.create(dir, dir);
			writeSessionSpeed(session, "fast");
			session.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
			const file = session.getSessionFile();
			if (!file) throw new Error("missing session file");
			expect(readSessionSpeed(SessionManager.open(file))).toBe("fast");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("uses the latest valid entry on the active branch and ignores malformed values", () => {
		const session = SessionManager.inMemory();
		writeSessionSpeed(session, "fast");
		const fastLeaf = session.getLeafId();
		writeSessionSpeed(session, "standard");
		session.appendCustomEntry("thinkrail.chat-speed", "invalid");
		expect(readSessionSpeed(session)).toBe("standard");
		if (!fastLeaf) throw new Error("missing leaf");
		session.branch(fastLeaf);
		expect(readSessionSpeed(session)).toBe("fast");
	});
});
