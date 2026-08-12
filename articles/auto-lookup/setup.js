'use strict';

// 記事「kintoneでルックアップ先の情報を自動更新する方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// このプラグインの実演には「参照先アプリ(取引先マスタ)」が必要。既存の共有テストアプリ
// (TEST_APP_ID_1/2)は他プラグインのfixtureが乗っているため使わず、この記事専用の参照先アプリを
// 新規作成する(fiscal_year_numberingのカウンター専用アプリと同じ考え方)。作成したアプリIDは
// articles/auto-lookup/reference-app-id.txt に保存し、次回実行時は再作成せず使い回す(冪等)。
//
// 実行: node articles/auto-lookup/setup.js

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'auto-lookup';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../auto_lookup/src');
const REFERENCE_APP_ID_FILE = path.join(__dirname, 'reference-app-id.txt');

const REF_CODE_FIELD = '取引先コード';
const REF_NAME_FIELD = '取引先名';
const REF_KEY_VALUE = 'T001';
const INITIAL_NAME = '株式会社サンプル商事';
const RENAMED_NAME = '株式会社サンプル商事(改称後)';

const LOOKUP_FIELD_CODE = '取引先コード';
const NAME_OUTPUT_FIELD_CODE = '取引先名';

const ensureReferenceApp = async (env) => {
  if (fs.existsSync(REFERENCE_APP_ID_FILE)) {
    return fs.readFileSync(REFERENCE_APP_ID_FILE, 'utf8').trim();
  }
  const created = await kintoneAdmin.createApp(env, '取引先マスタ(記事用, auto_lookup)');
  const appId = created.app;
  await kintoneAdmin.addFormFields(env, appId, {
    [REF_CODE_FIELD]: {
      type: 'SINGLE_LINE_TEXT',
      code: REF_CODE_FIELD,
      label: REF_CODE_FIELD,
      required: true,
      unique: true,
    },
    [REF_NAME_FIELD]: {
      type: 'SINGLE_LINE_TEXT',
      code: REF_NAME_FIELD,
      label: REF_NAME_FIELD,
    },
  });
  await kintoneAdmin.deployApp(env, appId);
  await kintoneAdmin.addRecords(env, appId, [
    {
      [REF_CODE_FIELD]: { value: REF_KEY_VALUE },
      [REF_NAME_FIELD]: { value: INITIAL_NAME },
    },
  ]);
  fs.writeFileSync(REFERENCE_APP_ID_FILE, String(appId));
  return String(appId);
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
  const referenceAppId = await ensureReferenceApp(env);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1200, height: 1000 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す(参照先アプリの方は白紙に戻さない。記事共通の固定マスタとして使い回す)。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.deployApp(env, appId);

    // 2. 参照先アプリのデータをデモ用の初期状態(改称前)に戻しておく(冪等: 前回実行分が
    //    改称後のままだと今回の「改称→自動反映」を再現できないため)。
    const refRecords = await kintoneAdmin.getRecords(
      env,
      referenceAppId,
      `${REF_CODE_FIELD} = "${REF_KEY_VALUE}"`,
    );
    const refRecordId = refRecords.records[0].$id.value;
    await kintoneAdmin.request(env, '/k/v1/records.json', 'PUT', {
      app: referenceAppId,
      records: [
        {
          id: refRecordId,
          record: { [REF_NAME_FIELD]: { value: INITIAL_NAME } },
        },
      ],
    });

    // 3. フィールド作成: 取引先名(コピー先、先に作る)→取引先コード(LOOKUPフィールド)。
    await kintoneAdmin.addFormFields(env, appId, {
      [NAME_OUTPUT_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_OUTPUT_FIELD_CODE,
        label: NAME_OUTPUT_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.addFormFields(env, appId, {
      [LOOKUP_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: LOOKUP_FIELD_CODE,
        label: LOOKUP_FIELD_CODE,
        lookup: {
          relatedApp: { app: referenceAppId },
          relatedKeyField: REF_CODE_FIELD,
          fieldMappings: [
            { field: NAME_OUTPUT_FIELD_CODE, relatedField: REF_NAME_FIELD },
          ],
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 4. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定: 自動再取得の対象に「取引先コード」ルックアップフィールドを選ぶ。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.waitForSelector('#js-lookup-field-list .js-checkbox-input');
    await page.click('#js-lookup-field-list .js-checkbox-input');
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    // 6. 設定画面のスクリーンショット。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 7. レコードを1件作成する。kintone標準のルックアップフィールドは、キー値を入力しただけでは
    //    「未確定」扱いで保存がブロックされる(実機で確認済み)。実際のユーザー操作と同じく、
    //    キー値を入力してからネイティブの「取得」ボタン(`.input-lookup-gaia`)を押して
    //    確定させる必要がある。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    await page.evaluate(
      (lookupCode, keyValue) => {
        const current = kintone.app.record.get().record;
        current[lookupCode].value = keyValue;
        kintone.app.record.set({ record: current });
      },
      LOOKUP_FIELD_CODE,
      REF_KEY_VALUE,
    );
    await page.click('.input-lookup-gaia');
    await page.waitForFunction(
      (outputCode, expected) => {
        const record = kintone.app.record.get();
        return record && record.record[outputCode].value === expected;
      },
      { timeout: 15000 },
      NAME_OUTPUT_FIELD_CODE,
      INITIAL_NAME,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);

    // 8. 参照先アプリ側のデータを改称する(このプラグインが無ければ、対象アプリ側の
    //    「取引先名」は保存時点の値のまま古くなる)。
    await kintoneAdmin.request(env, '/k/v1/records.json', 'PUT', {
      app: referenceAppId,
      records: [
        {
          id: refRecordId,
          record: { [REF_NAME_FIELD]: { value: RENAMED_NAME } },
        },
      ],
    });

    // 9. 対象レコードの編集画面を開き直す(実際のユーザー導線: 詳細画面→編集ボタン)。
    //    このプラグインはapp.record.edit.showで自動的に再取得するため、ユーザーは何も
    //    操作しなくても「取引先名」が改称後の値に自動更新される。
    const listRes = await kintoneAdmin.getRecords(env, appId, '');
    const recordId = listRes.records[0].$id.value;
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${recordId}`, {
      waitUntil: 'networkidle0',
    });
    await common.goToEditScreenFromDetail(page);

    await page.waitForFunction(
      (outputCode, expected) =>
        kintone.app.record.get().record[outputCode].value === expected,
      { timeout: 20000 },
      NAME_OUTPUT_FIELD_CODE,
      RENAMED_NAME,
    );

    // 10. 自動反映後のスクリーンショット。
    await common.screenshotToDirectory(page, screenshotDir, 'record-result');

    console.log('done.');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
