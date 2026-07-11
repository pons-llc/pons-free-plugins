'use strict';

// レコード追加画面での実際のルックアップ動作(ボタン押下→Organization API呼び出し→反映)を検証する
// Puppeteerテスト。config-screen.e2e.test.jsが画面の疎通・選択肢の絞り込みを見るのに対し、こちらは
// 「実際に取得した組織情報の値が反映されるか」という機能面を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様(pnpm run build && pnpm run upload、.env設定済み)。
// 実行: pnpm run test:e2e
//
// 期待値(組織名)はハードコードせず、テスト実行時にOrganization API(GET /v1/organizations.json)へ
// 実際にリクエストして取得した、検証環境に実在する組織の値と突き合わせる。検証環境には親子関係を持つ
// 組織が存在しないため、このテストは「親組織を持たない組織」のケース(親組織欄が空文字列のままになる
// こと)を確認する。親組織を1階層だけ遡るロジック自体はresolve-org-info.test.jsで検証済み(idea.md参照)。
//
// NOTE: レコード追加画面(/edit)へは実際のユーザー導線(アプリ一覧画面→「レコードを追加する」
// リンクをクリック)で遷移する(self_lookup/user_info_lookupと同じ理由)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureTargetAppFields,
  ensureButtonSpace,
  fetchAnyOrganization,
  BUTTON_SPACE_ELEMENT_ID,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('レコード追加画面での組織情報反映(実環境)', () => {
  let browser;
  let page;
  let env;
  let expectedOrg;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);

    // 期待値はハードコードせず、検証環境に実在する組織をOrganization APIから取得する。
    expectedOrg = await fetchAnyOrganization(env);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 設定行を1件追加して保存する(元フィールド=orgl_org_code、発動条件=ボタン押下時、
    // ボタン設置スペース=orgl_button_space、転記項目: 組織名→orgl_out_name、
    // 親組織名→orgl_out_parent_name)。TEST_APP_ID_1には手動検証済みの設定行が既にあることが
    // あるため、常に最後の.js-rowをスコープに操作し、既存行を巻き込まない。すでに本テスト用の行が
    // 保存済み(再実行時)なら追加・保存をスキップする(buttonSpaceElementIdは設定行間で重複できない
    // ため、冪等にする)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const alreadyConfigured = await page.evaluate((spaceId) => {
      const rows = Array.from(document.querySelectorAll('.js-row'));
      return rows.some(
        (row) => row.querySelector('.js-button-space')?.value === spaceId,
      );
    }, BUTTON_SPACE_ELEMENT_ID);

    if (!alreadyConfigured) {
      await page.click('#js-row-add');
      const rows = await page.$$('.js-row');
      const newRow = rows[rows.length - 1];

      await (await newRow.$('.js-source-field')).select('orgl_org_code');
      await (
        await newRow.$('.js-button-space')
      ).select(BUTTON_SPACE_ELEMENT_ID);

      await (await newRow.$('.js-mapping-add')).click();
      let mappingRows = await newRow.$$('.js-mapping-row');
      await mappingRows[0]
        .$('.js-mapping-attribute')
        .then((el) => el.select('name'));
      await mappingRows[0]
        .$('.js-mapping-destination')
        .then((el) => el.select('orgl_out_name'));

      await (await newRow.$('.js-mapping-add')).click();
      mappingRows = await newRow.$$('.js-mapping-row');
      await mappingRows[1]
        .$('.js-mapping-attribute')
        .then((el) => el.select('parentName'));
      await mappingRows[1]
        .$('.js-mapping-destination')
        .then((el) => el.select('orgl_out_parent_name'));

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('.kintoneplugin-button-dialog-ok'),
      ]);

      // プラグイン設定の保存(kintone.plugin.app.setConfig())は、フィールド/レイアウトの変更と
      // 同じく「テスト環境」相当の状態にしか反映されず、レコード追加・編集画面などの実際の画面に
      // 反映されるには明示的なアプリの更新(デプロイ)が必要(self_lookup/user_info_lookupと同じ)。
      await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('元フィールドに組織コードを入力してボタンを押すと、Organization APIで取得した値が反映される', async () => {
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

    // 元フィールドに検証環境に実在する組織コードをセットする(公式JavaScript API経由)。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current.orgl_org_code.value = value;
      kintone.app.record.set({ record: current });
    }, expectedOrg.code);

    // 組織情報取得ボタン(設定したスペースフィールド内、自プラグインが動的に追加する)をクリックする。
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

    // ボタン押下後、出力先フィールドにOrganization APIから取得した実際の値が反映される。
    await page.waitForFunction(
      (expected) => {
        const record = kintone.app.record.get().record;
        return record.orgl_out_name.value === expected;
      },
      { timeout: 15000 },
      expectedOrg.name,
    );

    const record = await page.evaluate(() => kintone.app.record.get().record);
    expect(record.orgl_out_name.value).toBe(expectedOrg.name);
    // 文字列1行フィールドが空の場合、レコード追加・編集画面でJavaScript API経由の取得値は
    // ''ではなくundefinedになる(kintone公式ドキュメント「フィールドの値が空の場合」に明記された
    // 挙動)。プラグイン自体はfield.value = ''を正しく書き込んでいるが、読み戻すとundefinedに
    // 正規化されるため、空文字列判定は真偽値としてチェックする。
    if (expectedOrg.parentCode) {
      // 親組織を持つ組織であれば、親組織名が空でないはず(この検証環境では通常発生しないケース)。
      expect(record.orgl_out_parent_name.value).toBeTruthy();
    } else {
      // 検証環境のこの組織には親組織が無いため、親組織名は空でクリアされる
      // (該当する親組織が無い場合の既定動作、resolve-org-info.test.jsで階層制御ロジック自体は検証済み)。
      expect(record.orgl_out_parent_name.value).toBeFalsy();
    }

    expect(pageErrors).toEqual([]);
  });
});
