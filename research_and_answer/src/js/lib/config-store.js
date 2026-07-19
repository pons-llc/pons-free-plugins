(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。フィールドコードはアプリテンプレートの固定規約とし、
  // ユーザーが変える可能性のある画面側の名前(スペース要素ID・一覧名)のみ設定にする。
  const DEFAULTS = {
    role: '', // 'request' | 'answer'
    answerAppId: '', // 依頼アプリに設定する、リレーション先の回答アプリID
    requestAppId: '', // 回答アプリに設定する、リレーション元の依頼アプリID
    previewSpaceId: 'preview',
    formSpaceId: 'form_space',
    listViewName: '集計リスト',
    analysisViewName: '分析',
  };

  // getConfig()はプラグインが未設定のアプリではnull/空オブジェクトを返すことがあるため、
  // saved自体がnull/undefinedでも例外にせず既定値を返す(org_lookupと同じ方針)。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      role: saved.role || DEFAULTS.role,
      answerAppId: saved.answerAppId || DEFAULTS.answerAppId,
      requestAppId: saved.requestAppId || DEFAULTS.requestAppId,
      previewSpaceId: saved.previewSpaceId || DEFAULTS.previewSpaceId,
      formSpaceId: saved.formSpaceId || DEFAULTS.formSpaceId,
      listViewName: saved.listViewName || DEFAULTS.listViewName,
      analysisViewName: saved.analysisViewName || DEFAULTS.analysisViewName,
    };
  };

  const serialize = (config) => ({
    role: config.role || '',
    answerAppId: String(config.answerAppId || '').trim(),
    requestAppId: String(config.requestAppId || '').trim(),
    previewSpaceId: config.previewSpaceId || DEFAULTS.previewSpaceId,
    formSpaceId: config.formSpaceId || DEFAULTS.formSpaceId,
    listViewName: config.listViewName || DEFAULTS.listViewName,
    analysisViewName: config.analysisViewName || DEFAULTS.analysisViewName,
  });

  const isPositiveIntString = (v) => /^[1-9]\d*$/.test(String(v || '').trim());

  const validate = (config) => {
    const errors = [];
    if (config.role !== 'request' && config.role !== 'answer') {
      errors.push(
        'このアプリの役割(依頼アプリ/回答アプリ)を選択してください。',
      );
    }
    if (config.role === 'request') {
      if (!isPositiveIntString(config.answerAppId)) {
        errors.push('回答アプリのアプリIDを数値で入力してください。');
      }
      if (!String(config.previewSpaceId || '').trim()) {
        errors.push('プレビューを表示するスペースの要素IDを入力してください。');
      }
    }
    if (config.role === 'answer') {
      if (!isPositiveIntString(config.requestAppId)) {
        errors.push('依頼アプリのアプリIDを数値で入力してください。');
      }
      if (!String(config.formSpaceId || '').trim()) {
        errors.push(
          '回答フォームを表示するスペースの要素IDを入力してください。',
        );
      }
      if (!String(config.listViewName || '').trim()) {
        errors.push('集計リストを表示する一覧名を入力してください。');
      }
      if (!String(config.analysisViewName || '').trim()) {
        errors.push('分析ダッシュボードを表示する一覧名を入力してください。');
      }
    }
    return { valid: errors.length === 0, errors };
  };

  const ConfigStore = {
    DEFAULTS,
    load,
    serialize,
    validate,
    isPositiveIntString,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.ResearchAnswer = root.ResearchAnswer || {};
    root.ResearchAnswer.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
