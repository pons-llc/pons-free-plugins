(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const NS = isNode ? null : root.AppSettingsRequest;
  const ChangeRequest = isNode
    ? require('./change-request.js')
    : NS.ChangeRequest;
  const ApiPath = isNode ? require('./api-path.js') : NS.ApiPath;
  const DeployPoller = isNode ? require('./deploy-poller.js') : NS.DeployPoller;
  const FieldDefs = isNode ? require('./field-defs.js') : NS.FieldDefs;
  const ViewChanges = isNode ? require('./view-changes.js') : NS.ViewChanges;

  // 「完了」へのアクション実行時の反映フロー(idea.md「反映フロー」)。kintone.api(api)・
  // 依頼アプリ自身のパス変換(selfPath = kintone.api.url(path, true)相当)・待機関数(wait)を注入し、
  // 分岐をユニットテストで確定的に確認できるようにする。APIはすべて実行ユーザーの権限で呼ばれる。
  const fail = (error) => ({ ok: false, error });

  const runApply = async ({
    api,
    selfPath,
    wait,
    record,
    ownAppId,
    recordId,
  }) => {
    const { CODES } = FieldDefs;
    const text = record[CODES.changeJson] ? record[CODES.changeJson].value : '';
    const parsed = ChangeRequest.parseChange(text);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const change = parsed.change;
    const appId = change.app.id;
    const recordAppId = record[CODES.appId]
      ? String(record[CODES.appId].value || '')
      : '';
    if (recordAppId !== appId) {
      return fail(
        `対象アプリID(${recordAppId || '未入力'})と変更内容のアプリID(${appId})が一致しません。依頼を編集し直してください。`,
      );
    }
    if (appId === String(ownAppId)) {
      return fail('この依頼アプリ自身の設定は変更できません。');
    }

    // 承認者が古い画面のまま承認すると、画面に表示された依頼内容と保存されている依頼内容が
    // 食い違う可能性があるため、最新のレコードと突き合わせる。
    const latest = await api(selfPath('/k/v1/record.json'), 'GET', {
      app: ownAppId,
      id: recordId,
    });
    const latestText =
      latest.record && latest.record[CODES.changeJson]
        ? latest.record[CODES.changeJson].value
        : '';
    if (latestText !== text) {
      return fail(
        '依頼内容が更新されています。画面を再読み込みして内容を確認してから、もう一度実行してください。',
      );
    }

    const target = (path, method, body) =>
      api(ApiPath.buildApiPath(path, change.app.guestSpaceId), method, body);
    const summary = ChangeRequest.summarize(change);

    // アプリのアクセス権の設定を取得するAPIはアプリ管理権限が必須のため、成功すれば管理権限がある。
    try {
      await target('/k/v1/app/acl.json', 'GET', { app: appId });
    } catch (err) {
      if (ApiPath.isPermissionError(err)) {
        return fail(
          `対象アプリ「${summary.appText}」のアプリ管理権限がありません。` +
            'このアクションは、対象アプリの管理権限を持つユーザーが実行してください。',
        );
      }
      return fail(
        `対象アプリ「${summary.appText}」の管理権限を確認できませんでした: ${ApiPath.describeApiError(err)}`,
      );
    }

    let live;
    let preview;
    try {
      [live, preview] = await Promise.all([
        target('/k/v1/app/form/fields.json', 'GET', { app: appId }),
        target('/k/v1/preview/app/form/fields.json', 'GET', { app: appId }),
      ]);
    } catch (err) {
      return fail(
        `対象アプリのフィールドを取得できませんでした: ${ApiPath.describeApiError(err)}`,
      );
    }
    // デプロイは動作テスト環境の「すべての」設定を反映するため、誰かの作業途中の変更を巻き込まないよう、
    // 未反映の変更がある(運用環境と動作テスト環境のrevisionが違う。実機確認済み)ときは中止する。
    if (String(live.revision) !== String(preview.revision)) {
      return fail(
        `対象アプリ「${summary.appText}」に、運用環境へ未反映の設定変更があります。` +
          'アプリの設定画面で「アプリを更新」または「変更を中止」してから、もう一度実行してください。',
      );
    }

    // 一覧の変更は「一覧の設定を変更するAPI」、それ以外は「フィールドの設定を変更/削除するAPI」で反映する。
    // revisionはアプリ全体で共通のため、取得時のrevisionを指定して途中の変更を検知させる。
    let request;
    let path;
    let revision;
    if (ViewChanges.isViewOperation(change.operation)) {
      let previewViews;
      try {
        previewViews = await target('/k/v1/preview/app/views.json', 'GET', {
          app: appId,
        });
      } catch (err) {
        return fail(
          `対象アプリの一覧を取得できませんでした: ${ApiPath.describeApiError(err)}`,
        );
      }
      request = ChangeRequest.buildViewApplyRequest(change, previewViews.views);
      path = '/k/v1/preview/app/views.json';
      revision = previewViews.revision;
    } else {
      request = ChangeRequest.buildApplyRequest(change, preview.properties);
      path = '/k/v1/preview/app/form/fields.json';
      revision = preview.revision;
    }
    if (!request.ok) {
      return fail(request.error);
    }

    let updated;
    try {
      updated = await target(path, request.method, {
        app: appId,
        revision,
        ...request.body,
      });
    } catch (err) {
      return fail(
        `対象アプリへの反映に失敗しました: ${ApiPath.describeApiError(err)}`,
      );
    }

    let deployResult;
    try {
      await target('/k/v1/preview/app/deploy.json', 'POST', {
        apps: [{ app: appId, revision: updated.revision }],
      });
      deployResult = await DeployPoller.pollUntilDeployed({
        getStatus: async () => {
          const resp = await target('/k/v1/preview/app/deploy.json', 'GET', {
            apps: [appId],
          });
          const entry = (resp.apps || []).find((a) => String(a.app) === appId);
          return entry ? entry.status : 'FAIL';
        },
        wait,
      });
    } catch (err) {
      deployResult = {
        success: false,
        status: ApiPath.describeApiError(err),
      };
    }
    if (!deployResult.success) {
      // 動作テスト環境に変更だけが残らないよう取り消す(取り消しに失敗しても元のエラーを優先して返す)。
      let reverted = true;
      try {
        await target('/k/v1/preview/app/deploy.json', 'POST', {
          apps: [{ app: appId }],
          revert: true,
        });
      } catch {
        reverted = false;
      }
      return fail(
        `運用環境への反映に失敗しました(status: ${deployResult.status})。` +
          (reverted
            ? '動作テスト環境の変更は取り消しました。'
            : '動作テスト環境の変更を取り消せなかったため、対象アプリの設定画面で「変更を中止」してください。'),
      );
    }

    const lines = [
      `対象アプリ「${summary.appText}」に「${summary.operationName}」を反映し、運用環境へ反映しました。`,
      `${summary.targetLabel}: ${summary.targetText}`,
      `変更前: ${summary.beforeText}`,
      `変更後: ${summary.afterText}`,
    ].concat(request.notes);
    return { ok: true, message: lines.join('\n') };
  };

  const ApplyRunner = { runApply };

  if (isNode) {
    module.exports = ApplyRunner;
  } else {
    root.AppSettingsRequest.ApplyRunner = ApplyRunner;
  }
})(typeof window !== 'undefined' ? window : globalThis);
