'use strict';

// 設定の保存 → 編集画面のエディターで人物・夫婦(離婚)・子・同居・メモを作成して保存 → 保存されたJSONの確認 →
// 詳細画面での描画 → 詳細画面からのメモの追記(PUT)→ JSONとして読めない値を編集画面で上書きしないこと、
// までを実環境で通しで検証する。
//
// テスト用レコードはこのテスト自身がREST APIで1件作成し、afterAllでそのIDだけを削除する
// (TEST_APP_ID_2は他プラグインのE2Eと共用のため、他のレコードには触らない)。
// TEST_APP_ID_2の必須フィールド(文字列__1行_ は重複禁止、ラジオボタン)はレコード作成時に埋める。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('ジェノグラムの作成・保存・メモ追記(実環境)', () => {
  let browser;
  let page;
  let env;
  let repoRoot;
  let pluginId;
  let recordId;
  const pageErrors = [];

  const appId = () => env.TEST_APP_ID_2;
  const detailUrl = () =>
    `https://${env.KINTONE_DOMAIN}/k/${appId()}/show#record=${recordId}`;

  const getSaved = async () => {
    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      { app: appId(), id: recordId },
    );
    return record[fixtures.JSON_FIELD].value;
  };

  const setSaved = (value) =>
    kintoneAdmin.request(env, '/k/v1/record.json', 'PUT', {
      app: appId(),
      id: recordId,
      record: { [fixtures.JSON_FIELD]: { value } },
    });

  const openDetail = async () => {
    await page.goto(detailUrl(), { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.gng-view', { timeout: 20000 });
  };

  const openEdit = async () => {
    await page.goto(detailUrl(), { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await common.goToEditScreenFromDetail(page);
  };

  // kintoneの固定ヘッダーにクリック位置が隠れることがあるため、DOMのclick()で押す
  // (project_e2e_upload_puppeteer_gotchas.md の5)
  const click = (selector) => page.$eval(selector, (el) => el.click());

  const typeInto = async (selector, text) => {
    await page.$eval(selector, (el) => el.focus());
    await page.keyboard.type(text);
  };

  const saveRecord = async () => {
    await Promise.all([
      page
        .waitForFunction(() => !location.href.includes('mode=edit'), {
          timeout: 30000,
        })
        .catch(async (e) => {
          await page.screenshot({
            path: path.join(process.env.TMPDIR || '/tmp', 'gng-save-fail.png'),
            fullPage: true,
          });
          throw e;
        }),
      page.click('button.gaia-ui-actionmenu-save'),
    ]);
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
  };

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, appId(), pluginId);
    await fixtures.ensureFixtures(env, appId());

    const created = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId(),
        record: {
          // 重複禁止。共用アプリには他プラグインの入力チェック(半角英数字は不可)があるため全角で入れる
          文字列__1行_: {
            value: `ジェノグラム試験${String(Date.now()).replace(
              /[0-9]/g,
              (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0),
            )}`,
          },
          ラジオボタン: { value: 'sample1' },
        },
      },
    );
    recordId = created.id;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    page.on('dialog', (dialog) => dialog.accept());
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await common.login(page, env);
    await fixtures.configureViaScreen(page, env, appId(), pluginId);
  }, 240000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (env && recordId) {
      await kintoneAdmin.deleteRecords(env, appId(), [recordId]);
    }
  });

  test('編集画面のエディターで家族を作成し、保存するとJSONとして保存される', async () => {
    await openEdit();
    await page.waitForSelector('.gng-edit', { timeout: 20000 });

    // 本人(女性・42歳)
    await click('.js-gng-add-person');
    await typeInto('.js-gng-person-name', '山田花子');
    await page.select('.js-gng-person-gender', 'female');
    await typeInto('.js-gng-person-age', '42');
    await click('.js-gng-person-client');

    // 配偶者(性別は自動で男性)→ 名前
    await click('.js-gng-add-partner');
    await typeInto('.js-gng-person-name', '山田太郎');
    expect(await page.$eval('.js-gng-person-gender', (el) => el.value)).toBe(
      'male',
    );

    // 夫婦の一覧から編集 → 離婚にして、この2人の子を追加
    await click('.gng-lists .js-gng-list-edit');
    await page.waitForSelector('.js-gng-union-status');
    await page.select('.js-gng-union-status', 'divorced');
    await click('.js-gng-union-add-child');
    await typeInto('.js-gng-person-name', '山田翔');
    await page.select('.js-gng-person-childtype', 'adopted');

    // 同居(本人と子)
    await click('.js-gng-new-household');
    await page.waitForSelector('.js-gng-household-submit');
    await page.$$eval('.gng-panel .js-gng-member', (els) => {
      els.forEach((el) => {
        const label = el.parentElement.textContent;
        if (label.includes('山田花子') || label.includes('山田翔')) {
          el.checked = true;
        }
      });
    });
    await click('.js-gng-household-submit');

    // メモ(全体宛て)
    await typeInto('.gng-memos .js-gng-memo-text', '初回面談。E2Eのメモ');
    await click('.gng-memos .js-gng-memo-add');

    // 図: 3人(本人は二重線で記号2つ)・離婚の斜線2本・養子の破線
    expect(await page.$$eval('.gng-svg .g-person', (els) => els.length)).toBe(
      4,
    );
    expect(await page.$$eval('.gng-svg .g-slash', (els) => els.length)).toBe(2);

    await saveRecord();

    const saved = JSON.parse(await getSaved());
    expect(saved.version).toBe(1);
    const byName = Object.fromEntries(saved.persons.map((p) => [p.name, p]));
    expect(Object.keys(byName).sort()).toEqual(
      ['山田太郎', '山田翔', '山田花子'].sort(),
    );
    expect(byName['山田花子']).toMatchObject({
      gender: 'female',
      age: '42',
      isClient: true,
    });
    expect(saved.unions).toHaveLength(1);
    expect(saved.unions[0].status).toBe('divorced');
    expect(byName['山田翔'].parentUnionId).toBe(saved.unions[0].id);
    expect(byName['山田翔'].childType).toBe('adopted');
    expect(saved.households).toHaveLength(1);
    expect(saved.households[0].members.sort()).toEqual(
      [byName['山田花子'].id, byName['山田翔'].id].sort(),
    );
    expect(saved.memos).toHaveLength(1);
    expect(saved.memos[0].text).toBe('初回面談。E2Eのメモ');
    expect(saved.memos[0].author.code).toBe(env.KINTONE_USERNAME);
  });

  test('詳細画面に図が描画され、メモを追記するとPUTで保存される', async () => {
    await openDetail();
    expect(
      await page.$$eval('.gng-view .gng-canvas .g-person', (els) => els.length),
    ).toBe(4);
    expect(
      await page.$$eval('.gng-view .gng-memo-text', (els) =>
        els.map((el) => el.textContent),
      ),
    ).toEqual(['初回面談。E2Eのメモ']);

    // 本人宛てにメモを追記 → 保存後に画面が再読み込みされる
    const clientId = await page.$$eval(
      '.gng-view .js-gng-memo-target option',
      (options) => options.find((o) => o.textContent === '山田花子').value,
    );
    await page.select('.gng-view .js-gng-memo-target', clientId);
    await typeInto(
      '.gng-view .js-gng-memo-text',
      '電話で近況確認(詳細画面から)',
    );
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      click('.gng-view .js-gng-memo-add'),
    ]);
    await page.waitForSelector('.gng-view', { timeout: 20000 });

    const saved = JSON.parse(await getSaved());
    expect(saved.memos.map((m) => m.text)).toEqual([
      '初回面談。E2Eのメモ',
      '電話で近況確認(詳細画面から)',
    ]);
    expect(saved.memos[1].targetId).toBe(clientId);
    // 人物などほかのデータは保持される
    expect(saved.persons).toHaveLength(3);
    // 本人にメモの件数バッジが出る
    expect(
      await page.$$eval('.gng-view .g-memo-badge-text', (els) =>
        els.map((el) => el.textContent),
      ),
    ).toEqual(['1']);
  });

  test('JSONとして読めない値は、編集画面で図を出さず、保存しても上書きしない', async () => {
    await setSaved('{"persons": [ broken');
    await openEdit();
    await page.waitForSelector('.gng-root .gng-error', { timeout: 20000 });
    expect(await page.$('.gng-edit')).toBeNull();
    await saveRecord();
    expect(await getSaved()).toBe('{"persons": [ broken');
  });

  test('ページエラーが出ていない', () => {
    expect(pageErrors).toEqual([]);
  });
});
