'use strict';

// 通常モード(ドロップダウン)での実際の挿入動作を検証する。
// (1) 通常テンプレート: プレースホルダーがレコードの値へ解決されて末尾に追記される
// (2) サブテーブル繰り返しテンプレート: サブテーブルの各行が展開・連結されて追記される
//
// 事前準備: config-screen.e2e.test.js と同じ(pnpm run build && pnpm run upload、.env設定)。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
// TEST_APP_ID_1にはgeo_checkin(「位置情報強制登録プラグイン」)が既に設定されており、
// 同じくkintone.app.record.getHeaderMenuSpaceElement()へ描画する(位置情報未登録時、
// spaceElをクリアしてメッセージを表示する)。どちらのapp.record.create.show/edit.showハンドラーが
// 後に実行されるかにより、先に描画した側の内容がクリアされて消えてしまう競合が実機で確認できた
// (kanban_view/src/e2e/full-flow.e2e.test.jsの詳細カレンダープラグインとの競合と同種の、
// 検証環境固有の問題であり本プラグイン自体の不具合ではない)。beforeAllで一時的に取り外し、
// afterAllで必ず元に戻す(common.removeAppPluginByName参照)。
const GEO_CHECKIN_SRC_DIR = path.join(
  PLUGIN_SRC_DIR,
  '..',
  '..',
  'geo_checkin',
  'src',
);
const GEO_CHECKIN_DISPLAY_NAME = '位置情報強制登録プラグイン';
const TARGET_FIELD_CODE = '文字列__複数行_';
const SOURCE_FIELD_CODE = '文字列__1行_';
const TABLE_FIELD_CODE = 'テーブル';
const TABLE_COLUMN_CODE = '文字列__複数行__2';

const NORMAL_TEMPLATE_NAME = 'あいさつ';
const NORMAL_TEMPLATE_BODY = `こんにちは、{${SOURCE_FIELD_CODE}}さん`;
const SUBTABLE_TEMPLATE_NAME = '明細';
const SUBTABLE_TEMPLATE_BODY = `・{${TABLE_COLUMN_CODE}}`;

// kintone.app.record.set()でテーブルの行を書き換える際は、公式ドキュメント
// (「テーブルへの追加、更新時には、既存のすべての行の値を指定してください」)のとおり、
// その行の列を1つでも省略すると行全体がkintone側の既定値(現在日時等)で上書きされてしまう
// ことを実機で確認した(実際に文字列__複数行__2だけを指定したところ、2行指定したはずが
// 1行に統合され、かつその値も空にリセットされる不具合を確認済み)。そのためテーブル
// 「テーブル」の全列を明示的に指定する。値は各列の型に応じた「空にする場合の値」
// (kintone公式ドキュメント「フィールドの値を空に設定する場合」参照。ラジオボタンは
// 空を指定できないためデフォルト値のsample1を使う)。
const TABLE_COLUMN_DEFAULTS = {
  日時_2: { type: 'DATETIME', value: null },
  数値_3: { type: 'NUMBER', value: '' },
  文字列__1行__3: { type: 'SINGLE_LINE_TEXT', value: '' },
  [TABLE_COLUMN_CODE]: { type: 'MULTI_LINE_TEXT', value: '' },
  ラジオボタン_2: { type: 'RADIO_BUTTON', value: 'sample1' },
  時刻: { type: 'TIME', value: null },
  チェックボックス_2: { type: 'CHECK_BOX', value: [] },
  ドロップダウン_2: { type: 'DROP_DOWN', value: '' },
  日付_3: { type: 'DATE', value: null },
};

// 設定画面のテンプレート行(js-template-row)内の各コントロールを、Puppeteerのtype()/select()
// ではなくDOM直接操作で埋める。動的に増える行を`.js-template-row`という共通クラスでしか
// 区別できないため(config-screen.e2e.test.jsのような単一行の想定では不要だが、このテストは
// 複数行を扱うため)、行のインデックスを指定して`querySelectorAll()[rowIndex]`で対象を絞り込む。
const fillTemplateRow = (page, rowIndex, fields) =>
  page.evaluate(
    (targetRowIndex, targetFields) => {
      const rowEl =
        document.querySelectorAll('.js-template-row')[targetRowIndex];
      const setValue = (selector, value) => {
        const el = rowEl.querySelector(selector);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      if (targetFields.name !== undefined) {
        setValue('.js-template-name', targetFields.name);
      }
      if (targetFields.targetFieldCode !== undefined) {
        setValue('.js-template-target', targetFields.targetFieldCode);
      }
      if (targetFields.kind !== undefined) {
        setValue('.js-template-kind', targetFields.kind);
      }
      if (targetFields.subtableFieldCode !== undefined) {
        setValue('.js-template-subtable', targetFields.subtableFieldCode);
      }
      if (targetFields.body !== undefined) {
        setValue('.js-template-body', targetFields.body);
      }
    },
    rowIndex,
    fields,
  );

describe('通常モード: レコード画面での挿入(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let geoCheckinPluginId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    geoCheckinPluginId = common.getPluginId(GEO_CHECKIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    await common.removeAppPluginByName(
      page,
      env,
      env.TEST_APP_ID_1,
      GEO_CHECKIN_DISPLAY_NAME,
    );

    // 通常テンプレート+サブテーブル繰り返しテンプレートの2件を設定して保存する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.select('.js-mode', 'DROPDOWN');

    await page.click('#js-template-add');
    const rowIndex1 =
      (await page.$$eval('.js-template-row', (rows) => rows.length)) - 1;
    await fillTemplateRow(page, rowIndex1, {
      name: NORMAL_TEMPLATE_NAME,
      targetFieldCode: TARGET_FIELD_CODE,
      body: NORMAL_TEMPLATE_BODY,
    });

    await page.click('#js-template-add');
    const rowIndex2 =
      (await page.$$eval('.js-template-row', (rows) => rows.length)) - 1;
    await fillTemplateRow(page, rowIndex2, {
      name: SUBTABLE_TEMPLATE_NAME,
      targetFieldCode: TARGET_FIELD_CODE,
      kind: 'SUBTABLE_REPEAT',
      subtableFieldCode: TABLE_FIELD_CODE,
      body: SUBTABLE_TEMPLATE_BODY,
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定の保存はテスト環境相当にしか反映されないため、レコード追加画面に
    // 反映するには明示的なデプロイが必要(self_lookup/org_lookupのe2eと同じ既知の注意点、
    // project_plugin_config_needs_deploy参照)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    // 取り外したgeo_checkinを必ず元に戻す(テストの成否によらず)。
    await kintoneAdmin.ensurePluginAdded(
      env,
      env.TEST_APP_ID_1,
      geoCheckinPluginId,
    );
    if (browser) {
      await browser.close();
    }
  });

  const openAddScreen = async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForSelector('.tmpi-button');
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
  };

  const selectTemplateByName = (name) =>
    page.evaluate((targetName) => {
      const selectEl = document.querySelector('.tmpi-select');
      const optionEl = Array.from(selectEl.options).find((o) =>
        o.textContent.startsWith(targetName),
      );
      selectEl.value = optionEl.value;
    }, name);

  test('通常テンプレートを選んで挿入すると、プレースホルダーが解決されて末尾に追記される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openAddScreen();

    await page.evaluate(
      (fieldCode, value) => {
        const record = kintone.app.record.get().record;
        record[fieldCode].value = value;
        kintone.app.record.set({ record });
      },
      SOURCE_FIELD_CODE,
      'テスト太郎',
    );

    await selectTemplateByName(NORMAL_TEMPLATE_NAME);
    await page.click('.tmpi-button');

    await page.waitForFunction(
      (fieldCode, expected) =>
        kintone.app.record.get().record[fieldCode].value.includes(expected),
      {},
      TARGET_FIELD_CODE,
      'こんにちは、テスト太郎さん',
    );

    expect(pageErrors).toEqual([]);
  });

  test('サブテーブル繰り返しテンプレートを選ぶと、各行が展開・連結されて追記される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openAddScreen();

    await page.evaluate(
      (tableCode, columnCode, values, columnDefaults) => {
        const record = kintone.app.record.get().record;
        record[tableCode].value = values.map((value) => {
          const rowValue = {};
          Object.keys(columnDefaults).forEach((code) => {
            rowValue[code] = { ...columnDefaults[code] };
          });
          rowValue[columnCode] = { type: 'MULTI_LINE_TEXT', value };
          return { id: null, value: rowValue };
        });
        kintone.app.record.set({ record });
      },
      TABLE_FIELD_CODE,
      TABLE_COLUMN_CODE,
      ['商品A', '商品B'],
      TABLE_COLUMN_DEFAULTS,
    );

    await selectTemplateByName(SUBTABLE_TEMPLATE_NAME);
    await page.click('.tmpi-button');

    await page.waitForFunction(
      (fieldCode, expected) =>
        kintone.app.record.get().record[fieldCode].value.includes(expected),
      {},
      TARGET_FIELD_CODE,
      '・商品A\n・商品B',
    );

    expect(pageErrors).toEqual([]);
  });

  // 「対象のテーブルに行が無い場合はアラートで案内する」パス自体は
  // js/lib/subtable-template.test.js(buildRepeatedTemplateTextが空行配列に対して空文字列を
  // 返す)とjs/lib/insert-composer.test.js(insertTextが空の場合は既存値を変えない)で
  // ユニットテスト済み。e2eでは検証しない: 実機で確認したところ、レコード追加画面のテーブルは
  // kintoneのテーブルウィジェット自体の挙動により、record.set()で空配列を代入しても
  // 必ず1行(既定値で埋められた行)へ戻ってしまい、JavaScript API経由で「0行」の状態を
  // 追加画面上で再現する方法が無かった(REST APIで0行のレコードを直接作成すれば
  // 編集画面で再現できる可能性はあるが、本テストスイートの検証範囲外とした)。
});
