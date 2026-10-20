(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 設定画面の候補(データを保存する文字列(複数行)フィールド・表示先のスペース)の抽出。
  // - jsonField: データ(JSON)を保存する文字列(複数行)フィールドのフィールドコード
  // - spaceId: 図を表示するスペースフィールドの要素ID
  // - hideJsonField: データのフィールドを画面に表示しないか('true'/'false'、既定true)

  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      jsonField: typeof saved.jsonField === 'string' ? saved.jsonField : '',
      spaceId: typeof saved.spaceId === 'string' ? saved.spaceId : '',
      hideJsonField: saved.hideJsonField !== 'false',
    };
  };

  const serialize = (config) => ({
    jsonField: config.jsonField || '',
    spaceId: config.spaceId || '',
    hideJsonField: config.hideJsonField === false ? 'false' : 'true',
  });

  const isConfigured = (config) =>
    !!(config && config.jsonField && config.spaceId);

  // fields: kintone.app.getFormFields()の戻り値(フィールドコードをキーにした平坦なオブジェクト)
  // layout: kintone.app.getFormLayout()の戻り値(レイアウト配列そのもの)
  // テーブル内のフィールド・スペースは、行ごとに複数あるため対象外。グループ内は対象に含める。
  const listCandidates = (fields, layout) => {
    const textFields = [];
    const spaces = [];
    const props = fields || {};
    const walk = (rows) => {
      (rows || []).forEach((row) => {
        if (row.type === 'GROUP') {
          walk(row.layout);
          return;
        }
        if (row.type === 'SUBTABLE') {
          return;
        }
        (row.fields || []).forEach((field) => {
          if (field.type === 'SPACER') {
            if (field.elementId) {
              spaces.push(field.elementId);
            }
            return;
          }
          if (field.type === 'MULTI_LINE_TEXT' && field.code) {
            const prop = props[field.code];
            textFields.push({
              code: field.code,
              label: (prop && prop.label) || field.code,
            });
          }
        });
      });
    };
    walk(layout);
    return { textFields, spaces };
  };

  const ConfigStore = { load, serialize, isConfigured, listCandidates };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
