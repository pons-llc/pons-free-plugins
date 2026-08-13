'use strict';

// articles/wareki-date/setup.js
// 記事「kintoneの日付を令和・和暦に変換する方法」用に ARTICLE_APP_ID を白紙に戻し、
// wareki_date_format プラグインで「契約日(西暦)を入力すると和暦(西暦併記)へ自動変換される」
// デモを実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/wareki-date/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../wareki_date_format/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'wareki-date';
const SOURCE_FIELD_CODE = '契約日';
const TARGET_FIELD_CODE = '契約日_和暦';

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [SOURCE_FIELD_CODE]: {
        type: 'DATE',
        code: SOURCE_FIELD_CODE,
        label: SOURCE_FIELD_CODE,
      },
      [TARGET_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TARGET_FIELD_CODE,
        label: '契約日(和暦)',
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 変換元=契約日、出力先=契約日(和暦)、書式=西暦和暦併記、全角=ON。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-pair-add');
    await page.waitForSelector('.js-pair-source');
    await page.select('.js-pair-source', SOURCE_FIELD_CODE);
    await page.select('.js-pair-target', TARGET_FIELD_CODE);
    await page.select('.js-pair-preset', 'WAREKI_WITH_SEIREKI');
    await page.click('.js-pair-zenkaku');

    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // デモ用レコードをREST APIで作成する(契約日のみ設定、和暦フィールドはまだ空)。
    // REST API経由の変更にはプラグインは追従しないため(idea.md「スコープ外」参照)、
    // このあと実際に編集画面を開いて保存することでsubmit時の変換保険処理を発火させる。
    const { id: recordId } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId,
        record: {
          [SOURCE_FIELD_CODE]: { value: '2026-05-01' },
        },
      },
    );

    // 一覧画面→レコードの行クリックで詳細画面へ、「レコードを編集する」で編集画面へ遷移する
    // (page.goto()でのハードナビゲーションはSPA内部状態が壊れるため使わない。実機で確認済みの方法)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    const rows = await page.$$('.recordlist-row-gaia');
    let opened = false;
    for (const row of rows) {
      const text = await page.evaluate((el) => el.textContent, row);
      if (new RegExp(`^${recordId}(\\D|$)`).test(text)) {
        const firstCell = await row.$('div,td,span');
        await firstCell.click();
        await page.waitForFunction(() => location.href.includes('/show'));
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
          .catch(() => {});
        opened = true;
        break;
      }
    }
    if (!opened) {
      throw new Error('一覧画面にデモレコードの行が見つかりませんでした。');
    }

    await page.waitForSelector('a.gaia-argoui-app-menu-edit');
    const editCenter = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('a.gaia-argoui-app-menu-edit'),
      ).filter((el) => el.offsetParent !== null);
      const target = candidates[0];
      if (!target) {
        return null;
      }
      const rect = target.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (!editCenter) {
      throw new Error('「レコードを編集する」リンクが見つかりませんでした。');
    }
    await page.mouse.click(editCenter.x, editCenter.y);
    await page.waitForFunction(() => location.href.includes('mode=edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    // 何も変更せずそのまま保存する。submit時の保険処理により、変換元フィールドの現在値から
    // 和暦フィールドが計算されて書き込まれる(idea.md「動作するタイミング」参照)。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const savedRecord = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: appId,
      id: recordId,
    });
    const convertedValue = savedRecord.record[TARGET_FIELD_CODE].value;
    if (!convertedValue) {
      throw new Error('和暦への変換結果が空でした。');
    }
    console.log('converted:', convertedValue);

    await page.reload({ waitUntil: 'networkidle0' });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await common.screenshotToDirectory(page, screenshotDir, 'record-detail');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
