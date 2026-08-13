const { resolveAssignee } = require('../js/lib/assignee-resolver');

describe('resolveAssignee', () => {
  test('USER_FIELD: returns the first user in the USER_SELECT field value', () => {
    const record = {
      assignee_user: {
        type: 'USER_SELECT',
        value: [
          { code: 'sato', name: 'Noboru Sato' },
          { code: 'kato', name: 'Misaki Kato' },
        ],
      },
    };
    expect(
      resolveAssignee(record, 'USER_FIELD', {
        assigneeFieldCode: 'assignee_user',
      }),
    ).toEqual({ code: 'sato', name: 'Noboru Sato' });
  });

  test('STATUS_ASSIGNEE: returns the first worker regardless of assigneeFieldCode', () => {
    const record = {
      作業者: {
        type: 'STATUS_ASSIGNEE',
        value: [{ code: 'sato', name: 'Noboru Sato' }],
      },
    };
    expect(
      resolveAssignee(record, 'STATUS_ASSIGNEE', {
        assigneeFieldCode: 'assignee_user',
        statusAssigneeFieldCode: '作業者',
      }),
    ).toEqual({ code: 'sato', name: 'Noboru Sato' });
  });

  test('returns null when the value array is empty (unassigned)', () => {
    const record = { assignee_user: { value: [] } };
    expect(
      resolveAssignee(record, 'USER_FIELD', {
        assigneeFieldCode: 'assignee_user',
      }),
    ).toBeNull();
  });

  test('returns null when the configured field code is missing', () => {
    expect(resolveAssignee({}, 'USER_FIELD', {})).toBeNull();
    expect(resolveAssignee({}, 'STATUS_ASSIGNEE', {})).toBeNull();
  });

  test('falls back to code when name is missing on the user object', () => {
    const record = { assignee_user: { value: [{ code: 'sato' }] } };
    expect(
      resolveAssignee(record, 'USER_FIELD', {
        assigneeFieldCode: 'assignee_user',
      }),
    ).toEqual({ code: 'sato', name: 'sato' });
  });
});
