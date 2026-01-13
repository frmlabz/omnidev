import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import type { CapabilityRegistry } from "@omnidev/core";

const LOG_FILE = ".omni/logs/mcp-server.log";

function debug(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	let logLine: string;

	if (data !== undefined) {
		logLine = `[${timestamp}] [omnidev:execute] ${message} ${JSON.stringify(data, null, 2)}`;
	} else {
		logLine = `[${timestamp}] [omnidev:execute] ${message}`;
	}

	console.error(logLine);

	try {
		mkdirSync(".omni/logs", { recursive: true });
		appendFileSync(LOG_FILE, `${logLine}\n`);
	} catch (error) {
		console.error(`Failed to write to log file: ${error}`);
	}
}

interface ExecuteArgs {
	code?: string;
}

interface ExecuteResult {
	exit_code: number;
	stdout: string;
	stderr: string;
	changed_files: string[];
	diff_stat: { files: number; insertions: number; deletions: number };
}

export async function handleOmniExecute(
	_registry: CapabilityRegistry,
	args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const { code } = (args as ExecuteArgs) || {};

	if (!code) {
		throw new Error("code is required");
	}

	debug("Writing user code to sandbox");
	mkdirSync(".omni/sandbox", { recursive: true });

	// Check if code exports a main function
	const hasMainExport = /export\s+(async\s+)?function\s+main\s*\(/.test(code);
	if (!hasMainExport) {
		throw new Error(
			"Code must export a main function: export async function main(): Promise<number>",
		);
	}

	const finalCode = `${code}\n\n// Auto-invoke main\nmain();\n`;
	await Bun.write(".omni/sandbox/main.ts", finalCode);

	debug("Executing code...");
	// Execute main.ts directly with Bun
	const result = await executeCode();
	debug("Execution complete", {
		exitCode: result.exitCode,
		stdoutLength: result.stdout.length,
		stderrLength: result.stderr.length,
	});

	// Get git diff stats
	const diffStat = await getGitDiffStats();

	const response: ExecuteResult = {
		exit_code: result.exitCode,
		stdout: result.stdout,
		stderr: result.stderr,
		changed_files: diffStat.files,
		diff_stat: {
			files: diffStat.files.length,
			insertions: diffStat.insertions,
			deletions: diffStat.deletions,
		},
	};

	debug("Returning execution result");
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(response, null, 2),
			},
		],
	};
}

async function executeCode(): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}> {
	return new Promise((resolve) => {
		const proc = spawn("bun", ["run", ".omni/sandbox/main.ts"], {
			cwd: process.cwd(),
			env: {
				...process.env,
				// Add sandbox-specific env if needed
			},
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			resolve({
				exitCode: code ?? 1,
				stdout,
				stderr,
			});
		});
	});
}

async function getGitDiffStats(): Promise<{
	files: string[];
	insertions: number;
	deletions: number;
}> {
	try {
		const proc = Bun.spawn(["git", "diff", "--name-only"]);
		const output = await new Response(proc.stdout).text();

		const files = output.trim().split("\n").filter(Boolean);

		// Get numeric stats
		const statProc = Bun.spawn(["git", "diff", "--shortstat"]);
		const statOutput = await new Response(statProc.stdout).text();

		const insertMatch = statOutput.match(/(\d+) insertion/);
		const deleteMatch = statOutput.match(/(\d+) deletion/);

		const insertions = insertMatch?.[1] ? Number.parseInt(insertMatch[1], 10) : 0;
		const deletions = deleteMatch?.[1] ? Number.parseInt(deleteMatch[1], 10) : 0;

		return {
			files,
			insertions,
			deletions,
		};
	} catch {
		return { files: [], insertions: 0, deletions: 0 };
	}
}
