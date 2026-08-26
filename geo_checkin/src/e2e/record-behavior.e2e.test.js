'use strict';

// レコード画面での実際の位置情報自動取得動作(実環境Puppeteer)を検証する。
// config-screen.e2e.test.jsが設定画面の疎通・選択肢の絞り込みを見るのに対し、こちらは
// 「保存時に実際に緯度・経度が反映されるか」「常に非表示になっているか」「編集画面で
// disabledになるか」「地図が表示されるか」「位置情報が取得できなくても保存は継続するか」
// という本プラグインの中核仕様(idea.md参照)を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build、検証環境アプリへのアップロード、
// .env設定済み)。
// 実行: pnpm run test:e2e
//
// Geolocationは実機のGPSに依存させず、Puppeteerのブラウザコンテキスト権限
// (overridePermissions)とpage.setGeolocation()で決定的な座標を返すようにする。
// 「取得失敗」ケースは、geolocation権限を明示的に許可しない(ブラウザ既定でPERMISSION_DENIED
// になる)ことで再現する。
//
// TEST_APP_ID_1には他プラグイン(bulk_field_update)由来の必須フィールド
// (bfu_required_test_field、文字列1行)が存在するため、保存をブロックしないようダミー値を
// 入れる(field_encryptionのe2eテストと同じ対処)。RADIO_BUTTON型の必須フィールドは
// defaultValueが設定済みのため、追加の入力は不要(実機で確認済み)。
//
// このテストが作成したレコードは、保存直後にURLから取得したレコードIDのみをafterAllで
// 削除する(feedback_shared_test_app_destructive_ops.md「自分が作ったと特定できるレコードのみ
// 削除する」に従う)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const LAT_FIELD_CODE = 'geoc_lat';
const LNG_FIELD_CODE = 'geoc_lng';
const REQUIRED_TEXT_FIELD_CODE = 'bfu_required_test_field';
const MOCK_LATITUDE = 35.681236;
const MOCK_LONGITUDE = 139.767125;

const fillRequiredTextField = (page) =>
  page.evaluate((code) => {
    const current = kintone.app.record.get().record;
    if (current[code]) {
      current[code].value = 'geo_checkin e2e';
    }
    kintone.app.record.set({ record: current });
  }, REQUIRED_TEXT_FIELD_CODE);

// beforeSave(page)を渡すと、必須項目の入力・保存クリックの前に追加の確認・操作を挟める
// (「非表示になっていること」は保存前のフォーム状態でのみ確認できるため)。
const addNewRecordAndSave = async (page, env, beforeSave) => {
  await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
    waitUntil: 'networkidle0',
  });
  const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
  await page.evaluate((el) => el.click(), addLinkEl);
  await page.waitForFunction(() => location.href.includes('/edit'));
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});

  if (beforeSave) {
    await beforeSave(page);
  }

  await fillRequiredTextField(page);

  // 新規追加の保存では、クリック直後のURLは`/edit`という別パス(「mode=edit」というハッシュは
  // 含まない)なので、`!location.href.includes('mode=edit')`は保存完了を待たずに常に真になって
  // しまう(既存プラグインのfield_encryptionのe2eテストにもある形だが、編集画面用の判定を
  // 転用した意味の薄い条件)。位置情報取得の失敗時はalert()が保存処理を一時ブロックするため、
  // その間は保存のPOSTリクエストがまだ発生しておらず、waitForNetworkIdle()だけに頼ると
  // アラート表示前の「静かな瞬間」を保存完了と誤認する。保存後に実際に付与されるレコードIDの
  // ハッシュ(`record=<数字>`)そのものを待つことで、確実に保存完了を検知する。
  await Promise.all([
    page.waitForFunction(() => /record=\d+/.test(location.hash), {
      timeout: 30000,
    }),
    page.click('button.gaia-ui-actionmenu-save'),
  ]);
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});

  const url = new URL(page.url());
  const match = url.hash.match(/record=(\d+)/);
  if (!match) {
    throw new Error(
      `保存後のURLからレコードIDを取得できませんでした: ${url.hash}`,
    );
  }
  return Number(match[1]);
};

describe('レコード画面での位置情報自動取得(実環境)', () => {
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
    await page.setViewport({ width: 1280, height: 1000 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定: 緯度=geoc_lat、経度=geoc_lng、地図を表示する=ON、で上書き保存する
    // (このテスト専用の自己完結セットアップ、org_lookupと同じ方針)。
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

  test('新規作成画面: 緯度・経度フィールドは常に非表示で、保存すると位置情報が自動反映される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const recordId = await addNewRecordAndSave(page, env, async () => {
      // 緯度・経度フィールドはsetFieldShown(false)により常に非表示になっている(idea.md参照)。
      // isFieldVisible()は非同期API(Promiseを返す)なので、page.evaluate()内でもawaitする。
      const [latVisible, lngVisible] = await page.evaluate(
        async (latCode, lngCode) => [
          await kintone.app.record.isFieldVisible(latCode),
          await kintone.app.record.isFieldVisible(lngCode),
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
    // kintoneのNUMBERフィールドは、displayScale未設定でも内部的な精度丸めが発生する
    // (実機で確認済み: 35.681236 → 35.6812)。取得できる緯度・経度は「ほぼ一致」までを検証する。
    expect(Number(record[LAT_FIELD_CODE].value)).toBeCloseTo(MOCK_LATITUDE, 3);
    expect(Number(record[LNG_FIELD_CODE].value)).toBeCloseTo(MOCK_LONGITUDE, 3);

    expect(pageErrors).toEqual([]);
  });

  test('詳細画面: 地図表示がONの場合、ヘッダーメニュースペースに位置情報のiframeが埋め込まれる', async () => {
    const recordId = createdIds[createdIds.length - 1];

    // 上記のNUMBERフィールドの精度丸めのため、地図URLに埋め込まれるはずの座標は
    // ハードコードした定数ではなく、実際に保存された値(REST APIで取得)と突き合わせる。
    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: env.TEST_APP_ID_1, id: recordId },
    );
    const storedLat = record[LAT_FIELD_CODE].value;
    const storedLng = record[LNG_FIELD_CODE].value;

    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/show#record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.waitForFunction(
      () => {
        const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
        return !!(spaceEl && spaceEl.querySelector('iframe.geoc-map-iframe'));
      },
      { timeout: 15000 },
    );

    const iframeSrc = await page.evaluate(() => {
      const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
      return spaceEl.querySelector('iframe.geoc-map-iframe').src;
    });
    expect(iframeSrc).toContain(`q=${Number(storedLat)},${Number(storedLng)}`);
    expect(iframeSrc.startsWith('https://www.google.com/maps?q=')).toBe(true);
  });

  test('編集画面: 緯度・経度フィールドは非表示になる', async () => {
    // disabled化(js/desktop.jsのdisableFields)自体はkintone公式ドキュメント
    // (event-object-actions)通り`record[fieldCode].disabled = true`をreturnする実装だが、
    // `disabled`はイベントオブジェクトに対する「書き込み専用の指示」で、kintone.app.record.get()の
    // 戻り値には反映されない(実機で確認済み)。また対象フィールドは非表示化もしているため
    // getFieldElement()で編集画面のinput要素を直接検証する手段も無い(getFieldElement()は
    // 詳細/印刷画面専用でありレコード編集画面では利用できない、公式ドキュメント参照)。
    // そのためこのテストはisFieldVisible()による非表示化のみをE2Eで検証し、disabled化は
    // 公式ドキュメントに沿った実装であることをもって担保する(org_lookupと同じ方針)。
    const recordId = createdIds[createdIds.length - 1];
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/show#record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await common.goToEditScreenFromDetail(page);

    const [latVisible, lngVisible] = await page.evaluate(
      async (latCode, lngCode) => [
        await kintone.app.record.isFieldVisible(latCode),
        await kintone.app.record.isFieldVisible(lngCode),
      ],
      LAT_FIELD_CODE,
      LNG_FIELD_CODE,
    );
    expect(latVisible).toBe(false);
    expect(lngVisible).toBe(false);
  });

  test('位置情報の利用が許可されない場合でも保存は継続し、位置情報は空のまま記録される', async () => {
    // clearPermissionOverrides()は「未設定(許可を尋ねる)」状態に戻すだけで、ヘッドレスChromeでは
    // 尋ねる相手がいないままgetCurrentPosition()が確定せず待機し続けることがある(実機で確認済み、
    // 30秒のタイムアウトで無限待ちになった)。overridePermissions(origin, [])で「geolocationを
    // 含まない許可リスト」を明示的に設定すると、PERMISSION_DENIEDとして即座に確定する。
    // 以降このテストが最後なので他テストへの影響は無い。
    const origin = `https://${env.KINTONE_DOMAIN}`;
    await browser.defaultBrowserContext().overridePermissions(origin, []);

    const dialogMessages = [];
    const onDialog = (dialog) => dialogMessages.push(dialog.message());
    page.on('dialog', onDialog);

    let recordId;
    try {
      recordId = await addNewRecordAndSave(page, env);
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
