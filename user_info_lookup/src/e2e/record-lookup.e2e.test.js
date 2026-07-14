'use strict';

// レコード追加画面での実際のルックアップ動作(ボタン押下→User API/kintone.user.getOrganizations()等の
// 呼び出し→反映)を検証するPuppeteerテスト。config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを
// 見るのに対し、こちらは「実際に取得したユーザー情報の値が反映されるか」という機能面を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// 期待値(表示名・メールアドレス)はハードコードせず、テスト実行時にUser API(GET /v1/users.json)へ
// 実際にリクエストして取得した値と突き合わせる(検証環境のユーザー名が変わってもテストが壊れないため)。
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する。/edit へ直接page.goto()すると、kintone管理画面のSPA内部状態が
// 正しく設定されず、kintone.app.record.get()などが
// "The specified JavaScript API cannot be executed on this screen." で失敗する
// (common.jsのopenPluginConfig()と同種の問題、self_lookupで確認済み)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureTargetAppFields,
  ensureButtonSpace,
  BUTTON_SPACE_ELEMENT_ID,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

// スペース内に複数ボタン(主ボタン+クリアボタン)が並ぶため、textContentで対象のボタンを
// 特定してPuppeteerのネイティブクリック(ElementHandle.click())で押す。
// confirm()を伴うクリアボタンは、page.evaluate()内のDOM.click()(非trusted-event)だと
// window.confirm()のダイアログが正しく処理されないことがある(biz_code_searchで確認済み)。
const clickButtonInSpace = async (page, spaceId, buttonText) => {
  const buttonHandle = await page.evaluateHandle(
    (id, text) => {
      const spaceEl = kintone.app.record.getSpaceElement(id);
      return Array.from(
        (spaceEl && spaceEl.querySelectorAll('button')) || [],
      ).find((b) => b.textContent === text);
    },
    spaceId,
    buttonText,
  );
  const buttonEl = buttonHandle.asElement();
  await buttonEl.click();
};

describe('レコード追加画面でのユーザー情報反映(実環境)', () => {
  let browser;
  let page;
  let env;
  let expectedUser;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);

    // 期待値はハードコードせず、User APIから実際の値を取得する(ログイン中のユーザー自身を対象にする)。
    const usersResp = await kintoneAdmin.request(env, '/v1/users.json', 'GET', {
      codes: [env.KINTONE_USERNAME],
    });
    expectedUser = usersResp.users[0];

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定行を1件追加して保存する(元フィールド=uil_user_code、発動条件=ボタン押下時、
    // ボタン設置スペース=uil_button_space、転記項目: 表示名→uil_out_name、メール→uil_out_email)。
    // TEST_APP_ID_1には手動検証済みの設定行が既にあることがあるため、常に最後の.js-rowを
    // スコープに操作し、既存行を巻き込まない。すでに本テスト用の行が保存済み(再実行時)なら
    // 追加・保存をスキップする(buttonSpaceElementIdは設定行間で重複できないため、冪等にする)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const rows = await page.$$('.js-row');
    let targetRow = null;
    for (const row of rows) {
      const spaceValue = await row.$eval('.js-button-space', (el) => el.value);
      if (spaceValue === BUTTON_SPACE_ELEMENT_ID) {
        targetRow = row;
        break;
      }
    }

    let needsSave = false;

    if (!targetRow) {
      await page.click('#js-row-add');
      const newRows = await page.$$('.js-row');
      targetRow = newRows[newRows.length - 1];

      await (await targetRow.$('.js-source-field')).select('uil_user_code');
      await (
        await targetRow.$('.js-button-space')
      ).select(BUTTON_SPACE_ELEMENT_ID);

      await (await targetRow.$('.js-mapping-add')).click();
      let mappingRows = await targetRow.$$('.js-mapping-row');
      await mappingRows[0]
        .$('.js-mapping-attribute')
        .then((el) => el.select('name'));
      await mappingRows[0]
        .$('.js-mapping-destination')
        .then((el) => el.select('uil_out_name'));

      await (await targetRow.$('.js-mapping-add')).click();
      mappingRows = await targetRow.$$('.js-mapping-row');
      await mappingRows[1]
        .$('.js-mapping-attribute')
        .then((el) => el.select('email'));
      await mappingRows[1]
        .$('.js-mapping-destination')
        .then((el) => el.select('uil_out_email'));

      needsSave = true;
    } else {
      // TEST_APP_ID_1に既に本テスト用のボタン設置スペースを使った行があるが、元フィールドが
      // 期待(uil_user_code)と異なる場合(手動検証等で別のフィールドに差し替えられていた場合)は
      // 選び直す(org_lookupで実際に発生した「元フィールドが差し替わっていた」不具合と同種の対策)。
      const sourceValue = await targetRow.$eval(
        '.js-source-field',
        (el) => el.value,
      );
      if (sourceValue !== 'uil_user_code') {
        await (await targetRow.$('.js-source-field')).select('uil_user_code');
        needsSave = true;
      }
    }

    if (needsSave) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存(kintone.plugin.app.setConfig())は、フィールド/レイアウトの変更と
      // 同じく「テスト環境」相当の状態にしか反映されず、レコード追加・編集画面などの実際の画面に
      // 反映されるには明示的なアプリの更新(デプロイ)が必要(self_lookupの判断記録.mdの10番と同じ)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('元フィールドにユーザーコードを入力してボタンを押すと、User APIで取得した値が反映される', async () => {
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

    // 元フィールドにログイン中ユーザー自身のユーザーコードをセットする(公式JavaScript API経由)。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.uil_user_code.value = value;
      kintone.app.record.set({ record: current });
    }, env.KINTONE_USERNAME);

    // ユーザー情報取得ボタン(設定したスペースフィールド内、自プラグインが動的に追加する)をクリックする。
    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      BUTTON_SPACE_ELEMENT_ID,
    );
    await page.evaluate((spaceId) => {
      kintone.app.record
        .getSpaceElement(spaceId)
        .querySelector('button')
        .click();
    }, BUTTON_SPACE_ELEMENT_ID);

    // ボタン押下後、出力先フィールドにUser APIから取得した実際の値が反映される。
    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.uil_out_name.value === expected;
      },
      { timeout: 15000 },
      expectedUser.name,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.uil_out_name.value).toBe(expectedUser.name);
    expect(record.uil_out_email.value).toBe(expectedUser.email);

    expect(pageErrors).toEqual([]);
  });

  test('クリアボタンを押すと、元フィールド・転記先フィールドがすべて空になる', async () => {
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

    // まず反映ボタンで値を反映させ、クリア対象があることを確認したうえでクリアする。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.uil_user_code.value = value;
      kintone.app.record.set({ record: current });
    }, env.KINTONE_USERNAME);

    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      BUTTON_SPACE_ELEMENT_ID,
    );
    await clickButtonInSpace(
      page,
      BUTTON_SPACE_ELEMENT_ID,
      'ユーザー情報を取得して反映',
    );

    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.uil_out_name.value === expected;
      },
      { timeout: 15000 },
      expectedUser.name,
    );

    // クリアボタンは反映ボタンと同じスペースに並んで表示される
    // (page.on('dialog')でconfirm()は自動的に承諾される、beforeAll参照)。
    await clickButtonInSpace(page, BUTTON_SPACE_ELEMENT_ID, 'クリア');

    // kintone.app.record.set()でフィールド値を空文字列にクリアすると、field.valueキー自体が
    // 無くなりundefinedになることがある(実際に検証環境で確認済みのkintoneの挙動)。
    // そのため偽値判定で確認する。
    await page.waitForFunction(
      () => !kintone.app.record.get().record.uil_out_name.value,
      { timeout: 20000 },
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.uil_user_code.value).toBeFalsy();
    expect(record.uil_out_name.value).toBeFalsy();
    expect(record.uil_out_email.value).toBeFalsy();

    expect(pageErrors).toEqual([]);
  });
});
