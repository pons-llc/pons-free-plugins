(function (global) {
  'use strict';

  const NS = (global.SelfLookup = global.SelfLookup || {});

  // desktop.js/mobile.js共通のモーダルDOM構築のみを持つ。kintone APIは呼ばず、呼び出し側から
  // レコード一覧とコールバックを受け取ってDOMを組み立てるだけ(security-checklist.md参照、
  // REST APIで取得した他レコードの値はtextContentでのみ描画しXSSを防ぐ)。

  const closeModal = (overlayEl) => {
    if (overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
  };

  // ボタン押下時の検索結果を一覧表示し、クリックで選ばせるモーダルを表示する
  // (検索結果が1件の場合も含め、常にこのモーダルで確認・反映させる。user-test.mdフィードバック反映、
  // 「ボタンを押すとモーダルが出ると思っていたが即時反映されていた」という指摘への対応)。
  // previewFieldCodesは設定画面で選んだ表示フィールド(未設定時はフィールドマッピングの検索先フィールドに
  // フォールバック、呼び出し側で解決済み)。fieldLabelByCodeが渡された場合は「ラベル: 値」形式で表示する。
  // onSelect(record)が選択されたレコードで呼ばれる。
  const showResultModal = ({
    records,
    previewFieldCodes,
    fieldLabelByCode,
    onSelect,
  }) => {
    const overlayEl = document.createElement('div');
    overlayEl.className = 'slk-modal-overlay';

    const modalEl = document.createElement('div');
    modalEl.className = 'slk-modal';

    const headingEl = document.createElement('div');
    headingEl.className = 'slk-modal-heading';
    headingEl.textContent = `${records.length}件のレコードが見つかりました。反映するレコードを選択してください。`;
    modalEl.appendChild(headingEl);

    const listEl = document.createElement('div');
    listEl.className = 'slk-modal-list';
    records.forEach((record) => {
      const rowEl = document.createElement('button');
      rowEl.type = 'button';
      rowEl.className = 'slk-modal-row';

      const previewParts = (previewFieldCodes || [])
        .map((fieldCode) => {
          const field = record ? record[fieldCode] : undefined;
          if (!field || field.value === '' || field.value === undefined) {
            return '';
          }
          const label =
            (fieldLabelByCode && fieldLabelByCode[fieldCode]) || fieldCode;
          return `${label}: ${field.value}`;
        })
        .filter((text) => text !== '');
      const recordNumber = record && record.$id ? record.$id.value : undefined;

      // textContentのみを使う(innerHTMLは使わない、security-checklist.md参照)。
      rowEl.textContent =
        previewParts.length > 0
          ? previewParts.join(' / ')
          : `レコード番号: ${recordNumber || ''}`;

      rowEl.addEventListener('click', () => {
        closeModal(overlayEl);
        onSelect(record);
      });
      listEl.appendChild(rowEl);
    });
    modalEl.appendChild(listEl);

    const cancelButtonEl = document.createElement('button');
    cancelButtonEl.type = 'button';
    cancelButtonEl.className =
      'kintoneplugin-button-dialog-cancel slk-modal-cancel';
    cancelButtonEl.textContent = 'キャンセル';
    cancelButtonEl.addEventListener('click', () => closeModal(overlayEl));
    modalEl.appendChild(cancelButtonEl);

    overlayEl.appendChild(modalEl);
    document.body.appendChild(overlayEl);
  };

  const LookupUI = { showResultModal };

  NS.LookupUI = LookupUI;
})(typeof window !== 'undefined' ? window : globalThis);
