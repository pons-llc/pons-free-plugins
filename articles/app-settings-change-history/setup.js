'use strict';

// 記事「kintoneのアプリ設定の変更履歴を残す方法」(site/articles/app-settings-change-history/)用に、
// アプリ設定変更依頼プラグイン(app_settings_request)の動作を実際に検証環境で行い、スクリーンショットを撮る。
//
// このプラグインは「依頼アプリ」と「変更対象アプリ」の2つが必要なため、
//   - 依頼アプリ: ARTICLE_APP_ID(記事ごとに白紙に戻して使い回す。article-app-setup skill参照)
//   - 変更対象アプリ: 記事専用の「契約管理」アプリ。初回に作成し、IDを target-app-id.txt に保存して使い回す
//     (articles/auto-lookup/setup.js の参照先アプリと同じ方式)。毎回、記事の初期状態(契約名: 任意、
//     契約区分: 新規/更新)に戻してから撮影する。
// 依頼の作成・申請・承認(確認ダイアログで「反映する」)は実際の画面操作で行い、プラグインの反映処理を実際に走らせる。
//
// 事前準備: cd app_settings_request/src && pnpm run build(プラグインはシステムに読み込み済みであること)
// 実行:     NODE_PATH=app_settings_request/src/node_modules node articles/app-settings-change-history/setup.js

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'app-settings-change-history';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../app_settings_request/src');
const TARGET_APP_ID_FILE = path.join(__dirname, 'target-app-id.txt');
const REQUEST_APP_NAME = 'アプリ設定変更依頼';
const TARGET_APP_NAME = '契約管理';
const HISTORY_VIEW_NAME = '変更履歴';

const ChangeRequest = require(path.join(PLUGIN_SRC_DIR, 'js/lib/change-request.js'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TARGET_FIELDS = {
  契約名: { type: 'SINGLE_LINE_TEXT', code: '契約名', label: '契約名', required: false },
  契約先: { type: 'SINGLE_LINE_TEXT', code: '契約先', label: '契約先' },
  契約金額: { type: 'NUMBER', code: '契約金額', label: '契約金額', unit: '円', unitPosition: 'AFTER' },
  契約区分: {
    type: 'DROP_DOWN',
    code: '契約区分',
    label: '契約区分',
    defaultValue: '新規',
    options: {
      新規: { label: '新規', index: '0' },
      更新: { label: '更新', index: '1' },
    },
  },
};

const ensureTargetApp = async (env) => {
  if (fs.existsSync(TARGET_APP_ID_FILE)) {
    return fs.readFileSync(TARGET_APP_ID_FILE, 'utf8').trim();
  }
  const created = await kintoneAdmin.createApp(env, TARGET_APP_NAME);
  const appId = String(created.app);
  await kintoneAdmin.addFormFields(env, appId, TARGET_FIELDS);
  await kintoneAdmin.deployApp(env, appId);
  await kintoneAdmin.addRecords(env, appId, [
    ['庁舎清掃業務委託', '株式会社サンプル美装', '4800000', '更新'],
    ['公用車リース', 'サンプルリース株式会社', '1320000', '新規'],
    ['文書管理システム保守', 'サンプルシステムズ株式会社', '2400000', '更新'],
  ].map(([name, partner, amount, kind]) => ({
    契約名: { value: name },
    契約先: { value: partner },
    契約金額: { value: amount },
    契約区分: { value: kind },
  })));
  fs.writeFileSync(TARGET_APP_ID_FILE, appId);
  return appId;
};

// 変更対象アプリを記事の初期状態に戻す(前回の撮影で反映した変更・作った一覧を元に戻す)。
const resetTargetApp = async (env, appId) => {
  await kintoneAdmin.request(env, '/k/v1/preview/app/deploy.json', 'POST', {
    apps: [{ app: appId }],
    revert: true,
  });
  await sleep(2000);
  await kintoneAdmin.request(env, '/k/v1/preview/app/form/fields.json', 'PUT', {
    app: appId,
    properties: {
      契約名: { type: 'SINGLE_LINE_TEXT', required: false },
      契約区分: {
        type: 'DROP_DOWN',
        options: TARGET_FIELDS.契約区分.options,
        defaultValue: '新規',
      },
    },
  });
  await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', {
    app: appId,
    views: {},
  });
  await kintoneAdmin.deployApp(env, appId);
};

// プロセス管理を無効にしても、前の記事のステータス・アクションは残る。完了ステータスが無いと
// プラグインの設定保存がエラーで止まる(既存の承認フローを勝手に書き換えない仕様)ため、記事用に
// プラグインの既定と同じ承認フロー(未申請→承認待ち→完了、OFF)にしておく。先頭のステータスは
// 新規に追加できない(APIの仕様)ため、既存の先頭のステータスの名前を「未申請」に変える。
const resetProcessToPluginFlow = async (env, appId) => {
  const current = await kintoneAdmin.request(env, '/k/v1/preview/app/status.json', 'GET', { app: appId });
  const keys = Object.keys(current.states || {}).sort(
    (a, b) => Number(current.states[a].index) - Number(current.states[b].index),
  );
  const states = {
    [keys[0] || '未申請']: {
      name: '未申請',
      index: '0',
      assignee: { type: 'ONE', entities: [{ entity: { type: 'FIELD_ENTITY', code: '作成者' } }] },
    },
    承認待ち: {
      name: '承認待ち',
      index: '1',
      assignee: { type: 'ANY', entities: [{ entity: { type: 'USER', code: env.KINTONE_USERNAME } }] },
    },
    完了: { name: '完了', index: '2', assignee: { type: 'ONE', entities: [] } },
  };
  if (keys.includes('承認待ち') || keys.includes('完了')) {
    // 既にこの記事の承認フローになっている場合は名前の付け替えをしない
    return;
  }
  await kintoneAdmin.updateProcessManagement(env, appId, {
    enable: false,
    states,
    actions: [
      { name: '申請する', from: '未申請', to: '承認待ち', filterCond: '', type: 'PRIMARY' },
      { name: '承認する', from: '承認待ち', to: '完了', filterCond: '', type: 'PRIMARY' },
      { name: '差し戻す', from: '承認待ち', to: '未申請', filterCond: '', type: 'PRIMARY' },
    ],
  });
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
  const targetAppId = await ensureTargetApp(env);
  await resetTargetApp(env, targetAppId);
  const base = `https://${env.KINTONE_DOMAIN}`;
  const screenshotDir = path.join(repoRoot, 'site', 'articles', ARTICLE_SLUG, 'screenshots');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept()); // 設定保存時のalert等を自動で閉じる
  await page.setViewport({ width: 1280, height: 900 });

  const mouseClick = async (handle) => {
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await handle.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const clickByText = async (selector, text) => {
    const handle = await page.waitForFunction(
      (sel, t) =>
        Array.from(document.querySelectorAll(sel)).find(
          (el) => el.offsetParent !== null && el.innerText.trim() === t,
        ),
      { timeout: 20000 },
      selector,
      text,
    );
    await mouseClick(handle.asElement());
  };
  // プロセス管理のアクション → 確認ポップオーバーの「実行」
  const runAction = async (name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await clickByText('span.gaia-app-statusbar-action', name);
    await sleep(500);
    await clickByText('button[name="ok"]', '実行');
  };
  // 完了アクション前の確認ダイアログ(本プラグイン)のボタン。kintoneの[実行]も button[name="ok"] で
  // 裏に残っているため、確認ダイアログ(.asr-confirm)の中のボタンを押す。
  const answerConfirm = (name) =>
    page.evaluate((n) => {
      let c = document.querySelector('.asr-confirm').parentElement;
      while (c && !c.querySelector(`button[name="${n}"]`)) {
        c = c.parentElement;
      }
      c.querySelector(`button[name="${n}"]`).click();
    }, name);
  const waitStatus = async (id, status) => {
    for (let i = 0; i < 90; i++) {
      const { record } = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', { app: appId, id });
      if (record['ステータス'].value === status) {
        return record;
      }
      await sleep(1000);
    }
    throw new Error(`レコード${id}のステータスが${status}になりません`);
  };
  const openDetail = async (id) => {
    await page.goto('about:blank');
    await page.goto(`${base}/k/${appId}/show#record=${id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.asr-detail');
  };
  // 依頼理由(文字列複数行)の入力欄はラベルの文字で探す
  const typeReason = async (text) => {
    const handle = await page.evaluateHandle(() => {
      const label = Array.from(document.querySelectorAll('span, div')).find(
        (el) => el.children.length === 0 && el.textContent.trim() === '依頼理由',
      );
      let box = label;
      while (box && !box.querySelector('textarea')) {
        box = box.parentElement;
      }
      return box.querySelector('textarea');
    });
    await handle.type(text);
  };
  const saveRecord = async () => {
    await Promise.all([
      page.waitForFunction(() => location.href.includes('/show'), { timeout: 60000 }),
      page.$eval('.gaia-ui-actionmenu-save', (el) => el.click()),
    ]);
    await page.waitForSelector('.asr-detail');
    return new URL(page.url()).hash.match(/record=(\d+)/)[1];
  };
  // 要素だけを切り出して撮る(ビューポートを縦長にして、要素全体が入るようにする)
  const shotElement = async (selector, label, pad = 12) => {
    await page.setViewport({ width: 1280, height: 2200 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    const box = await (await page.$(selector)).boundingBox();
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, `${label}.png`),
      clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
    });
    await page.setViewport({ width: 1280, height: 900 });
  };

  try {
    await common.login(page, env);

    // 2. 依頼アプリ(ARTICLE_APP_ID)を白紙に戻す(レコード → フィールド → プラグイン → プロセス管理の順)
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await resetProcessToPluginFlow(env, appId);
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', { app: appId, views: {} }).catch(() => {});
    await kintoneAdmin.request(env, '/k/v1/preview/app/settings.json', 'PUT', { app: appId, name: REQUEST_APP_NAME });
    await kintoneAdmin.deployApp(env, appId);

    // 3〜5. プラグインを追加し、設定画面で保存する(フィールド・スペース・承認フローが自動で作られる)
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.waitForSelector('#js-process-status');
    await page.waitForFunction(() => document.getElementById('js-process-status').textContent !== '');
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');
    await page.setViewport({ width: 1280, height: 900 });
    await Promise.all([
      page.waitForFunction(() => location.href.includes('/flow'), { timeout: 180000 }),
      page.$eval('.kintoneplugin-button-dialog-ok', (el) => el.click()),
    ]);

    // 「変更履歴」一覧(依頼アプリのレコードが、そのままアプリ設定の変更履歴になる)
    const views = (await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'GET', { app: appId })).views;
    views[HISTORY_VIEW_NAME] = {
      type: 'LIST',
      name: HISTORY_VIEW_NAME,
      index: String(Object.keys(views).length),
      fields: ['レコード番号', 'asr_app_name', 'asr_field_label', 'asr_operation', 'asr_reason', 'ステータス', '作成者', 'asr_applied_at'],
      filterCond: '',
      sort: 'レコード番号 asc',
    };
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', { app: appId, views });
    await kintoneAdmin.deployApp(env, appId);

    // 6-1. 依頼①: 契約名を必須にする(依頼画面で入力 → 申請 → 承認 → 確認ダイアログで反映)
    await page.goto(`${base}/k/${appId}/edit`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.asr-editor');
    await page.type('.asr-js-keyword', TARGET_APP_NAME);
    await page.$eval('.asr-js-search', (el) => el.click());
    await page.waitForSelector(`.asr-js-app-results option[value="${targetAppId}"]`);
    await page.select('.asr-js-app-results', targetAppId);
    await page.waitForSelector('.asr-js-field option[value="契約名"]', { timeout: 30000 });
    await page.select('.asr-js-field', '契約名');
    await page.select('.asr-js-operation', 'required');
    await typeReason('契約名の入力漏れがあり、台帳の照合に時間がかかっているため');
    await page.$eval('.asr-js-keyword', (el) => el.blur());
    await shotElement('.asr-editor', 'request-editor');
    const req1 = await saveRecord();
    await runAction('申請する');
    await waitStatus(req1, '承認待ち');
    await openDetail(req1);
    await runAction('承認する');
    await page.waitForSelector('.asr-confirm', { visible: true, timeout: 20000 });
    await sleep(800);
    const dialog = await page.evaluateHandle(() => document.querySelector('.asr-confirm').closest('.ocean-ui-dialog, [role="dialog"]'));
    const db = await dialog.asElement().boundingBox();
    await page.screenshot({
      path: path.join(screenshotDir, 'confirm-dialog.png'),
      clip: { x: db.x - 8, y: db.y - 8, width: db.width + 16, height: db.height + 16 },
    });
    await answerConfirm('ok');
    await waitStatus(req1, '完了');

    // 依頼①の完了後の詳細画面(反映結果・反映日時が記録されている)
    await openDetail(req1);
    await page.setViewport({ width: 1280, height: 1500 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800);
    await common.screenshotToDirectory(page, screenshotDir, 'record-result');
    await page.setViewport({ width: 1280, height: 900 });

    // 6-2. 依頼②: 契約区分に「解約」を追加(依頼はRESTで作成し、承認は画面で行う)
    const app = { id: targetAppId, name: TARGET_APP_NAME, guestSpaceId: '' };
    const optionsChange = ChangeRequest.buildChange({
      app,
      field: { code: '契約区分', label: '契約区分', type: 'DROP_DOWN', subtableCode: '' },
      operation: 'options',
      before: ['新規', '更新'],
      after: [
        { from: '新規', label: '新規' },
        { from: '更新', label: '更新' },
        { from: '', label: '解約' },
      ],
    });
    const createPending = async (change, itemName, opName, reason) => {
      const resp = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
        app: appId,
        record: {
          asr_app_id: { value: change.app.id },
          asr_app_name: { value: change.app.name },
          asr_field_label: { value: itemName },
          asr_operation: { value: opName },
          asr_change_json: { value: ChangeRequest.serialize(change) },
          asr_reason: { value: reason },
        },
      });
      await kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', { app: appId, id: resp.id, action: '申請する' });
      return resp.id;
    };
    const req2 = await createPending(optionsChange, '契約区分(契約区分)', '選択肢の変更', '年度途中の解約を区分で管理したいため');
    await openDetail(req2);
    await runAction('承認する');
    await page.waitForSelector('.asr-confirm', { visible: true, timeout: 20000 });
    await answerConfirm('ok');
    await waitStatus(req2, '完了');

    // 6-3. 依頼③: 一覧の作成(一覧画面のURLを変換して依頼。承認待ちのまま残す)
    // 依頼者の操作どおり、対象アプリの一覧画面で絞り込み(契約区分=更新)と並び順(契約金額 降順)を指定した
    // URLを使う。並び順は「?query=…order by」では効かない(実環境で確認)ため、「絞り込む」ダイアログで指定する
    // (ダイアログには条件が引き継がれ、ソートの初期値は「降順」)。
    await page.goto(
      `${base}/k/${targetAppId}/?query=${encodeURIComponent('契約区分 in ("更新")')}`,
      { waitUntil: 'networkidle0' },
    );
    await mouseClick(await page.waitForSelector('button.gaia-argoui-app-filterbutton'));
    await sleep(1500);
    const combos = await page.$$('.gaia-argoui-app-filter-dialog .gaia-ui-fieldselect-combobox input');
    const sortCombo = combos[combos.length - 1];
    await sortCombo.click({ clickCount: 3 });
    await sortCombo.type('契約金額');
    await sleep(800);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(800);
    await clickByText('.gaia-argoui-app-filter-dialog button', '適用');
    await page.waitForFunction(() => location.hash.includes('sort_0='), { timeout: 20000 });
    const listUrl = page.url();
    await page.goto(`${base}/k/${appId}/edit`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.asr-editor');
    await page.type('.asr-js-app-id', targetAppId);
    await page.$eval('.asr-js-load-id', (el) => el.click());
    await page.waitForSelector('.asr-js-field option[value="契約名"]', { timeout: 30000 });
    await page.$eval('input.asr-js-target-kind[value="view"]', (el) => el.click());
    await page.waitForSelector('.asr-view-editor[data-loaded="1"]');
    await page.select('.asr-js-view-op', 'viewCreate');
    await page.type('.asr-js-view-name', '更新予定の契約(金額順)');
    await page.$eval(
      '.asr-js-view-url',
      (el, url) => {
        el.value = url;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      listUrl,
    );
    await page.$eval('.asr-js-view-convert', (el) => el.click());
    await page.waitForSelector('.asr-converted', { timeout: 40000 });
    await typeReason('次年度の更新手続きの対象を、金額の大きい順に確認したい');
    await shotElement('.asr-editor', 'request-view');
    const req3 = await saveRecord();
    await runAction('申請する');
    await waitStatus(req3, '承認待ち');

    // 7. 依頼アプリの「変更履歴」一覧(=アプリ設定の変更履歴)
    const historyView = (await kintoneAdmin.request(env, '/k/v1/app/views.json', 'GET', { app: appId })).views[HISTORY_VIEW_NAME];
    await page.goto(`${base}/k/${appId}/?view=${historyView.id}`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await common.screenshotToDirectory(page, screenshotDir, 'history-list');
    await page.setViewport({ width: 1280, height: 900 });

    // 変更対象アプリ: 契約名が必須(*)になり、契約区分に「解約」が増えている
    await page.goto(`${base}/k/${targetAppId}/edit`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.control-gaia');
    await sleep(800);
    await common.screenshotToDirectory(page, screenshotDir, 'target-form');
    console.log(`撮影しました: 依頼アプリ ${appId} / 変更対象アプリ ${targetAppId}(依頼 ${req1}, ${req2}, ${req3})`);
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
