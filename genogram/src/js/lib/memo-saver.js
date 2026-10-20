(function (root) {
  'use strict';

  // 詳細画面からのメモの追記。データのフィールドだけを PUT /k/v1/record.json で更新する。
  // API実行数を抑えるため、まず画面表示時の値とリビジョンでそのままPUTする(1回)。他の利用者が先に
  // 更新していた場合はkintoneがリビジョン不一致(GAIA_CO02)で拒否するので、そのときだけ最新をGETして
  // メモを足し直し、そのリビジョンでPUTし直す(計3回)。リビジョンを必ず指定するため、他の利用者の
  // 更新を上書きすることはない。
  // api: (path, method, body) => Promise。kintone.api(kintone.api.url(path, true), method, body)を渡す。

  const isNode = typeof module !== 'undefined' && module.exports;
  const Model = isNode ? require('./model') : root.Genogram.Model;
  const Ops = isNode ? require('./ops') : root.Genogram.Ops;

  const CONFLICT = 'GAIA_CO02';
  const RECORD_PATH = '/k/v1/record.json';

  const buildValue = (rawValue, memo, idGen) => {
    const parsed = Model.parse(rawValue);
    if (!parsed.ok) {
      throw new Error(
        'ジェノグラムのデータを読み込めません。編集画面でデータのフィールドを確認してください。',
      );
    }
    Ops.addMemo(parsed.model, memo, idGen);
    return Model.serialize(parsed.model);
  };

  const put = (api, appId, recordId, revision, fieldCode, value) =>
    api(RECORD_PATH, 'PUT', {
      app: appId,
      id: recordId,
      record: { [fieldCode]: { value } },
      revision,
    });

  const appendMemo = async (args) => {
    const { api, appId, recordId, revision, fieldCode, currentValue, memo } =
      args;
    const idGen = args.idGen || Ops.defaultIdGenerator;
    if (!memo || !String(memo.text || '').trim()) {
      throw new Error('メモを入力してください。');
    }
    const value = buildValue(currentValue, memo, idGen);
    try {
      return await put(api, appId, recordId, revision, fieldCode, value);
    } catch (error) {
      if (!error || error.code !== CONFLICT) {
        throw error;
      }
    }

    const latest = await api(RECORD_PATH, 'GET', { app: appId, id: recordId });
    const latestField = latest.record[fieldCode];
    const retryValue = buildValue(
      latestField ? latestField.value : '',
      memo,
      idGen,
    );
    try {
      return await put(
        api,
        appId,
        recordId,
        latest.record.$revision.value,
        fieldCode,
        retryValue,
      );
    } catch (error) {
      if (error && error.code === CONFLICT) {
        throw new Error(
          '他の利用者が同時に更新しています。画面を再読み込みしてから、もう一度追記してください。',
        );
      }
      throw error;
    }
  };

  const MemoSaver = { appendMemo };

  if (isNode) {
    module.exports = MemoSaver;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.MemoSaver = MemoSaver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
