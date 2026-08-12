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
// TEST_APP_ID_1には23件前後の既存レコードがあり、デフォルトの「(すべて)」一覧は
// レコード番号順で複数ページに分かれる可能性が高い(新規追加したシードレコードが1ページ目の
// event.recordsに含まれる保証がない)。このため、レコード一覧画面へは
// URL内のクエリ(?query=...、JavaScript API側の「URL内のクエリで表示するレコードの条件を
// 指定する」機能)でマーカーフィールドを絞り込んで遷移し、シードレコードだけが表示される
// 状態を作る(radar_chart_view等と異なり、共有テストアプリの一覧設定自体は変更しない)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'calendar_view';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('詳細カレンダープラグイン(実環境, 一気通貫)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await fixtures.ensureSeedRecords(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面: 一覧を追加してフィールドを設定・保存でき、再読み込み後も内容が保持される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('詳細カレンダープラグイン');

    let blocks = await page.$$('.js-view-config-block');
    if (blocks.length === 0) {
      // 入力欄は空欄のまま追加 -> 「すべて(デフォルト)」向けの設定になる。
      await page.click('#js-view-add');
      blocks = await page.$$('.js-view-config-block');
    }
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const block = blocks[0];

    // タイトルフィールドの選択肢はSUBTABLE以外の全フィールド(config.js冒頭のallFieldsの絞り込みが
    // 実際に効いているかの回帰確認)。テーブル(SUBTABLE)は含まれない。
    const titleOptionValues = await block.$$eval(
      '.js-title-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(titleOptionValues).toContain(fixtures.TITLE_FIELD_CODE);
    expect(titleOptionValues).not.toContain('テーブル');

    // 開始日時フィールドの選択肢はDATE/DATETIMEのみ。
    const startOptionValues = await block.$$eval(
      '.js-start-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(startOptionValues).toContain(fixtures.START_FIELD_CODE);
    expect(startOptionValues).not.toContain(fixtures.TITLE_FIELD_CODE);

    // グループ分けフィールドの選択肢はグループ化可能な型のみ(文字列1行は含まれない)。
    const groupOptionValues = await block.$$eval(
      '.js-group-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(groupOptionValues).toContain(fixtures.GROUP_FIELD_CODE);
    expect(groupOptionValues).not.toContain(fixtures.TITLE_FIELD_CODE);

    // 色分けフィールドの選択肢はSTATUS/DROP_DOWN/RADIO_BUTTONのみ(グループ分けフィールドより
    // 狭い、ユーザー選択は含まれない)。
    const colorOptionValues = await block.$$eval(
      '.js-color-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(colorOptionValues).toContain(fixtures.GROUP_FIELD_CODE);
    expect(colorOptionValues).not.toContain('ユーザー選択');

    await block.$eval(
      '.js-title-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.TITLE_FIELD_CODE,
    );
    await block.$eval(
      '.js-start-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.START_FIELD_CODE,
    );
    await block.$eval(
      '.js-group-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.GROUP_FIELD_CODE,
    );
    await block.$eval(
      '.js-color-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.GROUP_FIELD_CODE,
    );

    // 色選択は自由入力のカラーピッカーではなく、固定パレットからの選択式(select)。
    const colorOverrideTag = await block.$eval(
      '.js-color-override-input',
      (el) => el.tagName,
    );
    expect(colorOverrideTag).toBe('SELECT');
    const colorOverrideOptionTexts = await block.$eval(
      '.js-color-override-input',
      (el) => Array.from(el.options).map((o) => o.textContent),
    );
    expect(colorOverrideOptionTexts).toContain('(自動)');
    expect(colorOverrideOptionTexts.length).toBeGreaterThan(1);

    // 既定の表示単位: 日表示、デザイン: 縦。
    const dayUnitRadio = await block.$('.js-view-unit[value="day"]');
    await dayUnitRadio.click();
    const verticalRadio = await block.$(
      '.js-layout-direction[value="vertical"]',
    );
    await verticalRadio.click();

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定はデプロイするまでレコード一覧画面等には反映されない
    // (radar_chart_view等と同じ既知の挙動)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedBlocks = await page.$$('.js-view-config-block');
    const reloadedBlock = reloadedBlocks[0];
    expect(await reloadedBlock.$eval('.js-title-field', (el) => el.value)).toBe(
      fixtures.TITLE_FIELD_CODE,
    );
    expect(await reloadedBlock.$eval('.js-start-field', (el) => el.value)).toBe(
      fixtures.START_FIELD_CODE,
    );
    expect(await reloadedBlock.$eval('.js-group-field', (el) => el.value)).toBe(
      fixtures.GROUP_FIELD_CODE,
    );
    expect(await reloadedBlock.$eval('.js-color-field', (el) => el.value)).toBe(
      fixtures.GROUP_FIELD_CODE,
    );
    expect(
      await reloadedBlock.$eval(
        '.js-view-unit[value="day"]',
        (el) => el.checked,
      ),
    ).toBe(true);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('レコード一覧画面: カレンダーが表示され、シードレコードのタイトルが日表示に描画される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // kintoneの`like`はトークン化された部分一致(全文検索寄り)であり、アンダースコア区切りの
    // 接頭辞では意図通りに一致しないことが実機で確認できたため、既知の2件のマーカー値を
    // `in`(完全一致の集合)で絞り込む。
    const markerValues = fixtures.SEED_RECORDS.map(
      (seed) => `cv_e2e_seed_${seed.markerSuffix}`,
    );
    const query = encodeURIComponent(
      `${fixtures.MARKER_FIELD_CODE} in (${markerValues.map((v) => `"${v}"`).join(', ')})`,
    );
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/?query=${query}`,
      {
        waitUntil: 'networkidle0',
      },
    );

    await page.waitForSelector('.cv-root', { timeout: 15000 });

    // REST APIを使わない設計上の制約(最大100件)であることが、常にツールバーに明示されている。
    const statusText = await page.$eval(
      '.cv-status-text',
      (el) => el.textContent,
    );
    expect(statusText).toContain('最大100件');

    // 設定画面のテストで既定表示単位を「日表示」にしたため、日表示ボタンがアクティブ。
    const activeUnitLabel = await page.$eval(
      '.cv-unit-button-active',
      (el) => el.textContent,
    );
    expect(activeUnitLabel).toBe('日表示');

    // グループ列見出し(sample1/sample2)が描画されている(グループ分けフィールドの反映確認)。
    const groupHeaderTexts = await page.$$eval('.cv-group-header-cell', (els) =>
      els.map((el) => el.textContent),
    );
    expect(groupHeaderTexts).toEqual(
      expect.arrayContaining(['sample1', 'sample2']),
    );

    // シードレコードのイベントブロックが実際にタイトル付きで描画されている。
    const eventTexts = await page.$$eval('.cv-event-block', (els) =>
      els.map((el) => el.textContent),
    );
    expect(eventTexts).toEqual(
      expect.arrayContaining(['CVイベントA', 'CVイベントB']),
    );

    // 色分けの凡例が、グループ分けフィールドの値(sample1/sample2)で表示されている
    // (色分けフィールド未設定時はグループ分けフィールドにフォールバックする仕様の確認)。
    const legendLabels = await page.$$eval('.cv-legend-label', (els) =>
      els.map((el) => el.textContent),
    );
    expect(legendLabels).toEqual(
      expect.arrayContaining(['sample1', 'sample2']),
    );

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'calendar-day-view');

    // 週表示への切り替えも正常に動作する。グループ分けフィールドが設定されており
    // 2種類以上のグループが存在するため、日付×グループの2軸グリッドで描画される。
    await page.click('.cv-unit-button:not(.cv-unit-button-active)');
    await page.waitForSelector('.cv-week-grouped-grid', { timeout: 10000 });
    const weekGroupHeaderTexts = await page.$$eval(
      '.cv-week-grouped-grid .cv-group-header-cell',
      (els) => els.map((el) => el.textContent),
    );
    expect(weekGroupHeaderTexts).toEqual(
      expect.arrayContaining(['sample1', 'sample2']),
    );
    const weekChipTexts = await page.$$eval('.cv-event-chip', (els) =>
      els.map((el) => el.textContent),
    );
    expect(weekChipTexts.some((t) => t.includes('CVイベントA'))).toBe(true);
    expect(weekChipTexts.some((t) => t.includes('CVイベントB'))).toBe(true);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'calendar-week-view');

    expect(pageErrors).toEqual([]);
  });
});
