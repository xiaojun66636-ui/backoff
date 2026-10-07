# backoff

Exponential backoff with full jitter, plus `retry`. No dependencies.

After a failure, the ceiling is `min(cap, base * factor^attempt)`. `jitter: "none"` waits the whole ceiling. `jitter: "full"` (the default) draws an integer uniformly from `0` through that ceiling. Full jitter is what stops a herd of clients from retrying on the same millisecond.

Attempt `0` is the wait after the first failure, not a delay before the first call.

## Use

```ts
import { delayMs, retry } from "./src/retry.ts";

delayMs(3, { baseMs: 100, capMs: 2_000 });

await retry(() => fetch(url), {
  attempts: 4,
  shouldRetry: (error) => error instanceof TypeError,
});
```

Pass `sleep` and `random` from tests. Do not retry a 400, a validation error, or anything the caller can only fix by changing the request. `shouldRetry` is how you say that.

## Test

```bash
node --experimental-strip-types --test test/*.test.ts
```

## License

MIT
