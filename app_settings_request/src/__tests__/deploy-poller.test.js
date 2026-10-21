const DeployPoller = require('../js/lib/deploy-poller.js');

describe('pollUntilDeployed', () => {
  test('1回目でSUCCESSなら即成功を返す', async () => {
    const getStatus = jest.fn().mockResolvedValue('SUCCESS');
    const wait = jest.fn().mockResolvedValue(undefined);
    const result = await DeployPoller.pollUntilDeployed({ getStatus, wait });
    expect(result).toEqual({ success: true, status: 'SUCCESS' });
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  test('PROCESSINGが続いたあとSUCCESSになれば成功(waitを挟んで再試行する)', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce('PROCESSING')
      .mockResolvedValueOnce('PROCESSING')
      .mockResolvedValueOnce('SUCCESS');
    const wait = jest.fn().mockResolvedValue(undefined);
    const result = await DeployPoller.pollUntilDeployed({ getStatus, wait });
    expect(result).toEqual({ success: true, status: 'SUCCESS' });
    expect(getStatus).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  test('FAILになったら即座に失敗を返す(以降ポーリングしない)', async () => {
    const getStatus = jest.fn().mockResolvedValue('FAIL');
    const wait = jest.fn().mockResolvedValue(undefined);
    const result = await DeployPoller.pollUntilDeployed({ getStatus, wait });
    expect(result).toEqual({ success: false, status: 'FAIL' });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  test('CANCELも失敗として扱う', async () => {
    const getStatus = jest.fn().mockResolvedValue('CANCEL');
    const result = await DeployPoller.pollUntilDeployed({
      getStatus,
      wait: jest.fn(),
    });
    expect(result).toEqual({ success: false, status: 'CANCEL' });
  });

  test('maxAttemptsに達してもPROCESSINGのままならTIMEOUTとして失敗を返す', async () => {
    const getStatus = jest.fn().mockResolvedValue('PROCESSING');
    const wait = jest.fn().mockResolvedValue(undefined);
    const result = await DeployPoller.pollUntilDeployed({
      getStatus,
      wait,
      maxAttempts: 3,
    });
    expect(result).toEqual({ success: false, status: 'TIMEOUT' });
    expect(getStatus).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
