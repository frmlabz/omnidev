/**
 * Helper functions for testing
 */

import { afterEach, beforeEach, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { join } from "node:path";

let cwdLock = Promise.resolve();

async function acquireCwdLock(): Promise<() => void> {
	let release!: () => void;
	const previous = cwdLock;
	cwdLock = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	return release;
}

/**
 * Expects an async function to throw an error
 * @param fn - Async function that should throw
 * @param errorMatch - Optional string or regex to match against error message
 * @throws If the function doesn't throw
 */
export async function expectToThrowAsync(
	fn: () => Promise<unknown>,
	errorMatch?: string | RegExp,
): Promise<void> {
	let threw = false;
	let caughtError: Error | undefined;

	try {
		await fn();
	} catch (e) {
		threw = true;
		caughtError = e as Error;
	}

	expect(threw).toBe(true);

	if (errorMatch && caughtError) {
		if (typeof errorMatch === "string") {
			expect(caughtError.message).toContain(errorMatch);
		} else {
			expect(caughtError.message).toMatch(errorMatch);
		}
	}
}

/**
 * Waits for a condition to be true
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 1000)
 * @param interval - Check interval in milliseconds (default: 50)
 * @throws If timeout is reached before condition is met
 */
export async function waitForCondition(
	condition: () => boolean | Promise<boolean>,
	timeout = 1000,
	interval = 50,
): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const result = await condition();
		if (result) {
			return;
		}
		await delay(interval);
	}

	throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Delays execution for a specified amount of time
 * @param ms - Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a spy function that records calls and arguments
 * @returns Spy function with call tracking
 */
export function createSpy<TArgs extends unknown[], TReturn>(
	implementation?: (...args: TArgs) => TReturn,
): {
	(...args: TArgs): TReturn;
	calls: TArgs[];
	callCount: number;
	reset: () => void;
} {
	const calls: TArgs[] = [];

	const spy = ((...args: TArgs) => {
		calls.push(args);
		if (implementation) {
			return implementation(...args);
		}
		return undefined as TReturn;
	}) as {
		(...args: TArgs): TReturn;
		calls: TArgs[];
		callCount: number;
		reset: () => void;
	};

	Object.defineProperty(spy, "calls", {
		get: () => calls,
	});

	Object.defineProperty(spy, "callCount", {
		get: () => calls.length,
	});

	spy.reset = () => {
		calls.length = 0;
	};

	return spy;
}

/**
 * Creates a mock function that returns predefined values
 * @param returnValues - Array of values to return on consecutive calls
 * @returns Mock function
 */
export function createMockFn<T>(...returnValues: T[]): () => T {
	let callIndex = 0;

	return () => {
		if (callIndex >= returnValues.length) {
			throw new Error("Mock function called more times than return values provided");
		}
		const value = returnValues[callIndex++];
		if (value === undefined) {
			throw new Error("Mock function returned undefined");
		}
		return value;
	};
}

/**
 * Creates a mock promise that can be resolved or rejected manually
 * @returns Object with promise and resolve/reject functions
 */
export function createDeferredPromise<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
} {
	let resolveRef!: (value: T) => void;
	let rejectRef!: (reason?: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolveRef = res;
		rejectRef = rej;
	});

	return {
		promise: promise,
		resolve: resolveRef,
		reject: rejectRef,
	};
}

/**
 * Captures console output during test execution
 * @param fn - Function to execute while capturing output
 * @returns Object with stdout and stderr arrays
 */
export async function captureConsole<T>(
	fn: () => Promise<T> | T,
): Promise<{ stdout: string[]; stderr: string[]; result: T }> {
	const stdout: string[] = [];
	const stderr: string[] = [];

	const originalLog = console.log;
	const originalError = console.error;
	const originalWarn = console.warn;

	console.log = (...args: unknown[]) => {
		stdout.push(args.map(String).join(" "));
	};

	console.error = (...args: unknown[]) => {
		stderr.push(args.map(String).join(" "));
	};

	console.warn = (...args: unknown[]) => {
		stderr.push(args.map(String).join(" "));
	};

	try {
		const result = await fn();
		return { stdout, stderr, result };
	} finally {
		console.log = originalLog;
		console.error = originalError;
		console.warn = originalWarn;
	}
}

/**
 * Creates a unique temporary directory for tests in /tmp
 * @param prefix - Optional prefix for the directory name (default: "omnidev-test-")
 * @returns Path to the created temporary directory
 */
export function tmpdir(prefix = "omnidev-test-"): string {
	return mkdtempSync(join(osTmpdir(), prefix));
}

export type TestDirOptions = {
	chdir?: boolean;
	createOmniDir?: boolean;
};

export type TestDirController = {
	readonly path: string;
	readonly originalCwd: string;
	setPath: (path: string, options?: TestDirOptions) => void;
	reset: (prefix?: string, options?: TestDirOptions & { cleanupPrevious?: boolean }) => string;
};

/**
 * Sets up a temporary directory for each test and cleans it up automatically.
 * Registers beforeEach/afterEach hooks on call.
 */
export function setupTestDir(
	prefix = "omnidev-test-",
	options: TestDirOptions = {},
): TestDirController {
	let currentDir = "";
	let originalCwd = "";
	let shouldChdir = options.chdir ?? false;
	let shouldCreateOmniDir = options.createOmniDir ?? false;
	let releaseCwdLock: (() => void) | null = null;

	const applyOptions = (dir: string, nextOptions?: TestDirOptions) => {
		if (nextOptions) {
			if (typeof nextOptions.chdir === "boolean") {
				shouldChdir = nextOptions.chdir;
			}
			if (typeof nextOptions.createOmniDir === "boolean") {
				shouldCreateOmniDir = nextOptions.createOmniDir;
			}
		}

		if (shouldCreateOmniDir) {
			mkdirSync(join(dir, ".omni"), { recursive: true });
		}

		if (shouldChdir) {
			process.chdir(dir);
		}
	};

	beforeEach(async () => {
		originalCwd = process.cwd();
		currentDir = tmpdir(prefix);
		if (shouldChdir) {
			releaseCwdLock = await acquireCwdLock();
		}
		applyOptions(currentDir);
	});

	afterEach(() => {
		if (shouldChdir) {
			process.chdir(originalCwd);
			releaseCwdLock?.();
			releaseCwdLock = null;
		}
		if (currentDir && existsSync(currentDir)) {
			rmSync(currentDir, { recursive: true, force: true });
		}
	});

	return {
		get path() {
			return currentDir;
		},
		get originalCwd() {
			return originalCwd;
		},
		setPath(path: string, nextOptions?: TestDirOptions) {
			currentDir = path;
			applyOptions(currentDir, nextOptions);
		},
		reset(nextPrefix = prefix, nextOptions?: TestDirOptions & { cleanupPrevious?: boolean }) {
			const cleanupPrevious = nextOptions?.cleanupPrevious ?? true;
			if (cleanupPrevious && currentDir && existsSync(currentDir)) {
				if (shouldChdir) {
					process.chdir(originalCwd);
				}
				rmSync(currentDir, { recursive: true, force: true });
			}
			currentDir = tmpdir(nextPrefix);
			applyOptions(currentDir, nextOptions);
			return currentDir;
		},
	};
}
