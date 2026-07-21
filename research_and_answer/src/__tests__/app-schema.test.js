'use strict';

const AppSchema = require('../js/lib/app-schema');
const Core = require('../js/lib/analysis-core');

describe('buildSpareFieldDefs', () => {
  test('全予備フィールドが分析側の除外パターン(SPARE_FIELD_PATTERN)と一致する', () => {
    const defs = AppSchema.buildSpareFieldDefs();
    const codes = Object.keys(defs);
    expect(codes).toHaveLength(30 + 30 + 10 + 10 + 10 + 5);
    codes.forEach((code) => {
      expect(Core.SPARE_FIELD_PATTERN.test(code)).toBe(true);
      expect(defs[code].code).toBe(code);
    });
    expect(defs.text_1.type).toBe('SINGLE_LINE_TEXT');
    expect(defs.text_30).toBeDefined();
    expect(defs.text_31).toBeUndefined();
    expect(defs.multi_text_1.type).toBe('MULTI_LINE_TEXT');
    expect(defs.multi_text_30).toBeDefined();
    expect(defs.multi_text_31).toBeUndefined();
    expect(defs.number_1.type).toBe('NUMBER');
    expect(defs.number_10).toBeDefined();
    expect(defs.number_11).toBeUndefined();
    expect(defs.date_1.type).toBe('DATE');
    expect(defs.date_10).toBeDefined();
    expect(defs.date_11).toBeUndefined();
    expect(defs.datetime_1.type).toBe('DATETIME');
    expect(defs.datetime_10).toBeDefined();
    expect(defs.datetime_11).toBeUndefined();
    expect(defs.time_1.type).toBe('TIME');
    expect(defs.time_5).toBeDefined();
    expect(defs.time_6).toBeUndefined();
  });
});

describe('buildRequestFieldDefs', () => {
  test('基本フィールドとquestionsテーブルを含む', () => {
    const defs = AppSchema.buildRequestFieldDefs({});
    expect(defs.title.required).toBe(true);
    expect(defs.requester.type).toBe('ORGANIZATION_SELECT');
    expect(defs.requester.required).toBe(true);
    expect(defs.recipients.type).toBe('ORGANIZATION_SELECT');
    expect(defs.deadline.type).toBe('DATETIME');
    expect(defs.attachment.type).toBe('FILE');
    expect(defs.questions.type).toBe('SUBTABLE');
    expect(Object.keys(defs.questions.fields)).toEqual(
      expect.arrayContaining([
        'order',
        'question',
        'question_detail',
        'field_type',
        'column_number',
        'insert_column',
        'choice',
        'question_width',
        'mondatory',
      ]),
    );
    expect(defs.questions.fields.field_type.options['文字列']).toBeDefined();
    expect(defs.questions.fields.column_number.type).toBe('NUMBER');
    // insert_columnはタイプ+番号から自動計算される文字列フィールド(手入力による型の取り違えを防ぐ)。
    // kintoneのCALC型はformatが数値/日付関連のみで文字列出力に対応しないため、
    // SINGLE_LINE_TEXT+expressionで実装する(実機REST APIで動作確認済み)。
    expect(defs.questions.fields.insert_column.type).toBe('SINGLE_LINE_TEXT');
    expect(defs.questions.fields.insert_column.expression).toContain(
      '& column_number',
    );
    AppSchema.QUESTION_TYPES.forEach((type) => {
      expect(defs.questions.fields.insert_column.expression).toContain(
        `field_type = "${type}"`,
      );
      expect(defs.questions.fields.insert_column.expression).toContain(
        `"${AppSchema.FIELD_TYPE_PREFIXES[type]}"`,
      );
    });
    expect(defs.related_links.fields.link_link.type).toBe('LINK');
    // 回答アプリの準備ができるまでrelatedは作らない
    expect(defs.related).toBeUndefined();
  });

  test('回答アプリにlookupがあればrelated(関連レコード一覧)を含む', () => {
    const defs = AppSchema.buildRequestFieldDefs({
      answerAppId: '203',
      recordNumberCode: 'レコード番号',
      answerHasLookup: true,
      answerDisplayFields: ['レコード番号', 'title'],
    });
    expect(defs.related.type).toBe('REFERENCE_TABLE');
    expect(defs.related.referenceTable.relatedApp.app).toBe('203');
    expect(defs.related.referenceTable.condition).toEqual({
      field: 'レコード番号',
      relatedField: 'lookup',
    });
  });
});

describe('buildRelatedFieldDef', () => {
  test('依頼レコード番号↔回答lookupの関連レコード一覧定義を返す', () => {
    const def = AppSchema.buildRelatedFieldDef({
      answerAppId: 597,
      recordNumberCode: 'レコード番号',
      displayFields: ['レコード番号', 'title', 'lookup'],
    });
    expect(def.type).toBe('REFERENCE_TABLE');
    expect(def.code).toBe('related');
    expect(def.referenceTable.relatedApp.app).toBe('597');
    expect(def.referenceTable.condition).toEqual({
      field: 'レコード番号',
      relatedField: 'lookup',
    });
    expect(def.referenceTable.displayFields).toEqual([
      'レコード番号',
      'title',
      'lookup',
    ]);
  });
});

describe('buildAnswerFieldDefs', () => {
  test('依頼アプリ情報があればlookupフィールドを含む', () => {
    const defs = AppSchema.buildAnswerFieldDefs({
      requestAppId: '202',
      requestRecordNumberCode: 'レコード番号',
    });
    expect(defs.lookup.type).toBe('NUMBER');
    expect(defs.lookup.lookup.relatedApp.app).toBe('202');
    expect(defs.lookup.lookup.relatedKeyField).toBe('レコード番号');
    const mapped = defs.lookup.lookup.fieldMappings.map((m) => m.field);
    expect(mapped).toEqual([
      'title',
      'description',
      'requester',
      'deadline',
      'json',
    ]);
    expect(defs.text_1).toBeDefined();
  });

  test('回答部署は優先する組織が初期値、回答状況はラジオボタン、添付ファイルあり', () => {
    const defs = AppSchema.buildAnswerFieldDefs({});
    expect(defs.requester.type).toBe('ORGANIZATION_SELECT');
    expect(defs.requester.required).toBe(true);
    expect(defs.deadline.type).toBe('DATETIME');
    expect(defs.answer_department.type).toBe('ORGANIZATION_SELECT');
    expect(defs.answer_department.required).toBe(true);
    expect(defs.answer_department.defaultValue).toEqual([
      { type: 'FUNCTION', code: 'PRIMARY_ORGANIZATION()' },
    ]);
    expect(defs.answer_status.type).toBe('RADIO_BUTTON');
    expect(Object.keys(defs.answer_status.options)).toEqual([
      '未着手',
      '対応中',
      '回答済',
    ]);
    expect(defs.answer_status.defaultValue).toBe('未着手');
    expect(defs.attachment.type).toBe('FILE');
  });

  test('依頼アプリ情報が無ければlookupは含まない', () => {
    const defs = AppSchema.buildAnswerFieldDefs({});
    expect(defs.lookup).toBeUndefined();
  });
});

describe('diffMissingFields', () => {
  test('既存に無いものだけを返す', () => {
    const desired = { a: { code: 'a' }, b: { code: 'b' } };
    expect(
      Object.keys(AppSchema.diffMissingFields(desired, { a: {} })),
    ).toEqual(['b']);
    expect(Object.keys(AppSchema.diffMissingFields(desired, null))).toEqual([
      'a',
      'b',
    ]);
    expect(
      Object.keys(AppSchema.diffMissingFields(desired, { a: {}, b: {} })),
    ).toEqual([]);
  });
});

describe('checkRequestAppReady / checkAnswerAppReady / findRecordNumberCode', () => {
  test('依頼アプリの必須フィールド不足を検出する', () => {
    expect(
      AppSchema.checkRequestAppReady({
        title: {},
        description: {},
        requester: {},
        deadline: {},
        json: {},
      }),
    ).toEqual({ ready: true, missing: [] });
    const result = AppSchema.checkRequestAppReady({ title: {} });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual([
      'description',
      'requester',
      'deadline',
      'json',
    ]);
  });

  test('lookupの有無とレコード番号コードの検出', () => {
    expect(AppSchema.checkAnswerAppReady({ lookup: {} }).hasLookup).toBe(true);
    expect(AppSchema.checkAnswerAppReady({}).hasLookup).toBe(false);
    expect(
      AppSchema.findRecordNumberCode({
        a: { type: 'SINGLE_LINE_TEXT' },
        レコード番号: { type: 'RECORD_NUMBER' },
      }),
    ).toBe('レコード番号');
    expect(AppSchema.findRecordNumberCode({})).toBeNull();
  });
});

describe('buildViewsPayload', () => {
  const names = { listViewName: '集計リスト', analysisViewName: '分析' };

  test('両方無ければ2つ追加し、既存一覧はindexをずらして引き継ぐ', () => {
    const existing = {
      '(作業者が自分)': {
        type: 'LIST',
        name: '(作業者が自分)',
        id: '1',
        index: '0',
        builtinType: 'ASSIGNEE',
      },
      一覧1: {
        type: 'LIST',
        name: '一覧1',
        id: '2',
        index: '1',
        fields: ['レコード番号'],
        filterCond: '',
        sort: 'レコード番号 asc',
      },
    };
    const payload = AppSchema.buildViewsPayload(
      existing,
      names,
      'レコード番号',
    );
    expect(payload.added).toBe(2);
    expect(payload.views['集計リスト'].type).toBe('CUSTOM');
    expect(payload.views['集計リスト'].html).toContain('virtual-table-div');
    expect(payload.views['集計リスト'].index).toBe('0');
    expect(payload.views['分析'].type).toBe('LIST');
    expect(payload.views['分析'].index).toBe('1');
    // 既存はindexが後ろへずれ、内容は保持
    expect(payload.views['(作業者が自分)']).toEqual({
      index: '2',
      type: 'LIST',
    });
    expect(payload.views['一覧1'].index).toBe('3');
    expect(payload.views['一覧1'].fields).toEqual(['レコード番号']);
    // PUTで許可されないidは含めない
    expect(payload.views['一覧1'].id).toBeUndefined();
  });

  test('両方あれば何もしない', () => {
    const existing = {
      集計リスト: {
        type: 'CUSTOM',
        name: '集計リスト',
        index: '0',
        html: '<div id="virtual-table-div"></div>',
      },
      分析: { type: 'LIST', name: '分析', index: '1', fields: [] },
    };
    expect(
      AppSchema.buildViewsPayload(existing, names, 'レコード番号'),
    ).toEqual({
      views: null,
      added: 0,
    });
  });
});
