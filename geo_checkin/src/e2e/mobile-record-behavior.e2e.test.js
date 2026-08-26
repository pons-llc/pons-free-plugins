'use strict';

// モバイル画面(js/mobile.js)の実際の動作を検証するPuppeteerテスト。record-behavior.e2e.test.js の
// モバイル版で、同じシナリオ(常に非表示・保存時の位置情報自動反映・地図表示・取得失敗時も保存継続)
// をモバイルのURL・UIでたどる(field_encryptionのmobile-encryption-flow.e2e.test.jsと同じ方針)。
//
// 事前準備: record-behavior.e2e.test.jsと同様(pnpm run build、検証環境アプリへのアップロード、
// .env設定済み)。
// 実行: pnpm run test:e2e
//
// 実機で確認した重要なUI仕様(field_encryptionのモバイルテストと同じ):
//   - モバイル画面のURLは`/k/m/{appId}/edit`(新規作成)、`/k/m/{appId}/show?record={id}`(詳細)。
//     詳細から編集への遷移は同じURLへ`#mode=edit`が付与されるだけ(パスは変わらない)。
//   - PCと異なり、モバイル画面は直接page.goto()してもkintone.mobile.app.record.get()等の
//     JavaScript APIが正常に機能する(SPA内部状態の問題が発生しない)。
//   - 新規作成の保存完了は、PCの`mode=edit`判定(新規作成では最初から真になってしまう)ではなく、
//     `location.href.includes('/show')`で判定する(field_encryptionのモバイルテストと同じ理由)。
//   - 保存ボタンは`button.gaia-mobile-v2-app-record-edittoolbar-save`、詳細画面の編集アイコンは
//     `button.gaia-mobile-v2-app-record-showtoolbar-editrecord`(実機で確認済み)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const LAT_FIELD_CODE = 'geoc_lat';
const LNG_FIELD_CODE = 'geoc_lng';
const REQUIRED_TEXT_FIELD_CODE = 'bfu_required_test_field';
const MOCK_LATITUDE = 35.658581;
const MOCK_LONGITUDE = 139.745433;

const jsClick = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) {
      throw new Error(`要素が見つかりません: ${sel}`);
    }
    el.click();
  }, selector);

const fillRequiredTextField = (page) =>
  page.evaluate((code) => {
    const current = kintone.mobile.app.record.get().record;
    if (current[code]) {
      current[code].value = 'geo_checkin mobile e2e';
    }
    kintone.mobile.app.record.set({ record: current });
  }, REQUIRED_TEXT_FIELD_CODE);

// beforeSave(page)を渡すと、必須項目の入力・保存クリックの前に追加の確認・操作を挟める。
const addNewMobileRecordAndSave = async (page, env, beforeSave) => {
  await page.goto(
    `https://${env.KINTONE_DOMAIN}/k/m/${env.TEST_APP_ID_1}/edit`,
    {
      waitUntil: 'networkidle0',
    },
  );
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});

  if (beforeSave) {
    await beforeSave(page);
  }

  await fillRequiredTextField(page);

  await jsClick(page, 'button.gaia-mobile-v2-app-record-edittoolbar-save');
  await page.waitForFunction(() => location.href.includes('/show'), {
    timeout: 30000,
  });
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});

  const url = new URL(page.url());
  const recordId = url.searchParams.get('record');
  if (!recordId) {
    throw new Error(
      `保存後のURLからレコードIDを取得できませんでした: ${url.href}`,
    );
  }
  return Number(recordId);
};

describe('モバイル画面での位置情報自動取得(実環境)', () => {
  let browser;
  let page;
  let env;
  const createdIds = [];

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定はPC/モバイル共通(record-behavior.e2e.test.jsと同じ内容)。既に保存済みでも
    // 上書きして冪等にする。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.select('#js-latitude-field', LAT_FIELD_CODE);
    await page.select('#js-longitude-field', LNG_FIELD_CODE);
    const showMapChecked = await page.$eval('#js-show-map', (el) => el.checked);
    if (!showMapChecked) {
      await page.click('#js-show-map');
    }
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    // Geolocationを許可し、固定座標を返すようにする(実機のGPSに依存しない決定的テスト)。
    const origin = `https://${env.KINTONE_DOMAIN}`;
    await browser
      .defaultBrowserContext()
      .overridePermissions(origin, ['geolocation']);
    await page.setGeolocation({
      latitude: MOCK_LATITUDE,
      longitude: MOCK_LONGITUDE,
      accuracy: 10,
    });
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await kintoneAdmin.request(env, '/k/v1/records.json', 'DELETE', {
        app: env.TEST_APP_ID_1,
        ids: createdIds,
      });
    }
    if (browser) {
      await browser.close();
    }
  });

  test('モバイル新規作成画面: 緯度・経度フィールドは常に非表示で、保存すると位置情報が自動反映される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const recordId = await addNewMobileRecordAndSave(page, env, async () => {
      // isFieldVisible()は非同期API(Promiseを返す)なので、page.evaluate()内でもawaitする。
      const [latVisible, lngVisible] = await page.evaluate(
        async (latCode, lngCode) => [
          await kintone.mobile.app.record.isFieldVisible(latCode),
          await kintone.mobile.app.record.isFieldVisible(lngCode),
        ],
        LAT_FIELD_CODE,
        LNG_FIELD_CODE,
      );
      expect(latVisible).toBe(false);
      expect(lngVisible).toBe(false);
    });
    createdIds.push(recordId);

    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: env.TEST_APP_ID_1, id: recordId },
    );
    // kintoneのNUMBERフィールドは内部的な精度丸めが発生する(record-behavior.e2e.test.js参照)。
    expect(Number(record[LAT_FIELD_CODE].value)).toBeCloseTo(MOCK_LATITUDE, 3);
    expect(Number(record[LNG_FIELD_CODE].value)).toBeCloseTo(MOCK_LONGITUDE, 3);

    expect(pageErrors).toEqual([]);
  });

  test('モバイル詳細画面: 地図表示がONの場合、ヘッダー下の要素に位置情報のiframeが埋め込まれる', async () => {
    const recordId = createdIds[createdIds.length - 1];

    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: env.TEST_APP_ID_1, id: recordId },
    );
    const storedLat = record[LAT_FIELD_CODE].value;
    const storedLng = record[LNG_FIELD_CODE].value;

    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/m/${env.TEST_APP_ID_1}/show?record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.waitForFunction(
      () => {
        const spaceEl = kintone.mobile.app.getHeaderSpaceElement();
        return !!(spaceEl && spaceEl.querySelector('iframe.geoc-map-iframe'));
      },
      { timeout: 15000 },
    );

    const iframeSrc = await page.evaluate(() => {
      const spaceEl = kintone.mobile.app.getHeaderSpaceElement();
      return spaceEl.querySelector('iframe.geoc-map-iframe').src;
    });
    expect(iframeSrc).toContain(`q=${Number(storedLat)},${Number(storedLng)}`);
    expect(iframeSrc.startsWith('https://www.google.com/maps?q=')).toBe(true);
  });

  test('モバイル編集画面: 緯度・経度フィールドは非表示になる', async () => {
    const recordId = createdIds[createdIds.length - 1];
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/m/${env.TEST_APP_ID_1}/show?record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await jsClick(
      page,
      'button.gaia-mobile-v2-app-record-showtoolbar-editrecord',
    );
    await page.waitForFunction(() => location.href.includes('mode=edit'), {
      timeout: 15000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const [latVisible, lngVisible] = await page.evaluate(
      async (latCode, lngCode) => [
        await kintone.mobile.app.record.isFieldVisible(latCode),
        await kintone.mobile.app.record.isFieldVisible(lngCode),
      ],
      LAT_FIELD_CODE,
      LNG_FIELD_CODE,
    );
    expect(latVisible).toBe(false);
    expect(lngVisible).toBe(false);
  });

  test('モバイル: 位置情報の利用が許可されない場合でも保存は継続し、位置情報は空のまま記録される', async () => {
    // overridePermissions(origin, [])で「geolocationを含まない許可リスト」を明示的に設定し、
    // PERMISSION_DENIEDとして即座に確定させる(record-behavior.e2e.test.jsと同じ理由)。
    const origin = `https://${env.KINTONE_DOMAIN}`;
    await browser.defaultBrowserContext().overridePermissions(origin, []);

    const dialogMessages = [];
    const onDialog = (dialog) => dialogMessages.push(dialog.message());
    page.on('dialog', onDialog);

    let recordId;
    try {
      recordId = await addNewMobileRecordAndSave(page, env);
    } finally {
      page.off('dialog', onDialog);
    }
    createdIds.push(recordId);

    expect(
      dialogMessages.some((m) => m.includes('位置情報は空のまま記録されます')),
    ).toBe(true);

    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: env.TEST_APP_ID_1, id: recordId },
    );
    expect(record[LAT_FIELD_CODE].value).toBe('');
    expect(record[LNG_FIELD_CODE].value).toBe('');
  });
});
