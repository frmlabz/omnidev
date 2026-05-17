/**
 * Format a string as a YAML double-quoted scalar.
 *
 * JSON strings are valid YAML double-quoted scalars and give us the escaping
 * behavior we need for quotes, backslashes, and control characters.
 */
export function yamlString(value: string): string {
	return JSON.stringify(value);
}
