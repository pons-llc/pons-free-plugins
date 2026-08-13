'use strict';

// articles/text-split/setup.js
// 記事「kintoneの文字列を区切り文字で分割する方法」用に ARTICLE_APP_ID を白紙に戻し、
// text_split プラグインで「住所をスペースで都道府県/番地以降に分割する」デモを実行して
// スクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/text-split/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../text_split/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'text-split';
const SOURCE_FIELD_CODE = '住所';
const PREF_FIELD_CODE = '都道府県';
const REST_FIELD_CODE = '番地以降';

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
      [PREF_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: PREF_FIELD_CODE,
        label: PREF_FIELD_CODE,
      },
      [REST_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: REST_FIELD_CODE,
        label: REST_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 元フィールド=住所、区切り=記号・文字(半角スペース)、出力先=都道府県・番地以降。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-split-add');
    await page.waitForSelector('.js-split-row');
    await page.select('.js-split-source', SOURCE_FIELD_CODE);

    await page.click('.js-delimiter-add');
    await page.waitForSelector('.js-delimiter-value');
    await page.type('.js-delimiter-value', ' ');

    await page.click('.js-target-add');
    await page.waitForSelector('.js-target-field');
    const targetSelectsBefore = await page.$$('.js-target-field');
    await targetSelectsBefore[0].select(PREF_FIELD_CODE);

    await page.click('.js-target-add');
    const targetSelectsAfter = await page.$$('.js-target-field');
    await targetSelectsAfter[targetSelectsAfter.length - 1].select(REST_FIELD_CODE);

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

    // デモ用レコードをREST APIで作成する(住所のみ設定、分割結果フィールドはまだ空)。
    const { id: recordId } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId,
        record: {
          [SOURCE_FIELD_CODE]: { value: '東京都 千代田区丸の内1-1-1' },
        },
      },
    );

    // 一覧画面→詳細画面→編集画面と実際のユーザー導線で遷移し、何も変更せず保存する
    // (submit時にのみ分割処理が実行される仕様のため)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    const rows = await page.$$('.recordlist-row-gaia');
    let opened = false;
    for (const row of rows) {
      const text = await page.evaluate((el) => el.textContent, row);
      if (new RegExp(`^${recordId}(\\D|$)`).test(text)) {
        const firstCell = await row.$('div,td,span');
        await firstCell.click();
        await page.waitForFunction(() => location.href.includes('/show'));
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
          .catch(() => {});
        opened = true;
        break;
      }
    }
    if (!opened) {
      throw new Error('一覧画面にデモレコードの行が見つかりませんでした。');
    }

    await page.waitForSelector('a.gaia-argoui-app-menu-edit');
    const editCenter = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('a.gaia-argoui-app-menu-edit'),
      ).filter((el) => el.offsetParent !== null);
      const target = candidates[0];
      if (!target) {
        return null;
      }
      const rect = target.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (!editCenter) {
      throw new Error('「レコードを編集する」リンクが見つかりませんでした。');
    }
    await page.mouse.click(editCenter.x, editCenter.y);
    await page.waitForFunction(() => location.href.includes('mode=edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    // 出力先フィールド(都道府県・番地以降)が編集画面で編集不可になっていることを確認する。
    const recordSnapshot = await page.evaluate(
      () => kintone.app.record.get().record,
    );
    console.log('DEBUG record keys:', Object.keys(recordSnapshot));
    console.log(
      'DEBUG pref:', JSON.stringify(recordSnapshot[PREF_FIELD_CODE]),
    );
    console.log(
      'DEBUG rest:', JSON.stringify(recordSnapshot[REST_FIELD_CODE]),
    );

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const savedRecord = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: appId,
      id: recordId,
    });
    const prefValue = savedRecord.record[PREF_FIELD_CODE].value;
    const restValue = savedRecord.record[REST_FIELD_CODE].value;
    if (prefValue !== '東京都' || restValue !== '千代田区丸の内1-1-1') {
      throw new Error(`想定外の分割結果: ${prefValue} / ${restValue}`);
    }
    console.log('split ok:', prefValue, '/', restValue);

    await page.reload({ waitUntil: 'networkidle0' });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await common.screenshotToDirectory(page, screenshotDir, 'record-detail');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
