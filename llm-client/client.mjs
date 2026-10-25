export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_BASE_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

export function parseRetryAfter(value) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

export async function callLLM({
  baseUrl,
  apiKey,
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  deadlineMs,
}) {
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const attemptStartedAt = Date.now();
    const remaining = deadlineMs
      ? deadlineMs - (Date.now() - startedAt)
      : Number.POSITIVE_INFINITY;

    if (remaining <= 0) {
      throw lastError ?? new Error(`deadline of ${deadlineMs}ms exceeded`);
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)),
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
        error.status = response.status;
        error.retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        throw error;
      }

      const data = await response.json();

      return {
        data,
        meta: {
          attempt,
          durationMs: Date.now() - attemptStartedAt,
          usage: data.usage ?? null,
        },
      };
    } catch (error) {
      lastError = error;

      const retryable =
        error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        error instanceof TypeError ||
        (typeof error.status === "number" && isRetryableStatus(error.status));

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const exponential = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * baseDelayMs;
      const waitMs = error.retryAfterMs ?? exponential + jitter;

      if (deadlineMs && Date.now() - startedAt + waitMs >= deadlineMs) {
        throw error;
      }

      console.warn(
        `attempt ${attempt + 1} failed (${error.message}), retrying in ${Math.round(waitMs)}ms`,
      );

      await sleep(waitMs);
    }
  }

  throw lastError;
}

export function callLLMWithDeadline({ deadlineMs = 180_000, ...options }) {
  return callLLM({ ...options, deadlineMs });
}

export function assertShape(value, shape, path = "root") {
  for (const [key, type] of Object.entries(shape)) {
    const actual = value?.[key];
    const ok =
      type === "array"
        ? Array.isArray(actual)
        : type === "string"
          ? typeof actual === "string" && actual.length > 0
          : typeof actual === type;

    if (!ok) {
      throw new Error(`invalid response at ${path}.${key}: expected ${type}`);
    }
  }

  return value;
}

export function extractJson(content) {
  if (typeof content !== "string") {
    throw new Error("message content is not a string");
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();

  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new Error(`failed to parse JSON: ${error.message}`);
  }
}

export function logUsage(meta, label = "request") {
  const usage = meta.usage ?? {};
  console.log(
    JSON.stringify({
      label,
      attempt: meta.attempt,
      durationMs: meta.durationMs,
      inputTokens: usage.prompt_tokens ?? null,
      outputTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
    }),
  );
}

export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );

  return results;
}
