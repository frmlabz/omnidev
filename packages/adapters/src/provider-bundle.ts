import { hasAnyHooks, mergeHooksConfigs } from "@omnidev-ai/core";
import type { CanonicalProviderId, LoadedCapability, SyncBundle } from "@omnidev-ai/core";

function capabilityAppliesToProvider(
	capability: LoadedCapability,
	providerId: CanonicalProviderId,
): boolean {
	const providers = capability.config.capability.providers;

	if (!providers) {
		return true;
	}

	return providers[providerId] === true;
}

function generateInstructionsContent(
	rules: SyncBundle["rules"],
	_docs: SyncBundle["docs"],
): string {
	if (rules.length === 0) {
		return "";
	}

	let content = `## Rules

`;

	for (const rule of rules) {
		content += `${rule.content}

`;
	}

	return content.trimEnd();
}

export function createProviderScopedBundle(
	bundle: SyncBundle,
	providerId: CanonicalProviderId,
): SyncBundle {
	const capabilities = bundle.capabilities.filter((capability) =>
		capabilityAppliesToProvider(capability, providerId),
	);
	const capabilityIds = new Set(capabilities.map((capability) => capability.id));

	const skills = bundle.skills.filter((skill) => capabilityIds.has(skill.capabilityId));
	const rules = bundle.rules.filter((rule) => capabilityIds.has(rule.capabilityId));
	const docs = bundle.docs.filter((doc) => capabilityIds.has(doc.capabilityId));
	const commands = bundle.commands.filter((command) => capabilityIds.has(command.capabilityId));
	const subagents = bundle.subagents.filter((subagent) => capabilityIds.has(subagent.capabilityId));

	const scopedBundle: SyncBundle = {
		capabilities,
		skills,
		rules,
		docs,
		commands,
		subagents,
		instructionsContent: generateInstructionsContent(rules, docs),
	};

	const mergedHooks = mergeHooksConfigs(
		capabilities.flatMap((capability) => (capability.hooks ? [capability.hooks] : [])),
	);

	if (hasAnyHooks(mergedHooks)) {
		scopedBundle.hooks = mergedHooks;
	}

	return scopedBundle;
}
