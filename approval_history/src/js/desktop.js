(function (global, kintone) {
  'use strict';

  const NS = global.ApprovalHistory;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // kintone.plugin.app.getConfig()は、画面表示直後の最初の呼び出しでは内部準備が間に合わず
  // nullを返すことがある(fiscal_year_numberingのdesktop.jsで実機検証済みの既知の挙動)。
  // 同一ページ内の2つ目以降のイベントでは正しい値が返ることを確認済みのため、短い間隔での
  // リトライにより取得できない場合だけ「未設定」として扱う。
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const loadConfig = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const raw = kintone.plugin.app.getConfig(PLUGIN_ID);
      if (raw) {
        return NS.ConfigStore.load(raw);
      }
      await sleep(200 * (attempt + 1));
    }
    return NS.ConfigStore.load(null);
  };

  // 決裁履歴テーブルは常にプラグインが行を追記するテーブルなので、どの画面でも手入力(既存行の編集)
  // できないようにしておく(idea.md「画面ごとの挙動」)。SUBTABLEフィールド自体には`disabled`が
  // 効かない(kintoneドキュメント「イベントオブジェクトで実行できる操作」参照、行内の個々のフィールドの
  // みが対象)ため、行ごとの内包フィールドをNS.TableDisabler.disableAllRows()で1つずつdisabledにする
  // (table-disabler.jsでユニットテスト済み)。event.recordを書き換えてreturnするだけなので、
  // create.show/edit.showハンドラー内で踏む「イベントハンドラー内ではrecord.set()を呼べない」制限には
  // 抵触しない。
  const disableTable = (record, config) => {
    const table = record[config.fieldCodes.table];
    NS.TableDisabler.disableAllRows(table);
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    async (event) => {
      const config = await loadConfig();
      if (NS.ConfigStore.isConfigured(config)) {
        disableTable(event.record, config);
      }
      return event;
    },
  );

  // 一覧画面のインライン編集(モバイルには存在しないイベントのためdesktop.jsのみ)。
  kintone.events.on('app.record.index.edit.show', async (event) => {
    const config = await loadConfig();
    if (NS.ConfigStore.isConfigured(config)) {
      disableTable(event.record, config);
    }
    return event;
  });

  // テーブルの行追加・削除ボタンをクリックしたときも`change.フィールドコード`イベントが発生する
  // (kintoneドキュメント「レコード追加画面でフィールドの値を変更したときのイベント」参照)。
  // show時点では空の場合が多いテーブルに、ユーザーが後から手動で行を追加した場合でも、その行を
  // 即座にdisabledにするため、フィールドコードが判明した時点(設定読み込み後)で動的に登録する。
  (async () => {
    const config = await loadConfig();
    if (!NS.ConfigStore.isConfigured(config)) {
      return;
    }
    const tableCode = config.fieldCodes.table;
    const onTableChange = (event) => {
      NS.TableDisabler.disableAllRows(event.record[tableCode]);
      return event;
    };
    kintone.events.on(
      [
        `app.record.create.change.${tableCode}`,
        `app.record.edit.change.${tableCode}`,
        `app.record.index.edit.change.${tableCode}`,
      ],
      onTableChange,
    );
  })();

  // プロセス管理のアクション実行時、実行前後のステータス・実行ユーザー・役職・実行日時を
  // 決裁履歴テーブルの末尾に1行追記する(idea.md「サブテーブルの構成」「役職の解決方法」)。
  kintone.events.on('app.record.detail.process.proceed', async (event) => {
    const config = await loadConfig();
    if (!NS.ConfigStore.isConfigured(config)) {
      return event;
    }

    const fieldCodes = config.fieldCodes;
    const table = event.record[fieldCodes.table];
    // プラグイン設定保存後にテーブルフィールドが手動で削除された場合など、フィールドが
    // 存在しないケースは記録できないだけで済ませ、プロセスアクション自体は妨げない。
    if (!table) {
      return event;
    }

    const loginUser = kintone.getLoginUser();

    let title = '';
    try {
      const organizations = await kintone.user.getOrganizations();
      title = NS.TitleResolver.resolveTitle(organizations);
    } catch {
      // レート制限等で役職が取得できなくても、決裁履歴の記録自体は継続する(idea.md参照)。
      title = '';
    }

    const row = NS.HistoryRow.buildHistoryRow(fieldCodes, {
      statusBefore: event.status && event.status.value,
      statusAfter: event.nextStatus && event.nextStatus.value,
      executedByCode: loginUser.code,
      executedByName: loginUser.name,
      executedByTitle: title,
      executedAtIso: new Date().toISOString(),
    });
    table.value.push(row);

    return event;
  });
})(typeof window !== 'undefined' ? window : globalThis, kintone);
