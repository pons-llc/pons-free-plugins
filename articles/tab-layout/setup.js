'use strict';

// articles/tab-layout/setup.js
// 記事「kintoneの入力フォームをタブ化する方法」用に ARTICLE_APP_ID を白紙に戻し、
// tab_layout プラグインで「基本情報タブ/契約詳細タブ」の切り替えデモを実行して
// スクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/tab-layout/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../tab_layout/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'tab-layout';
const NAME_FIELD_CODE = '契約者名';
const ADDRESS_FIELD_CODE = '契約住所';
const AMOUNT_FIELD_CODE = '契約金額';
const PAYMENT_FIELD_CODE = '支払方法';
const NOTE_FIELD_CODE = '備考';
const ANCHOR_ELEMENT_ID = 'tbl_article_anchor';

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
  await page.setViewport({ width: 1200, height: 950 });

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
      [ADDRESS_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: ADDRESS_FIELD_CODE,
        label: ADDRESS_FIELD_CODE,
      },
      [AMOUNT_FIELD_CODE]: {
        type: 'NUMBER',
        code: AMOUNT_FIELD_CODE,
        label: AMOUNT_FIELD_CODE,
      },
      [PAYMENT_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: PAYMENT_FIELD_CODE,
        label: PAYMENT_FIELD_CODE,
        options: {
          銀行振込: { label: '銀行振込', index: '0' },
          口座振替: { label: '口座振替', index: '1' },
        },
      },
      [NOTE_FIELD_CODE]: {
        type: 'MULTI_LINE_TEXT',
        code: NOTE_FIELD_CODE,
        label: NOTE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, ANCHOR_ELEMENT_ID);
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: タブグループを1つ追加し、アンカー=スペース、
    // タブ1「基本情報」=契約者名・契約住所、タブ2「契約詳細」=契約金額・支払方法・備考。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-layout-add');
    await page.waitForSelector('.js-layout-space');
    await page.select('.js-layout-space', ANCHOR_ELEMENT_ID);

    const addTabWithItems = async (label, itemCodes) => {
      await page.click('.js-layout-row:last-of-type .js-tab-add');
      const tabRows = await page.$$('.js-layout-row:last-of-type .js-tab-row');
      const tabRow = tabRows[tabRows.length - 1];
      await tabRow.$eval(
        '.js-tab-label',
        (el, value) => {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        label,
      );
      for (const itemCode of itemCodes) {
        await tabRow.$eval('.js-item-add', (el) => el.click());
        const itemSelects = await tabRow.$$('.js-item-select');
        const lastSelect = itemSelects[itemSelects.length - 1];
        await lastSelect.select(itemCode);
      }
    };

    await addTabWithItems('基本情報', [NAME_FIELD_CODE, ADDRESS_FIELD_CODE]);
    await addTabWithItems('契約詳細', [
      AMOUNT_FIELD_CODE,
      PAYMENT_FIELD_CODE,
      NOTE_FIELD_CODE,
    ]);

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

    // レコード追加画面へ実際のユーザー導線で遷移する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.waitForSelector('.tbl-tab-button', { timeout: 15000 });
    await common.screenshotToDirectory(page, screenshotDir, 'tab-basic-info');

    // 「契約詳細」タブ(2つ目のボタン)をクリックする。
    const tabButtons = await page.$$('.tbl-tab-button');
    await tabButtons[1].click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await common.screenshotToDirectory(page, screenshotDir, 'tab-contract-detail');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
