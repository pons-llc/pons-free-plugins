'use strict';

// articles/field-encryption/setup.js
// 記事「kintoneで個人情報を暗号化して保存する方法」用に ARTICLE_APP_ID を白紙に戻し、
// field_encryption プラグインで「マイナンバー・備考フィールドを暗号化して保存し、
// 詳細画面でパスフレーズ入力により復号する」デモを実行してスクリーンショットを撮る
// (scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/field-encryption/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../field_encryption/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'field-encryption';
const NAME_FIELD_CODE = '氏名';
const NUMBER_FIELD_CODE = 'マイナンバー';
const NOTE_FIELD_CODE = '備考';
const SPACE_ELEMENT_ID = 'fe_article_decrypt_space';
const PASSPHRASE = 'k1ntone-fe-article-2026!';

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
  await page.setViewport({ width: 1280, height: 950 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [NAME_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_FIELD_CODE,
        label: NAME_FIELD_CODE,
      },
      [NUMBER_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NUMBER_FIELD_CODE,
        label: NUMBER_FIELD_CODE,
      },
      [NOTE_FIELD_CODE]: {
        type: 'MULTI_LINE_TEXT',
        code: NOTE_FIELD_CODE,
        label: NOTE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, SPACE_ELEMENT_ID);
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 暗号化対象フィールド=マイナンバー・備考、復号ボタン設置スペース、最小文字数=8。
    await common.openPluginConfig(page, env, appId, pluginId);
    const checkboxHandles = await page.$$('#js-target-fields input[type=checkbox]');
    for (const handle of checkboxHandles) {
      const value = await page.evaluate((el) => el.value, handle);
      if (value === NUMBER_FIELD_CODE || value === NOTE_FIELD_CODE) {
        await handle.click();
      }
    }
    await page.select('#js-space-element', SPACE_ELEMENT_ID);
    await page.evaluate(() => {
      const el = document.getElementById('js-min-length');
      el.value = '8';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // レコード追加画面へ実際のユーザー導線で遷移し、氏名・マイナンバー・備考を入力、
    // パスフレーズを設定して保存する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.evaluate(
      (nameCode, numberCode, noteCode) => {
        const current = kintone.app.record.get().record;
        current[nameCode].value = '山田太郎';
        current[numberCode].value = '123456789012';
        current[noteCode].value = '来庁時は本人確認書類を確認すること';
        kintone.app.record.set({ record: current });
      },
      NAME_FIELD_CODE,
      NUMBER_FIELD_CODE,
      NOTE_FIELD_CODE,
    );

    await page.waitForSelector('.fe-passphrase-input');
    await page.type('.fe-passphrase-input', PASSPHRASE);
    await page.type('.fe-passphrase-confirm-input', PASSPHRASE);

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const url = new URL(page.url());
    const recordId = url.hash.match(/record=(\d+)/)[1];

    // REST APIで生の値が暗号文(FE1:接頭辞)になっていることを確認する。
    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: appId,
      id: recordId,
    });
    const ciphertext = record.record[NUMBER_FIELD_CODE].value;
    if (!ciphertext.startsWith('FE1:') || ciphertext.includes('123456789012')) {
      throw new Error(`想定外の保存値: ${ciphertext}`);
    }
    console.log('ciphertext ok:', ciphertext.slice(0, 40) + '...');

    // 詳細画面: マスクされた状態のスクリーンショット。
    await page.reload({ waitUntil: 'networkidle0' });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await common.screenshotToDirectory(page, screenshotDir, 'record-masked');

    // 正しいパスフレーズで復号する。
    await page.waitForSelector('.fe-decrypt-passphrase-input');
    await page.type('.fe-decrypt-passphrase-input', PASSPHRASE);
    await page.click('.fe-decrypt-button');
    await page.waitForSelector('.fe-result-success');
    await common.screenshotToDirectory(page, screenshotDir, 'record-decrypted');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
