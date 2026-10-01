(function (root) {
  'use strict';

  // 指摘履歴テーブルの行(イベントオブジェクト/GET record.jsonの形式: { id, value: { code: { type, value } } })
  // の読み取りと、PUT record.json用のテーブル値の組み立て(idea.md「画面ごとの挙動」)。
  // PUTでは「リクエストに含めない行は削除される」「idだけを指定した行は値が保持される」(kintoneドキュメント
  // 「1件のレコードを更新する」補足)ため、変更しない行は{ id }のみ、変更行はフル値で送る。
  //
  // codes.targetRowId(v2で追加した「対象行ID」列)は、v1の設定のまま再保存していないアプリでは存在しない。
  // その場合は行IDを読み書きしない(フィールド単位の指摘だけが使える)。

  const STATUS_UNRESOLVED = '未解決';
  const STATUS_RESOLVED = '解決済み';

  const cellValue = (row, code) => {
    if (!code) {
      return undefined;
    }
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
          targetRowId: str(cellValue(row, codes.targetRowId)),
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

  // バッジ・下書きの紐付けキー。テーブルの行単位の指摘は「テーブルコード#行ID」。
  const targetKey = (code, rowId) => (rowId ? `${code}#${rowId}` : code);

  const rowExists = (rowIdsByTable, code, rowId) =>
    !!rowId && (rowIdsByTable[code] || []).indexOf(String(rowId)) !== -1;

  // rowIdsByTable: { テーブルコード: [現在の行IDの文字列, ...] }
  // 行が削除済みの指摘はテーブル単位のキーに寄せる(未解決の指摘が画面から見えなくなるのを防ぐ)。
  const summarizeByTarget = (items, rowIdsByTable = {}) => {
    const summary = {};
    items.forEach((item) => {
      const key = rowExists(rowIdsByTable, item.targetCode, item.targetRowId)
        ? targetKey(item.targetCode, item.targetRowId)
        : item.targetCode;
      if (!summary[key]) {
        summary[key] = { unresolved: [], resolved: [], state: 'resolved' };
      }
      const entry = summary[key];
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

  const rowLabel = (tableLabel, index) => `${tableLabel} ${index + 1}行目`;

  // 画面に出す対象名。フィールド名は現在のラベル(labelOf)を優先し、行は現在の並び順で「n行目」を振り直す。
  // 削除済みのフィールド・行は、指摘時に保存したラベルを使う。
  const describeTarget = (item, labelOf, rowIdsByTable = {}) => {
    const currentLabel = labelOf(item.targetCode);
    if (!item.targetRowId) {
      return currentLabel || item.targetLabel || item.targetCode;
    }
    const index = (rowIdsByTable[item.targetCode] || []).indexOf(
      String(item.targetRowId),
    );
    if (currentLabel && index !== -1) {
      return rowLabel(currentLabel, index);
    }
    return `${item.targetLabel || item.targetCode}(削除された行)`;
  };

  // テーブル行の中身を短く要約する(どの行への指摘かを見分けるため)。
  const cellText = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => (v && typeof v === 'object' ? v.name || v.code : v))
        .filter((v) => v)
        .join(', ');
    }
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  };

  const rowSummary = (tableRow, maxLength = 40) => {
    const cells = (tableRow && tableRow.value) || {};
    const parts = Object.keys(cells)
      .map((code) => cellText(cells[code] && cells[code].value).trim())
      .filter((text) => text)
      .slice(0, 3);
    const text = parts.join(' / ');
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  };

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

  const toPutValue = (codes, item) => {
    const value = {
      [codes.targetCode]: { value: item.targetCode },
      [codes.targetLabel]: { value: item.targetLabel },
      [codes.pointedAt]: { value: item.pointedAt },
      [codes.pointedBy]: { value: userValue(item.pointedBy) },
      [codes.comment]: { value: item.comment },
      [codes.status]: { value: item.status },
      [codes.resolution]: { value: item.resolution },
      [codes.resolvedBy]: { value: userValue(item.resolvedBy) },
      [codes.resolvedAt]: { value: item.resolvedAt },
    };
    if (codes.targetRowId) {
      value[codes.targetRowId] = { value: item.targetRowId || '' };
    }
    return value;
  };

  const idOnly = (tableValue) =>
    (tableValue || []).map((row) => ({ id: row.id }));

  // 下書きの指摘(entries)をまとめて末尾に追加する。内容が空の下書きは無視し、1件も残らなければエラー。
  const buildTableForAdd = (tableValue, codes, params) => {
    const newRows = (params.entries || [])
      .map((entry) => ({ ...entry, comment: str(entry.comment).trim() }))
      .filter((entry) => entry.comment)
      .map((entry) => ({
        value: toPutValue(codes, {
          targetCode: entry.targetCode,
          targetLabel: entry.targetLabel,
          targetRowId: entry.targetRowId || '',
          pointedAt: params.nowIso,
          pointedBy: { code: params.userCode },
          comment: entry.comment,
          status: STATUS_UNRESOLVED,
          resolution: '',
          resolvedBy: null,
          resolvedAt: '',
        }),
      }));
    if (newRows.length === 0) {
      throw new Error('指摘内容を入力してください。');
    }
    return idOnly(tableValue).concat(newRows);
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
    targetKey,
    summarizeByTarget,
    countUnresolved,
    rowLabel,
    describeTarget,
    rowSummary,
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
