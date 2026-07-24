'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e
//
// TEST_APP_ID_1には数値フィールド(数値/数値_0/数値_1/数値_2)・ラジオボタン(ラジオボタン、
// 選択肢sample1/sample2)が既存で用意されている(CLAUDE.md記載の前提)ため、新規フィールド作成は
// 行わない。設定画面で「フィールドごと」グルーピング(グルーピングフィールド=ラジオボタン)を
// 選ぶことで、既存レコードの一部がsample1に集中しており合計/平均トグルが意味を持つケース
// (count > 1のグループ)を実機で確認できる。
//
// このファイル1本で「設定の保存→レコード一覧画面でのボタン→別タブでの生成」までを一気通貫で
// 検証する(research_and_answerのfull-flow.e2e.test.jsと同じ命名方針)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'radar_chart_view';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

// 4軸(四角形)にすることで、公開サイト用のスクリーンショットが3軸(正三角形)より見栄えがする。
const AXIS_CODES = ['数値', '数値_0', '数値_1', '数値_2'];
const GROUPING_FIELD_CODE = 'ラジオボタン';
const TITLE = 'E2Eテストチャート';
const SCALE_DIVISIONS = '4';

describe('レーダーチャートプラグイン(実環境, 一気通貫)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // config.jsの保存成功時(alert)・バリデーション失敗時(alert)はネイティブダイアログを出す。
    // 自動で閉じないとwaitForNavigation()がタイムアウトするまでテストが止まってしまう。
    page.on('dialog', (dialog) => dialog.accept());
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面: 軸フィールドがNUMBER型のみに絞り込まれ、保存後もリロードで内容が保持される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('レーダーチャートプラグイン');

    // 軸1のプルダウンの選択肢がNUMBER型のみに絞り込まれていること(config.js冒頭の
    // fieldsOfType()による絞り込みが実際に効いているかの回帰確認)。
    const axisSelects = await page.$$('.js-axis-select');
    expect(axisSelects.length).toBe(8);
    const axis1OptionValues = await axisSelects[0].evaluate((el) =>
      Array.from(el.options)
        .map((o) => o.value)
        .filter((v) => v !== ''),
    );
    expect(axis1OptionValues).toEqual(expect.arrayContaining(AXIS_CODES));
    expect(axis1OptionValues).not.toContain(GROUPING_FIELD_CODE);

    for (let i = 0; i < AXIS_CODES.length; i++) {
      await axisSelects[i].select(AXIS_CODES[i]);
    }

    // グルーピング単位を「レコードごと」にすると、グルーピングフィールド欄が隠れる
    // (前回のテスト実行で「フィールドごと」のまま保存されている場合があるため、
    // 初期状態を前提にせずまず明示的に「レコードごと」へ切り替えてから確認する)。
    await page.click('.js-grouping-record');
    const groupingFieldRowHiddenAfterRecord = await page.$eval(
      '.js-grouping-field-row',
      (el) => el.hidden,
    );
    expect(groupingFieldRowHiddenAfterRecord).toBe(true);

    // グルーピング単位を「フィールドごと」に切り替えると、グルーピングフィールド欄が表示される。
    await page.click('.js-grouping-field');
    const groupingFieldRowHiddenAfter = await page.$eval(
      '.js-grouping-field-row',
      (el) => el.hidden,
    );
    expect(groupingFieldRowHiddenAfter).toBe(false);

    const groupingOptionValues = await page.$eval(
      '.js-grouping-field-select',
      (el) =>
        Array.from(el.options)
          .map((o) => o.value)
          .filter((v) => v !== ''),
    );
    expect(groupingOptionValues).toContain(GROUPING_FIELD_CODE);
    expect(groupingOptionValues).not.toContain(AXIS_CODES[0]);
    await page.select('.js-grouping-field-select', GROUPING_FIELD_CODE);

    await page.evaluate((title) => {
      document.querySelector('.js-title').value = title;
      document.querySelector('.js-title').dispatchEvent(new Event('change'));
    }, TITLE);
    await page.evaluate((divisions) => {
      document.querySelector('.js-scale-divisions').value = divisions;
      document
        .querySelector('.js-scale-divisions')
        .dispatchEvent(new Event('change'));
    }, SCALE_DIVISIONS);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定は保存直後は「プレビュー」状態で、レコード一覧画面などプラグイン設定画面
    // 以外の画面には反映されない(config.jsの保存完了alertが「アプリを更新してください」と
    // 案内している理由と同じ)。フィールド追加時と同様にアプリのデプロイが必要
    // (実機で確認: デプロイ前はkintone.plugin.app.getConfig()がレコード一覧画面で空を返した)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    // 保存後、設定画面を開き直して内容が保持されているか確認する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const reloadedAxisValues = await page.$$eval('.js-axis-select', (els) =>
      els.map((el) => el.value).filter((v) => v !== ''),
    );
    expect(reloadedAxisValues).toEqual(AXIS_CODES);

    const reloadedGroupingType = await page.$eval(
      '.js-grouping-field',
      (el) => el.checked,
    );
    expect(reloadedGroupingType).toBe(true);

    const reloadedGroupingField = await page.$eval(
      '.js-grouping-field-select',
      (el) => el.value,
    );
    expect(reloadedGroupingField).toBe(GROUPING_FIELD_CODE);

    const reloadedTitle = await page.$eval('.js-title', (el) => el.value);
    expect(reloadedTitle).toBe(TITLE);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('レコード一覧画面: ボタン押下→「表示中のレコード」選択で別タブにレーダーチャートが生成される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.rcv-open-button', { timeout: 15000 });
    await page.click('.rcv-open-button');

    const selectionButtons = await page.$$('.rcv-selection-button');
    expect(selectionButtons.length).toBe(2);

    const [newTarget] = await Promise.all([
      browser.waitForTarget((target) => target.opener() === page.target(), {
        timeout: 15000,
      }),
      selectionButtons[0].click(), // 表示中のレコードで作成
    ]);
    const chartPage = await newTarget.page();
    const chartPageErrors = [];
    chartPage.on('pageerror', (err) => chartPageErrors.push(err.message));

    await chartPage.waitForSelector('#radar-chart svg', { timeout: 15000 });

    expect(await chartPage.title()).toBe(TITLE);

    const gridRingCount = await chartPage.$$eval(
      '.radar-grid polygon',
      (els) => els.length,
    );
    expect(gridRingCount).toBe(Number(SCALE_DIVISIONS));

    const axisLabelCount = await chartPage.$$eval(
      '.radar-axis-label',
      (els) => els.length,
    );
    expect(axisLabelCount).toBe(AXIS_CODES.length);

    const legendItemCountBefore = await chartPage.$$eval(
      '#radar-legend .legend-item',
      (els) => els.length,
    );
    expect(legendItemCountBefore).toBeGreaterThanOrEqual(1);

    const polygonCountBefore = await chartPage.$$eval(
      '.radar-series polygon',
      (els) => els.length,
    );
    expect(polygonCountBefore).toBe(legendItemCountBefore);

    // 公開サイト用のスクリーンショットは、絞り込み前(全系列が見える状態)で撮る。
    await common.screenshot(
      chartPage,
      repoRoot,
      PLUGIN_NAME,
      'radar-chart-sample',
    );

    // 凡例のチェックボックスを1つ外すと、対応する系列のポリゴンが1つ減る(絞り込み機能の確認)。
    if (legendItemCountBefore > 1) {
      await chartPage.click(
        '#radar-legend .legend-item input[type="checkbox"]',
      );
      const polygonCountAfter = await chartPage.$$eval(
        '.radar-series polygon',
        (els) => els.length,
      );
      expect(polygonCountAfter).toBe(polygonCountBefore - 1);
    }

    expect(chartPageErrors).toEqual([]);

    await chartPage.close();
  });

  test('レコード一覧画面: 「絞り込み条件の全件」選択でも別タブにレーダーチャートが生成される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.rcv-open-button', { timeout: 15000 });
    await page.click('.rcv-open-button');
    const selectionButtons = await page.$$('.rcv-selection-button');

    const [newTarget] = await Promise.all([
      browser.waitForTarget((target) => target.opener() === page.target(), {
        timeout: 20000,
      }),
      selectionButtons[1].click(), // 絞り込み条件の全件で作成
    ]);
    const chartPage = await newTarget.page();
    const chartPageErrors = [];
    chartPage.on('pageerror', (err) => chartPageErrors.push(err.message));

    await chartPage.waitForSelector('#radar-chart svg', { timeout: 20000 });

    expect(await chartPage.title()).toBe(TITLE);
    const statusText = await chartPage.$eval(
      '#radar-status',
      (el) => el.textContent,
    );
    expect(statusText).toContain('絞り込み条件の全件');

    expect(chartPageErrors).toEqual([]);

    await chartPage.close();
  });
});
