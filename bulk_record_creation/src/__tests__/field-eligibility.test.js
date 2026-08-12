'use strict';

const {
  isEligibleField,
  listEligibleFields,
  listAssigneeCandidateFields,
  listRecurrenceFieldCandidates,
  inputKindOf,
} = require('../js/lib/field-eligibility');

const formFields = {
  title: { type: 'SINGLE_LINE_TEXT', code: 'title', label: 'タイトル' },
  memo: { type: 'MULTI_LINE_TEXT', code: 'memo', label: 'メモ' },
  due_date: { type: 'DATE', code: 'due_date', label: '期日' },
  created_date: { type: 'DATE', code: 'created_date', label: '起票日' },
  meeting_datetime: {
    type: 'DATETIME',
    code: 'meeting_datetime',
    label: '会議日時',
  },
  worker: { type: 'USER_SELECT', code: 'worker', label: '担当者' },
  org: { type: 'ORGANIZATION_SELECT', code: 'org', label: '担当組織' },
  grp: { type: 'GROUP_SELECT', code: 'grp', label: '担当グループ' },
  record_number: {
    type: 'RECORD_NUMBER',
    code: 'record_number',
    label: 'レコード番号',
  },
  creator: { type: 'CREATOR', code: 'creator', label: '作成者' },
  status: { type: 'STATUS', code: 'status', label: 'ステータス' },
  assignee: { type: 'STATUS_ASSIGNEE', code: 'assignee', label: '作業者' },
  calc: { type: 'CALC', code: 'calc', label: '計算' },
  table: { type: 'SUBTABLE', code: 'table', label: 'テーブル' },
  file: { type: 'FILE', code: 'file', label: '添付ファイル' },
  group_deco: { type: 'GROUP', code: 'group_deco', label: 'グループ(装飾)' },
  looked_up: {
    type: 'SINGLE_LINE_TEXT',
    code: 'looked_up',
    label: 'ルックアップ',
    lookup: { relatedApp: { app: '1' } },
  },
};

describe('isEligibleField', () => {
  test('通常の文字列フィールドは対象', () => {
    expect(isEligibleField(formFields.title)).toBe(true);
  });

  test('ルックアップフィールドは型を問わず対象外', () => {
    expect(isEligibleField(formFields.looked_up)).toBe(false);
  });

  test('ユーザー/組織/グループ選択は対象外(対象者フィールド専用のため)', () => {
    expect(isEligibleField(formFields.worker)).toBe(false);
    expect(isEligibleField(formFields.org)).toBe(false);
    expect(isEligibleField(formFields.grp)).toBe(false);
  });

  test('システム系・書き込み不可フィールドは対象外', () => {
    [
      'record_number',
      'creator',
      'status',
      'assignee',
      'calc',
      'table',
      'file',
      'group_deco',
    ].forEach((code) => {
      expect(isEligibleField(formFields[code])).toBe(false);
    });
  });

  test('DATE型は(繰り返し用に設定されていなければ)対象', () => {
    expect(isEligibleField(formFields.due_date)).toBe(true);
  });
});

describe('listEligibleFields', () => {
  test('対象外フィールドを除いたテンプレート候補一覧を返す(DATETIME型も対象)', () => {
    const eligible = listEligibleFields(formFields).map((f) => f.code);
    expect(eligible.sort()).toEqual(
      ['created_date', 'due_date', 'meeting_datetime', 'memo', 'title'].sort(),
    );
  });

  test('excludeFieldCodesで指定したフィールド(繰り返し用日付フィールド)をさらに除外する', () => {
    const eligible = listEligibleFields(formFields, {
      excludeFieldCodes: ['due_date'],
    }).map((f) => f.code);
    expect(eligible.sort()).toEqual(
      ['created_date', 'meeting_datetime', 'memo', 'title'].sort(),
    );
  });
});

describe('listAssigneeCandidateFields', () => {
  test('USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECTのみを候補として返す', () => {
    const candidates = listAssigneeCandidateFields(formFields).map(
      (f) => f.code,
    );
    expect(candidates.sort()).toEqual(['grp', 'org', 'worker'].sort());
  });
});

describe('listRecurrenceFieldCandidates', () => {
  test('DATE型・DATETIME型を候補として返す', () => {
    const candidates = listRecurrenceFieldCandidates(formFields).map(
      (f) => f.code,
    );
    expect(candidates.sort()).toEqual(
      ['created_date', 'due_date', 'meeting_datetime'].sort(),
    );
  });
});

describe('inputKindOf', () => {
  test('ラジオボタン・ドロップダウンはSINGLE_CHOICE', () => {
    expect(inputKindOf('RADIO_BUTTON')).toBe('SINGLE_CHOICE');
    expect(inputKindOf('DROP_DOWN')).toBe('SINGLE_CHOICE');
  });

  test('チェックボックス・複数選択はMULTI_CHOICE', () => {
    expect(inputKindOf('CHECK_BOX')).toBe('MULTI_CHOICE');
    expect(inputKindOf('MULTI_SELECT')).toBe('MULTI_CHOICE');
  });

  test('DATE/TIME/DATETIME/NUMBERはそれぞれの種類を返す', () => {
    expect(inputKindOf('DATE')).toBe('DATE');
    expect(inputKindOf('TIME')).toBe('TIME');
    expect(inputKindOf('DATETIME')).toBe('DATETIME');
    expect(inputKindOf('NUMBER')).toBe('NUMBER');
  });

  test('複数行文字列・リッチエディターはTEXTAREA', () => {
    expect(inputKindOf('MULTI_LINE_TEXT')).toBe('TEXTAREA');
    expect(inputKindOf('RICH_TEXT')).toBe('TEXTAREA');
  });

  test('その他(文字列1行等)はTEXT', () => {
    expect(inputKindOf('SINGLE_LINE_TEXT')).toBe('TEXT');
    expect(inputKindOf('LINK')).toBe('TEXT');
  });

  test('フィールドオブジェクトを渡した場合もtypeで判定する', () => {
    expect(inputKindOf({ type: 'NUMBER', code: 'n' })).toBe('NUMBER');
  });
});
