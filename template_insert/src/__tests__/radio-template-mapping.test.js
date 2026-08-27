const {
  resolveTemplateForRadioValue,
} = require('../js/lib/radio-template-mapping.js');

const templates = [
  { id: 'tpl_1', name: '承認' },
  { id: 'tpl_2', name: '却下' },
];

describe('resolveTemplateForRadioValue', () => {
  test('マッピング済みの選択肢に対応するテンプレートを返す', () => {
    const radioMappings = [
      { optionValue: '承認', templateId: 'tpl_1' },
      { optionValue: '却下', templateId: 'tpl_2' },
    ];
    expect(
      resolveTemplateForRadioValue({
        templates,
        radioMappings,
        radioValue: '却下',
      }),
    ).toEqual({ id: 'tpl_2', name: '却下' });
  });

  test('マッピングが無い選択肢はnullを返す', () => {
    const radioMappings = [{ optionValue: '承認', templateId: 'tpl_1' }];
    expect(
      resolveTemplateForRadioValue({
        templates,
        radioMappings,
        radioValue: '保留',
      }),
    ).toBeNull();
  });

  test('マッピング先のテンプレートIDが存在しない(削除済み)場合はnullを返す', () => {
    const radioMappings = [{ optionValue: '承認', templateId: 'tpl_removed' }];
    expect(
      resolveTemplateForRadioValue({
        templates,
        radioMappings,
        radioValue: '承認',
      }),
    ).toBeNull();
  });

  test('radioMappings自体が空でもエラーにならない', () => {
    expect(
      resolveTemplateForRadioValue({
        templates,
        radioMappings: [],
        radioValue: '承認',
      }),
    ).toBeNull();
  });
});
