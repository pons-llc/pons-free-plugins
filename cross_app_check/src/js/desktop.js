(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // プラグイン設定に入っているのは、アプリ共通の既定値(表記・上限)だけ。
  // 「どのアプリをどう突き合わせるか」はレコードごとに持つ([[definition-store]])。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const BUTTON_ID = 'cac-run-button';

  const createRunButton = (onClick) => {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal cac-run-button';
    button.textContent = '突合を実行';
    button.addEventListener('click', onClick);
    return button;
  };

  kintone.events.on('app.record.detail.show', async (event) => {
    const spaceEl = kintone.app.record.getSpaceElement(
      NS.AppSchema.SPACER_ELEMENT_ID,
    );
    // 集計用フィールドが未作成だとスペースフィールドが存在せず null になる
    if (!spaceEl) {
      return event;
    }
    spaceEl.textContent = '';

    const appId = String(event.appId);
    const recordId = String(event.recordId);

    let definition = NS.DefinitionStore.loadFromRecord(
      event.record,
      NS.AppSchema.FIELD_CODES.definition,
    );

    // 結果ビューワは設定エディタの下に置く
    const viewContainer = document.createElement('div');

    const editor = NS.DefinitionEditor.create(spaceEl, {
      definition,
      currentAppId: appId,
      summaryAppId: appId,
      summaryRecordId: recordId,
      onSaved: (saved) => {
        definition = saved;
        refreshRunButton();
      },
    });

    spaceEl.appendChild(viewContainer);
    const view = NS.ResultView.create(viewContainer, {});

    const refresh = async () => {
      const record = await NS.RecordsClient.fetchRecord(appId, recordId);
      await view.setRuns(NS.RunHistory.readRuns(record));
    };

    const runReconcile = async () => {
      const validation = NS.DefinitionValidation.validate(definition, appId);
      if (!validation.ok) {
        view.setMessage(
          `突合設定が未完了です: ${validation.errors.join(' / ')}`,
          true,
        );
        editor.open();
        return;
      }

      const button = document.getElementById(BUTTON_ID);
      if (button) {
        button.disabled = true;
      }
      // ローディングは「データが揃うまで」の区間だけを囲む。
      // 再描画やダイアログの前に必ず HIDDEN にする(CLAUDE.mdのbudget_meterの落とし穴)。
      kintone.showLoading('VISIBLE');
      try {
        const outcome = await NS.ReconcileRunner.run({
          definition,
          config,
          summaryAppId: appId,
          summaryRecordId: recordId,
          onProgress: (text) => {
            view.setMessage(text);
          },
        });
        kintone.showLoading('HIDDEN');

        await refresh();

        const warnings = [];
        if (outcome.baseTruncated) {
          warnings.push(
            `基準アプリの取得が上限(${config.limits.maxBaseRecords}件)に達したため、一部のレコードは突合されていません。`,
          );
        }
        if (outcome.truncatedTargets.length > 0) {
          warnings.push(
            `次の対象アプリで取得が上限に達しました: ${outcome.truncatedTargets.join(', ')}`,
          );
        }
        if (warnings.length > 0) {
          view.setMessage(warnings.join(' '), true);
        } else {
          // 結果ビューワはその場で描き替わるが、レコード上の「突合履歴」テーブルは
          // kintoneが最初に描いたままなので、再読み込みするまで新しい行が現れない。
          // 黙っていると「保存されていない」ように見えるため、そのことを明示する。
          view.setMessage(
            `突合を実行しました(実行ID: ${outcome.runId})。` +
              '「突合履歴」テーブルの表示は、画面を再読み込みすると更新されます。',
          );
        }
      } catch (err) {
        kintone.showLoading('HIDDEN');
        view.setMessage(
          `突合に失敗しました: ${(err && err.message) || err}`,
          true,
        );
      } finally {
        const target = document.getElementById(BUTTON_ID);
        if (target) {
          target.disabled = false;
        }
      }
    };

    function refreshRunButton() {
      const button = document.getElementById(BUTTON_ID);
      if (!button) {
        return;
      }
      const validation = NS.DefinitionValidation.validate(definition, appId);
      button.title = validation.ok
        ? ''
        : `突合設定が未完了です: ${validation.errors.join(' / ')}`;
    }

    const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (headerEl && !document.getElementById(BUTTON_ID)) {
      headerEl.appendChild(createRunButton(runReconcile));
    }
    refreshRunButton();

    await view.setRuns(NS.RunHistory.readRuns(event.record));
    if (NS.DefinitionStore.isEmpty(definition)) {
      view.setMessage(
        'まず「突合設定」で、基準アプリと対象アプリのレコード一覧URLを貼り付けて保存してください。',
      );
    }
    return event;
  });
})(typeof window !== 'undefined' ? window : globalThis, kintone);
