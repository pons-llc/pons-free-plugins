const { buildCard } = require('../js/lib/card-model');

const baseViewConfig = {
  titleFieldCode: 'title',
  hoverFieldCodes: [],
  dueFieldCode: '',
  badgeFieldCode: '',
  assigneeMode: 'USER_FIELD',
  assigneeFieldCode: 'assignee_user',
};

const formFields = {
  title: { label: 'タイトル' },
  memo: { label: 'メモ' },
  priority: { label: '優先度' },
  due: { label: '期限' },
};

describe('buildCard', () => {
  test('builds the basic fields (id/title) from the record', () => {
    const record = {
      $id: { value: '42' },
      title: { value: 'タスクA' },
    };
    const card = buildCard(record, baseViewConfig, { formFields });
    expect(card.id).toBe('42');
    expect(card.title).toBe('タスクA');
  });

  test('joins hover fields into label: value lines, skipping empty values', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      memo: { value: '詳細メモ' },
      priority: { value: '' },
    };
    const viewConfig = {
      ...baseViewConfig,
      hoverFieldCodes: ['memo', 'priority'],
    };
    const card = buildCard(record, viewConfig, { formFields });
    expect(card.hoverText).toBe('メモ: 詳細メモ');
  });

  test('sets badgeLabel from badgeFieldCode when configured', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      priority: { value: '高' },
    };
    const viewConfig = { ...baseViewConfig, badgeFieldCode: 'priority' };
    const card = buildCard(record, viewConfig, { formFields });
    expect(card.badgeLabel).toBe('高');
  });

  test('leaves badgeLabel empty when badgeFieldCode is not configured', () => {
    const record = { $id: { value: '1' }, title: { value: 'タスクA' } };
    const card = buildCard(record, baseViewConfig, { formFields });
    expect(card.badgeLabel).toBe('');
  });

  test('flags overdue when the due date is before "now"', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      due: { value: '2024-01-01' },
    };
    const viewConfig = { ...baseViewConfig, dueFieldCode: 'due' };
    const card = buildCard(record, viewConfig, {
      formFields,
      now: new Date(2024, 0, 15),
    });
    expect(card.dueLabel).toBe('2024-01-01');
    expect(card.overdue).toBe(true);
  });

  test('does not flag overdue when the due date is in the future', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      due: { value: '2099-01-01' },
    };
    const viewConfig = { ...baseViewConfig, dueFieldCode: 'due' };
    const card = buildCard(record, viewConfig, {
      formFields,
      now: new Date(2024, 0, 15),
    });
    expect(card.overdue).toBe(false);
  });

  test('resolves assignee via USER_FIELD mode', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      assignee_user: { value: [{ code: 'sato', name: 'Noboru Sato' }] },
    };
    const card = buildCard(record, baseViewConfig, { formFields });
    expect(card.assignee).toEqual({ code: 'sato', name: 'Noboru Sato' });
  });

  test('resolves assignee via STATUS_ASSIGNEE mode using context.statusAssigneeFieldCode', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      作業者: { value: [{ code: 'sato', name: 'Noboru Sato' }] },
    };
    const viewConfig = { ...baseViewConfig, assigneeMode: 'STATUS_ASSIGNEE' };
    const card = buildCard(record, viewConfig, {
      formFields,
      statusAssigneeFieldCode: '作業者',
    });
    expect(card.assignee).toEqual({ code: 'sato', name: 'Noboru Sato' });
  });

  test('assignee is null when unassigned', () => {
    const record = {
      $id: { value: '1' },
      title: { value: 'タスクA' },
      assignee_user: { value: [] },
    };
    const card = buildCard(record, baseViewConfig, { formFields });
    expect(card.assignee).toBeNull();
  });
});
