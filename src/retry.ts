export type Jitter = "none" | "full";

export type BackoffOptions = {
  /** Delay after the first failure, in milliseconds. Default 100. */
  baseMs?: number;
  /** Hard cap. Default 10_000. */
  capMs?: number;
  /** Growth per extra failure. Default 2. */
  factor?: number;
  /** `full` draws uniformly from 0 through the ceiling. Default `full`. */
  jitter?: Jitter;
  /** Must return a number in [0, 1). Default `Math.random`. */
  random?: () => number;
};

export type RetryOptions = BackoffOptions & {
  /** Total calls, including the first. Default 3. */
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const DEFAULTS = {
  baseMs: 100,
  capMs: 10_000,
  factor: 2,
};

/**
 * Ceiling is `min(cap, base * factor^attempt)`.
 * `none` returns the ceiling. `full` returns a uniform integer in `0..ceiling`.
 * Attempt 0 is the wait after the first failure.
 */
export function delayMs(attempt: number, options: BackoffOptions = {}): number {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error("attempt must be an integer >= 0");
  }
  const baseMs = options.baseMs ?? DEFAULTS.baseMs;
  const capMs = options.capMs ?? DEFAULTS.capMs;
  const factor = options.factor ?? DEFAULTS.factor;
  const jitter = options.jitter ?? "full";
  if (!(baseMs > 0) || !(capMs >= baseMs) || !(factor >= 1)) {
    throw new Error("baseMs must be > 0, capMs >= baseMs, factor >= 1");
  }
  const grown = baseMs * factor ** attempt;
  const ceiling = Math.min(capMs, grown);
  if (jitter === "none") return ceiling;
  const random = options.random ?? Math.random;
  const roll = random();
  if (!(roll >= 0) || roll >= 1 || !Number.isFinite(roll)) {
    throw new Error("random() must return a finite number in [0, 1)");
  }
  return Math.floor(roll * (ceiling + 1));
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `task` until it resolves or attempts run out. The last error is rethrown. */
export async function retry<T>(
  task: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("attempts must be an integer >= 1");
  }
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const again = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!again || attempt === attempts - 1) throw error;
      const wait = delayMs(attempt, options);
      if (wait > 0) await sleep(wait);
    }
  }
  throw lastError;
}
