'use strict';

// 設定の保存(指摘履歴テーブルの自動作成)から、詳細画面での指摘登録 → バツマーク表示 →
// 解決登録 → チェックマーク表示 → 履歴閲覧 → 編集画面での表示・編集不可、までを実環境で通しで検証する。
//
// テスト用レコードはこのテスト自身がREST APIで1件作成し、afterAllでそのIDだけを削除する
// (TEST_APP_ID_2は他プラグインのE2Eと共用のため、他のレコードには触らない)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'record_review';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TABLE_CODE = 'review_comment_table';
const TARGET_FIELD = '文字列__1行_';
const SECOND_FIELD = '数値';
const COMMENT = '正式名称(株式会社〇〇)で記載してください';
const RESOLUTION = '登記簿どおりの正式名称に修正しました';

describe('指摘の登録と解決(実環境)', () => {
  let browser;
  let page;
  let env;
  let repoRoot;
  let pluginId;
  let recordId;
  const pageErrors = [];

  const detailUrl = () =>
    `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_2}/show#record=${recordId}`;

  const getTableRows = async () => {
    const resp = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: env.TEST_APP_ID_2,
      id: recordId,
    });
    return resp.record[TABLE_CODE].value;
  };

  const openDetail = async () => {
    await page.goto(detailUrl(), { waitUntil: 'networkidle0' });
    await page.waitForSelector('.rr-toolbar', { timeout: 20000 });
  };

  // 保存成功時、desktop.jsはlocation.reload()する。リロード後のツールバー描画まで待つ。
  const clickAndWaitReload = async (selector) => {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.$eval(selector, (el) => el.click()),
    ]);
    await page.waitForSelector('.rr-toolbar', { timeout: 20000 });
  };

  const badgeSelector = (code, state) =>
    `.rr-badge-wrap[data-field-code="${code}"] .rr-badge--${state}`;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_2, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await common.login(page, env);

    // 設定画面で保存(テーブルが無ければ自動作成)→ プラグイン設定を運用環境へ反映する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_2, pluginId);
    await page.waitForSelector('.js-target-checkbox', { timeout: 15000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }),
      page.$eval('.js-save-button', (el) => el.click()),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_2);

    const resp = await kintoneAdmin.addRecords(env, env.TEST_APP_ID_2, [
      {
        [TARGET_FIELD]: { value: '〇〇' },
        [SECOND_FIELD]: { value: '1000' },
        ラジオボタン: { value: 'sample1' },
      },
    ]);
    recordId = resp.ids[0];
  }, 180000);

  afterAll(async () => {
    if (recordId) {
      await kintoneAdmin.deleteRecords(env, env.TEST_APP_ID_2, [recordId]);
    }
    if (browser) {
      await browser.close();
    }
  });

  test('保存により指摘履歴テーブル(9つの内包フィールド)が作成される', async () => {
    const fields = await kintoneAdmin.getFormFields(env, env.TEST_APP_ID_2);
    const table = fields[TABLE_CODE];
    expect(table.type).toBe('SUBTABLE');
    expect(table.fields.rr_target_code.type).toBe('SINGLE_LINE_TEXT');
    expect(table.fields.rr_target_label.type).toBe('SINGLE_LINE_TEXT');
    expect(table.fields.rr_pointed_at.type).toBe('DATETIME');
    expect(table.fields.rr_pointed_by.type).toBe('USER_SELECT');
    expect(table.fields.rr_comment.type).toBe('MULTI_LINE_TEXT');
    expect(table.fields.rr_status.type).toBe('DROP_DOWN');
    expect(table.fields.rr_resolution.type).toBe('MULTI_LINE_TEXT');
    expect(table.fields.rr_resolved_by.type).toBe('USER_SELECT');
    expect(table.fields.rr_resolved_at.type).toBe('DATETIME');
  });

  test('指摘モードで「＋」から指摘を登録すると、赤いバツマークと赤枠が付く', async () => {
    await openDetail();
    const summary = await page.$eval('.rr-summary', (el) => el.textContent);
    expect(summary).toContain('指摘はありません');

    // 指摘モードOFFの状態に揃えてからONにする(localStorageに前回の状態が残っている場合に備える)。
    const pressed = await page.$eval('.js-rr-mode', (el) => el.getAttribute('aria-pressed'));
    if (pressed !== 'true') {
      await page.$eval('.js-rr-mode', (el) => el.click());
    }
    await page.waitForSelector(badgeSelector(TARGET_FIELD, 'none'));
    await page.$eval(badgeSelector(TARGET_FIELD, 'none'), (el) => el.click());
    await page.waitForSelector('.rr-modal .js-rr-comment');
    const title = await page.$eval('.rr-modal-title', (el) => el.textContent);
    expect(title).toContain('文字列 (1行)');

    await page.type('.rr-modal .js-rr-comment', COMMENT);
    await clickAndWaitReload('.rr-modal .js-rr-add');

    await page.waitForSelector(badgeSelector(TARGET_FIELD, 'unresolved'));
    const badgeText = await page.$eval(badgeSelector(TARGET_FIELD, 'unresolved'), (el) =>
      el.textContent,
    );
    expect(badgeText).toBe('✕ 1');
    const tipText = await page.$eval(
      `.rr-badge-wrap[data-field-code="${TARGET_FIELD}"] .rr-tip`,
      (el) => el.textContent,
    );
    expect(tipText).toContain(COMMENT);
    const outline = await page.evaluate(
      (code) => kintone.app.record.getFieldElement(code).style.outline,
      TARGET_FIELD,
    );
    expect(outline).toContain('solid');
    const summaryAfter = await page.$eval('.rr-summary', (el) => el.textContent);
    expect(summaryAfter).toContain('未解決の指摘 1件');

    const rows = await getTableRows();
    expect(rows).toHaveLength(1);
    const v = rows[0].value;
    expect(v.rr_target_code.value).toBe(TARGET_FIELD);
    expect(v.rr_target_label.value).toBe('文字列 (1行)');
    expect(v.rr_comment.value).toBe(COMMENT);
    expect(v.rr_status.value).toBe('未解決');
    expect(v.rr_pointed_by.value[0].code).toBe(env.KINTONE_USERNAME);
    expect(v.rr_pointed_at.value).not.toBe('');
    expect(v.rr_resolved_by.value).toEqual([]);
  });

  test('バツマークから解決内容を登録すると、緑のチェックマークに変わる', async () => {
    await page.$eval(badgeSelector(TARGET_FIELD, 'unresolved'), (el) => el.click());
    await page.waitForSelector('.rr-modal .js-rr-resolution');
    const commentInDialog = await page.$eval('.rr-modal .rr-item--unresolved', (el) =>
      el.textContent,
    );
    expect(commentInDialog).toContain(COMMENT);

    // 解決内容が空のままでは登録されない。
    await page.$eval('.rr-modal .js-rr-resolve', (el) => el.click());
    await page.waitForFunction(() => {
      const err = document.querySelector('.rr-modal .rr-resolve-form .rr-error');
      return err && !err.hidden;
    });

    await page.type('.rr-modal .js-rr-resolution', RESOLUTION);
    await clickAndWaitReload('.rr-modal .js-rr-resolve');

    await page.waitForSelector(badgeSelector(TARGET_FIELD, 'resolved'));
    const badgeText = await page.$eval(badgeSelector(TARGET_FIELD, 'resolved'), (el) =>
      el.textContent,
    );
    expect(badgeText).toBe('✓');
    const outline = await page.evaluate(
      (code) => kintone.app.record.getFieldElement(code).style.outline,
      TARGET_FIELD,
    );
    expect(outline).toBe('');
    const summary = await page.$eval('.rr-summary', (el) => el.textContent);
    expect(summary).toContain('すべて解決済み');

    const rows = await getTableRows();
    expect(rows).toHaveLength(1);
    const v = rows[0].value;
    expect(v.rr_status.value).toBe('解決済み');
    expect(v.rr_resolution.value).toBe(RESOLUTION);
    expect(v.rr_resolved_by.value[0].code).toBe(env.KINTONE_USERNAME);
    expect(v.rr_resolved_at.value).not.toBe('');
    // 解決時も指摘側の情報は保持されている(行のフル値PUT)。
    expect(v.rr_comment.value).toBe(COMMENT);
    expect(v.rr_pointed_by.value[0].code).toBe(env.KINTONE_USERNAME);
  });

  test('2件目の指摘を別フィールドに登録し、指摘履歴ダイアログで全件を閲覧できる', async () => {
    await page.waitForSelector(badgeSelector(SECOND_FIELD, 'none'));
    await page.$eval(badgeSelector(SECOND_FIELD, 'none'), (el) => el.click());
    await page.waitForSelector('.rr-modal .js-rr-comment');
    await page.type('.rr-modal .js-rr-comment', '税込金額か税抜金額か明記してください');
    await clickAndWaitReload('.rr-modal .js-rr-add');
    await page.waitForSelector(badgeSelector(SECOND_FIELD, 'unresolved'));
    await page.waitForSelector(badgeSelector(TARGET_FIELD, 'resolved'));

    const rows = await getTableRows();
    expect(rows).toHaveLength(2);
    // 1件目(解決済み)の内容は2件目の追加で失われない(既存行はidのみ送信)。
    expect(rows[0].value.rr_status.value).toBe('解決済み');
    expect(rows[0].value.rr_resolution.value).toBe(RESOLUTION);

    // 公開サイト用: 指摘モードOFFで、バツ・チェックが付いた詳細画面を撮影する。
    await page.$eval('.js-rr-mode', (el) => el.click());
    await page.waitForFunction(() => !document.querySelector('.rr-badge--none'));
    await page.setViewport({ width: 1280, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    // 未解決の指摘内容がツールチップで表示されている状態を撮る。
    await page.hover(badgeSelector(SECOND_FIELD, 'unresolved'));
    await page.screenshot({
      path: path.join(repoRoot, 'site', 'plugins', PLUGIN_NAME, 'screenshots', 'detail-screen.png'),
      clip: { x: 0, y: 0, width: 1280, height: 1000 },
    });

    await page.$eval('.js-rr-history', (el) => el.click());
    await page.waitForSelector('.rr-history-table');
    const historyRows = await page.$$eval('.rr-history-table tbody tr', (trs) =>
      trs.map((tr) => tr.className),
    );
    expect(historyRows).toEqual(['rr-row--resolved', 'rr-row--unresolved']);
    await page.$eval('.js-rr-unresolved-only', (el) => el.click());
    const visible = await page.$$eval('.rr-history-table tbody tr', (trs) =>
      trs.filter((tr) => getComputedStyle(tr).display !== 'none').length,
    );
    expect(visible).toBe(1);
    await page.$eval('.rr-modal-close', (el) => el.click());
    expect(await page.$('.rr-modal')).toBeNull();
  });

  test('編集画面では未解決の指摘が一覧表示され、指摘履歴テーブルは編集不可', async () => {
    await common.goToEditScreenFromDetail(page);
    await page.waitForSelector('.rr-edit-panel', { timeout: 15000 });
    const panelText = await page.$eval('.rr-edit-panel', (el) => el.textContent);
    expect(panelText).toContain('未解決の指摘 1件');
    expect(panelText).toContain('税込金額か税抜金額か');
    expect(panelText).not.toContain(COMMENT);

    const result = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('.subtable-row-label-text-gaia')).find(
        (el) => el.textContent.trim() === '指摘履歴',
      );
      const inputs = label
        ? label.closest('.subtable-row-gaia').querySelectorAll('tbody input, tbody textarea')
        : [];
      return {
        count: inputs.length,
        allDisabled: Array.from(inputs).every((el) => el.disabled === true),
      };
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.allDisabled).toBe(true);

    expect(pageErrors).toEqual([]);
  });
});
