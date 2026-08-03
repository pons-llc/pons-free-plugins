'use strict';

const {
  buildInnerDocument,
  buildOuterShellDocument,
  buildDataUrl,
  SANDBOX_PERMISSIONS,
  BABEL_STANDALONE_URL,
  TAILWIND_CDN_URL,
  SELF_RELOAD_HASH,
} = require('../js/lib/build-preview-html');

describe('buildInnerDocument', () => {
  test('HTML/CSS/JSを組み合わせた1つのHTMLドキュメントを組み立てる', () => {
    const doc = buildInnerDocument({
      html: '<h1>Hello</h1>',
      css: 'h1{color:red}',
      js: 'console.log(1);',
    });
    expect(doc).toContain('<!doctype html>');
    expect(doc).toContain('<h1>Hello</h1>');
    expect(doc).toContain('<style>h1{color:red}</style>');
    expect(doc).toContain('<script type="module">console.log(1);</script>');
  });

  test('HTMLフィールドの値はエスケープしない(実行させることが機能そのものであるため)', () => {
    const doc = buildInnerDocument({
      html: '<div onclick="alert(1)">click</div>',
      css: '',
      js: '',
    });
    expect(doc).toContain('<div onclick="alert(1)">click</div>');
  });

  test('CSS中の</style(大文字小文字問わず)をエスケープしてタグの早期終了を防ぐ', () => {
    const doc = buildInnerDocument({
      html: '',
      css: 'body{}</style><script>alert(1)</script>',
      js: '',
    });
    expect(doc).not.toContain('</style><script>alert(1)</script>');
    expect(doc).toContain('<\\/style>');
  });

  test('JS中の</script(大文字小文字問わず)をエスケープしてタグの早期終了を防ぐ', () => {
    const doc = buildInnerDocument({
      html: '',
      css: '',
      js: 'const s = "</SCRIPT><script>alert(1)</script>";',
    });
    expect(doc).not.toContain('</SCRIPT><script>alert(1)</script>');
    expect(doc).toContain('<\\/SCRIPT>');
  });

  test('html/css/js未入力(undefined)でも例外を投げず空として扱う', () => {
    const doc = buildInnerDocument({});
    expect(doc).toContain('<style></style>');
    expect(doc).toContain('<script type="module"></script>');
  });

  test('reactMode未指定(既定)ではimport map・Babel・TailwindのCDNを一切読み込まない', () => {
    const doc = buildInnerDocument({ html: '', css: '', js: '' });
    expect(doc).not.toContain('importmap');
    expect(doc).not.toContain(BABEL_STANDALONE_URL);
    expect(doc).not.toContain(TAILWIND_CDN_URL);
    expect(doc).not.toContain('text/babel');
  });

  test('reactMode: trueでimport map・Babel standalone・Tailwind CDNを読み込む', () => {
    const doc = buildInnerDocument({
      html: '',
      css: '',
      js: '',
      reactMode: true,
    });
    expect(doc).toContain('<script type="importmap">');
    expect(doc).toContain('"react":');
    expect(doc).toContain(`<script src="${BABEL_STANDALONE_URL}">`);
    expect(doc).toContain(`<script src="${TAILWIND_CDN_URL}">`);
  });

  test('reactMode: trueではJSをtext/babel(data-type=module)で埋め込み、App実行のブートストラップを追記する', () => {
    const doc = buildInnerDocument({
      html: '',
      css: '',
      js: 'export default function App() { return <div>hi</div>; }',
      reactMode: true,
    });
    expect(doc).toContain(
      '<script type="text/babel" data-type="module" data-presets="react">',
    );
    expect(doc).toContain(
      'export default function App() { return <div>hi</div>; }',
    );
    expect(doc).toContain("import { createRoot } from 'react-dom/client';");
    expect(doc).toContain('createRoot(__genaiRootEl).render(<App />);');
    expect(doc).toContain("typeof App === 'function'");
  });

  test('reactMode: trueでもJS中の</script(大文字小文字問わず)はエスケープする', () => {
    const doc = buildInnerDocument({
      html: '',
      css: '',
      js: 'const s = "</script><script>alert(1)</script>";',
      reactMode: true,
    });
    expect(doc).not.toContain('</script><script>alert(1)</script>');
  });

  test('selfReloadOnce未指定(既定)では自己リロードのガードスクリプトを含めない', () => {
    const doc = buildInnerDocument({ html: '', css: '', js: '' });
    expect(doc).not.toContain('location.reload()');
  });

  test('selfReloadOnce: trueでは、location.hashで印を付けてからlocation.reload()する自己リロードガードを先頭付近に含める', () => {
    const doc = buildInnerDocument({
      html: '',
      css: '',
      js: '',
      selfReloadOnce: true,
    });
    expect(doc).toContain(`location.hash !== '${SELF_RELOAD_HASH}'`);
    expect(doc).toContain('location.reload();');
    // <meta charset>の直後、CDN読み込みより前に置くことで初回描画をできるだけ早く解決する。
    expect(doc.indexOf('location.reload()')).toBeLessThan(
      doc.indexOf('<style>'),
    );
  });
});

describe('buildDataUrl', () => {
  test('生成したHTMLドキュメントをdata:text/htmlのURLへ変換する', () => {
    const url = buildDataUrl('<h1>hi</h1>');
    expect(url).toBe('data:text/html;charset=utf-8,%3Ch1%3Ehi%3C%2Fh1%3E');
  });

  test('URLとして特別な意味を持つ文字(&, #, %等)を含むドキュメントも正しくエンコードする', () => {
    const url = buildDataUrl('<p>a&b #c 100%</p>');
    expect(
      decodeURIComponent(url.replace('data:text/html;charset=utf-8,', '')),
    ).toBe('<p>a&b #c 100%</p>');
  });
});

describe('buildOuterShellDocument', () => {
  test('sandbox属性付きiframeでinnerUrlを読み込む殻ページを組み立てる', () => {
    const doc = buildOuterShellDocument({
      innerUrl: 'blob:https://example.cybozu.com/1234-5678',
    });
    expect(doc).toContain(
      '<iframe src="blob:https://example.cybozu.com/1234-5678" sandbox="' +
        SANDBOX_PERMISSIONS +
        '"></iframe>',
    );
  });

  test('sandbox許可リストにallow-same-originを含めない(オリジン分離の核心)', () => {
    expect(SANDBOX_PERMISSIONS).not.toMatch(/allow-same-origin/);
  });

  test('sandbox許可リストにallow-top-navigationを含めない(タブジャッキング対策)', () => {
    expect(SANDBOX_PERMISSIONS).not.toMatch(/allow-top-navigation/);
  });
});
