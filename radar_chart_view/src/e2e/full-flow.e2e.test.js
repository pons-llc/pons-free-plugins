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
// TEST_APP_ID_1には数値フィールド(数値/数値_0/数値_1/数値_2)・ラジオボタン(ラジオボタン、
// 選択肢sample1/sample2)が既存で用意されている(CLAUDE.md記載の前提)ため、新規フィールド作成は
// 行わない。設定画面で「フィールドごと」グルーピング(グルーピングフィールド=ラジオボタン)を
// 選ぶことで、既存レコードの一部がsample1に集中しており合計/平均トグルが意味を持つケース
// (count > 1のグループ)を実機で確認できる。
//
// このファイル1本で「設定の保存→レコード一覧画面でのボタン→別タブでの生成」までを一気通貫で
// 検証する(research_and_answerのfull-flow.e2e.test.jsと同じ命名方針)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'radar_chart_view';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

// 4軸(四角形)にすることで、公開サイト用のスクリーンショットが3軸(正三角形)より見栄えがする。
const AXIS_CODES = ['数値', '数値_0', '数値_1', '数値_2'];
const GROUPING_FIELD_CODE = 'ラジオボタン';
const TITLE = 'E2Eテストチャート';
const SCALE_DIVISIONS = '4';

// クリックした点の座標を(要素の中心ではなく)明示的に指定して、要素の一部分にしか
// 反応しない回帰(config画面のlabel/for不整合、選択パネルのボタンがflex-shrinkで
// 縮んで見た目より狭い範囲しかクリックできない、など)を検知できるようにする。
const clickAtFraction = async (page, selector, xFraction, yFraction) => {
  const box = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.click(
    box.x + box.width * xFraction,
    box.y + box.height * yFraction,
  );
};

describe('レーダーチャートプラグイン(実環境, 一気通貫)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // config.jsの保存成功時(alert)・バリデーション失敗時(alert)はネイティブダイアログを出す。
    // 自動で閉じないとwaitForNavigation()がタイムアウトするまでテストが止まってしまう。
    page.on('dialog', (dialog) => dialog.accept());
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // 各テストが開いた生成HTMLのタブ(chartPage)を閉じ忘れる、またはアサーション失敗で
  // 閉じずに抜けると、次のテストのbrowser.waitForTarget()が古いタブに即座にマッチしてしまい
  // 別のテストを検知できなくなる(実際にこの取り違えでタイムアウトする不具合が起きた)。
  // テストごとに、mainの`page`以外の余分なタブを必ず片付ける。
  afterEach(async () => {
    const pages = await browser.pages();
    await Promise.all(
      pages.filter((p) => p !== page).map((p) => p.close().catch(() => {})),
    );
  });

  test('設定画面: label/forが正しく結びつき、離れたラベルのテキストをクリックしても対応する項目に反応する', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('レーダーチャートプラグイン');

    // 軸1のラベルのテキスト部分(セレクトボックス自体ではない場所)をクリックしても、
    // for/id が正しく結びついていればセレクトボックスにフォーカスが移る
    // (label要素がinputを直接ラップしていないケースでの回帰確認)。
    const axisLabelSelector = '.rcv-axis-item:nth-of-type(1) label';
    await clickAtFraction(page, axisLabelSelector, 0.5, 0.5);
    const axis1Focused = await page.evaluate(
      () =>
        document.activeElement === document.getElementById('js-axis-select-0'),
    );
    expect(axis1Focused).toBe(true);

    // タイトル欄も同様に、ラベルテキストのクリックで入力欄にフォーカスが移ることを確認する。
    await page.click('label[for="js-title"]');
    const titleFocused = await page.evaluate(
      () => document.activeElement === document.getElementById('js-title'),
    );
    expect(titleFocused).toBe(true);

    // 軸1のプルダウンの選択肢がNUMBER型のみに絞り込まれていること(config.js冒頭の
    // fieldsOfType()による絞り込みが実際に効いているかの回帰確認)。
    const axisSelects = await page.$$('.js-axis-select');
    expect(axisSelects.length).toBe(8);
    const axis1OptionValues = await axisSelects[0].evaluate((el) =>
      Array.from(el.options)
        .map((o) => o.value)
        .filter((v) => v !== ''),
    );
    expect(axis1OptionValues).toEqual(expect.arrayContaining(AXIS_CODES));
    expect(axis1OptionValues).not.toContain(GROUPING_FIELD_CODE);

    for (let i = 0; i < AXIS_CODES.length; i++) {
      await axisSelects[i].select(AXIS_CODES[i]);
    }

    // グルーピング単位を「レコードごと」にすると、グルーピングフィールド欄が隠れる
    // (前回のテスト実行で「フィールドごと」のまま保存されている場合があるため、
    // 初期状態を前提にせずまず明示的に「レコードごと」へ切り替えてから確認する)。
    await page.click('.js-grouping-record');
    const groupingFieldRowHiddenAfterRecord = await page.$eval(
      '.js-grouping-field-row',
      (el) => el.hidden,
    );
    expect(groupingFieldRowHiddenAfterRecord).toBe(true);

    // グルーピング単位を「フィールドごと」に切り替えると、グルーピングフィールド欄が表示される。
    await page.click('.js-grouping-field');
    const groupingFieldRowHiddenAfter = await page.$eval(
      '.js-grouping-field-row',
      (el) => el.hidden,
    );
    expect(groupingFieldRowHiddenAfter).toBe(false);

    // 「グルーピングフィールド」ラベルのテキストクリックでもセレクトボックスにフォーカスが移る。
    await page.click('label[for="js-grouping-field-select"]');
    const groupingSelectFocused = await page.evaluate(
      () =>
        document.activeElement ===
        document.getElementById('js-grouping-field-select'),
    );
    expect(groupingSelectFocused).toBe(true);

    const groupingOptionValues = await page.$eval(
      '.js-grouping-field-select',
      (el) =>
        Array.from(el.options)
          .map((o) => o.value)
          .filter((v) => v !== ''),
    );
    expect(groupingOptionValues).toContain(GROUPING_FIELD_CODE);
    expect(groupingOptionValues).not.toContain(AXIS_CODES[0]);
    await page.select('.js-grouping-field-select', GROUPING_FIELD_CODE);

    await page.evaluate((title) => {
      document.querySelector('.js-title').value = title;
      document.querySelector('.js-title').dispatchEvent(new Event('change'));
    }, TITLE);
    await page.evaluate((divisions) => {
      document.querySelector('.js-scale-divisions').value = divisions;
      document
        .querySelector('.js-scale-divisions')
        .dispatchEvent(new Event('change'));
    }, SCALE_DIVISIONS);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定は保存直後は「プレビュー」状態で、レコード一覧画面などプラグイン設定画面
    // 以外の画面には反映されない(config.jsの保存完了alertが「アプリを更新してください」と
    // 案内している理由と同じ)。フィールド追加時と同様にアプリのデプロイが必要
    // (実機で確認: デプロイ前はkintone.plugin.app.getConfig()がレコード一覧画面で空を返した)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    // 保存後、設定画面を開き直して内容が保持されているか確認する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const reloadedAxisValues = await page.$$eval('.js-axis-select', (els) =>
      els.map((el) => el.value).filter((v) => v !== ''),
    );
    expect(reloadedAxisValues).toEqual(AXIS_CODES);

    const reloadedGroupingType = await page.$eval(
      '.js-grouping-field',
      (el) => el.checked,
    );
    expect(reloadedGroupingType).toBe(true);

    const reloadedGroupingField = await page.$eval(
      '.js-grouping-field-select',
      (el) => el.value,
    );
    expect(reloadedGroupingField).toBe(GROUPING_FIELD_CODE);

    const reloadedTitle = await page.$eval('.js-title', (el) => el.value);
    expect(reloadedTitle).toBe(TITLE);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('レコード一覧画面: ボタン押下→「表示中のレコード」選択でカード形式のレーダーチャートが別タブに生成される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.rcv-open-button', { timeout: 15000 });
    await page.click('.rcv-open-button');

    const selectionButtons = await page.$$('.rcv-selection-button');
    expect(selectionButtons.length).toBe(2);

    // 選択パネルのボタンは、見た目の幅いっぱい(左端近く〜右端近くまで)クリックに反応する必要がある
    // (flex-shrinkでボタンの実際のヒット領域がテキストより狭くなる回帰の確認)。この1クリックが
    // 実際の「表示中のレコードで作成」の操作を兼ねる(2回連続で押すと1回目でパネルが閉じてしまうため)。
    const [newTarget] = await Promise.all([
      browser.waitForTarget((target) => target.opener() === page.target(), {
        timeout: 15000,
      }),
      clickAtFraction(page, '.rcv-selection-button', 0.9, 0.5), // 表示中のレコードで作成(右寄りをクリック)
    ]);
    const chartPage = await newTarget.page();
    const chartPageErrors = [];
    chartPage.on('pageerror', (err) => chartPageErrors.push(err.message));

    await chartPage.waitForSelector('#radar-card-grid .radar-card', {
      timeout: 15000,
    });

    expect(await chartPage.title()).toBe(TITLE);

    const cardCount = await chartPage.$$eval(
      '.radar-card',
      (els) => els.length,
    );
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // 1カードにつき、目盛リング(scaleDivisions個)と軸ラベル(軸数個)、系列ポリゴン1枚を持つ。
    const gridRingCount = await chartPage.$$eval(
      '.radar-grid polygon',
      (els) => els.length,
    );
    expect(gridRingCount).toBe(cardCount * Number(SCALE_DIVISIONS));

    const axisLabelCount = await chartPage.$$eval(
      '.radar-axis-label',
      (els) => els.length,
    );
    expect(axisLabelCount).toBe(cardCount * AXIS_CODES.length);

    const polygonCountBefore = await chartPage.$$eval(
      '.radar-series polygon',
      (els) => els.length,
    );
    expect(polygonCountBefore).toBe(cardCount);

    // フィールドごとグルーピングなので、バッジチップは表示されない(グループ値自体が見出し)。
    const badgeChipCount = await chartPage.$$eval(
      '.radar-badge-chip',
      (els) => els.length,
    );
    expect(badgeChipCount).toBe(0);

    // 公開サイト用のスクリーンショットは、絞り込み前(全カードが見える状態)で撮る。
    await common.screenshot(
      chartPage,
      repoRoot,
      PLUGIN_NAME,
      'radar-chart-sample',
    );

    // カードのチェックボックスを1つ外すと、そのカードはdimmed(is-hidden-series)になるが、
    // グリッドからは削除されない(ポリゴン数は変わらない、再度チェックすればいつでも戻せる)。
    if (cardCount > 1) {
      const firstCheckbox = await chartPage.$(
        '.radar-card-header input[type="checkbox"]',
      );
      await firstCheckbox.click();
      const polygonCountAfter = await chartPage.$$eval(
        '.radar-series polygon',
        (els) => els.length,
      );
      expect(polygonCountAfter).toBe(polygonCountBefore);

      const firstCardHidden = await chartPage.$eval('.radar-card', (el) =>
        el.classList.contains('is-hidden-series'),
      );
      expect(firstCardHidden).toBe(true);

      // 再度チェックすると元に戻る。
      const firstCheckboxAgain = await chartPage.$(
        '.radar-card-header input[type="checkbox"]',
      );
      await firstCheckboxAgain.click();
      const firstCardHiddenAgain = await chartPage.$eval('.radar-card', (el) =>
        el.classList.contains('is-hidden-series'),
      );
      expect(firstCardHiddenAgain).toBe(false);
    }

    expect(chartPageErrors).toEqual([]);

    await chartPage.close();
  });

  test('レコード一覧画面: 「絞り込み条件の全件」選択でも別タブにカード形式のレーダーチャートが生成される', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.rcv-open-button', { timeout: 15000 });
    await page.click('.rcv-open-button');
    const selectionButtons = await page.$$('.rcv-selection-button');

    const [newTarget] = await Promise.all([
      browser.waitForTarget((target) => target.opener() === page.target(), {
        timeout: 20000,
      }),
      selectionButtons[1].click(), // 絞り込み条件の全件で作成
    ]);
    const chartPage = await newTarget.page();
    const chartPageErrors = [];
    chartPage.on('pageerror', (err) => chartPageErrors.push(err.message));

    await chartPage.waitForSelector('#radar-card-grid .radar-card', {
      timeout: 20000,
    });

    expect(await chartPage.title()).toBe(TITLE);
    const statusText = await chartPage.$eval(
      '#radar-status',
      (el) => el.textContent,
    );
    expect(statusText).toContain('絞り込み条件の全件');

    expect(chartPageErrors).toEqual([]);

    await chartPage.close();
  });

  test('レコードごとグルーピング: バッジフィールドの値がカードのバッジ(チップ)として表示される(頂点ラベルではない)', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('.js-grouping-record');

    await page.evaluate(() => {
      document
        .querySelectorAll('.js-badge-fields .js-checkbox-item-input')
        .forEach((el) => {
          if (el.checked) {
            el.click();
          }
        });
    });
    const badgeCheckbox = await page.evaluateHandle((code) => {
      const inputs = Array.from(
        document.querySelectorAll('.js-badge-fields .js-checkbox-item-input'),
      );
      return inputs.find((el) => el.value === code);
    }, GROUPING_FIELD_CODE);
    await badgeCheckbox.asElement().click();

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.rcv-open-button', { timeout: 15000 });
    await page.click('.rcv-open-button');
    const selectionButtons = await page.$$('.rcv-selection-button');

    const [newTarget] = await Promise.all([
      browser.waitForTarget((target) => target.opener() === page.target(), {
        timeout: 15000,
      }),
      selectionButtons[0].click(),
    ]);
    const chartPage = await newTarget.page();
    const chartPageErrors = [];
    chartPage.on('pageerror', (err) => chartPageErrors.push(err.message));

    await chartPage.waitForSelector('#radar-card-grid .radar-card', {
      timeout: 15000,
    });

    // レコードごとグルーピングでは、カードのタイトル領域にラベル文字列(結合テキスト)を
    // 詰め込むのではなく、バッジフィールドごとに個別のチップ(.radar-badge-chip)として表示する。
    const badgeChipTexts = await chartPage.$$eval(
      '.radar-card-badges .radar-badge-chip',
      (els) => els.map((el) => el.textContent),
    );
    expect(badgeChipTexts.length).toBeGreaterThanOrEqual(1);
    expect(
      badgeChipTexts.every((t) => t === 'sample1' || t === 'sample2'),
    ).toBe(true);

    expect(chartPageErrors).toEqual([]);

    await chartPage.close();
  });
});
