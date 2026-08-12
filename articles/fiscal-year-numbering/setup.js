'use strict';

// 記事「kintoneで年度が変わったら番号をリセットして自動採番する方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// カウンター専用アプリは、fiscal_year_numbering自身のe2eテストが使っている既存アプリ
// (FYN_COUNTER_APP_ID、未設定時は'572')をそのまま流用する(記事用に新規作成しない。
// 「閲覧+作成のみ」の記録専用アプリで、環境に1つあれば複数アプリから使い回せる設計のため)。
//
// 実行: node articles/fiscal-year-numbering/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'fiscal-year-numbering';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../fiscal_year_numbering/src');
const COUNTER_APP_ID = process.env.FYN_COUNTER_APP_ID || '572';

const NUMBER_FIELD_CODE = '文書番号';
const DATE_FIELD_CODE = '申請日';

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1200, height: 1000 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.deployApp(env, appId);

    // 2. フィールド作成。基準日は「作成日時を使う」モードにすると、レコード追加画面で保存ボタンを
    //    押した時点ではまだ実際の作成日時が確定していないため
    //    (「作成日時の値を取得できませんでした」エラーになることを実機で確認済み)、
    //    「指定したフィールドを使う」モード向けに日付フィールドを別途用意する。
    await kintoneAdmin.addFormFields(env, appId, {
      [NUMBER_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NUMBER_FIELD_CODE,
        label: NUMBER_FIELD_CODE,
      },
      [DATE_FIELD_CODE]: {
        type: 'DATE',
        code: DATE_FIELD_CODE,
        label: DATE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 基準日=指定したフィールド(申請日)、番号フィールド=文書番号、区切り文字=-、
    //    連番桁数=4、カウンター専用アプリID=既存の共有カウンターアプリ、採番タイミング=保存時。
    //    元号テーブルは未保存時に「令和(2019年〜)」が1件自動でシードされるため、それをそのまま使う。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.select('.js-date-field', DATE_FIELD_CODE);
    await page.evaluate(
      (counterAppId) => {
        document.querySelector('input[name="js-date-source"][value="FIELD"]').checked = true;
        document.querySelector('.js-separator').value = '-';
        document.querySelector('.js-sequence-digits').value = '4';
        document.querySelector('.js-counter-app-id').value = counterAppId;
        document.querySelector('input[name="js-numbering-timing"][value="save"]').checked = true;
      },
      COUNTER_APP_ID,
    );
    // <select>はpage.evaluateでの直接value代入だとネイティブのイベントが発火せず、config.js側の
    // change依存の内部状態が更新されないことがあるため、number-fieldはpage.select()で選び直す
    // (organization-inquiry/setup.jsと同じ理由)。
    await page.select('.js-number-field', NUMBER_FIELD_CODE);
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面のスクリーンショット。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 6. レコード追加画面で保存し、実際に番号が振られることを確認する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    // 基準日フィールドに今日の日付を入力する(未入力だと年度判定用フィールドの値が空、で保存が
    // ブロックされる)。
    await page.evaluate((fieldCode) => {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      const current = kintone.app.record.get().record;
      current[fieldCode].value = iso;
      kintone.app.record.set({ record: current });
    }, DATE_FIELD_CODE);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);

    await page.waitForFunction(
      (fieldCode) => {
        const record = kintone.app.record.get();
        return record && record.record[fieldCode].value !== '';
      },
      { timeout: 20000 },
      NUMBER_FIELD_CODE,
    );

    // 7. 採番結果のスクリーンショット。
    await common.screenshotToDirectory(page, screenshotDir, 'record-result');

    const record = await page.evaluate(
      (fieldCode) => kintone.app.record.get().record[fieldCode].value,
      NUMBER_FIELD_CODE,
    );
    console.log(`done. number = ${record}`);
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
