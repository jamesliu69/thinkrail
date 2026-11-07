import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionFactory, SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionSpeed } from "@thinkrail/contracts";
import type { PiRuntimeGeneration } from "./piRuntime";
import { readSessionSpeed } from "./sessionSpeed";

/** OpenAI 公布支援 Codex Fast 的模型；新模型須確認相容後加入。 */
const FAST_MODELS: ReadonlySet<string> = new Set([
	"gpt-6-astra",
	"gpt-6-luna",
	"gpt-6-sol",
	"gpt-6.1-sol",
	"gpt-6.1-terra",
]);

type ModelIdentity = Pick<Model<string>, "provider" | "api" | "baseUrl" | "id">;

/** 限定使用原生 ChatGPT OAuth 路徑及已知相容模型，避免影響其他供應者。 */
export function chatGptFastSupported(
	model: ModelIdentity,
	oauth: boolean,
	opaque: boolean,
): boolean {
	return (
		oauth &&
		!opaque &&
		model.provider === "openai" &&
		model.api === "openai-responses" &&
		model.baseUrl === "https://api.openai.com/v1" &&
		FAST_MODELS.has(model.id)
	);
}

/** 只在目前請求模型與對話模型一致時，要求 OpenAI 優先處理。 */
export function fastRequestPayload(
	payload: unknown,
	speed: SessionSpeed,
	model: ModelIdentity,
	oauth: boolean,
	opaque: boolean,
): unknown {
	if (
		speed !== "fast" ||
		!chatGptFastSupported(model, oauth, opaque) ||
		!payload ||
		typeof payload !== "object" ||
		Array.isArray(payload) ||
		!("model" in payload) ||
		payload.model !== model.id
	)
		return undefined;
	return { ...payload, service_tier: "priority" };
}

/** 在 pi 傳送前依當前對話設定與實際憑證來源加入 Fast 要求。 */
export function chatGptFastExtension(
	session: SessionManager,
	generation: Pick<PiRuntimeGeneration, "runtime" | "opaqueProviderIds">,
): ExtensionFactory {
	return (pi) => {
		pi.on("before_provider_request", async (event, ctx) => {
			const model = ctx.model;
			if (
				!model ||
				readSessionSpeed(session) !== "fast" ||
				!chatGptFastSupported(
					model,
					generation.runtime.isUsingOAuth(model.provider),
					generation.opaqueProviderIds.has(model.provider),
				)
			)
				return;
			const auth = await generation.runtime.getAuth(model);
			if (auth?.source !== "OAuth" || !auth.auth.apiKey || auth.auth.apiKey.startsWith("sk-"))
				return;
			return fastRequestPayload(event.payload, "fast", model, true, false);
		});
	};
}
