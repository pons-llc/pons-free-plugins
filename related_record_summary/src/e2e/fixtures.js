'use strict';

// このプラグインのe2eテストが必要とするデータを冪等に用意する。
//
// 関連レコード一覧フィールド「関連レコード一覧」自体はTEST_APP_ID_1に手動設定済み
// (参照先アプリ=TEST_APP_ID_2、条件: 文字列__1行_ = 文字列__1行_、
// さらに絞り込む条件: ラジオボタン in ("sample1"))であり、CLAUDE.md開発方針7の対象外
// (フィールドの作成ではなくフィールド設定の一部である`referenceTable`は
// ensureFormFields()では作れないため、今回はこの既存設定にテストを合わせる)。
//
// このテストが必要とするのは、TEST_APP_ID_1側に「参照先アプリのsample1グループと
// 文字列__1行_で一致する」レコードが1件存在することだけ。文字列__1行_はプラグイン間で
// 共有される汎用フィールドのため、他プラグインのフィクスチャと衝突しないよう
// 文字列__1行__1(未使用)にマーカー値を入れて、自分が作ったシードレコードを再実行時に
// 再利用できるようにする(冪等)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

// レコード詳細画面(app.record.detail.show)へは、実際のユーザー導線(一覧画面→対象レコードの
// クリック)で遷移する。`page.goto()`で`/show#record=...`へ直接ハードナビゲーションすると、
// kintone管理画面のSPA内部状態が正しく設定されず、kintone.app.record.get()がnullを返す
// (common.jsのopenPluginConfig()と同種の問題、実環境で確認済み)。
//
// また、一覧画面の行クリックはReactの合成イベント(mousedown/mouseup)で処理されており、
// `element.click()`(DOM API、isTrusted:false)や、行全体(横に非常に幅広く、可視領域外まで
// 伸びている)の中心点をクリックするPuppeteerの既定動作では反応しない。行の先頭セル
// (レコード番号列)に対してElementHandle.click()(実際のマウス座標を伴うトラステッドクリック)
// する必要がある(実環境で確認済み)。
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

const MATCH_FIELD_CODE = '文字列__1行_';
const MATCH_VALUE = 'あ'; // TEST_APP_ID_2側の sample1 グループのレコードと一致させる値
const MARKER_FIELD_CODE = '文字列__1行__1';
const MARKER_VALUE = 'rrs_e2e_seed';

const REFERENCE_FIELD_CODE = '関連レコード一覧';
const RELATED_TARGET_FIELD_CODE = '数値'; // 参照先アプリの集計対象フィールド(SUM/AVERAGE用)
const WRITE_FIELD_SUM = '数値_1'; // 自アプリの書き込み先(合計)
const WRITE_FIELD_COUNT = '数値_2'; // 自アプリの書き込み先(件数)

// TEST_APP_ID_1に、参照先アプリのsample1グループと一致するシードレコードを1件用意する
// (既にあれば再作成しない)。
const ensureSeedRecord = async (env, appId) => {
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `${MARKER_FIELD_CODE} = "${MARKER_VALUE}"`,
    },
  );
  if (existing.records && existing.records.length > 0) {
    return { created: false, recordId: existing.records[0].$id.value };
  }
  const res = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: {
      [MATCH_FIELD_CODE]: { value: MATCH_VALUE },
      [MARKER_FIELD_CODE]: { value: MARKER_VALUE },
    },
  });
  return { created: true, recordId: res.id };
};

module.exports = {
  MATCH_FIELD_CODE,
  MATCH_VALUE,
  MARKER_FIELD_CODE,
  MARKER_VALUE,
  REFERENCE_FIELD_CODE,
  RELATED_TARGET_FIELD_CODE,
  WRITE_FIELD_SUM,
  WRITE_FIELD_COUNT,
  ensureSeedRecord,
  openRecordDetailViaIndex,
};
