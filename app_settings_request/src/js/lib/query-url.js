(function (root) {
  'use strict';

  // 一覧の作成・修正で入力する「一覧画面のURL」の扱い。
  //
  // 一覧画面で絞り込み・ソートしたときのURLは、フィールドコードではなく内部のフィールドID(f13466487)で
  // 条件を持つ(例: /k/791/?view=20&q=f13466487%20%3D%20%2215%22#sort_0=f13466487&order_0=desc。
  // 検証環境で確認、2026-10-21)。フィールドIDとフィールドコードの対応を返す公開APIはないため、
  // このURLを同一オリジンの非表示iframeで開き、そのページの公式JavaScript API
  // kintone.app.getQueryCondition()/getQuery() でフィールドコードのクエリに変換する(desktop.js)。
  // ここではURLの検証(同じkintoneの一覧画面だけを開く)と、getQuery()の結果の分解を行う。

  const LIST_PATH = /^\/k\/(?:guest\/([1-9][0-9]*)\/)?([1-9][0-9]*)\/$/;

  const parseListUrl = (text, origin) => {
    const fail = (error) => ({ ok: false, error });
    const raw = String(text || '').trim();
    if (!raw) {
      return fail('一覧画面のURLを入力してください。');
    }
    let url;
    try {
      url = new URL(raw, origin);
    } catch {
      return fail('URLの形式が正しくありません。');
    }
    if (url.origin !== origin) {
      return fail(
        'このkintone環境の一覧画面のURLを入力してください(別のドメインのURLは使えません)。',
      );
    }
    const match = url.pathname.match(LIST_PATH);
    if (!match) {
      return fail(
        'レコード一覧画面のURL(https://…/k/アプリID/?view=… の形)を入力してください。',
      );
    }
    return {
      ok: true,
      appId: match[2],
      guestSpaceId: match[1] || '',
      viewId: url.searchParams.get('view') || '',
      // iframeには検証済みのパス以降だけを渡す(オリジンは常に自分自身)。
      src: url.pathname + url.search + url.hash,
    };
  };

  // ダブルクォートの外側にあるキーワードの位置を探す(値の中の「order by」等を区切りと誤認しない)。
  const findOutsideQuotes = (query, keyword) => {
    let inQuote = false;
    for (let i = 0; i < query.length; i++) {
      const ch = query[i];
      if (inQuote) {
        if (ch === '\\') {
          i++;
        } else if (ch === '"') {
          inQuote = false;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (
        query.slice(i, i + keyword.length).toLowerCase() === keyword &&
        (i === 0 || /\s/.test(query[i - 1]))
      ) {
        return i;
      }
    }
    return -1;
  };

  // kintone.app.getQuery()の結果「条件 order by 並び順 limit N offset N」を分解する。
  const splitQuery = (query) => {
    let rest = String(query || '').trim();
    const limitAt = findOutsideQuotes(rest, 'limit ');
    if (limitAt !== -1) {
      rest = rest.slice(0, limitAt).trim();
    }
    const orderAt = findOutsideQuotes(rest, 'order by ');
    if (orderAt === -1) {
      return { filterCond: rest, sort: '' };
    }
    return {
      filterCond: rest.slice(0, orderAt).trim(),
      sort: rest.slice(orderAt + 'order by '.length).trim(),
    };
  };

  const QueryUrl = { parseListUrl, splitQuery };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueryUrl;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.QueryUrl = QueryUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
