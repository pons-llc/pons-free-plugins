'use strict';

// 一覧の作成・修正・削除の依頼から、「承認する」(→完了)で対象アプリへ反映されるまでを実環境で確認する。
//
// 一覧画面のURLは、実際にkintoneの「絞り込む」ダイアログで条件(金額 = 15)と並び順(金額 降順)を
// 指定して得る(条件が内部のフィールドIDで表現されるURLを、プラグインがフィールドコードに変換できることを
// 確認するため)。ダイアログの項目選択はコンボボックスに入力してEnterで選ぶ(実環境で確認、2026-10-21)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const ChangeRequest = require('../js/lib/change-request.js');
const { makeFlowHelpers } = require('./flow-helpers');
const {
  REQUEST_APP_ID,
  TARGET_APP_ID,
  VIEW_NAME_PREFIX,
  resetTargetApp,
  ensureRequestApp,
  cleanupTargetViews,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

let browser;
let page;
let env;
const pageErrors = [];

const { createPendingRequest, openDetail, approve, waitForStatus } =
  makeFlowHelpers({ getPage: () => page, getEnv: () => env });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getLiveViews = async () =>
  (
    await kintoneAdmin.request(env, '/k/v1/app/views.json', 'GET', {
      app: TARGET_APP_ID,
    })
  ).views;

const findView = (views, name) =>
  Object.values(views).find((v) => v.name === name);

const mouseClick = async (handle) => {
  const box = await handle.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

// 変更対象アプリの一覧画面で「金額 = 15、金額 降順」に絞り込み、アドレスバーのURLを返す。
const filteredListUrl = async () => {
  await page.goto(`https://${env.KINTONE_DOMAIN}/k/${TARGET_APP_ID}/`, {
    waitUntil: 'networkidle0',
  });
  await mouseClick(await page.$('button.gaia-argoui-app-filterbutton'));
  await sleep(1500);
  const pick = async (index, label) => {
    const combos = await page.$$(
      '.gaia-argoui-app-filter-dialog .gaia-ui-fieldselect-combobox input',
    );
    const combo = index === -1 ? combos[combos.length - 1] : combos[index];
    await combo.click({ clickCount: 3 });
    await combo.type(label);
    await sleep(800);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(800);
  };
  await pick(0, '金額');
  const valueInput = await page.$(
    '.gaia-argoui-app-filter-dialog .filter-item-input-gaia input[type="text"]',
  );
  await valueInput.type('15');
  await pick(-1, '金額');
  const apply = await page.evaluateHandle(() =>
    Array.from(
      document.querySelectorAll('.gaia-argoui-app-filter-dialog button'),
    ).find((b) => b.innerText.trim() === '適用'),
  );
  await mouseClick(apply.asElement());
  await page.waitForFunction(() => location.search.includes('q='), {
    timeout: 15000,
  });
  return page.url();
};

describe('一覧の作成・修正・削除の依頼(実環境)', () => {
  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, REQUEST_APP_ID, pluginId);
    await ensureRequestApp(env, env.KINTONE_USERNAME);
    await resetTargetApp(env);
    await cleanupTargetViews(env);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await common.login(page, env);
  }, 240000);

  afterAll(async () => {
    if (env) {
      await cleanupTargetViews(env);
    }
    if (browser) {
      await browser.close();
    }
  }, 120000);

  const viewName = `${VIEW_NAME_PREFIX}${Date.now()}`;

  test('作成: 一覧画面のURLを変換し、承認で一覧が作成される', async () => {
    const url = await filteredListUrl();
    // 条件は内部のフィールドID(f+数字)で表現されている
    expect(decodeURIComponent(url)).toMatch(/q=f[0-9]+ = "15"/);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${REQUEST_APP_ID}/edit`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.asr-editor');
    await page.type('.asr-js-app-id', TARGET_APP_ID);
    await page.$eval('.asr-js-load-id', (el) => el.click());
    await page.waitForSelector('.asr-js-field option[value="title"]', {
      timeout: 30000,
    });
    await page.$eval('input.asr-js-target-kind[value="view"]', (el) =>
      el.click(),
    );
    await page.waitForSelector('.asr-view-editor[data-loaded="1"]');
    await page.select('.asr-js-view-op', 'viewCreate');
    await page.type('.asr-js-view-name', viewName);
    await page.type('.asr-js-view-url', url);
    await page.$eval('.asr-js-view-convert', (el) => el.click());
    await page.waitForSelector('.asr-converted', { timeout: 40000 });
    const converted = await page.$eval('.asr-converted', (el) => el.innerText);
    expect(converted).toContain('絞り込み条件: amount = "15"');
    expect(converted).toContain('並び順: amount desc');

    await Promise.all([
      page.waitForFunction(() => location.href.includes('/show'), {
        timeout: 60000,
      }),
      page.$eval('.gaia-ui-actionmenu-save', (el) => el.click()),
    ]);
    const id = new URL(page.url()).hash.match(/record=(\d+)/)[1];
    await page.waitForSelector('.asr-detail');
    const detail = await page.$eval('.asr-detail', (el) => el.innerText);
    expect(detail).toContain(`新しい一覧「${viewName}」`);
    expect(detail).toContain('一覧の作成');

    await kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', {
      app: REQUEST_APP_ID,
      id,
      action: '申請する',
    });
    await openDetail(id);
    const dialogText = await approve();
    expect(dialogText).toContain('amount = "15"');
    await waitForStatus(id, '完了');

    const created = findView(await getLiveViews(), viewName);
    expect(created).toMatchObject({
      type: 'LIST',
      filterCond: 'amount = "15"',
      sort: 'amount desc',
    });
    expect(created.fields.length).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  }, 300000);

  test('修正: 一覧名・条件・並び順を変更できる(表示フィールドは変えない)', async () => {
    const view = findView(await getLiveViews(), viewName);
    const newName = `${viewName}改`;
    const id = await createPendingRequest(
      ChangeRequest.buildChange({
        app: { id: TARGET_APP_ID, name: '[e2e] 変更対象', guestSpaceId: '' },
        view: { id: view.id, name: view.name },
        operation: 'viewUpdate',
        before: {
          name: view.name,
          filterCond: view.filterCond,
          sort: view.sort,
        },
        after: {
          name: newName,
          filterCond: 'kind in ("B")',
          sort: 'レコード番号 asc',
          sourceUrl: `/k/${TARGET_APP_ID}/?query=kind%20in%20(%22B%22)`,
        },
      }),
    );
    await openDetail(id);
    await approve();
    await waitForStatus(id, '完了');
    const updated = (await getLiveViews())[newName];
    expect(updated).toMatchObject({
      id: view.id,
      filterCond: 'kind in ("B")',
      sort: 'レコード番号 asc',
      fields: view.fields,
    });
    expect(pageErrors).toEqual([]);
  }, 300000);

  test('削除: 一覧が削除される', async () => {
    const view = findView(await getLiveViews(), `${viewName}改`);
    const id = await createPendingRequest(
      ChangeRequest.buildChange({
        app: { id: TARGET_APP_ID, name: '[e2e] 変更対象', guestSpaceId: '' },
        view: { id: view.id, name: view.name },
        operation: 'viewDelete',
        before: {
          name: view.name,
          filterCond: view.filterCond,
          sort: view.sort,
        },
        after: null,
      }),
    );
    await openDetail(id);
    await approve();
    await waitForStatus(id, '完了');
    expect(findView(await getLiveViews(), view.name)).toBeUndefined();
    expect(pageErrors).toEqual([]);
  }, 300000);
});
