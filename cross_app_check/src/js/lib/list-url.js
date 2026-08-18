(function (root) {
  'use strict';

  // kintoneのレコード一覧画面のURLから、アプリID・絞り込みクエリ・一覧IDを取り出す。
  //
  // 「クエリ記法で条件を書いてください」と言われても普通の利用者には書けないので、
  // 「一覧画面で絞り込んで、そのURLをコピーして貼る」だけで条件を指定できるようにする。
  //
  // 公式ドキュメント「URL内のクエリで、表示するレコードの条件を指定する」より、
  // 一覧のURLは次の形をとる。
  //   https://{domain}/k/{APP_ID}/?view={VIEW_ID}
  //   https://{domain}/k/{APP_ID}/?query={URLエンコードしたクエリ}
  // ゲストスペースのアプリは /k/guest/{SPACE_ID}/{APP_ID}/ になる。
  //
  // `view`しか付いていない場合、その一覧に保存された絞り込み条件はURLには現れない。
  // 呼び出し側が views API(GET /k/v1/app/views.json)の`filterCond`で解決する必要があるため、
  // ここでは viewId をそのまま返す。

  // /k/123/ と /k/guest/5/123/ の両方からアプリIDを取る
  const APP_ID_PATTERN = /\/k\/(?:guest\/\d+\/)?(\d+)(?:\/|$)/;

  const decodeQuery = (raw) => {
    if (!raw) {
      return '';
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      // 不正なパーセントエンコードが混じっていた場合はそのまま返す
      return raw;
    }
  };

  // URLSearchParamsに頼らず自前で拾う。
  // kintoneのクエリは`%20`区切りだが、貼り付け経路によっては`+`が空白ではなく
  // 「プラス記号そのもの」として入っていることがあり、URLSearchParamsだと
  // `+`を空白に変換してしまってクエリが壊れるため。
  const readParam = (search, name) => {
    const pattern = new RegExp(`[?&]${name}=([^&#]*)`);
    const matched = pattern.exec(search);
    return matched ? decodeQuery(matched[1]) : '';
  };

  // 貼り付けられた文字列を解析する。
  // 戻り値: { ok, appId, query, viewId, error }
  const parse = (input) => {
    const text = String(input || '').trim();
    if (text === '') {
      return {
        ok: false,
        appId: '',
        query: '',
        viewId: '',
        error: 'URLを貼り付けてください。',
      };
    }

    const appIdMatch = APP_ID_PATTERN.exec(text);
    if (!appIdMatch) {
      return {
        ok: false,
        appId: '',
        query: '',
        viewId: '',
        error:
          'kintoneのレコード一覧のURLではないようです(「/k/アプリID/」を含むURLを貼り付けてください)。',
      };
    }

    // クエリ文字列部分。ハッシュより後ろに付くこともあるため全体から拾う。
    const query = readParam(text, 'query') || readParam(text, 'q');
    const viewId = readParam(text, 'view');

    return {
      ok: true,
      appId: appIdMatch[1],
      query,
      viewId: /^\d+$/.test(viewId) ? viewId : '',
      error: '',
    };
  };

  // 一覧に保存された絞り込み条件(filterCond)と、URLに直接書かれたクエリを1本にまとめる。
  // 両方あるときはANDでつなぐ(kintoneの画面上も「一覧の条件 かつ 絞り込み条件」で表示されるため)。
  const combineQuery = (viewFilterCond, urlQuery) => {
    const parts = [viewFilterCond, urlQuery]
      .map((part) => String(part || '').trim())
      .filter((part) => part !== '');
    if (parts.length === 0) {
      return '';
    }
    if (parts.length === 1) {
      return parts[0];
    }
    return parts.map((part) => `(${part})`).join(' and ');
  };

  // 画面に「この条件で読み込みます」と出すための説明文
  const describe = (query) =>
    query && query.trim() !== ''
      ? query.trim()
      : '(絞り込みなし・全レコードが対象)';

  const ListUrl = {
    parse,
    combineQuery,
    describe,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ListUrl;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.ListUrl = ListUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
