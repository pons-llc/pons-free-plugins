'use strict';

// React/JSXサポートを有効にした場合の実環境テスト(実行方式はblob。理由は下記)。以下を確認する:
//   1. リンクが実際に別タブで開くこと
//   2. import map経由でbareインポート('react'/'lucide-react')が解決され、Babel standaloneが
//      JSXを実際に変換し、Tailwind CDNがユーティリティクラスを実際に適用すること
//      (ユーザーの実際の入力例〈`export default function App() {...}`、bare import、JSX、
//      Tailwindクラス〉を再現したサンプルで検証する)
//   3. HTMLフィールドが空でもJSだけでDOM(#root)が組み立てられ、「未入力」扱いにならないこと
//
// 実行方式をblobにしている理由: data方式は`data:`URLへのトップレベル遷移になるが、実際に
// このE2E環境のChrome(Puppeteerバンドル版)で試したところ、リンクをクリックしても別タブが
// 一切開かない(targetcreatedイベントが発火しない)ことを確認した。これはidea.md「実行方式の選択」
// に記載したとおり「主要ブラウザはフィッシング対策としてdata:URLへのトップレベル遷移を
// 制限・ブロックする傾向がある」という設計上のリスクが実際に顕在化したものであり、プラグインの
// 不具合ではない(data方式自体のE2E確認は`data-url-mode.e2e.test.js`でhrefの形式のみを
// ブラウザナビゲーションを伴わずに検証する)。React/JSXサポート自体の検証には影響しないため、
// ここでは確実に別タブが開くblob方式を使う。
//
// 事前準備・実行方法はconfig-screen.e2e.test.jsと同様。CDN(esm.sh/unpkg.com/cdn.tailwindcss.com)
// への実通信を伴うため、他のE2Eテストよりネットワーク状況に左右されやすい。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  HTML_FIELD_CODE,
  CSS_FIELD_CODE,
  JS_FIELD_CODE,
  REACT_MARKER_TEXT,
  ensureReactSeedRecord,
  openRecordDetailViaIndex,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

// detail-link.e2e.test.jsと同じ考え方で、実行方式・Reactサポートの状態も含めて自己完結で
// 確認・保存する(他のテストファイルが別の値を保存している場合に備える)。
const ensureConfigured = async (page, env, appId, pluginId) => {
  await common.openPluginConfig(page, env, appId, pluginId);
  const current = await page.evaluate(() => ({
    html: document.querySelector('.js-html-field').value,
    css: document.querySelector('.js-css-field').value,
    js: document.querySelector('.js-js-field').value,
    executionMode: document.querySelector('.js-execution-mode:checked')?.value,
    enableReact: document.querySelector('.js-enable-react').checked,
  }));
  if (
    current.html === HTML_FIELD_CODE &&
    current.css === CSS_FIELD_CODE &&
    current.js === JS_FIELD_CODE &&
    current.executionMode === 'blob' &&
    current.enableReact === true
  ) {
    return;
  }
  await page.select('.js-html-field', HTML_FIELD_CODE);
  await page.select('.js-css-field', CSS_FIELD_CODE);
  await page.select('.js-js-field', JS_FIELD_CODE);
  await page.click('.js-execution-mode[value="blob"]');
  await page.evaluate(() => {
    const el = document.querySelector('.js-enable-react');
    if (!el.checked) {
      el.click();
    }
  });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.kintoneplugin-button-dialog-ok'),
  ]);
  await kintoneAdmin.deployApp(env, appId);
};

describe('React/JSXサポート(実環境、実行方式blob)', () => {
  let browser;
  let page;
  let env;
  let seedRecordId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    const seed = await ensureReactSeedRecord(env, env.TEST_APP_ID_1);
    seedRecordId = seed.recordId;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    await ensureConfigured(page, env, env.TEST_APP_ID_1, pluginId);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('HTMLが空でもJSのReactコンポーネントが実際に描画され、lucide-react・Tailwindも効く', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openRecordDetailViaIndex(page, env, env.TEST_APP_ID_1, seedRecordId);

    // HTMLフィールドは空だが、JSに内容があるため「未入力」扱いにならずリンクが出る
    // (idea.md「HTML/JSフィールドがどちらも未入力」参照)。
    const linkEl = await page.waitForSelector('.genai-app-share-link');
    const href = await page.evaluate((el) => el.getAttribute('href'), linkEl);
    expect(href).toMatch(/^blob:/);

    const [newPage] = await Promise.all([
      new Promise((resolve) =>
        browser.once('targetcreated', async (target) =>
          resolve(await target.page()),
        ),
      ),
      linkEl.click(),
    ]);
    await newPage.waitForSelector('iframe');
    const innerFrame = newPage
      .frames()
      .find((frame) => frame.parentFrame() !== null);
    expect(innerFrame).toBeDefined();

    await innerFrame.waitForSelector('#react-app-marker', { timeout: 30000 });

    const markerText = await innerFrame.$eval(
      '#react-app-marker span',
      (el) => el.textContent,
    );
    expect(markerText).toBe(REACT_MARKER_TEXT);

    // lucide-react経由のアイコンが実際にSVGとして描画されている(import mapの
    // 'lucide-react'解決が効いていることの確認)。
    const iconCount = await innerFrame.$$eval(
      '#react-app-marker svg',
      (els) => els.length,
    );
    expect(iconCount).toBeGreaterThan(0);

    // Tailwind CDNが実際にユーティリティクラス(text-red-500)を適用している。
    const color = await innerFrame.$eval(
      '#react-app-marker',
      (el) => getComputedStyle(el).color,
    );
    expect(color).toBe('rgb(239, 68, 68)'); // Tailwindのtext-red-500

    await newPage.close();
    expect(pageErrors).toEqual([]);
  }, 90000);
});
