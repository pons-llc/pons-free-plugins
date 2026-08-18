'use strict';

// アプリ間突合プラグインの実環境E2E。
//
// 単体テスト(src/__tests__)では突合ロジックそのものを検証しているので、ここでは
// 「実際のkintone上でしか壊れ方が分からない」ところだけを通しで確認する。
//   - 設定画面から集計用フィールド(突合設定・サブテーブル+添付ファイル・スペース)をAPIで作れるか
//     → サブテーブルの中に添付ファイルフィールドを作れるか、を実地で確かめるのが主目的
//   - レコード詳細画面の「突合設定」に一覧URLを貼ると、アプリIDとフィールド一覧が読めるか
//   - 貼ったURLの絞り込み条件(?query=)が実際に母集団へ効くか
//   - 「突合を実行」でJSONが添付され、履歴テーブルに1行増えるか
//   - 未提出者が画面に「未提出」として出るか
//   - 2回実行しても上書きされず履歴が2行になるか(追記スナップショット方式)

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'cross_app_check';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const {
  CAC_BASE_APP_ID,
  CAC_TARGET_APP_ID,
  CAC_SUMMARY_APP_ID,
  KEY_FIELD,
  NAME_FIELD,
  DATE_FIELD,
  EXPECTED,
} = fixtures;

describe('アプリ間突合プラグイン(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let summaryRecordId;
  const pageErrors = [];
  const consoleErrors = [];

  const listUrl = (appId, query) => {
    const base = `https://${env.KINTONE_DOMAIN}/k/${appId}/`;
    return query ? `${base}?query=${encodeURIComponent(query)}` : base;
  };

  const openSummaryRecord = async () => {
    const url = `https://${env.KINTONE_DOMAIN}/k/${CAC_SUMMARY_APP_ID}/show#record=${summaryRecordId}`;
    // すでに同じURLを開いている場合、page.goto()はハッシュだけの移動とみなされて
    // ページが再読み込みされず、プラグインも再実行されない。必ずreload()する。
    if (page.url() === url) {
      await page.reload({ waitUntil: 'networkidle2' });
    } else {
      await page.goto(url, { waitUntil: 'networkidle2' });
    }
    await page.waitForSelector('.cac-editor', { timeout: 30000 });
  };

  // 「一覧のURLを貼る → 読み込む → フィールドを選ぶ」を1アプリぶん行う。
  // セレクタは説明文と読み込み状況を取り違えないよう、すべて明示的に指定する
  // (どちらも .cac-note を持つため、汎用セレクタだと説明文を掴んでしまう)。
  const fillAppSection = async (parts, url, selections) => {
    await page.evaluate(
      (sel, value) => {
        document.querySelector(sel).value = value;
      },
      parts.url,
      url,
    );
    await page.$eval(parts.load, (el) => el.click());
    await page.waitForFunction(
      (selector) =>
        document.querySelector(selector).textContent.includes('読み込みました'),
      { timeout: 30000 },
      parts.status,
    );
    for (const [selector, value] of Object.entries(selections)) {
      await page.select(selector, value);
    }
  };

  const BASE_PARTS = {
    url: '.cac-base-url',
    load: '.cac-base-load',
    status: '.cac-base-status',
  };
  const TARGET_PARTS = {
    url: '.cac-target-url',
    load: '.cac-target-load',
    status: '.cac-target-status',
  };

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);

    await fixtures.ensureBaseAppFields(env);
    await fixtures.ensureTargetAppFields(env);
    await fixtures.resetRecords(env);
    await kintoneAdmin.ensurePluginAdded(env, CAC_SUMMARY_APP_ID, pluginId);
    summaryRecordId = await fixtures.resetSummaryRecord(env);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // 既定の800px幅だと設定画面の右側が見切れて公開サイト用のスクリーンショットに使えない
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // レコード詳細画面は下方向に余白が長く続くため、ページ全体ではなく
  // 「実際に中身がある範囲」だけを切り出して公開サイト用のスクリーンショットにする。
  const screenshotRegion = async (label, selector) => {
    const bottom = await page.evaluate((sel) => {
      const node = document.querySelector(sel);
      return Math.ceil(node.getBoundingClientRect().bottom + window.scrollY);
    }, selector);
    const dir = path.join(
      repoRoot,
      'site',
      'plugins',
      PLUGIN_NAME,
      'screenshots',
    );
    await page.setViewport({ width: 1280, height: bottom + 24 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(dir, `${label}.png`) });
    await page.setViewport({ width: 1280, height: 900 });
  };

  test('設定画面で集計用フィールドを作成できる', async () => {
    await common.openPluginConfig(page, env, CAC_SUMMARY_APP_ID, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('アプリ間突合プラグイン');

    await page.waitForFunction(
      () =>
        !document
          .querySelector('.js-schema-status')
          .textContent.includes('確認中'),
      { timeout: 30000 },
    );

    // 「集計用フィールドを作成」は確認ダイアログを出すので自動で承諾する
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    const alreadyCreated = await page.$eval(
      '.js-schema-create',
      (el) => el.disabled,
    );
    if (!alreadyCreated) {
      await page.click('.js-schema-create');
      await page.waitForFunction(
        () =>
          document
            .querySelector('.js-schema-status')
            .textContent.includes('作成済み'),
        { timeout: 120000 },
      );
    }

    const properties = await kintoneAdmin.getFormFields(
      env,
      CAC_SUMMARY_APP_ID,
    );
    // 突合設定をレコード単位で持つためのJSON欄
    expect(properties.cac_definition.type).toBe('MULTI_LINE_TEXT');
    // サブテーブルの中に添付ファイルフィールドが実際に作られたことをAPIで確認する
    expect(properties.cac_runs.type).toBe('SUBTABLE');
    expect(properties.cac_runs.fields.cac_run_file.type).toBe('FILE');

    const { layout } = await kintoneAdmin.getFormLayout(
      env,
      CAC_SUMMARY_APP_ID,
    );
    expect(JSON.stringify(layout)).toContain('cac_view');

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
    await common.savePluginConfig(page);
    // setConfig()は動作テスト環境にしか反映されないため、詳細画面から読めるようデプロイする
    await kintoneAdmin.deployApp(env, CAC_SUMMARY_APP_ID);
  });

  test('レコード詳細画面で、一覧URLを貼り付けて突合設定を保存できる', async () => {
    await openSummaryRecord();

    // まだ未設定なので、設定エディタは開いた状態で出て案内が出ている
    expect(await page.$eval('.cac-editor-body', (el) => el.hidden)).toBe(false);
    const initialMessage = await page.$eval(
      '.cac-message',
      (el) => el.textContent,
    );
    expect(initialMessage).toContain('突合設定');

    // 基準アプリ: 素の一覧URL(絞り込みなし)
    await fillAppSection(BASE_PARTS, listUrl(CAC_BASE_APP_ID), {
      '.cac-base-key': KEY_FIELD,
      '.cac-base-name': NAME_FIELD,
    });
    // URLから読み取ったアプリ名が画面に出る
    const baseStatus = await page.$eval(
      '.cac-base-status',
      (el) => el.textContent,
    );
    expect(baseStatus).toContain('妊娠届');

    // 対象アプリ: 同じく一覧URL
    await fillAppSection(TARGET_PARTS, listUrl(CAC_TARGET_APP_ID), {
      '.cac-target-key': KEY_FIELD,
      '.cac-target-date': DATE_FIELD,
    });
    await page.evaluate(() => {
      const el = document.querySelector('.cac-target-label');
      el.value = '面談';
      el.dispatchEvent(new Event('input'));
    });

    await screenshotRegion('definition-editor', '.cac-editor');

    await page.$eval('.cac-editor-save', (el) => el.click());
    await page.waitForFunction(
      () =>
        document
          .querySelector('.cac-editor-status')
          .textContent.includes('保存しました'),
      { timeout: 30000 },
    );

    // 設定はプラグイン設定ではなくレコードのフィールドに入る
    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: CAC_SUMMARY_APP_ID,
      id: summaryRecordId,
    });
    const definition = JSON.parse(record.record.cac_definition.value);
    expect(definition.baseApp.appId).toBe(String(CAC_BASE_APP_ID));
    expect(definition.baseApp.keyFieldCode).toBe(KEY_FIELD);
    expect(definition.baseApp.keyFieldType).toBe('SINGLE_LINE_TEXT');
    expect(definition.targets).toHaveLength(1);
    expect(definition.targets[0].appId).toBe(String(CAC_TARGET_APP_ID));
    expect(definition.targets[0].label).toBe('面談');
  });

  test('突合を実行すると、履歴が1行増えて未提出者が表示される', async () => {
    await openSummaryRecord();
    await page.waitForSelector('#cac-run-button', { timeout: 30000 });
    await page.click('#cac-run-button');
    await page.waitForSelector('.cac-table', { timeout: 120000 });

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: CAC_SUMMARY_APP_ID,
      id: summaryRecordId,
    });
    const rows = record.record.cac_runs.value;
    expect(rows).toHaveLength(1);
    expect(rows[0].value.cac_run_file.value).toHaveLength(1);
    expect(rows[0].value.cac_run_file.value[0].name).toMatch(/\.json$/);
    expect(rows[0].value.cac_run_summary.value).toBe(
      `対象${EXPECTED.baseCount}件 / 未提出${EXPECTED.unsubmitted}件`,
    );

    const summaryText = await page.$eval(
      '.cac-summary',
      (el) => el.textContent,
    );
    expect(summaryText).toContain(`対象者 ${EXPECTED.baseCount} 件`);
    expect(summaryText).toContain(`いずれか未提出 ${EXPECTED.unsubmitted} 件`);
    expect(summaryText).toContain(
      `面談: 提出済 ${EXPECTED.submitted} / 未提出 ${EXPECTED.unsubmitted}`,
    );

    const tableRows = await page.$$eval('.cac-tr', (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('.cac-td')).map((td) =>
          td.textContent.trim(),
        ),
      ),
    );
    expect(tableRows).toHaveLength(EXPECTED.baseCount);

    const byName = {};
    tableRows.forEach((cells) => {
      byName[cells[1]] = cells;
    });
    EXPECTED.unsubmittedNames.forEach((name) => {
      expect(byName[name][2]).toBe('未提出');
    });
    EXPECTED.submittedNames.forEach((name) => {
      expect(byName[name][2]).toContain('提出済');
    });
    // 同じキーで2件出している人は件数付きで、最終提出日が最新の日付になる
    expect(byName['山田花子'][2]).toBe('提出済(2件)');
    expect(byName['山田花子'][3]).toBe(EXPECTED.lastDateOfA001);

    // 対象アプリにしか居ない X-999 は母集団(基準アプリ)に居ないので行にならない
    expect(tableRows.map((cells) => cells[0])).not.toContain('X-999');

    const doneMessage = await page.$eval(
      '.cac-message',
      (el) => el.textContent,
    );
    expect(doneMessage).toContain('突合を実行しました');
    expect(doneMessage).toContain('再読み込み');

    // 公開サイト用のスクリーンショットは、履歴テーブルにも行が入った状態で撮る
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.cac-table', { timeout: 60000 });
    await screenshotRegion('result-view', '.cac-view');
  });

  test('「未提出のみ表示」で未提出者だけに絞り込める', async () => {
    // page.click()はkintoneの固定ヘッダー/フッターに遮られて空振りすることがあるため、
    // 既存プラグインのE2Eと同じくDOMのclick()を直接呼ぶ
    await page.$eval('.cac-unsubmitted-only', (el) => el.click());
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.cac-tr').length === expected,
      { timeout: 10000 },
      EXPECTED.unsubmitted,
    );

    const names = await page.$$eval('.cac-tr', (trs) =>
      trs.map((tr) => tr.querySelectorAll('.cac-td')[1].textContent.trim()),
    );
    expect(names.sort()).toEqual(EXPECTED.unsubmittedNames.slice().sort());

    await page.$eval('.cac-unsubmitted-only', (el) => el.click());
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.cac-tr').length === expected,
      { timeout: 10000 },
      EXPECTED.baseCount,
    );
  });

  test('もう一度実行すると上書きされず履歴が2行になる(追記スナップショット)', async () => {
    await page.click('#cac-run-button');
    await page.waitForFunction(
      () => document.querySelectorAll('.cac-run-select option').length === 2,
      { timeout: 120000 },
    );

    const record = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: CAC_SUMMARY_APP_ID,
      id: summaryRecordId,
    });
    const rows = record.record.cac_runs.value;
    expect(rows).toHaveLength(2);
    // 1回目の結果ファイルが消えていないこと
    expect(rows[0].value.cac_run_file.value).toHaveLength(1);
    expect(rows[1].value.cac_run_file.value).toHaveLength(1);
    expect(rows[0].value.cac_run_id.value).not.toBe(
      rows[1].value.cac_run_id.value,
    );
  });

  test('ドロップダウンで過去の実行結果に切り替えられる', async () => {
    const options = await page.$$eval('.cac-run-select option', (opts) =>
      opts.map((opt) => opt.value),
    );
    expect(options).toHaveLength(2);

    await page.select('.cac-run-select', options[1]);
    await page.waitForSelector('.cac-table', { timeout: 30000 });
    expect(await page.$$eval('.cac-tr', (trs) => trs.length)).toBe(
      EXPECTED.baseCount,
    );
  });

  test('貼り付けたURLの絞り込み条件(?query=)が母集団に効く', async () => {
    await openSummaryRecord();
    await page.$eval('.cac-editor-toggle', (el) => el.click());

    // 基準アプリを「A-001とA-002だけ」に絞ったURLで貼り直す
    const filtered = listUrl(
      CAC_BASE_APP_ID,
      `${KEY_FIELD} in ("A-001", "A-002")`,
    );
    await fillAppSection(BASE_PARTS, filtered, {
      '.cac-base-key': KEY_FIELD,
      '.cac-base-name': NAME_FIELD,
    });
    // 対象アプリも貼り直して、このテストだけでも成立するようにしておく
    // (直前のテストが保存した設定に依存させない)
    await fillAppSection(TARGET_PARTS, listUrl(CAC_TARGET_APP_ID), {
      '.cac-target-key': KEY_FIELD,
      '.cac-target-date': DATE_FIELD,
    });

    // 抽出された条件が画面に表示される
    const queryNote = await page.$eval(
      '.cac-base-query',
      (el) => el.textContent,
    );
    expect(queryNote).toContain('A-001');
    expect(queryNote).toContain('A-002');

    await page.$eval('.cac-editor-save', (el) => el.click());
    await page.waitForFunction(
      () =>
        document
          .querySelector('.cac-editor-status')
          .textContent.includes('保存しました'),
      { timeout: 30000 },
    );

    const runsBefore = await page.$$eval(
      '.cac-run-select option',
      (opts) => opts.filter((opt) => opt.value !== '').length,
    );
    await page.click('#cac-run-button');
    await page.waitForFunction(
      (expected) =>
        document.querySelectorAll('.cac-run-select option').length === expected,
      { timeout: 120000 },
      runsBefore + 1,
    );
    await page.waitForSelector('.cac-table', { timeout: 30000 });

    // 母集団が2件に絞られている(A-003・A-004は対象外)
    const tableRows = await page.$$eval('.cac-tr', (trs) =>
      trs.map((tr) => tr.querySelectorAll('.cac-td')[0].textContent.trim()),
    );
    expect(tableRows.sort()).toEqual(['A-001', 'A-002']);

    const summaryText = await page.$eval(
      '.cac-summary',
      (el) => el.textContent,
    );
    expect(summaryText).toContain('対象者 2 件');
  });

  test('コンソールエラーが出ていない', () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
