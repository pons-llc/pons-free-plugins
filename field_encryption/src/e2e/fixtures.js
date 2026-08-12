'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールド・レイアウトを
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields()/ensureSpacerInLayout()を
// 使う(既存のものは触らない、org_lookupと同じ方針)。
//
// TEST_APP_ID_1には標準の文字列(1行)「文字列__1行_」・文字列(複数行)「文字列__複数行_」が
// 既に用意されている(CLAUDE.md開発方針7、実機で確認済み)ため、暗号化対象フィールドを新設する
// 必要は無い。復号ボタン用のスペースフィールドのみ、このプラグイン専用のものを新設する
// (既存のspace1/space2は他のプラグインの手動検証で使われている可能性があるため使い回さない)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_FIELD_CODES = {
  single: '文字列__1行_',
  multi: '文字列__複数行_',
};

const SPACE_ELEMENT_ID = 'fe_decrypt_space';

const ensureDecryptSpace = (env, appId) =>
  kintoneAdmin.ensureSpacerInLayout(env, appId, SPACE_ELEMENT_ID);

// レコード詳細画面(app.record.detail.show)へは、実際のユーザー導線(一覧画面→対象レコードの
// クリック)で遷移する。page.goto()で/show#record=...へ直接ハードナビゲーションすると、
// kintone管理画面のSPA内部状態が正しく設定されずkintone.app.record.get()がnullを返す
// (related_record_summary/src/e2e/fixtures.jsと同じ問題、実環境で確認済み)。
//
// 一覧画面の行クリックはReactの合成イベント(mousedown/mouseup)で処理されており、
// element.click()(DOM API、isTrusted:false)では反応しないため、行の先頭セルに対して
// ElementHandle.click()(実際のマウス座標を伴うトラステッドクリック)する。
//
// TEST_APP_ID_1の既定の一覧ビューは「(作業者が自分)」という絞り込みビューになっており、
// 管理者ユーザーには何も表示されないため、先に「(すべて)」ビューへ切り替える。
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

// レコード詳細画面から「レコードを編集する」リンク(a.gaia-argoui-app-menu-edit、実環境で
// 確認済みのセレクター、title属性が「レコードを編集する」)をクリックしてレコード編集画面へ
// 遷移する。同じクラスを持つ要素がDOM上に複数存在し(非表示の複製を含む)、page.$()やElementHandle
// が拾う要素と実際に画面へ表示されている要素が一致するとは限らない(実環境で確認済み: 通常の
// ElementHandle.click()だと"Node is either not clickable or not an Element"になったり、
// クリックはできても画面遷移しなかったりする)。そのためdocument.elementFromPoint()を使わず、
// offsetParentがnullでない(実際にレイアウトされ表示されている)要素だけをtitle属性で絞り込み、
// その中心座標をpage.mouse.click()で直接クリックする。
const openRecordEditFromDetail = async (page) => {
  await page.waitForSelector('a.gaia-argoui-app-menu-edit');
  const center = await page.evaluate(() => {
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
  if (!center) {
    throw new Error(
      '「レコードを編集する」リンクが表示状態で見つかりませんでした。',
    );
  }
  await page.mouse.click(center.x, center.y);
  // 新規作成画面(/edit というパス)とは異なり、既存レコードの編集は`/show#record=...`と同じURLに
  // `&mode=edit`が付与されるだけでパス自体は変わらない(実環境で確認済み)。
  await page.waitForFunction(() => location.href.includes('mode=edit'));
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});
};

module.exports = {
  TARGET_FIELD_CODES,
  SPACE_ELEMENT_ID,
  ensureDecryptSpace,
  openRecordDetailViaIndex,
  openRecordEditFromDetail,
};
