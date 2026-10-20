(function (root) {
  'use strict';

  // オフライン版(webapp/)のケースファイル(.json)の書き出し・読み込み。
  // ケース名・保存日時とジェノグラムのデータ(kintone版のフィールドの値と同じ形)を1つのJSONにまとめる。
  // 読み込みは、このケースファイルに加えて、kintone版のフィールドの値(モデルのJSONそのもの)も受け付ける。
  // kintone版のプラグイン本体(manifest.json)には含めない。

  const Model =
    typeof module !== 'undefined' && module.exports
      ? require('./model')
      : root.Genogram.Model;

  const FORMAT = 'govapps-genogram-case';
  const VERSION = 1;
  const CASE_NAME_MAX = 100;

  const serialize = (model, meta) => {
    const info = meta || {};
    return JSON.stringify(
      {
        format: FORMAT,
        version: VERSION,
        caseName: String(info.caseName || '').slice(0, CASE_NAME_MAX),
        savedAt: info.savedAt || new Date().toISOString(),
        genogram: Model.normalize(model),
      },
      null,
      2,
    );
  };

  const isObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  // 戻り値: { ok: true, model, caseName } | { ok: false, error }
  const parse = (text) => {
    let data;
    try {
      data = JSON.parse(String(text));
    } catch {
      return { ok: false, error: 'JSONとして読み込めないファイルです。' };
    }
    if (!isObject(data)) {
      return { ok: false, error: 'ジェノグラムのデータではありません。' };
    }
    if (data.format === FORMAT) {
      return {
        ok: true,
        model: Model.normalize(data.genogram),
        caseName:
          typeof data.caseName === 'string'
            ? data.caseName.slice(0, CASE_NAME_MAX)
            : '',
      };
    }
    // kintone版のフィールドの値(モデルのJSONそのもの)
    if (data.format === undefined && Array.isArray(data.persons)) {
      return { ok: true, model: Model.normalize(data), caseName: '' };
    }
    return { ok: false, error: 'ジェノグラムのデータではありません。' };
  };

  const pad = (n) => String(n).padStart(2, '0');

  // ファイル名に使えない文字(Windows/macOS)と制御文字を _ に置き換える
  const fileName = (caseName, date, ext) => {
    const base =
      String(caseName || '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .trim()
        .slice(0, 50) || 'ジェノグラム';
    const d = date || new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    return `${base}_${stamp}.${ext || 'json'}`;
  };

  const CaseFile = {
    FORMAT,
    VERSION,
    CASE_NAME_MAX,
    serialize,
    parse,
    fileName,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseFile;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.CaseFile = CaseFile;
  }
})(typeof window !== 'undefined' ? window : globalThis);
