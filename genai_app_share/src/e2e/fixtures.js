'use strict';

// このプラグインのE2Eテストが必要とするデータを冪等に用意する。
//
// TEST_APP_ID_1には文字列複数行(MULTI_LINE_TEXT)フィールドが3つ標準搭載されている
// (文字列__複数行_/文字列__複数行__0/文字列__複数行__1、CLAUDE.md「フィールドの確認は必須、
// 作成は基本不要」の対象。新規作成は不要)ため、これらをHTML/CSS/JSフィールドとして使う。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const HTML_FIELD_CODE = '文字列__複数行_';
const CSS_FIELD_CODE = '文字列__複数行__0';
const JS_FIELD_CODE = '文字列__複数行__1';

const MARKER_TEXT = 'genai_app_share_e2e_seed';

const SAMPLE_HTML = `<h1 id="greeting">${MARKER_TEXT}</h1>`;
const SAMPLE_CSS = '#greeting{color:red}';
// JSからDOMを書き換えたことを、外側のPuppeteerテストから検証できるようにする
// (iframeの中で実際にJSが実行されたことの確認、idea.md「セキュリティ設計」参照)。
const SAMPLE_JS =
  'document.getElementById("greeting").textContent = "hello from js";';

// TEST_APP_ID_1に、HTML/CSS/JSサンプルを入れたシードレコードを1件用意する(既にあれば再作成しない)。
const ensureSeedRecord = async (env, appId) => {
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `${HTML_FIELD_CODE} like "${MARKER_TEXT}"`,
    },
  );
  if (existing.records.length > 0) {
    return { created: false, recordId: existing.records[0].$id.value };
  }
  const res = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: {
      [HTML_FIELD_CODE]: { value: SAMPLE_HTML },
      [CSS_FIELD_CODE]: { value: SAMPLE_CSS },
      [JS_FIELD_CODE]: { value: SAMPLE_JS },
    },
  });
  return { created: true, recordId: res.id };
};

// React/JSXサポート(enableReact: true)の検証用サンプル。ユーザーの実際の入力例
// (`export default function App() {...}`、bare importの`react`/`lucide-react`、JSX、
// Tailwindのユーティリティクラス)を最小限に再現し、import map・Babel変換・Tailwind CDNの
// 3点がすべて実際に効くことをE2Eで確認する(idea.md「React/JSXサポート」参照)。
const REACT_MARKER_TEXT = 'genai_app_share_e2e_react_seed';
const REACT_SAMPLE_JS = `import React from 'react';
import { Check } from 'lucide-react';

export default function App() {
  return (
    <div id="react-app-marker" className="text-red-500">
      <Check data-testid="lucide-icon" />
      <span>${REACT_MARKER_TEXT}</span>
    </div>
  );
}`;

const ensureReactSeedRecord = async (env, appId) => {
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `${JS_FIELD_CODE} like "${REACT_MARKER_TEXT}"`,
    },
  );
  if (existing.records.length > 0) {
    return { created: false, recordId: existing.records[0].$id.value };
  }
  const res = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: {
      [HTML_FIELD_CODE]: { value: '' },
      [CSS_FIELD_CODE]: { value: '' },
      [JS_FIELD_CODE]: { value: REACT_SAMPLE_JS },
    },
  });
  return { created: true, recordId: res.id };
};

// レコード詳細画面(app.record.detail.show)へは、実際のユーザー導線(一覧画面→対象レコードの
// クリック)で遷移する(related_record_summaryのfixtures.jsと同じ理由・同じ実装。
// page.goto()による/show への直接ハードナビゲーションはkintone管理画面のSPA内部状態が
// 正しく設定されずJavaScript APIが失敗するため使えないことを実環境で確認済み)。
const openRecordDetailViaIndex = async (page, env, appId, recordId) => {
  await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
    waitUntil: 'networkidle0',
  });
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});

  const viewToggle = await page.$('.gaia-argoui-app-viewtoggle');
  if (viewToggle) {
    await viewToggle.click();
    const allViewHandle = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll('*')).find(
        (el) =>
          el.children.length === 0 && el.textContent.trim() === '（すべて）',
      ),
    );
    const allViewEl = allViewHandle.asElement();
    if (allViewEl) {
      await allViewEl.click();
      await page
        .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
        .catch(() => {});
    }
  }

  const rows = await page.$$('.recordlist-row-gaia');
  for (const row of rows) {
    const recordNumberText = await page.evaluate((el) => el.textContent, row);
    if (new RegExp(`^${recordId}(\\D|$)`).test(recordNumberText)) {
      const firstCell = await row.$('div,td,span');
      await firstCell.click();
      await page.waitForFunction(() => location.href.includes('/show'));
      await page
        .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
        .catch(() => {});
      return;
    }
  }
  throw new Error(
    `一覧画面にレコード(${recordId})の行が見つかりませんでした。`,
  );
};

module.exports = {
  HTML_FIELD_CODE,
  CSS_FIELD_CODE,
  JS_FIELD_CODE,
  MARKER_TEXT,
  REACT_MARKER_TEXT,
  ensureSeedRecord,
  ensureReactSeedRecord,
  openRecordDetailViaIndex,
};
