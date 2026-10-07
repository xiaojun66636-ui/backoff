import assert from "node:assert/strict";
import { test } from "node:test";
import { delayMs, retry } from "../src/retry.ts";

const fixed = { baseMs: 100, factor: 2, capMs: 1000, jitter: "none" as const };

test("exponential delay hits the cap", () => {
  assert.equal(delayMs(0, fixed), 100);
  assert.equal(delayMs(1, fixed), 200);
  assert.equal(delayMs(2, fixed), 400);
  assert.equal(delayMs(3, fixed), 800);
  assert.equal(delayMs(4, fixed), 1000);
  assert.equal(delayMs(20, fixed), 1000);
});

test("full jitter stays inside 0..ceiling", () => {
  assert.equal(delayMs(0, { ...fixed, jitter: "full", random: () => 0 }), 0);
  assert.equal(delayMs(1, { ...fixed, jitter: "full", random: () => 0.5 }), 100);
  assert.equal(delayMs(0, { ...fixed, jitter: "full", random: () => 0.999 }), 100);
});

test("retry sleeps between failures and returns the first success", async () => {
  const waits: number[] = [];
  let calls = 0;
  const value = await retry(
    () => {
      calls += 1;
      if (calls < 3) throw new Error("not yet");
      return "ok";
    },
    {
      ...fixed,
      attempts: 4,
      sleep: async (ms) => {
        waits.push(ms);
      },
    },
  );
  assert.equal(value, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [100, 200]);
});

test("retry throws the last error and honors shouldRetry", async () => {
  const boom = new Error("boom");
  await assert.rejects(
    () =>
      retry(
        () => {
          throw boom;
        },
        { ...fixed, attempts: 2, sleep: async () => {} },
      ),
    boom,
  );

  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        () => {
          calls += 1;
          throw new Error("no");
        },
        {
          attempts: 5,
          sleep: async () => {},
          shouldRetry: () => false,
        },
      ),
    /no/,
  );
  assert.equal(calls, 1);
});

test("rejects bad options", () => {
  assert.throws(() => delayMs(-1, fixed));
  assert.throws(() => delayMs(0, { baseMs: 0 }));
  assert.throws(() => delayMs(0, { jitter: "full", random: () => 1 }));
});
