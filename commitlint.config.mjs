/**
 * 中文 Conventional Commits 設定：type 保留英文關鍵字，scope 與 subject 允許中文。
 */
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		// 中文 scope／subject 無大小寫可言，關閉 case 檢查
		"scope-case": [0],
		"subject-case": [0],
		// 中文占寬較大，上限放寬（subject 100、header 120）
		"subject-max-length": [2, "always", 100],
		"header-max-length": [2, "always", 120],
		// 正文／頁腳行寬放寬並降為警告
		"body-max-line-length": [1, "always", 200],
		"footer-max-line-length": [1, "always", 200],
	},
};
