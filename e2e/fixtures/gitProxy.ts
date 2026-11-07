export {};

/** 編譯時固定 runner 選定的 Git 路徑，不依賴宿主再次搜尋 PATH。 */
declare const E2E_GIT_EXECUTABLE: string;

/** 將原始參數與標準串流交給真實 Git，並等待它結束以保留 exit code。 */
const child = Bun.spawn([E2E_GIT_EXECUTABLE, ...process.argv.slice(2)], {
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	windowsHide: true,
});
process.exit(await child.exited);
