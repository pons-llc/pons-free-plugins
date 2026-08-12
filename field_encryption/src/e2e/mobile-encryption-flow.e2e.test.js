'use strict';

// モバイル画面(js/mobile.js)の実際の動作を検証するPuppeteerテスト。encryption-flow.e2e.test.js の
// モバイル版で、同じシナリオ(暗号化→詳細画面での復号→編集画面での再暗号化)をモバイルのURL・UIで
// たどる。パスフレーズの入力手段がPC(スペース要素に直接フォーム)とモバイル(トリガーボタン+
// ボトムシート)で異なる点が最大の違い(idea.md「モバイル対応」参照)。
//
// 事前準備: encryption-flow.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// 実機で確認した重要なUI仕様:
//   - モバイル画面のURLは `/k/m/{appId}/edit`(新規作成)、`/k/m/{appId}/show?record={id}`(詳細)で、
//     詳細から編集への遷移はPCと同様に同じURLへ `#mode=edit` が付与されるだけ(パスは変わらない)。
//   - PCと異なり、モバイル画面は直接page.goto()してもkintone.mobile.app.record.get()等のJavaScript
//     APIが正常に機能する(SPA内部状態の問題が発生しない)。
//   - このプラグインのスペース要素(fe_decrypt_space)はレイアウトの最後尾にあり、フィールド数の
//     多いTEST_APP_ID_1ではトリガーボタンが画面の非常に下方(スクロール後)に描画される。
//     Puppeteerの通常のElementHandle.click()(実座標クリック)はスクロール直後の座標ズレにより
//     反応しないことがある(実環境で確認済み)ため、トリガーボタン・キントーン標準の
//     編集/保存ボタンはいずれもpage.evaluate()内でのDOM click()(非trusted、しかしこのプラグイン
//     自身のボタンは通常のaddEventListener('click')なので問題なく反応する)を使う。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  TARGET_FIELD_CODES,
  SPACE_ELEMENT_ID,
  ensureDecryptSpace,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const PASSPHRASE = 'mobile correct horse battery 123';

const jsClick = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) {
      throw new Error(`要素が見つかりません: ${sel}`);
    }
    el.click();
  }, selector);

describe('モバイル画面での暗号化・復号の実際の動作(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let recordId;
  let firstCiphertext;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureDecryptSpace(env, env.TEST_APP_ID_1);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // プラグイン設定を確定させる(encryption-flow.e2e.test.jsと同じ内容。設定はPC/モバイル共通なので
    // 既に保存済みでも上書きして冪等にする)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const checkboxHandles = await page.$$(
      '#js-target-fields input[type=checkbox]',
    );
    for (const handle of checkboxHandles) {
      const value = await page.evaluate((el) => el.value, handle);
      const checked = await page.evaluate((el) => el.checked, handle);
      const shouldBeChecked =
        value === TARGET_FIELD_CODES.single ||
        value === TARGET_FIELD_CODES.multi;
      if (shouldBeChecked !== checked) {
        await handle.click();
      }
    }
    await page.select('#js-space-element', SPACE_ELEMENT_ID);
    await page.evaluate(() => {
      const el = document.getElementById('js-min-length');
      el.value = '8';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('モバイル新規作成画面: ボトムシートでパスフレーズを設定して保存すると暗号文になる', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/m/${env.TEST_APP_ID_1}/edit`,
      {
        waitUntil: 'networkidle0',
      },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.evaluate((codes) => {
      const current = kintone.mobile.app.record.get().record;
      current[codes.single].value = 'モバイルのひみつ1行';
      current[codes.multi].value = 'モバイルの\nひみつ複数行';
      if (current.bfu_required_test_field) {
        current.bfu_required_test_field.value = 'field_encryption mobile e2e';
      }
      kintone.mobile.app.record.set({ record: current });
    }, TARGET_FIELD_CODES);

    await page.waitForSelector('.fe-trigger-button');
    await jsClick(page, '.fe-trigger-button');
    await page.waitForSelector('.fe-sheet-panel');

    const inputHandles = await page.$$('.fe-sheet-input');
    expect(inputHandles).toHaveLength(2);
    await inputHandles[0].type(PASSPHRASE);
    await inputHandles[1].type(PASSPHRASE);
    await jsClick(page, '.fe-sheet-submit');

    // ボトムシートが閉じ、トリガーボタンのラベルが更新されるまで待つ。
    await page.waitForFunction(
      () => !document.querySelector('.fe-sheet-backdrop'),
      { timeout: 10000 },
    );
    const triggerLabel = await page.$eval(
      '.fe-trigger-button',
      (el) => el.textContent,
    );
    expect(triggerLabel).toContain('設定済み');

    await jsClick(page, 'button.gaia-mobile-v2-app-record-edittoolbar-save');
    await page.waitForFunction(() => location.href.includes('/show'), {
      timeout: 15000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const url = new URL(page.url());
    recordId = url.searchParams.get('record');
    expect(recordId).toBeTruthy();

    const singleText = await page.evaluate((code) => {
      const el = kintone.mobile.app.record.getFieldElement(code);
      return el ? el.textContent : null;
    }, TARGET_FIELD_CODES.single);
    expect(singleText).toContain('暗号化されています');

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_1,
      id: recordId,
    });
    firstCiphertext = record.record[TARGET_FIELD_CODES.single].value;
    expect(firstCiphertext.startsWith('FE1:')).toBe(true);
    expect(firstCiphertext).not.toContain('モバイル');

    expect(pageErrors).toEqual([]);
  });

  test('モバイル詳細画面: 誤ったパスフレーズだとエラーになり、正しいパスフレーズで復号できる', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/m/${env.TEST_APP_ID_1}/show?record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForSelector('.fe-trigger-button');
    await jsClick(page, '.fe-trigger-button');
    await page.waitForSelector('.fe-sheet-panel');

    const passphraseInput = await page.waitForSelector('.fe-sheet-input');
    await passphraseInput.type('wrong-passphrase');
    await jsClick(page, '.fe-sheet-submit');

    await page.waitForFunction(
      () => (document.querySelector('.fe-sheet-error') || {}).textContent,
      { timeout: 10000 },
    );
    const errorText = await page.$eval(
      '.fe-sheet-error',
      (el) => el.textContent,
    );
    expect(errorText).toContain('パスフレーズが正しくない');

    // 失敗時は入力欄がクリアされ、シートは開いたままのはず。
    const clearedValue = await page.$eval('.fe-sheet-input', (el) => el.value);
    expect(clearedValue).toBe('');

    const correctInput = await page.$('.fe-sheet-input');
    await correctInput.type(PASSPHRASE);
    await jsClick(page, '.fe-sheet-submit');

    await page.waitForFunction(
      () => !document.querySelector('.fe-sheet-backdrop'),
      {
        timeout: 10000,
      },
    );
    const valueTexts = await page.$$eval('.fe-value-text', (els) =>
      els.map((el) => el.textContent),
    );
    expect(valueTexts).toContain('モバイルのひみつ1行');
    expect(valueTexts).toContain('モバイルの\nひみつ複数行');

    expect(pageErrors).toEqual([]);
  });

  test('モバイル編集画面: 復号せずに保存すると暗号文はそのまま残る(データ破壊防止の回帰確認)', async () => {
    await jsClick(
      page,
      'button.gaia-mobile-v2-app-record-showtoolbar-editrecord',
    );
    await page.waitForFunction(() => location.href.includes('mode=edit'), {
      timeout: 10000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await jsClick(page, 'button.gaia-mobile-v2-app-record-edittoolbar-save');
    await page.waitForFunction(() => !location.href.includes('mode=edit'), {
      timeout: 15000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_1,
      id: recordId,
    });
    expect(record.record[TARGET_FIELD_CODES.single].value).toBe(
      firstCiphertext,
    );

    expect(pageErrors).toEqual([]);
  });

  test('モバイル編集画面: 復号→値を変更→保存すると新しい暗号文になり、同じパスフレーズで再復号できる', async () => {
    await jsClick(
      page,
      'button.gaia-mobile-v2-app-record-showtoolbar-editrecord',
    );
    await page.waitForFunction(() => location.href.includes('mode=edit'), {
      timeout: 10000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForSelector('.fe-trigger-button');
    await jsClick(page, '.fe-trigger-button');
    await page.waitForSelector('.fe-sheet-panel');
    const passphraseInput = await page.waitForSelector('.fe-sheet-input');
    await passphraseInput.type(PASSPHRASE);
    await jsClick(page, '.fe-sheet-submit');

    await page.waitForFunction(
      (code) => {
        const field = kintone.mobile.app.record.get().record[code];
        return (
          field && field.value === 'モバイルのひみつ1行' && !field.disabled
        );
      },
      { timeout: 15000 },
      TARGET_FIELD_CODES.single,
    );

    await page.evaluate((code) => {
      const current = kintone.mobile.app.record.get().record;
      current[code].value = 'モバイル編集後のあたらしい秘密';
      kintone.mobile.app.record.set({ record: current });
    }, TARGET_FIELD_CODES.single);

    await jsClick(page, 'button.gaia-mobile-v2-app-record-edittoolbar-save');
    await page.waitForFunction(() => !location.href.includes('mode=edit'), {
      timeout: 15000,
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_1,
      id: recordId,
    });
    const newCiphertext = record.record[TARGET_FIELD_CODES.single].value;
    expect(newCiphertext.startsWith('FE1:')).toBe(true);
    expect(newCiphertext).not.toBe(firstCiphertext);

    await page.waitForSelector('.fe-trigger-button');
    await jsClick(page, '.fe-trigger-button');
    await page.waitForSelector('.fe-sheet-panel');
    const reDecryptInput = await page.waitForSelector('.fe-sheet-input');
    await reDecryptInput.type(PASSPHRASE);
    await jsClick(page, '.fe-sheet-submit');
    await page.waitForFunction(
      () => !document.querySelector('.fe-sheet-backdrop'),
      {
        timeout: 10000,
      },
    );
    const valueTexts = await page.$$eval('.fe-value-text', (els) =>
      els.map((el) => el.textContent),
    );
    expect(valueTexts).toContain('モバイル編集後のあたらしい秘密');

    expect(pageErrors).toEqual([]);
  });
});
