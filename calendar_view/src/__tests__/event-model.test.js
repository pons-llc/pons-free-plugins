const { buildEvents } = require('../js/lib/event-model');

const formFields = {
  title: { type: 'SINGLE_LINE_TEXT', label: 'タイトル' },
  start: { type: 'DATETIME', label: '開始' },
  end: { type: 'DATETIME', label: '終了' },
  start_date: { type: 'DATE', label: '開始日' },
  assignee: { type: 'USER_SELECT', label: '担当者' },
  memo: { type: 'SINGLE_LINE_TEXT', label: 'メモ' },
  status: { type: 'STATUS', label: 'ステータス' },
};

const record = (overrides) => ({
  $id: { value: '1' },
  $revision: { value: '3' },
  title: { type: 'SINGLE_LINE_TEXT', value: 'MTG' },
  start: { type: 'DATETIME', value: '2026-08-10T09:00:00Z' },
  end: { type: 'DATETIME', value: '2026-08-10T10:00:00Z' },
  start_date: { type: 'DATE', value: '2026-08-10' },
  assignee: { type: 'USER_SELECT', value: [{ code: 'alice', name: 'Alice' }] },
  memo: { type: 'SINGLE_LINE_TEXT', value: 'note' },
  status: { type: 'STATUS', value: '未着手' },
  ...overrides,
});

describe('buildEvents', () => {
  test('builds an event from a record with start/end/title/group/hover', () => {
    const config = {
      titleFieldCode: 'title',
      startFieldCode: 'start',
      endFieldCode: 'end',
      groupFieldCode: 'assignee',
      hoverFieldCodes: ['memo'],
    };
    const events = buildEvents([record()], config, formFields);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      recordId: '1',
      revision: '3',
      title: 'MTG',
      groupKey: 'alice',
      groupLabel: 'Alice',
      allDay: false,
    });
    expect(events[0].hoverLines).toEqual(['メモ: note']);
    expect(events[0].start.toISOString()).toBe('2026-08-10T09:00:00.000Z');
    expect(events[0].end.toISOString()).toBe('2026-08-10T10:00:00.000Z');
  });

  test('skips records with no valid start date', () => {
    const config = { titleFieldCode: 'title', startFieldCode: 'start' };
    const events = buildEvents(
      [record({ start: { type: 'DATETIME', value: '' } })],
      config,
      formFields,
    );
    expect(events).toHaveLength(0);
  });

  test('defaults to a 1-hour duration when end field is unset (DATETIME start)', () => {
    const config = { titleFieldCode: 'title', startFieldCode: 'start' };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].end.getTime() - events[0].start.getTime()).toBe(
      60 * 60 * 1000,
    );
  });

  test('marks all-day and defaults to a 1-day duration when start field type is DATE', () => {
    const config = { titleFieldCode: 'title', startFieldCode: 'start_date' };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].allDay).toBe(true);
    expect(events[0].end.getTime() - events[0].start.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  test('treats an end date at/before the start as unset and applies the default duration', () => {
    const config = {
      titleFieldCode: 'title',
      startFieldCode: 'start',
      endFieldCode: 'end',
    };
    const events = buildEvents(
      [record({ end: { type: 'DATETIME', value: '2026-08-10T08:00:00Z' } })],
      config,
      formFields,
    );
    expect(events[0].end.getTime() - events[0].start.getTime()).toBe(
      60 * 60 * 1000,
    );
  });

  test('produces an empty groupKey/groupLabel when no groupFieldCode is configured', () => {
    const config = { titleFieldCode: 'title', startFieldCode: 'start' };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].groupKey).toBe('');
    expect(events[0].groupLabel).toBe('');
  });

  test('colorKey/colorLabel fall back to the group when no colorFieldCode is configured', () => {
    const config = {
      titleFieldCode: 'title',
      startFieldCode: 'start',
      groupFieldCode: 'assignee',
    };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].colorKey).toBe('alice');
    expect(events[0].colorLabel).toBe('Alice');
  });

  test('colorKey/colorLabel use a dedicated colorFieldCode independently of grouping', () => {
    const config = {
      titleFieldCode: 'title',
      startFieldCode: 'start',
      groupFieldCode: 'assignee',
      colorFieldCode: 'status',
    };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].groupKey).toBe('alice');
    expect(events[0].colorKey).toBe('未着手');
    expect(events[0].colorLabel).toBe('未着手');
  });

  test('colorKey is empty when neither colorFieldCode nor groupFieldCode is configured', () => {
    const config = { titleFieldCode: 'title', startFieldCode: 'start' };
    const events = buildEvents([record()], config, formFields);
    expect(events[0].colorKey).toBe('');
    expect(events[0].colorLabel).toBe('');
  });
});
