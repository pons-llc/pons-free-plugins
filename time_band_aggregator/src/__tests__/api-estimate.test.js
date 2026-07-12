'use strict';

const ApiEstimate = require('../js/lib/api-estimate');

describe('ApiEstimate.compute', () => {
  test('0件は0回', () => {
    expect(ApiEstimate.compute(0)).toEqual({
      readCalls: 0,
      writeCalls: 0,
      totalCalls: 0,
    });
  });

  test('500件ちょうどは読み取り1回・書き込み5回', () => {
    expect(ApiEstimate.compute(500)).toEqual({
      readCalls: 1,
      writeCalls: 5,
      totalCalls: 6,
    });
  });

  test('501件は読み取り2回・書き込み6回に切り上がる', () => {
    expect(ApiEstimate.compute(501)).toEqual({
      readCalls: 2,
      writeCalls: 6,
      totalCalls: 8,
    });
  });
});

describe('ApiEstimate.buildMessage', () => {
  test('件数と見積り回数を含む文字列を組み立てる', () => {
    const message = ApiEstimate.buildMessage(150);
    expect(message).toContain('対象レコード数: 150件');
    expect(message).toContain('約1回');
    expect(message).toContain('約2回');
  });
});
