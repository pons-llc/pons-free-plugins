const { withRetry, ConflictError, RetryExhaustedError } = require('../js/lib/retry');

describe('withRetry', () => {
  test('resolves immediately if fn succeeds on the first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 5, backoffMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on ConflictError and succeeds once fn stops rejecting', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ConflictError('dup'))
      .mockRejectedValueOnce(new ConflictError('dup'))
      .mockResolvedValueOnce('ok-on-third');
    await expect(withRetry(fn, { maxAttempts: 5, backoffMs: 0 })).resolves.toBe(
      'ok-on-third'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('does not retry a non-conflict error; it propagates immediately', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetry(fn, { maxAttempts: 5, backoffMs: 0 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throws a distinguishable RetryExhaustedError after maxAttempts conflicts', async () => {
    const fn = jest.fn().mockRejectedValue(new ConflictError('dup'));
    await expect(withRetry(fn, { maxAttempts: 3, backoffMs: 0 })).rejects.toBeInstanceOf(
      RetryExhaustedError
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
