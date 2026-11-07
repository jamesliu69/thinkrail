import { describe, expect, test } from "bun:test";
import { droppedFolderName } from "./droppedFolder";

describe("droppedFolderName", () => {
	test("returns the trimmed name when the drop is exactly one directory", () => {
		expect(
			droppedFolderName({
				itemCount: 1,
				entries: [{ name: " my-project ", isDirectory: true }],
			}),
		).toBe("my-project");
	});

	test("a single dropped file is not a folder open", () => {
		expect(
			droppedFolderName({ itemCount: 1, entries: [{ name: "notes.txt", isDirectory: false }] }),
		).toBeNull();
	});

	test("a mixed drop of folder and file is ignored", () => {
		expect(
			droppedFolderName({
				itemCount: 2,
				entries: [
					{ name: "project", isDirectory: true },
					{ name: "notes.txt", isDirectory: false },
				],
			}),
		).toBeNull();
	});

	test("two dropped folders are ambiguous and ignored", () => {
		expect(
			droppedFolderName({
				itemCount: 2,
				entries: [
					{ name: "a", isDirectory: true },
					{ name: "b", isDirectory: true },
				],
			}),
		).toBeNull();
	});

	test("an entry count that disagrees with the item count is ignored", () => {
		expect(
			droppedFolderName({
				itemCount: 2,
				entries: [{ name: "project", isDirectory: true }],
			}),
		).toBeNull();
		expect(
			droppedFolderName({
				itemCount: 1,
				entries: [
					{ name: "a", isDirectory: true },
					{ name: "b", isDirectory: true },
				],
			}),
		).toBeNull();
	});

	test("a null entry list (no entries API) never opens anything", () => {
		expect(droppedFolderName({ itemCount: 1, entries: null })).toBeNull();
		expect(droppedFolderName({ itemCount: 0, entries: null })).toBeNull();
	});

	test("a whitespace-only folder name is ignored", () => {
		expect(
			droppedFolderName({ itemCount: 1, entries: [{ name: "  ", isDirectory: true }] }),
		).toBeNull();
	});
});
