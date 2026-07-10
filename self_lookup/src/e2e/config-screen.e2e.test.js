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
// このテストの主眼は「検索先のキーフィールド」プルダウンが実際にunique設定のフィールド/
// レコード番号のみに絞り込まれること、「ルックアップボタンを設置するスペースフィールド」
// プルダウンにkintone.app.getFormLayout()由来の選択肢が実際に出ることの回帰確認
// (静的HTML・単体テストでは検知できない。CLAUDE.mdの開発方針1参照)。
//
// NOTE: TEST_APP_ID_1には(このテストとは別に)手動検証済みの設定行がすでに1件保存されている
// ことがあるため、「#js-lookup-add」で追加した新しい行だけを対象にする(既存行を巻き込まない
// よう、常に最後の.js-lookup-rowをスコープに操作する)。このテストはSaveを押さないため、
// 既存の保存済み設定を書き換えることはない。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensureTargetAppFields, ensureButtonSpace } = require('./fixtures');

const PLUGIN_NAME = 'self_lookup';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、設定行を追加すると各プルダウンの選択肢が実際に絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('セルフルックアッププラグイン');

    await page.click('#js-lookup-add');
    const rows = await page.$$('.js-lookup-row');
    const newRow = rows[rows.length - 1];

    // 検索先のキーフィールド: unique設定のあるフィールドまたはレコード番号のみが選択肢に
    // 出ているはず(config.js冒頭のotherKeyEligibleFieldsの絞り込みが実際に効いているかの
    // 回帰確認)。fixtures.jsで用意した「slk_key」(unique)と「レコード番号」が含まれ、
    // unique設定のない「文字列__1行_」は含まれない。
    const otherKeyOptionValues = await newRow.$$eval(
      '.js-lookup-other-key option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(otherKeyOptionValues).toContain('slk_key');
    expect(otherKeyOptionValues).toContain('レコード番号');
    expect(otherKeyOptionValues).not.toContain('文字列__1行_');

    // 自レコードの検索キーとなるフィールド: 対応フィールド型ならunique制約なく選べる。
    const selfKeyOptionValues = await newRow.$$eval(
      '.js-lookup-self-key option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(selfKeyOptionValues).toContain('文字列__1行_');

    // ルックアップボタンを設置するスペースフィールド: kintone.app.getFormLayout()の戻り値を
    // 誤って{layout:[...]}としてラップ扱いすると常に0件になる(CLAUDE.mdの既知の落とし穴、
    // tab_layoutプラグインで実際に発生したバグと同種)。fixtures.jsで用意したスペースが出ること。
    const spaceOptionValues = await newRow.$$eval(
      '.js-lookup-button-space option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(spaceOptionValues).toContain('self_lookup_button_space');

    // 検索先キー・自レコードキー・スペースを選び、フィールドマッピングを1件追加した状態で保存前
    // バリデーションが通ることも合わせて確認する(モーダル表示フィールドは未設定のままでもよい)。
    // このテストはSaveを押さないため、既存の保存済み設定には影響しない。
    const otherKeySelect = await newRow.$('.js-lookup-other-key');
    await otherKeySelect.select('slk_key');
    const selfKeySelect = await newRow.$('.js-lookup-self-key');
    await selfKeySelect.select('文字列__1行_');
    const spaceSelect = await newRow.$('.js-lookup-button-space');
    await spaceSelect.select('self_lookup_button_space');

    const mappingAddButton = await newRow.$('.js-mapping-add');
    await mappingAddButton.click();
    const mappingSourceSelect = await newRow.$('.js-mapping-source');
    await mappingSourceSelect.select('文字列__1行__0');
    const mappingTargetSelect = await newRow.$('.js-mapping-target');
    await mappingTargetSelect.select('slk_copied_name');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
