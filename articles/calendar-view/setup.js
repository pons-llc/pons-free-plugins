'use strict';

// articles/calendar-view/setup.js
// 記事「kintoneの予定をカレンダーで表示する方法」用に ARTICLE_APP_ID を白紙に戻し、
// calendar_view プラグインで「営業チーム/開発チームの予定を週表示でグループ分け表示する」
// デモを実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/calendar-view/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../calendar_view/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'calendar-view';
const TITLE_FIELD_CODE = '予定名';
const START_FIELD_CODE = '開始日時';
const END_FIELD_CODE = '終了日時';
const GROUP_FIELD_CODE = '担当チーム';

// ローカルタイムゾーンでの日時からkintoneのDATETIME値(UTCのISO8601文字列)を作る。
// Node側(このスクリプト)とPuppeteerが起動するブラウザは同じマシンのローカルタイムゾーンで
// 動くため、toISOString()で変換すれば両者で表示がずれない。
const localDateTime = (daysFromToday, hour, minute) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
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
  await page.setViewport({ width: 1400, height: 950 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
      [START_FIELD_CODE]: {
        type: 'DATETIME',
        code: START_FIELD_CODE,
        label: START_FIELD_CODE,
      },
      [END_FIELD_CODE]: {
        type: 'DATETIME',
        code: END_FIELD_CODE,
        label: END_FIELD_CODE,
      },
      [GROUP_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: GROUP_FIELD_CODE,
        label: GROUP_FIELD_CODE,
        options: {
          営業チーム: { label: '営業チーム', index: '0' },
          開発チーム: { label: '開発チーム', index: '1' },
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 一覧を追加(空欄=すべて)し、タイトル/開始/終了/グループ/色分けフィールドを設定。
    // 既定の表示単位=週表示、デザイン=縦。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-view-add');
    await page.waitForSelector('.js-view-config-block');

    await page.$eval(
      '.js-view-config-block .js-title-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      TITLE_FIELD_CODE,
    );
    await page.$eval(
      '.js-view-config-block .js-start-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      START_FIELD_CODE,
    );
    await page.$eval(
      '.js-view-config-block .js-end-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      END_FIELD_CODE,
    );
    await page.$eval(
      '.js-view-config-block .js-group-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      GROUP_FIELD_CODE,
    );
    await page.$eval(
      '.js-view-config-block .js-color-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      GROUP_FIELD_CODE,
    );
    await page.$eval('.js-view-config-block .js-view-unit[value="week"]', (el) =>
      el.click(),
    );
    await page.$eval(
      '.js-view-config-block .js-layout-direction[value="vertical"]',
      (el) => el.click(),
    );

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

    // デモ用レコード: 今日と明日にまたがる、営業チーム/開発チームの予定。
    await kintoneAdmin.addRecords(env, appId, [
      {
        [TITLE_FIELD_CODE]: { value: 'A社定例MTG' },
        [START_FIELD_CODE]: { value: localDateTime(0, 10, 0) },
        [END_FIELD_CODE]: { value: localDateTime(0, 11, 0) },
        [GROUP_FIELD_CODE]: { value: '営業チーム' },
      },
      {
        [TITLE_FIELD_CODE]: { value: 'B社商談' },
        [START_FIELD_CODE]: { value: localDateTime(0, 14, 0) },
        [END_FIELD_CODE]: { value: localDateTime(0, 15, 0) },
        [GROUP_FIELD_CODE]: { value: '営業チーム' },
      },
      {
        [TITLE_FIELD_CODE]: { value: 'スプリントレビュー' },
        [START_FIELD_CODE]: { value: localDateTime(0, 13, 0) },
        [END_FIELD_CODE]: { value: localDateTime(0, 14, 0) },
        [GROUP_FIELD_CODE]: { value: '開発チーム' },
      },
      {
        [TITLE_FIELD_CODE]: { value: 'リリース作業' },
        [START_FIELD_CODE]: { value: localDateTime(1, 9, 0) },
        [END_FIELD_CODE]: { value: localDateTime(1, 12, 0) },
        [GROUP_FIELD_CODE]: { value: '開発チーム' },
      },
      {
        [TITLE_FIELD_CODE]: { value: '週次進捗共有' },
        [START_FIELD_CODE]: { value: localDateTime(1, 16, 0) },
        [END_FIELD_CODE]: { value: localDateTime(1, 17, 0) },
        [GROUP_FIELD_CODE]: { value: '営業チーム' },
      },
    ]);

    // レコード一覧画面でカレンダーが表示されることを確認し、週表示のスクリーンショットを撮る。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.cv-root', { timeout: 15000 });

    const activeUnitLabel = await page.$eval(
      '.cv-unit-button-active',
      (el) => el.textContent,
    );
    if (activeUnitLabel !== '週表示') {
      throw new Error(`想定外の既定表示単位: ${activeUnitLabel}`);
    }
    await page.waitForSelector('.cv-week-grouped-grid', { timeout: 10000 });
    await common.screenshotToDirectory(page, screenshotDir, 'calendar-week-view');

    // 日表示にも切り替えて、時間軸(グループ×時刻)のスクリーンショットも撮る。
    await page.click('.cv-unit-button:not(.cv-unit-button-active)');
    await page.waitForFunction(
      () => document.querySelector('.cv-unit-button-active').textContent === '日表示',
      { timeout: 10000 },
    );
    await common.screenshotToDirectory(page, screenshotDir, 'calendar-day-view');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
