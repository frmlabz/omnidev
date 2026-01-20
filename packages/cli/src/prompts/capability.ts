/**
 * Validate capability ID format.
 * Must be lowercase, kebab-case, alphanumeric.
 */
export function isValidCapabilityId(id: string): boolean {
	return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}
