import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import type { CapabilityRegistry } from '@omnidev/core';

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

export async function handleOmniExecute(_registry: CapabilityRegistry, args: unknown) {
	const { code } = (args as ExecuteArgs) || {};

	if (!code) {
		throw new Error('code is required');
	}

	// Write code to sandbox
	mkdirSync('.omni/sandbox', { recursive: true });
	await Bun.write('.omni/sandbox/main.ts', code);

	// Execute with Bun
	const result = await executeCode();

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

	return {
		content: [
			{
				type: 'text',
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
		const proc = spawn('bun', ['run', '.omni/sandbox/main.ts'], {
			cwd: process.cwd(),
			env: {
				...process.env,
				// Add sandbox-specific env if needed
			},
		});

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
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
		const proc = Bun.spawn(['git', 'diff', '--name-only']);
		const output = await new Response(proc.stdout).text();

		const files = output.trim().split('\n').filter(Boolean);

		// Get numeric stats
		const statProc = Bun.spawn(['git', 'diff', '--shortstat']);
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
