'use strict';

// オフライン版(1つのHTMLファイル)を組み立てる。外部パッケージ不使用。
// kintone版プラグインと同じ js/lib・描画・エディターのコードと desktop.css を、template.html に埋め込む。
// 出力: genogram/webapp/dist/genogram-offline.html(ダブルクリックでブラウザで開ける。インターネット接続不要)
//
// 実行: node genogram/webapp/build.js
//       node genogram/webapp/build.js --site   (公開サイト site/plugins/genogram/ にも配置する)

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'genogram-offline.html');

// 読み込み順は依存関係順(manifest.json の desktop.js と同じ順。kintone依存の desktop.js の代わりに app.js)
const SCRIPTS = [
  path.join(SRC, 'js/lib/model.js'),
  path.join(SRC, 'js/lib/ops.js'),
  path.join(SRC, 'js/lib/layout.js'),
  path.join(SRC, 'js/lib/scene.js'),
  path.join(SRC, 'js/lib/case-file.js'),
  path.join(SRC, 'js/renderer.js'),
  path.join(SRC, 'js/viewer.js'),
  path.join(SRC, 'js/editor.js'),
  path.join(__dirname, 'app.js'),
];
const STYLES = [path.join(SRC, 'css/desktop.css'), path.join(__dirname, 'app.css')];

// <script>の中で "</script" が現れるとHTMLとして閉じてしまうため、"<\/" にする(JSとしては同じ文字列)
const escapeScript = (code) => code.replace(/<\/(script)/gi, '<\\/$1');

const main = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  const icon = fs.readFileSync(path.join(SRC, 'image/icon.png')).toString('base64');

  const styles = STYLES.map(
    (file) => `/* ${path.basename(file)} */\n${fs.readFileSync(file, 'utf8')}`,
  )
    .join('\n')
    .replace('__ICON_DATA_URI__', `"data:image/png;base64,${icon}"`);
  const scripts = SCRIPTS.map(
    (file) => `// ---- ${path.relative(path.join(__dirname, '..'), file)} ----\n${escapeScript(fs.readFileSync(file, 'utf8'))}`,
  ).join('\n');

  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const html = template
    .replace('/*__STYLES__*/', () => styles)
    .replace('/*__SCRIPTS__*/', () => scripts)
    .replace('__VERSION__', String(manifest.version));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html);
  console.log(`作成しました: ${OUT_FILE}(${(html.length / 1024).toFixed(0)}KB)`);

  if (process.argv.includes('--site')) {
    const siteFile = path.join(__dirname, '../../site/plugins/genogram', path.basename(OUT_FILE));
    fs.mkdirSync(path.dirname(siteFile), { recursive: true });
    fs.copyFileSync(OUT_FILE, siteFile);
    console.log(`公開サイトに配置しました: ${siteFile}`);
  }
};

main();
