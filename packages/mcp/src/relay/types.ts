export interface RelayRequest {
	toolName: string;
	arguments: Record<string, unknown>;
}

export interface RelayResponse {
	success: boolean;
	result?: unknown;
	error?: string;
}

export interface RelayToolsResponse {
	tools: Array<{
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
	}>;
}
