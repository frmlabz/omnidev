import { normalizeProviderId } from "@omnidev-ai/core";
import type { CanonicalProviderId } from "@omnidev-ai/core";

const PROVIDER_BLOCK_REGEX = /<provider\.([a-z-]+)>([\s\S]*?)<\/provider\.\1>/g;
const PROVIDER_TAG_REGEX = /<\/?provider\.[a-z-]+>/;

export function renderOmniMdForProvider(content: string, providerId?: CanonicalProviderId): string {
	if (!providerId) {
		return content;
	}

	const rendered = content.replace(
		PROVIDER_BLOCK_REGEX,
		(_match, rawProvider: string, providerContent: string) => {
			const canonicalProvider = normalizeProviderId(rawProvider);
			return canonicalProvider === providerId ? providerContent : "";
		},
	);

	const strayTag = rendered.match(PROVIDER_TAG_REGEX);
	if (strayTag) {
		throw new Error(`Invalid provider block syntax in OMNI.md near ${strayTag[0]}`);
	}

	return rendered;
}
