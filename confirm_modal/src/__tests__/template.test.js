'use strict';

const Template = require('../js/lib/template');

describe('Template.renderTemplate', () => {
  test('replaces a known placeholder with the context value', () => {
    expect(
      Template.renderTemplate('アクション: {action}', { action: '承認' }),
    ).toBe('アクション: 承認');
  });

  test('replaces multiple placeholders', () => {
    const result = Template.renderTemplate(
      '{action} を実行すると {nextStatus} になります',
      {
        action: '承認',
        nextStatus: '完了',
      },
    );
    expect(result).toBe('承認 を実行すると 完了 になります');
  });

  test('leaves unknown placeholders untouched', () => {
    expect(
      Template.renderTemplate('{unknown} のテスト', { action: '承認' }),
    ).toBe('{unknown} のテスト');
  });

  test('returns an empty string when the template is missing', () => {
    expect(Template.renderTemplate('', { action: '承認' })).toBe('');
    expect(Template.renderTemplate(undefined, { action: '承認' })).toBe('');
  });

  test('returns the template unchanged when it has no placeholders', () => {
    expect(Template.renderTemplate('本当に保存しますか?', {})).toBe(
      '本当に保存しますか?',
    );
  });

  test('treats a missing context as an empty object (no replacements)', () => {
    expect(Template.renderTemplate('{action}', undefined)).toBe('{action}');
  });
});
