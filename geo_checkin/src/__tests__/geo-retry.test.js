'use strict';

const { withGeoRetry, isRetryableGeoError } = require('../js/lib/geo-retry');

describe('isRetryableGeoError', () => {
  test('POSITION_UNAVAILABLE(code: 2)はリトライ対象', () => {
    expect(isRetryableGeoError({ code: 2 })).toBe(true);
  });

  test('TIMEOUT(code: 3)はリトライ対象', () => {
    expect(isRetryableGeoError({ code: 3 })).toBe(true);
  });

  test('PERMISSION_DENIED(code: 1)はリトライ対象外(許可設定が変わらない限り再試行しても無駄なため)', () => {
    expect(isRetryableGeoError({ code: 1 })).toBe(false);
  });

  test('Geolocation非対応ブラウザのError(codeなし)はリトライ対象外', () => {
    expect(isRetryableGeoError(new Error('non-code error'))).toBe(false);
  });

  test('null/undefinedはリトライ対象外', () => {
    expect(isRetryableGeoError(null)).toBe(false);
    expect(isRetryableGeoError(undefined)).toBe(false);
  });
});

describe('withGeoRetry', () => {
  const noopSleep = () => Promise.resolve();

  test('1回目で成功すればsleepは呼ばれない', async () => {
    const getPosition = jest.fn().mockResolvedValue('ok');
    const sleep = jest.fn(noopSleep);
    await expect(
      withGeoRetry(getPosition, { maxAttempts: 3, delayMs: 1000, sleep }),
    ).resolves.toBe('ok');
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('POSITION_UNAVAILABLEで失敗後、リトライして成功する', async () => {
    const getPosition = jest
      .fn()
      .mockRejectedValueOnce({ code: 2 })
      .mockResolvedValueOnce('ok-on-second');
    const sleep = jest.fn(noopSleep);
    await expect(
      withGeoRetry(getPosition, { maxAttempts: 3, delayMs: 1000, sleep }),
    ).resolves.toBe('ok-on-second');
    expect(getPosition).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  test('maxAttempts回失敗し続けると、最後のエラーをそのままthrowする', async () => {
    const finalError = { code: 3 };
    const getPosition = jest
      .fn()
      .mockRejectedValueOnce({ code: 2 })
      .mockRejectedValueOnce({ code: 3 })
      .mockRejectedValueOnce(finalError);
    const sleep = jest.fn(noopSleep);
    await expect(
      withGeoRetry(getPosition, { maxAttempts: 3, delayMs: 1000, sleep }),
    ).rejects.toBe(finalError);
    expect(getPosition).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('PERMISSION_DENIEDは1回失敗した時点で即座に伝播し、リトライしない', async () => {
    const permissionError = { code: 1 };
    const getPosition = jest.fn().mockRejectedValue(permissionError);
    const sleep = jest.fn(noopSleep);
    await expect(
      withGeoRetry(getPosition, { maxAttempts: 3, delayMs: 1000, sleep }),
    ).rejects.toBe(permissionError);
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('Geolocation非対応ブラウザのErrorも即座に伝播する', async () => {
    const unsupportedError = new Error('non-code error');
    const getPosition = jest.fn().mockRejectedValue(unsupportedError);
    const sleep = jest.fn(noopSleep);
    await expect(
      withGeoRetry(getPosition, { maxAttempts: 3, delayMs: 1000, sleep }),
    ).rejects.toBe(unsupportedError);
    expect(getPosition).toHaveBeenCalledTimes(1);
  });
});
