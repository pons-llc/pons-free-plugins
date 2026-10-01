'use strict';

// 設定の保存(指摘履歴テーブルの自動作成、またはv1テーブルへの「対象行ID」列の追加)から、詳細画面での
// まとめて指摘(フィールド2件+テーブルの行1件を下書き→1回で登録)→ バツマーク表示 → 解決登録 →
// チェックマーク表示 → 履歴閲覧 → 編集画面での表示・編集不可、までを実環境で通しで検証する。
//
// テスト用レコードはこのテスト自身がREST APIで1件作成し、afterAllでそのIDだけを削除する
// (TEST_APP_ID_2は他プラグインのE2Eと共用のため、他のレコードには触らない)。
// 行単位の指摘の検証用に、TEST_APP_ID_2に無いテーブル(ITEMS_TABLE)だけはensureFormFields()で冪等に追加する。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'record_review';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TABLE_CODE = 'review_comment_table';
const TARGET_FIELD = '文字列__1行_';
const SECOND_FIELD = '数値';
const ITEMS_TABLE = 'rr_e2e_items';
const ITEMS_LABEL = '明細(E2E)';
const COMMENT = '正式名称(株式会社〇〇)で記載してください';
const SECOND_COMMENT = '税込金額か税抜金額か明記してください';
const ROW_COMMENT = '単価が見積書と一致していません';
const RESOLUTION = '登記簿どおりの正式名称に修正しました';

describe('まとめて指摘と解決(実環境)', () => {
  let browser;
  let page;
  let env;
  let repoRoot;
  let pluginId;
  let recordId;
  let itemRowIds;
  const pageErrors = [];

  const appId = () => env.TEST_APP_ID_2;
  const detailUrl = () =>
    `https://${env.KINTONE_DOMAIN}/k/${appId()}/show#record=${recordId}`;

  const getRecord = async () => {
    const resp = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: appId(),
      id: recordId,
    });
    return resp.record;
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

  const wrapSel = (key) => `.rr-badge-wrap[data-target-key="${key}"]`;
  const badgeSel = (key, state) => `${wrapSel(key)} .rr-badge--${state}`;
  const draftSel = (key) => `.rr-draft-item[data-target-key="${key}"]`;
  const rowKey = (i) => `${ITEMS_TABLE}#${itemRowIds[i]}`;

  const ensureReviewMode = async () => {
    const pressed = await page.$eval('.js-rr-mode', (el) =>
      el.getAttribute('aria-pressed'),
    );
    if (pressed !== 'true') {
      await page.$eval('.js-rr-mode', (el) => el.click());
    }
  };

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, appId(), pluginId);
    await kintoneAdmin.ensureFormFields(env, appId(), {
      [ITEMS_TABLE]: {
        type: 'SUBTABLE',
        code: ITEMS_TABLE,
        label: ITEMS_LABEL,
        fields: {
          rr_e2e_item_name: {
            type: 'SINGLE_LINE_TEXT',
            code: 'rr_e2e_item_name',
            label: '品名',
          },
        },
      },
    });

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    page.on('dialog', (dialog) => dialog.accept());
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await common.login(page, env);

    // 設定画面で保存(テーブルが無ければ作成、v1のテーブルなら列を追加)→ プラグイン設定を運用環境へ反映する。
    await common.openPluginConfig(page, env, appId(), pluginId);
    await page.waitForSelector('.js-target-checkbox', { timeout: 15000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }),
      page.$eval('.js-save-button', (el) => el.click()),
    ]);
    await kintoneAdmin.deployApp(env, appId());

    const resp = await kintoneAdmin.addRecords(env, appId(), [
      {
        [TARGET_FIELD]: { value: '〇〇' },
        [SECOND_FIELD]: { value: '1000' },
        ラジオボタン: { value: 'sample1' },
        [ITEMS_TABLE]: {
          value: [
            { value: { rr_e2e_item_name: { value: 'ボールペン' } } },
            { value: { rr_e2e_item_name: { value: 'コピー用紙' } } },
          ],
        },
      },
    ]);
    recordId = resp.ids[0];
    const record = await getRecord();
    itemRowIds = record[ITEMS_TABLE].value.map((row) => String(row.id));
  }, 180000);

  afterAll(async () => {
    if (recordId) {
      await kintoneAdmin.deleteRecords(env, appId(), [recordId]);
    }
    if (browser) {
      await browser.close();
    }
  });

  test('保存により指摘履歴テーブル(対象行IDを含む10の内包フィールド)が用意される', async () => {
    const fields = await kintoneAdmin.getFormFields(env, appId());
    const table = fields[TABLE_CODE];
    expect(table.type).toBe('SUBTABLE');
    const types = Object.fromEntries(
      Object.entries(table.fields).map(([code, f]) => [code, f.type]),
    );
    expect(types).toEqual({
      rr_target_code: 'SINGLE_LINE_TEXT',
      rr_target_label: 'SINGLE_LINE_TEXT',
      rr_target_row_id: 'SINGLE_LINE_TEXT',
      rr_pointed_at: 'DATETIME',
      rr_pointed_by: 'USER_SELECT',
      rr_comment: 'MULTI_LINE_TEXT',
      rr_status: 'DROP_DOWN',
      rr_resolution: 'MULTI_LINE_TEXT',
      rr_resolved_by: 'USER_SELECT',
      rr_resolved_at: 'DATETIME',
    });
  });

  test('フィールド2件とテーブルの行1件を下書きし、まとめて1回で登録できる', async () => {
    await openDetail();
    const summary = await page.$eval('.rr-summary', (el) => el.textContent);
    expect(summary).toContain('指摘はありません');

    await ensureReviewMode();
    // フィールドと、テーブルの各行に「＋」が出る。
    await page.waitForSelector(badgeSel(TARGET_FIELD, 'add'));
    await page.waitForSelector(badgeSel(rowKey(0), 'add'));
    await page.waitForSelector(badgeSel(rowKey(1), 'add'));

    await page.$eval(badgeSel(TARGET_FIELD, 'add'), (el) => el.click());
    await page.$eval(badgeSel(SECOND_FIELD, 'add'), (el) => el.click());
    await page.$eval(badgeSel(rowKey(1), 'add'), (el) => el.click());
    // 同じ対象を2回押しても下書きは増えない。
    await page.$eval(badgeSel(TARGET_FIELD, 'drafted'), (el) => el.click());

    const draftKeys = await page.$$eval('.rr-draft-item', (els) =>
      els.map((el) => el.dataset.targetKey),
    );
    expect(draftKeys).toEqual([TARGET_FIELD, SECOND_FIELD, rowKey(1)]);
    const rowDraftText = await page.$eval(draftSel(rowKey(1)), (el) => el.textContent);
    expect(rowDraftText).toContain(`${ITEMS_LABEL} 2行目`);
    expect(rowDraftText).toContain('コピー用紙');

    // 何も書かずに登録しようとするとエラーになり、保存されない。
    await page.$eval('.js-rr-draft-submit', (el) => el.click());
    await page.waitForFunction(() => {
      const err = document.querySelector('.rr-draft-panel .rr-error');
      return err && !err.hidden;
    });
    expect((await getRecord())[TABLE_CODE].value).toHaveLength(0);

    await page.type(`${draftSel(TARGET_FIELD)} .js-rr-draft-comment`, COMMENT);
    await page.type(`${draftSel(SECOND_FIELD)} .js-rr-draft-comment`, SECOND_COMMENT);
    await page.type(`${draftSel(rowKey(1))} .js-rr-draft-comment`, ROW_COMMENT);
    const submitText = await page.$eval('.js-rr-draft-submit', (el) => el.textContent);
    expect(submitText).toContain('まとめて登録(3件)');
    await clickAndWaitReload('.js-rr-draft-submit');

    await page.waitForSelector(badgeSel(TARGET_FIELD, 'unresolved'));
    await page.waitForSelector(badgeSel(SECOND_FIELD, 'unresolved'));
    await page.waitForSelector(badgeSel(rowKey(1), 'unresolved'));
    expect(await page.$(badgeSel(rowKey(0), 'unresolved'))).toBeNull();
    expect(await page.$('.rr-draft-panel:not([hidden])')).toBeNull();

    const badgeText = await page.$eval(badgeSel(TARGET_FIELD, 'unresolved'), (el) =>
      el.textContent,
    );
    expect(badgeText).toBe('✕ 1');
    const tipText = await page.$eval(`${wrapSel(rowKey(1))} .rr-tip`, (el) => el.textContent);
    expect(tipText).toContain(ROW_COMMENT);
    const outline = await page.evaluate(
      (code) => kintone.app.record.getFieldElement(code).style.outline,
      TARGET_FIELD,
    );
    expect(outline).toContain('solid');
    expect(await page.$eval('.rr-summary', (el) => el.textContent)).toContain(
      '未解決の指摘 3件',
    );

    const rows = (await getRecord())[TABLE_CODE].value.map((r) => r.value);
    expect(rows).toHaveLength(3);
    expect(rows.map((v) => v.rr_target_code.value)).toEqual([
      TARGET_FIELD,
      SECOND_FIELD,
      ITEMS_TABLE,
    ]);
    // 1回のまとめて登録なので、指摘日時・指摘者はすべて同じ。
    expect(new Set(rows.map((v) => v.rr_pointed_at.value)).size).toBe(1);
    rows.forEach((v) => {
      expect(v.rr_status.value).toBe('未解決');
      expect(v.rr_pointed_by.value[0].code).toBe(env.KINTONE_USERNAME);
    });
    expect(rows[0].rr_target_row_id.value).toBe('');
    expect(rows[2].rr_target_row_id.value).toBe(itemRowIds[1]);
    expect(rows[2].rr_target_label.value).toBe(`${ITEMS_LABEL} 2行目`);
    expect(rows[2].rr_comment.value).toBe(ROW_COMMENT);
  });

  test('バツマークから解決内容を登録すると、緑のチェックマークに変わる', async () => {
    await page.$eval(badgeSel(TARGET_FIELD, 'unresolved'), (el) => el.click());
    await page.waitForSelector('.rr-modal .js-rr-resolution');
    // ダイアログには1件ずつの登録欄は無く、下書きへの追加ボタンだけがある。
    expect(await page.$('.rr-modal .js-rr-add')).toBeNull();
    expect(await page.$('.rr-modal .js-rr-dialog-add-draft')).not.toBeNull();

    await page.$eval('.rr-modal .js-rr-resolve', (el) => el.click());
    await page.waitForFunction(() => {
      const err = document.querySelector('.rr-modal .rr-resolve-form .rr-error');
      return err && !err.hidden;
    });

    await page.type('.rr-modal .js-rr-resolution', RESOLUTION);
    await clickAndWaitReload('.rr-modal .js-rr-resolve');

    await page.waitForSelector(badgeSel(TARGET_FIELD, 'resolved'));
    expect(
      await page.$eval(badgeSel(TARGET_FIELD, 'resolved'), (el) => el.textContent),
    ).toBe('✓');
    expect(
      await page.evaluate(
        (code) => kintone.app.record.getFieldElement(code).style.outline,
        TARGET_FIELD,
      ),
    ).toBe('');

    const rows = (await getRecord())[TABLE_CODE].value.map((r) => r.value);
    expect(rows[0].rr_status.value).toBe('解決済み');
    expect(rows[0].rr_resolution.value).toBe(RESOLUTION);
    expect(rows[0].rr_resolved_by.value[0].code).toBe(env.KINTONE_USERNAME);
    expect(rows[0].rr_resolved_at.value).not.toBe('');
    expect(rows[0].rr_comment.value).toBe(COMMENT);
    // 他の指摘(行単位を含む)は変わらない。
    expect(rows[2].rr_status.value).toBe('未解決');
    expect(rows[2].rr_target_row_id.value).toBe(itemRowIds[1]);
  });

  test('行のバツマークからは、その行への指摘が表示される', async () => {
    await page.$eval(badgeSel(rowKey(1), 'unresolved'), (el) => el.click());
    await page.waitForSelector('.rr-modal .rr-item--unresolved');
    const title = await page.$eval('.rr-modal-title', (el) => el.textContent);
    expect(title).toContain(`${ITEMS_LABEL} 2行目`);
    const cards = await page.$$eval('.rr-modal .rr-item', (els) =>
      els.map((el) => el.textContent),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toContain(ROW_COMMENT);
    await page.$eval('.rr-modal-close', (el) => el.click());
  });

  test('指摘履歴ダイアログで全件(行の指摘は「n行目」付き)を閲覧できる', async () => {
    await page.$eval('.js-rr-history', (el) => el.click());
    await page.waitForSelector('.rr-history-table');
    const historyRows = await page.$$eval('.rr-history-table tbody tr', (trs) =>
      trs.map((tr) => ({ cls: tr.className, target: tr.cells[0].textContent })),
    );
    expect(historyRows).toHaveLength(3);
    expect(historyRows.map((r) => r.target)).toContain(`${ITEMS_LABEL} 2行目`);
    expect(historyRows.filter((r) => r.cls === 'rr-row--resolved')).toHaveLength(1);
    await page.$eval('.js-rr-unresolved-only', (el) => el.click());
    const visible = await page.$$eval(
      '.rr-history-table tbody tr',
      (trs) => trs.filter((tr) => getComputedStyle(tr).display !== 'none').length,
    );
    expect(visible).toBe(2);
    await page.$eval('.rr-modal-close', (el) => el.click());
    expect(await page.$('.rr-modal')).toBeNull();
  });

  test('公開サイト用: バツ・チェック・下書きパネルが表示された詳細画面を撮影する', async () => {
    await ensureReviewMode();
    await page.waitForSelector(badgeSel('文字列__1行__1', 'add'));
    await page.$eval(badgeSel('文字列__1行__1', 'add'), (el) => el.click());
    await page.type(
      `${draftSel('文字列__1行__1')} .js-rr-draft-comment`,
      '案件名は契約書の表記に合わせてください',
    );
    await page.$eval(badgeSel(rowKey(0), 'add'), (el) => el.click());
    await page.type(`${draftSel(rowKey(0))} .js-rr-draft-comment`, '数量の単位(箱/本)を明記してください');
    await page.evaluate(() => {
      document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.hover(badgeSel(SECOND_FIELD, 'unresolved'));
    await page.screenshot({
      path: path.join(repoRoot, 'site', 'plugins', PLUGIN_NAME, 'screenshots', 'detail-screen.png'),
      clip: { x: 0, y: 0, width: 1280, height: 1000 },
    });

    // テーブルの行ごとのバッジ(行の＋・未解決の行のバツ)が見える位置でも撮影する。
    await page.evaluate((code) => {
      kintone.app.record.getFieldElement(code).scrollIntoView({ block: 'center' });
    }, ITEMS_TABLE);
    await page.waitForFunction(
      (key) => {
        const wrap = document.querySelector(`.rr-badge-wrap[data-target-key="${key}"]`);
        const r = wrap && wrap.getBoundingClientRect();
        return r && r.top > 0 && r.bottom < window.innerHeight;
      },
      {},
      rowKey(1),
    );
    await page.hover(badgeSel(rowKey(1), 'unresolved'));
    await page.screenshot({
      path: path.join(repoRoot, 'site', 'plugins', PLUGIN_NAME, 'screenshots', 'row-review.png'),
    });

    // 下書きを破棄して終える(未保存の下書きが残ったまま画面遷移しない)。
    await page.$eval('.js-rr-draft-clear', (el) => el.click());
    expect(await page.$('.rr-draft-item')).toBeNull();
  });

  test('編集画面では未解決の指摘が一覧表示され、指摘履歴テーブルは編集不可', async () => {
    await common.goToEditScreenFromDetail(page);
    await page.waitForSelector('.rr-edit-panel', { timeout: 15000 });
    const panelText = await page.$eval('.rr-edit-panel', (el) => el.textContent);
    expect(panelText).toContain('未解決の指摘 2件');
    expect(panelText).toContain(SECOND_COMMENT);
    expect(panelText).toContain(`【${ITEMS_LABEL} 2行目】`);
    expect(panelText).not.toContain(COMMENT);

    const result = await page.evaluate(() => {
      const label = Array.from(
        document.querySelectorAll('.subtable-row-label-text-gaia'),
      ).find((el) => el.textContent.trim() === '指摘履歴');
      const inputs = label
        ? label
            .closest('.subtable-row-gaia')
            .querySelectorAll('tbody input, tbody textarea')
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
