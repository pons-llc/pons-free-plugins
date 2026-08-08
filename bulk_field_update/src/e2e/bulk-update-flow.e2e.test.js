'use strict';

// 一覧画面ボタン → 確認ダイアログ(現在の絞り込み条件の表示・対象フィールドごとの値入力欄・
// 必須フィールドのバリデーション)→ 実行 → 書き戻しまでの実環境テスト。
// config-screen.e2e.test.jsが設定画面の疎通確認なのに対し、こちらは「一覧画面の現在の
// 絞り込み条件がダイアログへ表示され、都度入力した値が実際にレコードへ書き込まれるか」
// 「必須フィールドを空のまま実行しようとするとブロックされるか」という機能面
// (このプラグインの中核)を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e
//
// NOTE: 一覧画面ボタンはkintone.user.getGroups()で判定した実行可能グループに所属する
// ユーザーにのみ表示される。検証環境のログインユーザー(.envのKINTONE_USERNAME)は
// "Administrators"グループに所属していることを事前にkintone.user.getGroups()で確認済み。
//
// NOTE: kintone.createDialog()が生成するOK/キャンセルボタンはkintone内部のUIコンポーネント
// (`gaia-argoui-dialog-buttons-*`)のため、`button[name="ok"]`(name属性)で特定する
// (age_grade_field_updateで実環境確認済みの内容を踏襲)。
//
// NOTE: プラグイン設定の保存はプレビューにしか反映されず、一覧画面(非設定画面)には
// デプロイしないと反映されない(project_plugin_config_needs_deploy.mdの注意点)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  REQUIRED_TEST_FIELD_CODE,
  ensureRequiredTestField,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_FIELD_CODE = '文字列__1行__0';
const MARKER_FIELD_CODE = '文字列__1行__1';
const MARKER_VALUE = 'bfu_e2e_bulk_update_seed';
const WRITE_VALUE = 'EDITED_BY_BULK_FIELD_UPDATE';
const REQUIRED_WRITE_VALUE = 'REQUIRED_FIELD_FILLED';

// このテスト専用のレコードを1件だけ用意する(既存レコードを巻き込まない、
// 他のテストで作られたマーカー付きレコードがあれば使い回す冪等な実装)。
const ensureSeedRecord = async (env, appId) => {
  const query = `${MARKER_FIELD_CODE} = "${MARKER_VALUE}" limit 1`;
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query,
      fields: ['$id'],
    },
  );
  if (existing.records.length > 0) {
    return existing.records[0].$id.value;
  }
  const created = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: { [MARKER_FIELD_CODE]: { value: MARKER_VALUE } },
  });
  return created.id;
};

describe('一覧画面ボタンでの一括更新(実環境)', () => {
  let browser;
  let page;
  let env;
  let recordId;
  let scopedQuery;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureRequiredTestField(env, env.TEST_APP_ID_1, kintoneAdmin);

    recordId = await ensureSeedRecord(env, env.TEST_APP_ID_1);
    scopedQuery = `$id = ${recordId}`;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 対象フィールドとして文字列__1行__0(任意)とbfu_required_test_field(必須)をONにし、
    // それ以外はOFFにする。他のテストの実行順序によって既にON/OFFの状態が残っていることが
    // あるため、.click()(トグル)ではなく.checked = ...を直接設定して冪等にする。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const rows = await page.$$('.js-row');
    for (const row of rows) {
      const label = await row.$eval(':nth-child(2)', (el) => el.textContent);
      const shouldBeEnabled =
        label.includes(`(${TARGET_FIELD_CODE})`) ||
        label.includes(`(${REQUIRED_TEST_FIELD_CODE})`);
      await row.$eval(
        '.js-row-enabled',
        (el, checked) => {
          el.checked = checked;
        },
        shouldBeEnabled,
      );
    }
    await page.evaluate(() => {
      document.querySelector('.js-group-codes').value = 'Administrators';
    });
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('現在の絞り込み条件が表示され、必須フィールドを空のまま実行しようとするとブロックされ、値を入力すると書き込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // URLのqueryパラメーターで、対象をこのテスト専用レコード1件だけに絞り込んだ状態で
    // 一覧画面を開く(kintoneドキュメントMCP「URL内のクエリで、表示するレコードの条件を
    // 指定する」参照。この絞り込み状態をkintone.app.getQueryCondition()が返す)。
    const url = `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/?query=${encodeURIComponent(scopedQuery)}`;
    await page.goto(url, { waitUntil: 'networkidle0' });

    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bfu-bulk-button'));
      },
      { timeout: 15000 },
    );

    await page.click('.bfu-bulk-button');
    await page.waitForSelector('.bfu-confirm-body', { timeout: 15000 });

    const dialogText = await page.evaluate(
      () => document.querySelector('.bfu-confirm-message').textContent,
    );
    // 現在の絞り込み条件(URLのqueryパラメーターで指定した内容)が表示されている。
    // kintone.app.getQueryCondition()は$id指定のクエリを「レコード番号 = 23」のように
    // 正規化して返す(アプリコード未設定時はレコード番号=レコードIDのため、実環境で確認済み)ため、
    // 元のクエリ文字列との完全一致ではなく、対象レコードIDが含まれることを確認する。
    expect(dialogText).toContain('対象レコード数: 1件');
    expect(dialogText).toContain(`絞り込み条件:`);
    expect(dialogText).toContain(String(recordId));

    // 必須フィールドのラベルに「(必須)」が付く。
    const rowLabels = await page.$$eval('.bfu-value-label', (els) =>
      els.map((el) => el.firstChild.textContent),
    );
    expect(rowLabels.some((l) => l.includes('(必須)'))).toBe(true);

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    // 必須フィールドを空のまま実行しようとすると、ダイアログが閉じずエラーが表示される。
    await clickOk();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.bfu-value-error');
        return el && !el.hidden && el.textContent.length > 0;
      },
      { timeout: 5000 },
    );
    const errorText = await page.$eval(
      '.bfu-value-error',
      (el) => el.textContent,
    );
    expect(errorText).toContain('必須フィールドのため');
    // ダイアログはまだ開いたまま(入力欄が残っている)。
    const stillOpen = await page.evaluate(
      () => !!document.querySelector('.bfu-confirm-body'),
    );
    expect(stillOpen).toBe(true);

    // 両方のフィールドに値を入力してから実行する。行はフィールドコードではなく表示ラベルで
    // 判別する(ダイアログにはフィールドコードを表示していないため)。
    await page.evaluate(
      (targetLabel, requiredLabel, writeValue, requiredValue) => {
        const rows = Array.from(document.querySelectorAll('.bfu-confirm-row'));
        rows.forEach((row) => {
          const labelText =
            row.querySelector('.bfu-value-label').firstChild.textContent;
          const input = row.querySelector('.bfu-value-input');
          if (labelText === targetLabel) {
            input.value = writeValue;
          } else if (labelText.startsWith(requiredLabel)) {
            input.value = requiredValue;
          }
        });
      },
      '文字列 (1行)',
      '一括更新必須テスト',
      WRITE_VALUE,
      REQUIRED_WRITE_VALUE,
    );

    await clickOk();

    // 書き戻し完了後、両フィールドへ書き込んだ値がレコードへ反映されるまで待つ
    // (完了時のalertはbeforeAllで登録したdialogハンドラーが自動acceptする)。
    await page.waitForFunction(
      (
        appId,
        id,
        targetFieldCode,
        requiredFieldCode,
        expectedTargetValue,
        expectedRequiredValue,
      ) =>
        kintone
          .api(kintone.api.url('/k/v1/record.json', true), 'GET', {
            app: appId,
            id,
          })
          .then(
            (res) =>
              res.record[targetFieldCode].value === expectedTargetValue &&
              res.record[requiredFieldCode].value === expectedRequiredValue,
          )
          .catch(() => false),
      { timeout: 30000, polling: 1000 },
      Number(env.TEST_APP_ID_1),
      recordId,
      TARGET_FIELD_CODE,
      REQUIRED_TEST_FIELD_CODE,
      WRITE_VALUE,
      REQUIRED_WRITE_VALUE,
    );

    expect(pageErrors).toEqual([]);
  });
});
