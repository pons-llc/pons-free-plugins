(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;

  // 集計アプリ(＝このプラグインが入っているアプリ)自身のフォーム設定を書き換えて、
  // 突合履歴テーブルと結果表示用のスペースを用意する。
  // scripts/kintone-admin.js の ensureFormFields / ensureSpacerInLayout / deployApp と
  // 同じ手順だが、あちらはNodeのパスワード認証専用なのでブラウザ側に実装し直している。
  const previewFieldsUrl = () =>
    kintone.api.url('/k/v1/preview/app/form/fields.json', true);
  const previewLayoutUrl = () =>
    kintone.api.url('/k/v1/preview/app/form/layout.json', true);
  const deployUrl = () =>
    kintone.api.url('/k/v1/preview/app/deploy.json', true);

  const DEPLOY_POLL_INTERVAL_MS = 1500;
  const DEPLOY_POLL_MAX_TRIES = 60;

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  // 動作テスト環境のフィールド一覧。運用環境ではなくpreviewを見るのは、
  // 直前に追加したフィールドも含めて差分判定したいため。
  const fetchPreviewFields = async (appId) => {
    const resp = await kintone.api(previewFieldsUrl(), 'GET', { app: appId });
    return { properties: resp.properties || {}, revision: resp.revision };
  };

  const fetchPreviewLayout = async (appId) => {
    const resp = await kintone.api(previewLayoutUrl(), 'GET', { app: appId });
    return { layout: resp.layout || [], revision: resp.revision };
  };

  const addFields = (appId, properties) =>
    kintone.api(previewFieldsUrl(), 'POST', { app: appId, properties });

  const updateLayout = (appId, layout) =>
    kintone.api(previewLayoutUrl(), 'PUT', { app: appId, layout });

  const deployApp = async (appId) => {
    await kintone.api(deployUrl(), 'POST', { apps: [{ app: appId }] });
    for (let i = 0; i < DEPLOY_POLL_MAX_TRIES; i += 1) {
      const resp = await kintone.api(deployUrl(), 'GET', { apps: [appId] });
      const status = resp.apps && resp.apps[0] ? resp.apps[0].status : '';
      if (status === 'SUCCESS') {
        return;
      }
      if (status === 'FAIL' || status === 'CANCEL') {
        throw new Error(
          `アプリの反映に失敗しました(status: ${status})。アプリの設定画面を確認してください。`,
        );
      }
      await sleep(DEPLOY_POLL_INTERVAL_MS);
    }
    throw new Error('アプリの反映が時間内に完了しませんでした。');
  };

  // 現在のスキーマ状態を調べる(設定画面の「作成済み/未作成」表示に使う)
  const inspect = async (appId) => {
    const [fields, layout] = await Promise.all([
      fetchPreviewFields(appId),
      fetchPreviewLayout(appId),
    ]);
    return {
      properties: fields.properties,
      layout: layout.layout,
      missingFields: Object.keys(
        NS.AppSchema.missingFieldProperties(fields.properties),
      ),
      missingSubtableFields: NS.AppSchema.missingSubtableFieldCodes(
        fields.properties,
      ),
      hasSpacer: NS.AppSchema.hasSpacer(layout.layout),
      ready: NS.AppSchema.isSchemaReady(fields.properties, layout.layout),
    };
  };

  // 不足しているものだけを足す(冪等)。何も足す必要がなければデプロイもしない。
  const ensureSchema = async (appId) => {
    const before = await inspect(appId);
    if (before.ready) {
      return { changed: false, addedFields: [], addedSpacer: false };
    }
    if (before.missingSubtableFields.length > 0) {
      throw new Error(
        `「突合履歴」テーブルに次のフィールドが不足しています: ${before.missingSubtableFields.join(', ')}。` +
          'テーブルを一度削除してから、もう一度この操作を実行してください。',
      );
    }

    const missing = NS.AppSchema.missingFieldProperties(before.properties);
    const addedFields = Object.keys(missing);
    if (addedFields.length > 0) {
      await addFields(appId, missing);
    }

    let addedSpacer = false;
    if (!before.hasSpacer) {
      // フィールド追加でレイアウトが変わっているため、レイアウトは取り直す
      const current = await fetchPreviewLayout(appId);
      const nextLayout = NS.AppSchema.appendSpacerRow(current.layout);
      await updateLayout(appId, nextLayout);
      addedSpacer = true;
    }

    await deployApp(appId);
    return { changed: true, addedFields, addedSpacer };
  };

  NS.SchemaWriter = {
    inspect,
    ensureSchema,
    deployApp,
  };
})(typeof window !== 'undefined' ? window : globalThis, kintone);
