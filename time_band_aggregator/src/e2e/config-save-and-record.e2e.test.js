'use strict';

// 設定の保存(フィールド自動作成を含む)と、実際のレコード画面での反映を検証するPuppeteerテスト。
// config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを見るのに対し、こちらは
// 「保存によって実際にフィールドが作成されるか」「保存時トリガーで実際に時間帯が算出されるか」
// 「作成されたフィールドがレコード画面で非表示になるか」という機能面を検証する。
//
// 最初のテストは発動タイミングSUBMIT(保存時)、2番目のテストはCHANGE(フィールド変更時)で、
// どちらもkintone.app.record.set()のみで値をセットする(実際のUI操作を伴わないため、ネイティブの
// changeイベントは発火しない、kintone公式の既知の制約)。desktop.js/mobile.jsは発動タイミングの
// 設定によらず保存時に必ずapplyRowToRecordを呼ぶ実装にしているため(user-test.mdフィードバック
// 「レコード保存しても値が入らない」反映)、CHANGE設定でもchangeイベントが発火しないケースで
// 保存時に反映されることをここで回帰確認する。「フィールド変更時」選択時の保存前リアルタイム
// プレビュー(change発火時の即時反映)自体は、実際のUI操作(日時ピッカー操作)を伴うため
// Puppeteerでの安定した自動テストが難しく、目視確認に委ねている(未検証の範囲)。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// 期待値(時間帯ラベル・数値)はハードコードせず、テスト実行時にNode側でも同じIntlベースの計算を
// 独立に行って突き合わせる(org_lookupのrecord-lookup.e2e.test.jsと同じ「実データに基づく検証」の
// 考え方)。DATETIMEフィールドの場合、実行ユーザーのタイムゾーン(kintone.getLoginUser().timezone)に
// 依存するため、テスト内でも同じ値を取得して計算に使う。
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する(org_lookup/self_lookup/user_info_lookupと同じ理由)。
// 保存ボタンのセレクター(.gaia-ui-actionmenu-save)は検証環境で実際に確認済み。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { findSourceField } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const pad2 = (n) => String(n).padStart(2, '0');
const clock = (m) =>
  m >= 1440 ? '24:00' : `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

describe('設定の保存とレコードへの反映(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let sourceField;
  let dropdownFieldCode;
  let numberFieldCode;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    sourceField = await findSourceField(env, env.TEST_APP_ID_1);
    dropdownFieldCode = `${sourceField.code}_timeband`;
    numberFieldCode = `${sourceField.code}_timeband_num`;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 既に本テスト用の行が保存済み(再実行時)なら追加・保存をスキップする(冪等)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const alreadyConfigured = await page.evaluate((code) => {
      const rows = Array.from(document.querySelectorAll('.js-row'));
      return rows.some(
        (row) => row.querySelector('.js-source-field')?.value === code,
      );
    }, sourceField.code);

    if (!alreadyConfigured) {
      await page.click('#js-row-add');
      const rows = await page.$$('.js-row');
      const newRow = rows[rows.length - 1];
      await (await newRow.$('.js-source-field')).select(sourceField.code);
      await (await newRow.$('.js-band-width')).select('60');
      await (await page.$('.js-trigger-submit')).click();

      // 保存処理はREST APIでのフィールド追加・デプロイのポーリングを含むため時間がかかる。
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
        page.click('.js-save-button'),
      ]);

      // kintone.plugin.app.setConfig()自体は動作テスト環境相当にしか反映されないため、
      // レコード画面(create/edit/submit)に反映するには明示的なデプロイが必要
      // (org_lookupのrecord-lookup.e2e.test.jsと同じ理由。フィールド追加自体は
      // js/config.jsが保存時に自らデプロイ済みだが、プラグイン設定の反映は別途必要)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('保存によりドロップダウン・数値フィールドが実際に作成される', async () => {
    const fields = await kintoneAdmin.getFormFields(env, env.TEST_APP_ID_1);
    expect(fields[dropdownFieldCode]).toBeDefined();
    expect(fields[dropdownFieldCode].type).toBe('DROP_DOWN');
    expect(fields[numberFieldCode]).toBeDefined();
    expect(fields[numberFieldCode].type).toBe('NUMBER');
  });

  test('保存時トリガーで実際に時間帯が算出され、作成フィールドはレコード画面で非表示になる', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 作成された2フィールドは追加画面でも非表示のはず(idea.md「機能概要」)。
    const dropdownVisible = await page.evaluate(
      (code) => kintone.app.record.isFieldVisible(code),
      dropdownFieldCode,
    );
    expect(dropdownVisible).toBe(false);
    const numberVisible = await page.evaluate(
      (code) => kintone.app.record.isFieldVisible(code),
      numberFieldCode,
    );
    expect(numberVisible).toBe(false);

    const testValue =
      sourceField.type === 'TIME' ? '09:45' : '2024-06-01T04:45:00Z';

    const expectedMinutes = await (async () => {
      if (sourceField.type === 'TIME') {
        return 9 * 60 + 45;
      }
      // DATETIMEの場合、実行ユーザーのタイムゾーンに算出結果が依存する(idea.md参照)。
      const timezone = await page.evaluate(
        () => kintone.getLoginUser().timezone,
      );
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      });
      const parts = formatter.formatToParts(new Date(testValue));
      const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
      const minute = Number(parts.find((p) => p.type === 'minute').value);
      return hour * 60 + minute;
    })();
    const bandStart = Math.floor(expectedMinutes / 60) * 60;
    const expectedLabel = `${clock(bandStart)}〜${clock(bandStart + 60)}`;

    await page.evaluate(
      (code, value) => {
        const current = kintone.app.record.get().record;
        current[code].value = value;
        kintone.app.record.set({ record: current });
      },
      sourceField.code,
      testValue,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record[dropdownFieldCode].value).toBe(expectedLabel);
    expect(record[numberFieldCode].value).toBe(String(bandStart));

    expect(pageErrors).toEqual([]);
  });

  // user-test.mdフィードバック「レコード保存しても値が入らない」の回帰テスト。発動タイミングを
  // 「フィールド変更時」に切り替えたうえで、kintone.app.record.set()のみで変換元フィールドの値を
  // 入れる(ネイティブのchangeイベントは発火しない、kintone公式の既知の制約)。修正前はCHANGE設定時に
  // 保存時の再計算が一切行われなかったため出力先が空のままだったが、修正後は保存時に必ず再計算される。
  test('「フィールド変更時」設定でも、changeイベントを伴わない値のセット後に保存すれば反映される', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await (await page.$('.js-trigger-change')).click();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
      page.click('.js-save-button'),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const testValue =
      sourceField.type === 'TIME' ? '14:15' : '2024-06-01T09:15:00Z';
    const expectedMinutes = await (async () => {
      if (sourceField.type === 'TIME') {
        return 14 * 60 + 15;
      }
      const timezone = await page.evaluate(
        () => kintone.getLoginUser().timezone,
      );
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      });
      const parts = formatter.formatToParts(new Date(testValue));
      const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
      const minute = Number(parts.find((p) => p.type === 'minute').value);
      return hour * 60 + minute;
    })();
    const bandStart = Math.floor(expectedMinutes / 60) * 60;
    const expectedLabel = `${clock(bandStart)}〜${clock(bandStart + 60)}`;

    // kintone.app.record.set()のみで値をセットする(ネイティブのUI操作を経ないため、
    // フィールド変更時イベントは発火しない)。
    await page.evaluate(
      (code, value) => {
        const current = kintone.app.record.get().record;
        current[code].value = value;
        kintone.app.record.set({ record: current });
      },
      sourceField.code,
      testValue,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record[dropdownFieldCode].value).toBe(expectedLabel);
    expect(record[numberFieldCode].value).toBe(String(bandStart));

    expect(pageErrors).toEqual([]);
  });
});
