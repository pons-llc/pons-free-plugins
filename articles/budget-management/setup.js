'use strict';

// articles/budget-management/setup.js
// 記事「kintoneで予算と実績を管理する方法」用に ARTICLE_APP_ID を白紙に戻し、
// budget_meter プラグインで「経費一覧の合計額が予算の85%に達し警告色になる」デモを実行して
// スクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/budget-management/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../budget_meter/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'budget-management';
const ITEM_FIELD_CODE = '費目';
const AMOUNT_FIELD_CODE = '金額';
const VIEW_NAME = '経費一覧';
const BUDGET = 300000;
const LABEL = '経費予算';

// budget_meter/src/e2e/fixtures.js と同じ方針: 一覧設定の更新PUTは「指定しなかった一覧は
// 削除される」仕様のため、既存の一覧を先にGETしてから対象一覧を追加してPUTする。
const VIEW_REQUEST_KEYS = [
  'index', 'type', 'name', 'fields', 'date', 'title', 'html', 'pager', 'device',
  'filterCond', 'sort',
];
const toRequestView = (view) => {
  const filtered = {};
  VIEW_REQUEST_KEYS.forEach((key) => {
    if (view[key] !== undefined) {
      filtered[key] = view[key];
    }
  });
  return filtered;
};

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
      [ITEM_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: ITEM_FIELD_CODE,
        label: ITEM_FIELD_CODE,
      },
      [AMOUNT_FIELD_CODE]: {
        type: 'NUMBER',
        code: AMOUNT_FIELD_CODE,
        label: AMOUNT_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 対象の一覧(経費一覧)を用意する。
    const current = await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/views.json',
      'GET',
      { app: appId },
    );
    const views = {};
    Object.entries(current.views).forEach(([name, view]) => {
      views[name] = toRequestView(view);
    });
    views[VIEW_NAME] = {
      index: String(Object.keys(views).length),
      type: 'LIST',
      name: VIEW_NAME,
      fields: ['レコード番号', ITEM_FIELD_CODE, AMOUNT_FIELD_CODE],
      sort: 'レコード番号 asc',
    };
    const viewsRes = await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/views.json',
      'PUT',
      { app: appId, views },
    );
    const viewId = viewsRes.views[VIEW_NAME].id;
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 対象の一覧=経費一覧、集計対象フィールド=金額、予算額=300000、
    // ラベル=経費予算、すべての予算を確認を許可するグループ=Administrators。
    await common.openPluginConfig(page, env, appId, pluginId);
    const rowCount = await page.$$eval('.js-row', (rows) => rows.length);
    if (rowCount === 0) {
      await page.click('#js-row-add');
    }
    await page.select('.js-row-view', String(viewId));
    await page.select('.js-row-field', AMOUNT_FIELD_CODE);
    await page.evaluate(
      (budget, label) => {
        const budgetEl = document.querySelector('.js-row-budget');
        budgetEl.value = String(budget);
        budgetEl.dispatchEvent(new Event('input', { bubbles: true }));
        const labelEl = document.querySelector('.js-row-label');
        labelEl.value = label;
        labelEl.dispatchEvent(new Event('input', { bubbles: true }));
      },
      BUDGET,
      LABEL,
    );
    await page.evaluate(() => {
      const el = document.querySelector('.js-all-views-group-codes');
      el.value = 'Administrators';
      el.dispatchEvent(new Event('input', { bubbles: true }));
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

    // デモ用レコード: 合計255,000円(予算300,000円の85% -> 警告しきい値80%を超え黄色に)。
    await kintoneAdmin.addRecords(env, appId, [
      { [ITEM_FIELD_CODE]: { value: '備品購入' }, [AMOUNT_FIELD_CODE]: { value: '120000' } },
      { [ITEM_FIELD_CODE]: { value: '交通費' }, [AMOUNT_FIELD_CODE]: { value: '80000' } },
      { [ITEM_FIELD_CODE]: { value: 'その他経費' }, [AMOUNT_FIELD_CODE]: { value: '55000' } },
    ]);

    // 一覧画面で「経費一覧」ビューを開き、「予算を確認」ボタンを押す。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await common.selectView(page, VIEW_NAME);
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bm-check-button'));
      },
      { timeout: 15000 },
    );
    const checkButtonHandle = await page.$('.bm-check-button');
    await page.evaluate((el) => el.click(), checkButtonHandle);
    await page.waitForSelector('.bm-meter', { timeout: 15000 });

    const valuesText = await page.$eval('.bm-meter-values', (el) => el.textContent);
    if (!valuesText.includes('255,000')) {
      throw new Error(`想定外のメーター表示: ${valuesText}`);
    }

    await common.screenshotToDirectory(page, screenshotDir, 'budget-meter');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
