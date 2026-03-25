import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";

const CAPABILITY_ENV_FILE = ".env";

function mergeEnvSources(capabilityEnv: Record<string, string>): Record<string, string> {
	const merged = { ...capabilityEnv };

	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string") {
			merged[key] = value;
		}
	}

	return merged;
}

export async function loadCapabilityEnvVariables(
	capabilityPath: string,
): Promise<Record<string, string>> {
	const envPath = join(capabilityPath, CAPABILITY_ENV_FILE);
	if (!existsSync(envPath)) {
		return mergeEnvSources({});
	}

	const envContent = await readFile(envPath, "utf-8");
	const capabilityEnv = Object.fromEntries(
		Object.entries(parseEnv(envContent)).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);

	return mergeEnvSources(capabilityEnv);
}
