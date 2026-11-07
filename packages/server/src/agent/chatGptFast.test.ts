import { describe, expect, test } from "bun:test";
import {
	type ExtensionAPI,
	type ExtensionContext,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { chatGptFastExtension, chatGptFastSupported, fastRequestPayload } from "./chatGptFast";
import type { PiRuntimeGeneration } from "./piRuntime";
import { writeSessionSpeed } from "./sessionSpeed";

const model = {
	provider: "openai",
	api: "openai-responses",
	baseUrl: "https://api.openai.com/v1",
	id: "gpt-6.1-sol",
};

describe("ChatGPT Fast request", () => {
	test("the pi hook honors session changes and resolved OAuth credentials", async () => {
		const session = SessionManager.inMemory();
		let source = "OAuth";
		let apiKey = "token";
		const generation = {
			runtime: {
				isUsingOAuth: () => true,
				getAuth: async () => ({ source, auth: { apiKey } }),
			},
			opaqueProviderIds: new Set<string>(),
		} as unknown as Pick<PiRuntimeGeneration, "runtime" | "opaqueProviderIds">;
		let handler:
			| ((
					event: { type: "before_provider_request"; payload: unknown },
					ctx: ExtensionContext,
			  ) => unknown)
			| undefined;
		const api = {
			on: (_name: string, callback: typeof handler) => {
				handler = callback;
			},
		} as unknown as ExtensionAPI;
		await chatGptFastExtension(session, generation)(api);
		if (!handler) throw new Error("missing hook");
		const event = { type: "before_provider_request" as const, payload: { model: model.id } };
		const ctx = { model } as ExtensionContext;
		expect(await handler(event, ctx)).toBeUndefined();
		writeSessionSpeed(session, "fast");
		expect(await handler(event, ctx)).toEqual({ model: model.id, service_tier: "priority" });
		source = "runtime";
		expect(await handler(event, ctx)).toBeUndefined();
		source = "OAuth";
		apiKey = "";
		expect(await handler(event, ctx)).toBeUndefined();
		apiKey = "sk-not-oauth";
		expect(await handler(event, ctx)).toBeUndefined();
		apiKey = "token";
		writeSessionSpeed(session, "standard");
		expect(await handler(event, ctx)).toBeUndefined();
	});
	test("requires a supported model, native OpenAI endpoint and OAuth", () => {
		expect(chatGptFastSupported(model, true, false)).toBe(true);
		expect(chatGptFastSupported(model, false, false)).toBe(false);
		expect(chatGptFastSupported(model, true, true)).toBe(false);
		expect(chatGptFastSupported({ ...model, id: "unknown" }, true, false)).toBe(false);
		expect(chatGptFastSupported({ ...model, provider: "openai-codex" }, true, false)).toBe(false);
		expect(chatGptFastSupported({ ...model, baseUrl: "https://example.com" }, true, false)).toBe(
			false,
		);
		expect(chatGptFastSupported({ ...model, api: "openai-completions" }, true, false)).toBe(false);
	});

	test("requests priority only for Fast and the actual supported model", () => {
		const payload = { model: model.id, input: [] };
		expect(fastRequestPayload(payload, "fast", model, true, false)).toEqual({
			...payload,
			service_tier: "priority",
		});
		expect(fastRequestPayload(payload, "standard", model, true, false)).toBeUndefined();
		expect(fastRequestPayload(payload, "fast", model, false, false)).toBeUndefined();
		expect(
			fastRequestPayload({ ...payload, model: "different" }, "fast", model, true, false),
		).toBeUndefined();
		expect(fastRequestPayload(null, "fast", model, true, false)).toBeUndefined();
	});
});
