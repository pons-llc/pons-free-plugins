'use strict';

// 実際に暗号化対象フィールドへ値を入力して保存し、REST APIで取得した生の値が暗号文
// (FE1:接頭辞のbase64)になっていることを確認するPuppeteerテスト。config-screen.e2e.test.jsが
// 設定画面の疎通・選択肢の絞り込みを見るのに対し、こちらは「実際に暗号化・復号が機能するか」という
// 機能面と、編集画面の最重要ロジック(復号しなかったフィールドは暗号文を保持し続ける)を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// テストは1つのdescribeブロック内で順番に実行され、前のtestで作成したレコードIDを後続のtestが
// 使い回す(Jestはデフォルトで同一ファイル内のtestを記述順に直列実行する)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  TARGET_FIELD_CODES,
  SPACE_ELEMENT_ID,
  ensureDecryptSpace,
  openRecordDetailViaIndex,
  openRecordEditFromDetail,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const PASSPHRASE = 'correct horse battery staple 123';

const getFieldElementText = (page, code) =>
  page.evaluate((c) => {
    const el = kintone.app.record.getFieldElement(c);
    return el ? el.textContent : null;
  }, code);

describe('暗号化・復号の実際の動作(実環境)', () => {
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
    // 既定のビューポート(800x600)では、詳細画面右上のツールバー(「レコードを編集する」等)が
    // 画面外に出てクリックできない(実環境で確認済み)。十分な幅に広げておく。
    await page.setViewport({ width: 1280, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // プラグイン設定を確定させる(暗号化対象フィールド2つ+復号スペース+最小文字数8)。
    // このプラグインの設定は複数行を持たない単純な形なので、常に上書き保存して冪等にする。
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

    // プラグイン設定の保存(kintone.plugin.app.setConfig())は「テスト環境」相当にしか反映されず、
    // レコード画面などの実際の画面に反映されるには明示的なデプロイが必要(org_lookupと同じ)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('新規作成画面でパスフレーズを設定して保存すると、フィールドの生の値が暗号文になる', async () => {
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

    // TEST_APP_ID_1には他プラグイン(bulk_field_update)用の必須フィールドが存在するため、
    // このプラグインとは無関係だが保存をブロックしないようダミー値を入れておく。
    await page.evaluate((codes) => {
      const current = kintone.app.record.get().record;
      current[codes.single].value = 'ひみつの1行テキスト';
      current[codes.multi].value = 'ひみつの\n複数行テキスト';
      if (current.bfu_required_test_field) {
        current.bfu_required_test_field.value = 'field_encryption e2e';
      }
      kintone.app.record.set({ record: current });
    }, TARGET_FIELD_CODES);

    await page.waitForSelector('.fe-passphrase-input');
    await page.type('.fe-passphrase-input', PASSPHRASE);
    await page.type('.fe-passphrase-confirm-input', PASSPHRASE);

    // 既存レコードの編集画面は/show#record=...のまま&mode=editが付くだけなので
    // (openRecordEditFromDetail参照)、保存完了はmode=editが外れたことで判定する。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const url = new URL(page.url());
    recordId = url.hash.match(/record=(\d+)/)[1];
    expect(recordId).toBeTruthy();

    // 詳細画面では、暗号化済みフィールドの実DOMがマスク文字列に書き換えられているはず。
    const singleText = await getFieldElementText(
      page,
      TARGET_FIELD_CODES.single,
    );
    expect(singleText).toContain('暗号化されています');

    // REST APIで取得した生の値がFE1:接頭辞のbase64(暗号文)になっており、平文が含まれないこと。
    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_1,
      id: recordId,
    });
    firstCiphertext = record.record[TARGET_FIELD_CODES.single].value;
    expect(firstCiphertext.startsWith('FE1:')).toBe(true);
    expect(firstCiphertext).not.toContain('ひみつ');
    expect(
      record.record[TARGET_FIELD_CODES.multi].value.startsWith('FE1:'),
    ).toBe(true);

    expect(pageErrors).toEqual([]);
  });

  test('詳細画面: 誤ったパスフレーズだとエラーになり平文が漏れない', async () => {
    await openRecordDetailViaIndex(page, env, env.TEST_APP_ID_1, recordId);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForSelector('.fe-decrypt-passphrase-input');
    await page.type('.fe-decrypt-passphrase-input', 'wrong-passphrase');
    await page.click('.fe-decrypt-button');

    await page.waitForSelector('.fe-result-error');
    const resultText = await page.$eval(
      '.fe-result-message',
      (el) => el.textContent,
    );
    expect(resultText).toContain('パスフレーズが正しくない');

    const bodyText = await page.evaluate(() => document.body.textContent);
    expect(bodyText).not.toContain('ひみつの1行テキスト');

    expect(pageErrors).toEqual([]);
  });

  test('詳細画面: 正しいパスフレーズで復号すると平文が表示される', async () => {
    await page.waitForSelector('.fe-decrypt-passphrase-input');
    await page.type('.fe-decrypt-passphrase-input', PASSPHRASE);
    await page.click('.fe-decrypt-button');

    await page.waitForSelector('.fe-result-success');
    const valueTexts = await page.$$eval('.fe-value-text', (els) =>
      els.map((el) => el.textContent),
    );
    expect(valueTexts).toContain('ひみつの1行テキスト');
    expect(valueTexts).toContain('ひみつの\n複数行テキスト');
  });

  test('編集画面: 復号せずに保存すると暗号文はそのまま残る(データ破壊防止の回帰確認)', async () => {
    await openRecordEditFromDetail(page);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 復号フォームには触れず、そのまま保存する。
    // 既存レコードの編集画面は/show#record=...のまま&mode=editが付くだけなので
    // (openRecordEditFromDetail参照)、保存完了はmode=editが外れたことで判定する。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_1,
      id: recordId,
    });
    // 復号せずに保存した場合、暗号文は保存前とバイト単位で完全に一致していなければならない。
    expect(record.record[TARGET_FIELD_CODES.single].value).toBe(
      firstCiphertext,
    );

    expect(pageErrors).toEqual([]);
  });

  test('編集画面: 復号→値を変更→保存すると、新しい暗号文になり新しい平文を同じパスフレーズで復号できる', async () => {
    await openRecordEditFromDetail(page);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.waitForSelector('.fe-decrypt-passphrase-input');
    await page.type('.fe-decrypt-passphrase-input', PASSPHRASE);
    await page.click('.fe-decrypt-button');

    await page.waitForFunction(
      (code) => {
        const field = kintone.app.record.get().record[code];
        return (
          field && field.value === 'ひみつの1行テキスト' && !field.disabled
        );
      },
      { timeout: 15000 },
      TARGET_FIELD_CODES.single,
    );

    await page.evaluate((code) => {
      const current = kintone.app.record.get().record;
      current[code].value = '編集後のあたらしい秘密';
      kintone.app.record.set({ record: current });
    }, TARGET_FIELD_CODES.single);

    // 既存レコードの編集画面は/show#record=...のまま&mode=editが付くだけなので
    // (openRecordEditFromDetail参照)、保存完了はmode=editが外れたことで判定する。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
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

    // 同じパスフレーズ(パスフレーズ変更フローは無い)で新しい平文を復号できることを確認する。
    await page.waitForSelector('.fe-decrypt-passphrase-input');
    await page.type('.fe-decrypt-passphrase-input', PASSPHRASE);
    await page.click('.fe-decrypt-button');
    await page.waitForSelector('.fe-result-success');
    const valueTexts = await page.$$eval('.fe-value-text', (els) =>
      els.map((el) => el.textContent),
    );
    expect(valueTexts).toContain('編集後のあたらしい秘密');

    expect(pageErrors).toEqual([]);
  });
});
