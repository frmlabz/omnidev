export type ProviderAlias = "claude";

export type CanonicalProviderId = "claude-code" | "codex" | "cursor" | "opencode";

export type ProviderName = ProviderAlias | CanonicalProviderId;

export type ProviderApplicability = Partial<Record<CanonicalProviderId, boolean>>;

const PROVIDER_ALIAS_MAP: Record<ProviderName, CanonicalProviderId> = {
	claude: "claude-code",
	"claude-code": "claude-code",
	codex: "codex",
	cursor: "cursor",
	opencode: "opencode",
};

export function normalizeProviderId(provider: string): CanonicalProviderId {
	if (provider in PROVIDER_ALIAS_MAP) {
		return PROVIDER_ALIAS_MAP[provider as ProviderName];
	}

	throw new Error(`Unknown provider: ${provider}`);
}

export function normalizeProviderApplicability(
	value: unknown,
	fieldName: string,
): ProviderApplicability {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${fieldName} must be a table of provider = boolean entries`);
	}

	const normalized: ProviderApplicability = {};

	for (const [rawProvider, rawEnabled] of Object.entries(value as Record<string, unknown>)) {
		if (typeof rawEnabled !== "boolean") {
			throw new Error(`${fieldName}.${rawProvider} must be a boolean`);
		}

		const canonicalProvider = normalizeProviderId(rawProvider);
		const existing = normalized[canonicalProvider];

		if (existing !== undefined && existing !== rawEnabled) {
			throw new Error(
				`Conflicting provider entries in ${fieldName}: ${rawProvider} maps to ${canonicalProvider}`,
			);
		}

		normalized[canonicalProvider] = rawEnabled;
	}

	return normalized;
}
