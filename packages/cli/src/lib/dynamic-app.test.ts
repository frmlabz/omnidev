import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { resolveCapabilityPath } from "./dynamic-app";

describe("resolveCapabilityPath", () => {
	test("resolves relative capability paths from cwd", () => {
		const cwd = "/workspace/project";

		expect(resolveCapabilityPath(".omni/capabilities/ralph", cwd)).toBe(
			join(cwd, ".omni", "capabilities", "ralph"),
		);
	});

	test("keeps absolute capability paths absolute", () => {
		const cwd = "/workspace/project";
		const capabilityPath = "/workspace/project/.omni/capabilities/ralph";

		expect(resolveCapabilityPath(capabilityPath, cwd)).toBe(resolve(capabilityPath));
	});
});
