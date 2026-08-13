'use strict';

// articles/text-extract-number/setup.js
// 記事「kintoneの文字列から数字だけを抽出する方法」用に ARTICLE_APP_ID を白紙に戻し、
// number_extract プラグインで「所在地(漢数字混じり)から丁目・番地・号を抽出する」デモを
// 実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/text-extract-number/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../number_extract/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'text-extract-number';
const SOURCE_FIELD_CODE = '所在地';
const CHOME_FIELD_CODE = '丁目';
const BANCHI_FIELD_CODE = '番地';
const GO_FIELD_CODE = '号';

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
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [SOURCE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: SOURCE_FIELD_CODE,
        label: SOURCE_FIELD_CODE,
      },
      [CHOME_FIELD_CODE]: {
        type: 'NUMBER',
        code: CHOME_FIELD_CODE,
        label: CHOME_FIELD_CODE,
      },
      [BANCHI_FIELD_CODE]: {
        type: 'NUMBER',
        code: BANCHI_FIELD_CODE,
        label: BANCHI_FIELD_CODE,
      },
      [GO_FIELD_CODE]: {
        type: 'NUMBER',
        code: GO_FIELD_CODE,
        label: GO_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 元フィールド=所在地、漢数字を含む=ON、出力先=丁目・番地・号。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-extract-add');
    await page.waitForSelector('.js-extract-row');
    await page.select('.js-extract-source', SOURCE_FIELD_CODE);
    await page.click('.js-extract-kanji');

    await page.click('.js-target-add');
    await page.waitForSelector('.js-target-field');
    let targetSelects = await page.$$('.js-target-field');
    await targetSelects[targetSelects.length - 1].select(CHOME_FIELD_CODE);

    await page.click('.js-target-add');
    targetSelects = await page.$$('.js-target-field');
    await targetSelects[targetSelects.length - 1].select(BANCHI_FIELD_CODE);

    await page.click('.js-target-add');
    targetSelects = await page.$$('.js-target-field');
    await targetSelects[targetSelects.length - 1].select(GO_FIELD_CODE);

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

    // レコード追加画面へ実際のユーザー導線で遷移し、所在地欄に値を入力する
    // (change イベントで即座に抽出されるため、実際のinput要素へネイティブイベントで入力する)。
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
      (labelText, value) => {
        const label = Array.from(document.querySelectorAll('.control-label-text-gaia')).find(
          (el) => el.textContent.trim() === labelText,
        );
        const row = label.closest('.control-gaia');
        const inputEl = row.querySelector('input[type="text"]');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        ).set;
        nativeInputValueSetter.call(inputEl, value);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      },
      SOURCE_FIELD_CODE,
      '港区西新橋二丁目3番4号',
    );

    await page.waitForFunction(
      (fieldCode) => {
        const v = kintone.app.record.get().record[fieldCode].value;
        return v && v.length > 0;
      },
      { timeout: 15000 },
      CHOME_FIELD_CODE,
    );

    const extracted = await page.evaluate(
      (chomeCode, banchiCode, goCode) => {
        const record = kintone.app.record.get().record;
        return {
          chome: record[chomeCode].value,
          banchi: record[banchiCode].value,
          go: record[goCode].value,
        };
      },
      CHOME_FIELD_CODE,
      BANCHI_FIELD_CODE,
      GO_FIELD_CODE,
    );
    if (extracted.chome !== '2' || extracted.banchi !== '3' || extracted.go !== '4') {
      throw new Error(`想定外の抽出結果: ${JSON.stringify(extracted)}`);
    }
    console.log('extract ok:', JSON.stringify(extracted));

    await common.screenshotToDirectory(page, screenshotDir, 'record-edit');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
