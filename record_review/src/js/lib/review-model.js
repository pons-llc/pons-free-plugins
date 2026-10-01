(function (root) {
  'use strict';

  // 指摘履歴テーブルの行(イベントオブジェクト/GET record.jsonの形式: { id, value: { code: { type, value } } })
  // の読み取りと、PUT record.json用のテーブル値の組み立て(idea.md「画面ごとの挙動」)。
  // PUTでは「リクエストに含めない行は削除される」「idだけを指定した行は値が保持される」(kintoneドキュメント
  // 「1件のレコードを更新する」補足)ため、変更しない行は{ id }のみ、変更行はフル値で送る。

  const STATUS_UNRESOLVED = '未解決';
  const STATUS_RESOLVED = '解決済み';

  const cellValue = (row, code) => {
    const cell = row && row.value && row.value[code];
    return cell ? cell.value : undefined;
  };

  const firstUser = (users) =>
    Array.isArray(users) && users.length > 0
      ? { code: users[0].code, name: users[0].name || users[0].code }
      : null;

  const str = (v) => (typeof v === 'string' ? v : '');

  const parseRows = (tableValue, codes) => {
    if (!Array.isArray(tableValue)) {
      return [];
    }
    return tableValue
      .map((row) => {
        const status = str(cellValue(row, codes.status));
        return {
          rowId: row.id,
          targetCode: str(cellValue(row, codes.targetCode)),
          targetLabel: str(cellValue(row, codes.targetLabel)),
          pointedAt: str(cellValue(row, codes.pointedAt)),
          pointedBy: firstUser(cellValue(row, codes.pointedBy)),
          comment: str(cellValue(row, codes.comment)),
          status,
          resolved: status === STATUS_RESOLVED,
          resolution: str(cellValue(row, codes.resolution)),
          resolvedBy: firstUser(cellValue(row, codes.resolvedBy)),
          resolvedAt: str(cellValue(row, codes.resolvedAt)),
        };
      })
      .filter((item) => item.targetCode && item.comment);
  };

  const summarizeByField = (items) => {
    const summary = {};
    items.forEach((item) => {
      if (!summary[item.targetCode]) {
        summary[item.targetCode] = {
          unresolved: [],
          resolved: [],
          state: 'resolved',
        };
      }
      const entry = summary[item.targetCode];
      if (item.resolved) {
        entry.resolved.push(item);
      } else {
        entry.unresolved.push(item);
        entry.state = 'unresolved';
      }
    });
    return summary;
  };

  const countUnresolved = (items) => items.filter((i) => !i.resolved).length;

  // kintoneの日時フィールドに渡す形式(UTC、ミリ秒なし)。
  const toKintoneDateTime = (date) =>
    date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const pad = (n) => String(n).padStart(2, '0');
  const formatDateTime = (iso) => {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const userValue = (user) => (user && user.code ? [{ code: user.code }] : []);

  const toPutValue = (codes, item) => ({
    [codes.targetCode]: { value: item.targetCode },
    [codes.targetLabel]: { value: item.targetLabel },
    [codes.pointedAt]: { value: item.pointedAt },
    [codes.pointedBy]: { value: userValue(item.pointedBy) },
    [codes.comment]: { value: item.comment },
    [codes.status]: { value: item.status },
    [codes.resolution]: { value: item.resolution },
    [codes.resolvedBy]: { value: userValue(item.resolvedBy) },
    [codes.resolvedAt]: { value: item.resolvedAt },
  });

  const idOnly = (tableValue) =>
    (tableValue || []).map((row) => ({ id: row.id }));

  const buildTableForAdd = (tableValue, codes, params) => {
    const comment = str(params.comment).trim();
    if (!comment) {
      throw new Error('指摘内容を入力してください。');
    }
    const newItem = {
      targetCode: params.targetCode,
      targetLabel: params.targetLabel,
      pointedAt: params.nowIso,
      pointedBy: { code: params.userCode },
      comment,
      status: STATUS_UNRESOLVED,
      resolution: '',
      resolvedBy: null,
      resolvedAt: '',
    };
    return idOnly(tableValue).concat([{ value: toPutValue(codes, newItem) }]);
  };

  const buildTableForResolve = (tableValue, codes, params) => {
    const resolution = str(params.resolution).trim();
    if (!resolution) {
      throw new Error('解決内容を入力してください。');
    }
    const rows = tableValue || [];
    const target = rows.find((row) => String(row.id) === String(params.rowId));
    if (!target) {
      throw new Error(
        '対象の指摘が見つかりません。他のユーザーが削除した可能性があります。画面を再読み込みしてください。',
      );
    }
    // 行の内容はparseRowsと同じ規則で読み取る(空行除外のfilterは通さない)。
    const item = parseRows([target], codes)[0] || {};
    if (item.resolved) {
      throw new Error(
        'この指摘は既に解決済みです。画面を再読み込みしてください。',
      );
    }
    const updated = {
      ...item,
      status: STATUS_RESOLVED,
      resolution,
      resolvedBy: { code: params.userCode },
      resolvedAt: params.nowIso,
    };
    return rows.map((row) =>
      row === target
        ? { id: row.id, value: toPutValue(codes, updated) }
        : { id: row.id },
    );
  };

  const ReviewModel = {
    STATUS_UNRESOLVED,
    STATUS_RESOLVED,
    parseRows,
    summarizeByField,
    countUnresolved,
    toKintoneDateTime,
    formatDateTime,
    buildTableForAdd,
    buildTableForResolve,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewModel;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.ReviewModel = ReviewModel;
  }
})(typeof window !== 'undefined' ? window : globalThis);
