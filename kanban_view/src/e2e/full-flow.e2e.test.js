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
// TEST_APP_ID_1にはcalendar_view(「詳細カレンダープラグイン」)が既に設定されており、
// 同じくkintone.app.getHeaderSpaceElement()へ描画する表示専用プラグインである。
// calendar_viewのconfig.viewConfigsには「すべて(ALL)」向けの設定(=一覧IDを明示指定しない
// 全ビュー共通のフォールバック設定)が保存済みのため、本プラグイン専用のビュー
// (kanban_view_e2e)を開いてもcalendar_viewのapp.record.index.showハンドラーが反応し、
// どちらの描画が最後に完了するかでheaderSpaceの内容が競合する(実機で確認済み。
// ビューを分けるだけでは解決しない: ALL設定は「指定されなかった一覧すべて」に効くフォールバックで
// あり、標準の「すべて」ビューだけに限定されるわけではないため)。
// この競合は「同じ検証環境アプリに複数の同種プラグインを同時装着している」ことによる
// テスト環境固有の問題であり、本プラグイン自体の不具合ではない。beforeAllでcalendar_viewを
// 一時的に取り外し、afterAllで必ず元に戻す(common.removeAppPluginByName参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'kanban_view';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const CALENDAR_VIEW_SRC_DIR = path.join(
  PLUGIN_SRC_DIR,
  '..',
  '..',
  'calendar_view',
  'src',
);
const CALENDAR_VIEW_DISPLAY_NAME = '詳細カレンダープラグイン';

describe('カンバンボードプラグイン(実環境, 一気通貫)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let kanbanViewId;
  let calendarViewPluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    calendarViewPluginId = common.getPluginId(CALENDAR_VIEW_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await fixtures.ensureSeedRecords(env, env.TEST_APP_ID_1);
    kanbanViewId = await fixtures.ensureKanbanView(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);

    await common.removeAppPluginByName(
      page,
      env,
      env.TEST_APP_ID_1,
      CALENDAR_VIEW_DISPLAY_NAME,
    );
  });

  afterAll(async () => {
    // 取り外したcalendar_viewを必ず元に戻す(テストの成否によらず)。設定内容(viewConfigs)は
    // 取り外し時に失われるが、calendar_view自身のe2eテストが再実行時に作り直す設計のため問題ない。
    await kintoneAdmin.ensurePluginAdded(
      env,
      env.TEST_APP_ID_1,
      calendarViewPluginId,
    );
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面: 一覧を追加して各項目を設定・保存でき、再読み込み後も内容が保持される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('カンバンボードプラグイン');

    // 専用一覧(kanban_view_e2e)向けの設定ブロックを探す(無ければ追加する)。
    // テスト再実行時に既に他の一覧向けの設定が残っていても、目的のブロックを取り違えないよう
    // タイトルの一覧IDで特定する(「すべて」を対象にすると、同じ一覧を対象にした
    // 他プラグインと描画が競合するため、本プラグインの一覧は専用IDを使う)。
    const findKanbanBlockIndex = async () => {
      const titles = await page.$$eval('.js-view-title', (els) =>
        els.map((el) => el.textContent),
      );
      return titles.findIndex((t) => t.includes(String(kanbanViewId)));
    };

    let blockIndex = await findKanbanBlockIndex();
    if (blockIndex === -1) {
      await page.type('.js-view-id-input', String(kanbanViewId));
      await page.click('#js-view-add');
      blockIndex = await findKanbanBlockIndex();
    }
    expect(blockIndex).toBeGreaterThanOrEqual(0);
    const block = (await page.$$('.js-view-config-block'))[blockIndex];

    // タイトルフィールドの選択肢はSUBTABLE以外の全フィールド(config.js冒頭のallFieldsの絞り込みが
    // 実際に効いているかの回帰確認)。テーブル(SUBTABLE)は含まれない。
    const titleOptionValues = await block.$$eval(
      '.js-title-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(titleOptionValues).toContain(fixtures.TITLE_FIELD_CODE);
    expect(titleOptionValues).not.toContain('テーブル');

    // グループ分けフィールドの選択肢はRADIO_BUTTON/DROP_DOWNのみ(ユーザー選択は含まれない)。
    const groupOptionValues = await block.$$eval(
      '.js-group-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(groupOptionValues).toContain(fixtures.GROUP_FIELD_CODE);
    expect(groupOptionValues).not.toContain(fixtures.ASSIGNEE_FIELD_CODE);

    // 担当者フィールドの選択肢はUSER_SELECTのみ(ドロップダウンは含まれない)。
    const assigneeOptionValues = await block.$$eval(
      '.js-assignee-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(assigneeOptionValues).toContain(fixtures.ASSIGNEE_FIELD_CODE);
    expect(assigneeOptionValues).not.toContain(fixtures.GROUP_FIELD_CODE);

    // 期限フィールドの選択肢はDATE/DATETIMEのみ。
    const dueOptionValues = await block.$$eval(
      '.js-due-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(dueOptionValues).toContain(fixtures.DUE_FIELD_CODE);
    expect(dueOptionValues).not.toContain(fixtures.TITLE_FIELD_CODE);

    // プロセス管理が有効なTEST_APP_ID_1では、STATUS/STATUS_ASSIGNEEのラジオが選択可能(非活性ではない)。
    expect(
      await block.$eval('.js-group-mode[value="STATUS"]', (el) => el.disabled),
    ).toBe(false);
    expect(
      await block.$eval(
        '.js-assignee-mode[value="STATUS_ASSIGNEE"]',
        (el) => el.disabled,
      ),
    ).toBe(false);

    await block.$eval(
      '.js-title-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.TITLE_FIELD_CODE,
    );
    await (await block.$('.js-group-mode[value="FIELD"]')).click();
    await block.$eval(
      '.js-group-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.GROUP_FIELD_CODE,
    );
    await (await block.$('.js-assignee-mode[value="USER_FIELD"]')).click();
    await block.$eval(
      '.js-assignee-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.ASSIGNEE_FIELD_CODE,
    );
    await block.$eval(
      '.js-due-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.DUE_FIELD_CODE,
    );
    await block.$eval(
      '.js-badge-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      fixtures.BADGE_FIELD_CODE,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定はデプロイするまでレコード一覧画面等には反映されない(既知の挙動)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedBlockIndex = await findKanbanBlockIndex();
    expect(reloadedBlockIndex).toBeGreaterThanOrEqual(0);
    const reloadedBlock = (await page.$$('.js-view-config-block'))[
      reloadedBlockIndex
    ];
    expect(await reloadedBlock.$eval('.js-title-field', (el) => el.value)).toBe(
      fixtures.TITLE_FIELD_CODE,
    );
    expect(
      await reloadedBlock.$eval(
        '.js-group-mode[value="FIELD"]',
        (el) => el.checked,
      ),
    ).toBe(true);
    expect(await reloadedBlock.$eval('.js-group-field', (el) => el.value)).toBe(
      fixtures.GROUP_FIELD_CODE,
    );
    expect(
      await reloadedBlock.$eval(
        '.js-assignee-mode[value="USER_FIELD"]',
        (el) => el.checked,
      ),
    ).toBe(true);
    expect(
      await reloadedBlock.$eval('.js-assignee-field', (el) => el.value),
    ).toBe(fixtures.ASSIGNEE_FIELD_CODE);
    expect(await reloadedBlock.$eval('.js-due-field', (el) => el.value)).toBe(
      fixtures.DUE_FIELD_CODE,
    );
    expect(await reloadedBlock.$eval('.js-badge-field', (el) => el.value)).toBe(
      fixtures.BADGE_FIELD_CODE,
    );

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('レコード一覧画面: カンバンボードが表示され、列・カード・期限超過マークが描画される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 専用一覧(kanban_view_e2e)は、作成時点でシードレコードのタイトルのみに絞り込む
    // filterCondを設定済み(fixtures.ensureKanbanView()参照)なので、view=で開くだけでよい。
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/?view=${kanbanViewId}`,
      {
        waitUntil: 'networkidle0',
      },
    );

    await page.waitForSelector('.kb-root', { timeout: 15000 });

    // グループ列見出し(sample1/sample2)が描画されている(グループ分けフィールドの反映確認)。
    const columnLabels = await page.$$eval('.kb-column-label', (els) =>
      els.map((el) => el.textContent),
    );
    expect(columnLabels).toEqual(
      expect.arrayContaining(['sample1', 'sample2']),
    );

    // シードレコードのカードが実際にタイトル付きで描画されている。
    const cardTitles = await page.$$eval('.kb-card-title', (els) =>
      els.map((el) => el.textContent),
    );
    expect(cardTitles).toEqual(
      expect.arrayContaining(['カンバンE2E-A(超過)', 'カンバンE2E-B(未超過)']),
    );

    // バッジフィールド(ラジオボタン)の値がカードに表示されている。
    const badgeTexts = await page.$$eval('.kb-badge', (els) =>
      els.map((el) => el.textContent),
    );
    expect(badgeTexts).toEqual(expect.arrayContaining(['sample1', 'sample2']));

    // 期限超過(過去日付)のカードにのみ🔥マークが付く。
    const overdueTexts = await page.$$eval('.kb-due-overdue', (els) =>
      els.map((el) => el.textContent),
    );
    expect(overdueTexts.some((t) => t.startsWith('🔥'))).toBe(true);
    const nonOverdueTexts = await page.$$eval(
      '.kb-due:not(.kb-due-overdue)',
      (els) => els.map((el) => el.textContent),
    );
    expect(nonOverdueTexts.some((t) => t.startsWith('🔥'))).toBe(false);

    // 担当者チップ(ユーザー選択フィールドの先頭の1人)が表示されている。
    const assigneeTexts = await page.$$eval('.kb-assignee', (els) =>
      els.map((el) => el.textContent),
    );
    expect(assigneeTexts.length).toBeGreaterThan(0);
    expect(assigneeTexts.every((t) => t.trim() !== '')).toBe(true);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'kanban-board');

    expect(pageErrors).toEqual([]);
  });
});
