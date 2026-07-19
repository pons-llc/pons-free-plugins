(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ResearchAnswer;
  const AppSchema = NS.AppSchema;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const appId = kintone.app.getId();

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const roleEl = document.getElementById('js-role');
  const answerAppIdEl = document.getElementById('js-answer-app-id');
  const requestAppIdEl = document.getElementById('js-request-app-id');
  const previewSpaceEl = document.getElementById('js-preview-space');
  const formSpaceEl = document.getElementById('js-form-space');
  const listViewEl = document.getElementById('js-list-view');
  const analysisViewEl = document.getElementById('js-analysis-view');
  const generateButtonEl = document.getElementById('js-generate');
  const generateLogEl = document.getElementById('js-generate-log');
  const requestSectionEl = document.getElementById('js-request-settings');
  const answerSectionEl = document.getElementById('js-answer-settings');

  // 初期値の反映
  roleEl.value = config.role;
  answerAppIdEl.value = config.answerAppId;
  requestAppIdEl.value = config.requestAppId;
  previewSpaceEl.value = config.previewSpaceId;
  formSpaceEl.value = config.formSpaceId;
  listViewEl.value = config.listViewName;
  analysisViewEl.value = config.analysisViewName;

  const applyRoleVisibility = () => {
    requestSectionEl.style.display = roleEl.value === 'request' ? '' : 'none';
    answerSectionEl.style.display = roleEl.value === 'answer' ? '' : 'none';
    generateButtonEl.disabled = !roleEl.value;
  };
  roleEl.addEventListener('change', applyRoleVisibility);
  applyRoleVisibility();

  const currentConfig = () => ({
    role: roleEl.value,
    answerAppId: answerAppIdEl.value.trim(),
    requestAppId: requestAppIdEl.value.trim(),
    previewSpaceId: previewSpaceEl.value.trim(),
    formSpaceId: formSpaceEl.value.trim(),
    listViewName: listViewEl.value.trim(),
    analysisViewName: analysisViewEl.value.trim(),
  });

  // --- REST APIヘルパー(すべて動作テスト環境=preview系。反映は「アプリを更新」で行う) ---
  const api = (path, method, body) =>
    kintone.api(kintone.api.url(path, true), method, body);
  const getPreviewFields = async (targetAppId) => {
    // GET /k/v1/preview/app/form/fields のレスポンスは {properties, revision} にラップされている
    const resp = await api('/k/v1/preview/app/form/fields.json', 'GET', {
      app: targetAppId,
    });
    return resp.properties;
  };
  // 運用環境(デプロイ済み)のフィールド。ルックアップ・関連レコード一覧の参照整合性チェックは
  // 相手アプリの運用環境に対して行われる(動作テスト環境に追加しただけでは参照できない。
  // E2Eで「指定されたフィールド(code: lookup)が見つかりません」エラーとして実際に確認)ため、
  // 相手アプリを参照するフィールドを作る前のチェックはこちらを使う。
  const getLiveFields = async (targetAppId) => {
    const resp = await api('/k/v1/app/form/fields.json', 'GET', {
      app: targetAppId,
    });
    return resp.properties;
  };

  // スペースフィールド(SPACER)はフィールド追加APIでは作れないため、レイアウト変更APIで
  // 末尾に1行追加する(scripts/kintone-admin.jsのensureSpacerInLayoutと同じ方針・冪等)
  const ensureSpacer = async (targetAppId, elementId) => {
    const { layout } = await api('/k/v1/preview/app/form/layout.json', 'GET', {
      app: targetAppId,
    });
    const hasSpacer = (rows) =>
      rows.some((row) => {
        if (row.type === 'GROUP') {
          return hasSpacer(row.layout || []);
        }
        return (row.fields || []).some(
          (f) => f.type === 'SPACER' && f.elementId === elementId,
        );
      });
    if (hasSpacer(layout)) {
      return false;
    }
    const newLayout = [
      ...layout,
      {
        type: 'ROW',
        fields: [
          { type: 'SPACER', elementId, size: { width: '600', height: '200' } },
        ],
      },
    ];
    await api('/k/v1/preview/app/form/layout.json', 'PUT', {
      app: targetAppId,
      layout: newLayout,
    });
    return true;
  };

  const log = (lines) => {
    generateLogEl.textContent = Array.isArray(lines) ? lines.join('\n') : lines;
  };

  // --- 必要な項目・一覧の自動作成(冪等: 不足分のみ追加、既存は変更しない) ---
  const generateRequestApp = async (cfg) => {
    const messages = [];
    const props = await getPreviewFields(appId);
    const recordNumberCode = AppSchema.findRecordNumberCode(props);

    // 回答アプリの状態(lookupの有無)を確認して、関連レコード一覧を作れるか判定する。
    // 参照整合性チェックは相手アプリの運用環境に対して行われるため、運用環境の状態を見る
    let answerReady = { hasLookup: false };
    let answerDisplayFields = ['lookup'];
    try {
      const answerProps = await getLiveFields(cfg.answerAppId);
      answerReady = AppSchema.checkAnswerAppReady(answerProps);
      const answerRecordNumber = AppSchema.findRecordNumberCode(answerProps);
      answerDisplayFields = [answerRecordNumber, 'title', 'lookup'].filter(
        (c) => c && answerProps[c],
      );
    } catch (e) {
      console.error(e);
      messages.push(
        `回答アプリ(ID: ${cfg.answerAppId})の情報を取得できませんでした。アプリIDと閲覧権限を確認してください。`,
      );
    }

    const defs = AppSchema.buildRequestFieldDefs({
      answerAppId: cfg.answerAppId,
      recordNumberCode,
      answerHasLookup: answerReady.hasLookup,
      answerDisplayFields,
    });
    const missing = AppSchema.diffMissingFields(defs, props);
    const missingCodes = Object.keys(missing);
    if (missingCodes.length > 0) {
      await api('/k/v1/preview/app/form/fields.json', 'POST', {
        app: appId,
        properties: missing,
      });
      messages.push(`フィールドを追加しました: ${missingCodes.join(', ')}`);
    } else {
      messages.push('追加が必要なフィールドはありませんでした。');
    }
    if (!answerReady.hasLookup) {
      messages.push(
        '回答アプリ(運用環境)にlookupフィールドがまだ無いため、関連レコード一覧(related)の作成をスキップしました。回答アプリ側で自動作成を実行し「アプリを更新」した後、もう一度このボタンを押してください。',
      );
    }

    if (await ensureSpacer(appId, cfg.previewSpaceId)) {
      messages.push(
        `プレビュー用スペース(${cfg.previewSpaceId})をフォーム末尾に追加しました。`,
      );
    }
    return messages;
  };

  const generateAnswerApp = async (cfg) => {
    const messages = [];
    const props = await getPreviewFields(appId);

    // 依頼アプリ側が先に生成済みで、かつ運用環境に反映済みであること(lookupのコピー元
    // フィールドの参照整合性チェックは依頼アプリの運用環境に対して行われる)を確認する
    let requestProps;
    try {
      requestProps = await getLiveFields(cfg.requestAppId);
    } catch (e) {
      console.error(e);
      throw new Error(
        `依頼アプリ(ID: ${cfg.requestAppId})の情報を取得できませんでした。アプリIDと閲覧権限を確認してください。`,
      );
    }
    const ready = AppSchema.checkRequestAppReady(requestProps);
    if (!ready.ready) {
      throw new Error(
        `依頼アプリ(運用環境)に必要なフィールド(${ready.missing.join(', ')})がありません。先に依頼アプリ側のプラグイン設定で自動作成を実行し、「アプリを更新」してください。`,
      );
    }
    const requestRecordNumberCode =
      AppSchema.findRecordNumberCode(requestProps);

    const defs = AppSchema.buildAnswerFieldDefs({
      requestAppId: cfg.requestAppId,
      requestRecordNumberCode,
    });
    const missing = AppSchema.diffMissingFields(defs, props);
    const missingCodes = Object.keys(missing);
    if (missingCodes.length > 0) {
      await api('/k/v1/preview/app/form/fields.json', 'POST', {
        app: appId,
        properties: missing,
      });
      messages.push(
        `フィールドを追加しました(${missingCodes.length}件): ${missingCodes.join(', ')}`,
      );
    } else {
      messages.push('追加が必要なフィールドはありませんでした。');
    }

    if (await ensureSpacer(appId, cfg.formSpaceId)) {
      messages.push(
        `回答フォーム用スペース(${cfg.formSpaceId})をフォーム末尾に追加しました。`,
      );
    }

    // 一覧(集計リスト=カスタマイズ形式、分析=表形式)。PUTは既存一覧を含めないと削除される仕様の
    // ため、GETした既存一覧をマージして送る。カスタマイズ形式の作成にはkintoneシステム管理権限が
    // 必要(REST API仕様)なので、権限エラー時は手動作成を案内する。
    const recordNumberCode = AppSchema.findRecordNumberCode(props);
    const viewsResp = await api('/k/v1/preview/app/views.json', 'GET', {
      app: appId,
    });
    const payload = AppSchema.buildViewsPayload(
      viewsResp.views,
      {
        listViewName: cfg.listViewName,
        analysisViewName: cfg.analysisViewName,
      },
      recordNumberCode,
    );
    if (payload.added > 0) {
      try {
        await api('/k/v1/preview/app/views.json', 'PUT', {
          app: appId,
          views: payload.views,
        });
        messages.push(
          `一覧を追加しました: ${cfg.listViewName}(カスタマイズ形式) / ${cfg.analysisViewName}`,
        );
      } catch (e) {
        console.error(e);
        messages.push(
          `一覧の自動作成に失敗しました(カスタマイズ形式の一覧作成にはkintoneシステム管理権限が必要です): ${e.message || e}`,
        );
        messages.push(
          `手動で一覧「${cfg.listViewName}」(カスタマイズ形式、HTMLに <div id="virtual-table-div"></div>、ページネーションあり)と一覧「${cfg.analysisViewName}」(表形式)を作成してください。表形式の「${cfg.listViewName}」でも動作します(ヘッダー部分に描画されます)。`,
        );
      }
    } else {
      messages.push('追加が必要な一覧はありませんでした。');
    }

    // 依頼アプリ側の関連レコード一覧(related)もここで自動作成する(表示用のおまけ。
    // 依頼アプリ側の自動作成の再実行でも作れる)。relatedの参照整合性チェックは「このアプリの
    // 運用環境」に対して行われるため、lookupが運用環境に反映済みの場合のみ作成できる。
    // 未反映(初回)の場合は、アプリ更新後にこのボタンを再実行するよう案内する。
    const requestPreviewProps = await getPreviewFields(cfg.requestAppId);
    if (!requestPreviewProps.related) {
      let liveSelfHasLookup = false;
      try {
        liveSelfHasLookup = !!(await getLiveFields(appId)).lookup;
      } catch (e) {
        console.error(e);
      }
      if (!liveSelfHasLookup) {
        messages.push(
          'このアプリの「アプリを更新」でlookupフィールドを反映した後、もう一度このボタンを押すと、依頼アプリに関連レコード一覧(related)を追加します(依頼アプリ側の自動作成の再実行でも追加できます)。',
        );
      } else {
        try {
          const answerRecordNumberCode = AppSchema.findRecordNumberCode(props);
          const relatedDef = AppSchema.buildRelatedFieldDef({
            answerAppId: String(appId),
            recordNumberCode: requestRecordNumberCode,
            displayFields: [answerRecordNumberCode, 'title', 'lookup'].filter(
              (c) => !!c,
            ),
          });
          await api('/k/v1/preview/app/form/fields.json', 'POST', {
            app: cfg.requestAppId,
            properties: { related: relatedDef },
          });
          messages.push(
            `依頼アプリ(ID: ${cfg.requestAppId})に関連レコード一覧(related)を追加しました。依頼アプリ側でも「アプリを更新」してください。`,
          );
        } catch (e) {
          console.error(e);
          messages.push(
            `依頼アプリ側への関連レコード一覧(related)の追加に失敗しました(${e.message || e})。依頼アプリのプラグイン設定で自動作成をもう一度実行してください。`,
          );
        }
      }
    }
    return messages;
  };

  generateButtonEl.addEventListener('click', async () => {
    const cfg = currentConfig();
    const validation = NS.ConfigStore.validate(cfg);
    if (!validation.valid) {
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';
    generateButtonEl.disabled = true;
    log('作成中です…');
    try {
      const messages =
        cfg.role === 'request'
          ? await generateRequestApp(cfg)
          : await generateAnswerApp(cfg);
      messages.push(
        '※ここまでの変更は動作テスト環境に加えられています。設定を保存し、アプリを更新すると反映されます。',
      );
      log(messages);
    } catch (e) {
      console.error(e);
      log(`自動作成に失敗しました: ${e.message || e}`);
    } finally {
      generateButtonEl.disabled = false;
    }
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + appId + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const cfg = currentConfig();
    const validation = NS.ConfigStore.validate(cfg);
    if (!validation.valid) {
      // 管理者自身の入力値の検証結果のみを表示する(念のためtextContentで出力)
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';
    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(cfg), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + appId;
    });
  });
})(kintone.$PLUGIN_ID);
