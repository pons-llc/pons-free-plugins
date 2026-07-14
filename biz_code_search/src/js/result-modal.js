(function (global) {
  'use strict';

  const NS = (global.BizCodeSearch = global.BizCodeSearch || {});

  // desktop.js/mobile.js共通のモーダルDOM構築のみを持つ。kintone APIは呼ばず、呼び出し側から
  // gBizINFOの検索結果一覧とコールバックを受け取ってDOMを組み立てるだけ(security-checklist.md参照、
  // 外部APIから取得した値はtextContentでのみ描画しXSSを防ぐ)。

  const closeModal = (overlayEl) => {
    if (overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
  };

  // ラベル付きで法人情報を1件分「ラベル: 値」形式の文字列にする(値が無い項目は省く)。
  const PREVIEW_FIELDS = [
    { key: 'name', label: '法人名' },
    { key: 'corporate_number', label: '法人番号' },
    { key: 'location', label: '所在地' },
    { key: 'postal_code', label: '郵便番号' },
    { key: 'status', label: 'ステータス' },
  ];

  // 法人名検索の結果(件数にかかわらず)を一覧表示し、クリックで選ばせるモーダルを表示する
  // (self_lookupの「常にモーダル経由、自動即時反映はしない」方針を踏襲、idea.md参照)。
  // items: gBizINFO検索結果(corporate_number/name/location/postal_code/status等を持つ配列)。
  // onSelect(item)が選択された法人情報で呼ばれる。
  const showSearchResultModal = ({ items, onSelect }) => {
    const overlayEl = document.createElement('div');
    overlayEl.className = 'bcs-modal-overlay';

    const modalEl = document.createElement('div');
    modalEl.className = 'bcs-modal';

    const headingEl = document.createElement('div');
    headingEl.className = 'bcs-modal-heading';
    headingEl.textContent = `${items.length}件の法人が見つかりました。反映する法人を選択してください。`;
    modalEl.appendChild(headingEl);

    const listEl = document.createElement('div');
    listEl.className = 'bcs-modal-list';
    items.forEach((item) => {
      const rowEl = document.createElement('button');
      rowEl.type = 'button';
      rowEl.className = 'bcs-modal-row';

      const previewParts = PREVIEW_FIELDS.map(({ key, label }) => {
        const value = item ? item[key] : undefined;
        return value ? `${label}: ${value}` : '';
      }).filter((text) => text !== '');

      // textContentのみを使う(innerHTMLは使わない、security-checklist.md参照)。
      rowEl.textContent = previewParts.join(' / ');

      rowEl.addEventListener('click', () => {
        closeModal(overlayEl);
        onSelect(item);
      });
      listEl.appendChild(rowEl);
    });
    modalEl.appendChild(listEl);

    const cancelButtonEl = document.createElement('button');
    cancelButtonEl.type = 'button';
    cancelButtonEl.className =
      'kintoneplugin-button-dialog-cancel bcs-modal-cancel';
    cancelButtonEl.textContent = 'キャンセル';
    cancelButtonEl.addEventListener('click', () => closeModal(overlayEl));
    modalEl.appendChild(cancelButtonEl);

    overlayEl.appendChild(modalEl);
    document.body.appendChild(overlayEl);
  };

  const ResultModal = { showSearchResultModal };

  NS.ResultModal = ResultModal;
})(typeof window !== 'undefined' ? window : globalThis);
