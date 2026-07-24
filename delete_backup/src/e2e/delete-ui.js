'use strict';

// レコード詳細画面での削除操作(「オプション」→「レコードを削除」→確認ポップアップの
// 「削除する」)。kintone標準UIの実装依存のセレクターであり、実機のPuppeteerで実際に
// クリックして確認済み(ログイン画面のセレクターと同様、kintoneのアップデートで変わる可能性がある)。
//
// - オプションメニューのボタン: .gaia-argoui-optionmenubutton
// - 削除メニュー項目: a[title="レコードを削除"]
// - 確認ポップアップの「削除する」ボタン: .removelink-confirm-btn-cybozu
//   (「キャンセル」ボタンも同じクラス名で、テキスト内容でしか区別できない)

const openDeleteConfirmation = async (page, domain, appId, recordId) => {
  await page.goto(`https://${domain}/k/${appId}/show#record=${recordId}`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForSelector('.gaia-argoui-optionmenubutton');
  await page.click('.gaia-argoui-optionmenubutton');
  await page.waitForSelector('a[title="レコードを削除"]');
  await page.click('a[title="レコードを削除"]');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.removelink-confirm-btn-cybozu')].some(
      (el) => el.textContent.trim() === '削除する',
    ),
  );
};

const confirmDelete = (page) =>
  page.evaluate(() => {
    const btn = [
      ...document.querySelectorAll('.removelink-confirm-btn-cybozu'),
    ].find((el) => el.textContent.trim() === '削除する');
    btn.click();
  });

module.exports = { openDeleteConfirmation, confirmDelete };
