'use strict';

// articles/confirm-modal/setup.js
// 記事「kintoneで削除・保存時に確認ダイアログを表示する方法」用に ARTICLE_APP_ID を白紙に戻し、
// confirm_modal プラグインで「レコード編集の保存時に確認ダイアログを表示し、キャンセルすると
// 保存されない」デモを実行してスクリーンショットを撮る
// (scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/confirm-modal/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../confirm_modal/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'confirm-modal';
const TITLE_FIELD_CODE = '案件名';
const CONFIRM_BODY_TEXT = 'この内容で保存してよろしいですか?';

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
  // 設定画面のバリデーションエラー等はネイティブのalert()で表示されるため自動acceptする。
  // kintone.showConfirmDialog()はネイティブダイアログではなくページ内に描画されるモーダルの
  // ため、このリスナーはそちらには影響しない。
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
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 対象イベント=レコード編集の保存、タイトル・本文・ボタン文言をカスタマイズ。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-rule-add');
    await page.waitForSelector('.js-rule-trigger');
    await page.select('.js-rule-trigger', 'EDIT_SUBMIT');
    await page.type('.js-rule-title', '保存確認');
    await page.type('.js-rule-body', CONFIRM_BODY_TEXT);
    await page.type('.js-rule-ok-text', '保存する');
    await page.type('.js-rule-cancel-text', 'やめる');

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

    // デモ用レコードをREST APIで作成する。
    const { id: recordId } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId,
        record: { [TITLE_FIELD_CODE]: { value: 'テスト案件' } },
      },
    );

    // 一覧画面→詳細画面→編集画面と実際のユーザー導線で遷移する
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

    const openEditScreen = async () => {
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
    };

    const clickButtonByText = async (text) => {
      const handle = await page.evaluateHandle((t) => {
        return Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === t,
        );
      }, text);
      const el = handle.asElement();
      if (!el) {
        throw new Error(`ボタンが見つかりませんでした: ${text}`);
      }
      await el.click();
    };

    // 1回目: 編集画面を開いて保存ボタンを押し、確認ダイアログで「やめる」を選ぶ。
    await openEditScreen();
    await page.click('button.gaia-ui-actionmenu-save');
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      { timeout: 15000 },
      CONFIRM_BODY_TEXT,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await common.screenshotToDirectory(page, screenshotDir, 'confirm-dialog');

    await clickButtonByText('やめる');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!page.url().includes('mode=edit')) {
      throw new Error('キャンセル後に編集画面から離れてしまいました。');
    }
    const revisionAfterCancel = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: appId, id: recordId },
    );
    console.log('revision after cancel:', revisionAfterCancel.record.$revision.value);

    // 2回目: もう一度保存ボタンを押し、今度は「保存する」を選ぶ。
    await page.click('button.gaia-ui-actionmenu-save');
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      { timeout: 15000 },
      CONFIRM_BODY_TEXT,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('mode=edit')),
      clickButtonByText('保存する'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const revisionAfterOk = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: appId, id: recordId },
    );
    console.log('revision after ok:', revisionAfterOk.record.$revision.value);
    if (
      Number(revisionAfterOk.record.$revision.value) <=
      Number(revisionAfterCancel.record.$revision.value)
    ) {
      throw new Error('「保存する」を選んだのにレコードが更新されませんでした。');
    }
    console.log('confirm modal flow: ok');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
