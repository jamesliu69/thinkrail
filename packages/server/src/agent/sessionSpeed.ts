import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionSpeed } from "@thinkrail/contracts";

/** pi session tree 中保存對話速度的擴充狀態識別碼。 */
const SPEED_ENTRY = "thinkrail.chat-speed";

/** 從目前分支還原最近一次有效的速度選擇，缺省時使用標準速度。 */
export function readSessionSpeed(session: SessionManager): SessionSpeed {
	for (const entry of session.getBranch().reverse()) {
		if (entry.type === "custom" && entry.customType === SPEED_ENTRY) {
			if (entry.data === "fast" || entry.data === "standard") return entry.data;
		}
	}
	return "standard";
}

/** 將速度選擇附加到 pi session tree，不納入模型上下文。 */
export function writeSessionSpeed(session: SessionManager, speed: SessionSpeed): void {
	session.appendCustomEntry(SPEED_ENTRY, speed);
}
