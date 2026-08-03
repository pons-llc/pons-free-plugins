(function (root) {
  'use strict';

  // 利用者が入力したHTML/CSS/JSから、プレビュー用のHTMLドキュメントを組み立てる純粋関数。
  // idea.md「生成ページの組み立て」「React/JSXサポート」「実行方式の選択」参照。
  //
  // - HTMLフィールドの値はエスケープしない(実行させることが機能そのものであるため)。
  // - CSS中の`</style`・JS中の`</script`(大文字小文字を問わない)は`<\/style`・`<\/script`に
  //   置換してから埋め込む。バックスラッシュを挟むことでHTMLパーサーが終了タグとして
  //   認識しなくなり、意図せずタグが閉じて後続のマークアップが壊れることを防ぐ
  //   (`</script>`を文字列としてHTMLへ展開する際の標準的な対策。`type="text/babel"`も
  //   同じ`<script>`要素であるため同様に必要)。
  const escapeClosingTag = (content, tagName) => {
    const pattern = new RegExp(`</(${tagName})`, 'gi');
    return String(content || '').replace(pattern, '<\\/$1');
  };

  // React/JSXサポート(オプトイン、既定OFF)で使う外部CDN一式。有効化した場合のみ読み込まれる
  // (idea.md「React/JSXサポート」参照。CLAUDE.md開発方針9の例外運用、plugin_catalog_builderと同じ考え方)。
  const REACT_IMPORT_MAP = {
    imports: {
      react: 'https://esm.sh/react@18',
      'react-dom': 'https://esm.sh/react-dom@18',
      'react-dom/client': 'https://esm.sh/react-dom@18/client',
      'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
      'lucide-react': 'https://esm.sh/lucide-react?external=react',
      recharts: 'https://esm.sh/recharts?external=react,react-dom',
    },
  };
  const BABEL_STANDALONE_URL =
    'https://unpkg.com/@babel/standalone@7/babel.min.js';
  const TAILWIND_CDN_URL = 'https://cdn.tailwindcss.com';

  // 利用者は`export default function App() { ... }`の形式でルートコンポーネントを書く規約
  // (idea.md参照)。同じモジュールスクリプト内に末尾から追記することで、importやexportの
  // 手間なくトップレベルの`App`識別子をそのまま参照できる。
  const REACT_MOUNT_BOOTSTRAP = [
    "import { createRoot } from 'react-dom/client';",
    "const __genaiRootEl = document.getElementById('root') || (() => {",
    "  const el = document.createElement('div');",
    "  el.id = 'root';",
    '  document.body.appendChild(el);',
    '  return el;',
    '})();',
    "if (typeof App === 'function') {",
    '  createRoot(__genaiRootEl).render(<App />);',
    '} else {',
    '  console.error(\'genai_app_share: "export default function App() {...}" が見つかりませんでした。\');',
    '}',
  ].join('\n');

  // executionMode: 'data'のときのみ使用する自己リロードのガード。data:URLを別タブで開いた直後、
  // 実機のChromeで初回描画が白紙のまま止まり、手動でリロードすると表示されることを確認済み
  // (Chromiumの既知の挙動と思われる。長いdata:URIを新規タブで開んだ際、初回の描画が
  // トリガーされないことがある)。location.hashに印を付けてからlocation.reload()を1回だけ
  // 実行することで、利用者が手動でリロードするのと同じ効果を自動で起こす。
  // - location.hashはURLの一部としてreload()後も保持される(sessionStorage等と異なり、
  //   data:URLのオリジンの扱いに依存しないため、無限ループの防止条件として確実)。
  // - `blob`方式ではこの現象が起きないため使用しない(idea.md「実行方式の選択」参照)。
  const SELF_RELOAD_HASH = '#genai-app-share-reloaded';
  const buildSelfReloadGuardScript = () =>
    [
      '<script>',
      '(function () {',
      `  if (location.hash !== '${SELF_RELOAD_HASH}') {`,
      `    location.hash = '${SELF_RELOAD_HASH.slice(1)}';`,
      '    location.reload();',
      '  }',
      '})();',
      '</script>',
    ].join('\n');

  const buildScriptTag = (safeJs, reactMode) => {
    if (!reactMode) {
      return `<script type="module">${safeJs}</script>`;
    }
    return `<script type="text/babel" data-type="module" data-presets="react">${safeJs}\n${REACT_MOUNT_BOOTSTRAP}</script>`;
  };

  const buildReactHeadTags = () =>
    [
      `<script type="importmap">${JSON.stringify(REACT_IMPORT_MAP)}</script>`,
      `<script src="${BABEL_STANDALONE_URL}"></script>`,
      `<script src="${TAILWIND_CDN_URL}"></script>`,
    ].join('\n');

  const buildInnerDocument = ({ html, css, js, reactMode, selfReloadOnce }) => {
    const safeCss = escapeClosingTag(css, 'style');
    const safeJs = escapeClosingTag(js, 'script');
    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      selfReloadOnce ? buildSelfReloadGuardScript() : '',
      reactMode ? buildReactHeadTags() : '',
      `<style>${safeCss}</style>`,
      '</head>',
      '<body>',
      html || '',
      buildScriptTag(safeJs, reactMode),
      '</body>',
      '</html>',
    ]
      .filter((line) => line !== '')
      .join('\n');
  };

  // 別タブで開く「殻」ページ。実際のHTML/CSS/JSはinnerUrl(Blob URL)を指すsandbox化iframeの
  // 中だけで実行させ、kintoneと同一オリジンの特権を持たせない(idea.md「セキュリティ設計」参照)。
  // innerUrlはURL.createObjectURL()が返す`blob:https://...`形式で、HTML属性値として
  // エスケープが必要な文字(`"`や`&`等)を含まないため、そのまま埋め込んでよい。
  // (executionMode: 'blob'のときのみ使用する)
  const SANDBOX_PERMISSIONS =
    'allow-scripts allow-modals allow-forms allow-popups';

  const buildOuterShellDocument = ({ innerUrl }) =>
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<title>生成AIアプリ</title>',
      '<style>html,body{margin:0;padding:0;height:100%;}iframe{border:0;width:100%;height:100%;display:block;}</style>',
      '</head>',
      '<body>',
      `<iframe src="${innerUrl}" sandbox="${SANDBOX_PERMISSIONS}"></iframe>`,
      '</body>',
      '</html>',
    ].join('\n');

  // executionMode: 'data'のときのみ使用する。`data:`URLは作成元を継承せず常に独立した
  // opaqueオリジンになるため(idea.md「実行方式の選択」参照)、sandbox iframeを介さず
  // このURLをそのままリンクのhrefにできる。
  const buildDataUrl = (innerDocument) =>
    `data:text/html;charset=utf-8,${encodeURIComponent(innerDocument)}`;

  const BuildPreviewHtml = {
    buildInnerDocument,
    buildOuterShellDocument,
    buildDataUrl,
    SANDBOX_PERMISSIONS,
    REACT_IMPORT_MAP,
    BABEL_STANDALONE_URL,
    TAILWIND_CDN_URL,
    SELF_RELOAD_HASH,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildPreviewHtml;
  } else {
    root.GenaiAppShare = root.GenaiAppShare || {};
    root.GenaiAppShare.BuildPreviewHtml = BuildPreviewHtml;
  }
})(typeof window !== 'undefined' ? window : globalThis);
