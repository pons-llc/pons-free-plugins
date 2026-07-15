'use strict';

// 設定の保存(サブテーブル自動作成を含む)と、実際のレコード画面での反映を検証するPuppeteerテスト。
// config-screen.e2e.test.jsが画面の疎通を見るのに対し、こちらは「保存によって決裁履歴テーブルが
// 実際に作成されるか」「作成されたテーブルがレコード作成画面で編集不可(disabled)になるか」という
// 機能面を検証する。
//
// プロセス管理のアクション実行(ステータス変更ボタン押下)自体は、検証環境アプリ側にプロセス管理・
// アクションが設定されている前提が必要で、TEST_APP_ID_1にその前提が整っているとは限らないため、
// このE2Eの必須シナリオには含めない(idea.md「TDD」参照)。実際のプロセスアクション実行時の
// 行追記は目視確認、またはプロセス管理を設定した別アプリでの確認に委ねる。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TABLE_CODE = 'approval_history_table';

describe('設定の保存とレコードへの反映(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 既に決裁履歴テーブルが作成済み(再実行時)なら保存自体をスキップする(冪等)。
    const fields = await kintoneAdmin.getFormFields(env, env.TEST_APP_ID_1);
    if (!fields[TABLE_CODE] || fields[TABLE_CODE].type !== 'SUBTABLE') {
      await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

      // 保存処理はREST APIでのフィールド追加・デプロイのポーリングを含むため時間がかかる。
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
        page.click('.js-save-button'),
      ]);

      // kintone.plugin.app.setConfig()自体は動作テスト環境相当にしか反映されないため、
      // レコード画面(create/edit)に反映するには明示的なデプロイが必要
      // (org_lookupのrecord-lookup.e2e.test.jsと同じ理由。フィールド追加自体はjs/config.jsが
      // 保存時に自らデプロイ済みだが、プラグイン設定の反映は別途必要)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('保存により決裁履歴テーブル(5つの内包フィールド)が実際に作成される', async () => {
    const fields = await kintoneAdmin.getFormFields(env, env.TEST_APP_ID_1);
    expect(fields[TABLE_CODE]).toBeDefined();
    expect(fields[TABLE_CODE].type).toBe('SUBTABLE');

    const innerFields = fields[TABLE_CODE].fields;
    expect(innerFields.status_before.type).toBe('SINGLE_LINE_TEXT');
    expect(innerFields.status_after.type).toBe('SINGLE_LINE_TEXT');
    expect(innerFields.executed_by.type).toBe('USER_SELECT');
    expect(innerFields.executed_by_title.type).toBe('SINGLE_LINE_TEXT');
    expect(innerFields.executed_at.type).toBe('DATETIME');
  });

  test('作成されたテーブルはレコード作成画面で編集不可(disabled)になる', async () => {
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

    const disabled = await page.evaluate((code) => {
      const record = kintone.app.record.get().record;
      return record[code] ? record[code].disabled : undefined;
    }, TABLE_CODE);
    expect(disabled).toBe(true);

    expect(pageErrors).toEqual([]);
  });
});
