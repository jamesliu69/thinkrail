import { expect, type Page, test } from "@playwright/test";
import { openFixtureProject } from "./fixtures/app";

function dispatchFileDrop(page: Page): Promise<void> {
	return page.evaluate(() => {
		const dt = new DataTransfer();
		const file = new File(["hello"], "notes.txt", { type: "text/plain" });
		dt.items.add(file);
		document.body.dispatchEvent(
			new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(
			new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
		document.body.dispatchEvent(
			new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }),
		);
	});
}

test("dropping a file opens no dialog and does not navigate", async ({ page }) => {
	await openFixtureProject(page);
	const urlBefore = page.url();

	await dispatchFileDrop(page);
	await page.waitForTimeout(1_000);

	await expect(page.getByTestId("located-folders-dialog")).toHaveCount(0);
	await expect(page.getByTestId("open-project-path-dialog")).toHaveCount(0);
	await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
	await expect(page).toHaveURL(urlBefore);
});

test("a file drag shows the drop overlay and clears it after the drop", async ({ page }) => {
	await openFixtureProject(page);

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
