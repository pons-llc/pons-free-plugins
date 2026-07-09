(function (root) {
  'use strict';

  // カウンター専用アプリの一意制約違反(衝突)時のみ再試行する。それ以外のエラーは即座に伝播する。
  class ConflictError extends Error {}
  class RetryExhaustedError extends Error {}

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const withRetry = async (fn, { maxAttempts, backoffMs }) => {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof ConflictError)) {
          throw err;
        }
        if (attempt >= maxAttempts) {
          throw new RetryExhaustedError(
            `最大試行回数(${maxAttempts})に達しました: ${err.message}`
          );
        }
        await sleep(backoffMs * attempt);
      }
    }
  };

  const Retry = { withRetry, ConflictError, RetryExhaustedError };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Retry;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.Retry = Retry;
  }
})(typeof window !== 'undefined' ? window : globalThis);
