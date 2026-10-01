'use strict';

const DeployPoller = require('../js/lib/deploy-poller');

describe('DeployPoller.waitForDeploy', () => {
  test('SUCCESSになったら解決する', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce([{ app: '1', status: 'PROCESSING' }])
      .mockResolvedValueOnce([{ app: '1', status: 'SUCCESS' }]);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      DeployPoller.waitForDeploy('1', { getStatus, wait, intervalMs: 10 }),
    ).resolves.toBeUndefined();
    expect(wait).toHaveBeenCalledTimes(1);
  });

  test('FAILになったら例外を投げる', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValue([{ app: '1', status: 'FAIL' }]);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      DeployPoller.waitForDeploy('1', { getStatus, wait }),
    ).rejects.toThrow('FAIL');
  });

  test('CANCELになったら例外を投げる', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValue([{ app: '1', status: 'CANCEL' }]);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      DeployPoller.waitForDeploy('1', { getStatus, wait }),
    ).rejects.toThrow('CANCEL');
  });

  test('タイムアウトしたら例外を投げる', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValue([{ app: '1', status: 'PROCESSING' }]);
    let now = 0;
    const realNow = Date.now;
    Date.now = () => now;
    const wait = jest.fn().mockImplementation(() => {
      now += 1000;
      return Promise.resolve();
    });

    try {
      await expect(
        DeployPoller.waitForDeploy('1', {
          getStatus,
          wait,
          intervalMs: 1000,
          timeoutMs: 2000,
        }),
      ).rejects.toThrow('タイムアウト');
    } finally {
      // テスト後片付けのための同期代入でありrequire-atomic-updatesは誤検知。
      // eslint-disable-next-line require-atomic-updates
      Date.now = realNow;
    }
  });
});
