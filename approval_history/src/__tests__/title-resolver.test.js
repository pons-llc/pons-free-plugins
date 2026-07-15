'use strict';

const TitleResolver = require('../js/lib/title-resolver');

describe('resolveTitle', () => {
  test('所属組織が無ければ空文字列を返す', () => {
    expect(TitleResolver.resolveTitle([])).toBe('');
    expect(TitleResolver.resolveTitle(undefined)).toBe('');
    expect(TitleResolver.resolveTitle(null)).toBe('');
  });

  test('primaryな組織の役職名を優先して返す', () => {
    const organizations = [
      {
        organization: { code: 'sub', name: '営業部', primary: false },
        title: { name: '主任' },
      },
      {
        organization: { code: 'main', name: '総務部', primary: true },
        title: { name: '課長' },
      },
    ];

    expect(TitleResolver.resolveTitle(organizations)).toBe('課長');
  });

  test('primaryな組織に役職が無い場合は他の役職ありの組織を返す', () => {
    const organizations = [
      {
        organization: { code: 'main', name: '総務部', primary: true },
        title: null,
      },
      {
        organization: { code: 'sub', name: '営業部', primary: false },
        title: { name: '主任' },
      },
    ];

    expect(TitleResolver.resolveTitle(organizations)).toBe('主任');
  });

  test('どの組織にも役職が無ければ空文字列を返す', () => {
    const organizations = [
      { organization: { code: 'main', primary: true }, title: null },
      { organization: { code: 'sub', primary: false }, title: null },
    ];

    expect(TitleResolver.resolveTitle(organizations)).toBe('');
  });
});
