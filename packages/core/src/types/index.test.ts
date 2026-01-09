import { describe, test, expect } from "bun:test";
import { getActiveProviders } from "./index.js";
import type { ProviderConfig } from "./index.js";

describe("getActiveProviders", () => {
	test("returns providers array when present", () => {
		const config: ProviderConfig = { providers: ["claude", "codex"] };
		expect(getActiveProviders(config)).toEqual(["claude", "codex"]);
	});

	test("returns single provider as array when present", () => {
		const config: ProviderConfig = { provider: "claude" };
		expect(getActiveProviders(config)).toEqual(["claude"]);
	});

	test("prefers providers array over single provider", () => {
		const config: ProviderConfig = {
			provider: "claude",
			providers: ["codex"],
		};
		expect(getActiveProviders(config)).toEqual(["codex"]);
	});

	test("returns claude as default when no provider specified", () => {
		const config: ProviderConfig = {};
		expect(getActiveProviders(config)).toEqual(["claude"]);
	});
});
