# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの目的

kintoneの無料プラグインを開発し、Cloudflare Pages(`site/`)で配布するためのリポジトリ。プラグインは各ディレクトリで完全に独立して管理する方針で、共通コードの共有パッケージやバンドラーは意図的に導入していない。新規プラグインを作る際は、既存プラグイン(`box_gdrive_iframe/`)のディレクトリ構成をコピーし、使えそうなコードは都度コピペする。

## ディレクトリ構成

- `<plugin_name>/idea.md` — そのプラグインの仕様メモ
- `<plugin_name>/src/` — `manifest.json`、`js/`、`css/`、`html/`、`image/`、`package.json`、`private.ppk`(署名鍵。git管理外)
- `<plugin_name>/src/dist/plugin.zip` — `cli-kintone plugin pack`の成果物(git管理外)
- `site/` — Cloudflare Pagesの公開ディレクトリ(サイト名「GovAppsプラグイン」。構成・デザインは`site-wire-frame.md`と姉妹サイト`~/Documents/govapps`を踏襲)。
  - `index.html` — トップページ。公開プラグインを`.plugin-card`として直接埋め込み(`data-category`/`data-tags`/`data-search`属性でクライアント側フィルタ)、キーワード・カテゴリ・タグ絞り込みとAI検索(`js/ai-search.js`、ブラウザ内で完結するベクトル検索)を提供する。`plugins.json`は機械可読な一覧として維持するが、`index.html`はこれを`fetch`しない(静的埋め込み)。
  - `about.html` / `faq.html` / `terms.html` / `privacypolicy.html` — 共通ページ
  - `css/51-modern-default.css`(kintone公式のプラグイン設定画面用CSS。いずれかのプラグインの`src/css/`からコピーして使い回す)、`css/style.css`(サイト全体のレイアウト)、`js/site.js`(ヘッダーメニュー・フィルタ・アコーディオン)、`js/ai-search.js`
  - `plugins/<name>/index.html` — プラグイン個別ページ(名称/概要/ユースケース(アコーディオン)/セットアップ手順/セキュリティレビューサマリ(アコーディオン)/設定画面スクショ/GitHubリンク/API実行数説明/改善要望リンク/関連kintoneサービスへの誘導、の構成で揃える)
  - `plugins/<name>/download.html` — ダウンロード計測用の中間ページ(直接`plugin.zip`をリンクせず、ここを経由させる)
  - `plugins/<name>/plugin.zip` — 実際の配布ファイル(git管理下)
  - `plugins/<name>/screenshots/config-screen.png` — 設定画面のスクリーンショット(E2Eテストで撮影、`scripts/e2e/common.js`の`screenshot()`参照)
- `scripts/publish.sh <plugin_dir_name>` — 対象プラグインを`pnpm run build`し、生成された`plugin.zip`を`site/plugins/<name>/`にコピーする

新しいプラグインを公開するときは、上記の`site/plugins/<name>/`一式(`index.html`・`download.html`・`plugin.zip`・`screenshots/`)を用意したうえで、`site/plugins.json`にも1エントリ(id/name/description/version/zip/page/category/tags)を追加し、`site/index.html`の`.plugin-grid`と`window.__PLUGIN_CORPUS__`にもカードとAI検索用のコーパスを追加すること。

## よく使うコマンド

パッケージマネージャーは**pnpm**を使う(npmではない)。各プラグインが独立して`node_modules`を持つ構成上、
同じdevDependency(`@kintone/cli`, `eslint`, `jest`等)を複数プラグイン分インストールすることになるが、
pnpmはパッケージ実体をグローバルストア(`~/.pnpm-store`)に1つだけ持ちハードリンクするため、
プラグイン数が増えてもディスク容量が線形に膨らまない。プラグイン間でコードやworkspace設定を共有するわけではなく、
あくまで「各プラグインが独立」という方針(上記)は変えていない。

プラグイン個別の作業は各`<plugin>/src`ディレクトリ内で実行する(`box_gdrive_iframe/src`, `fiscal_year_numbering/src`が実装例)。

```bash
cd <plugin>/src
pnpm install
pnpm run build      # cli-kintone plugin pack --private-key private.ppk --output dist/plugin.zip --input manifest.json
pnpm run develop    # build --watch
pnpm run upload     # cli-kintone plugin upload --input dist/plugin.zip --watch (検証環境アプリへの自動反映)
pnpm run lint       # eslint .
pnpm test           # jest(導入済みのプラグインのみ)
```

初回のみ、プラグインごとに署名鍵を生成する(生成済みなら不要、鍵は使い回す)。

```bash
pnpm run keygen     # cli-kintone plugin keygen --output private.ppk
```

リポジトリルートからは、ビルドして公開サイトへ配布物を反映する。

```bash
bash scripts/publish.sh <plugin_dir_name>
```

Cloudflare Pages側はビルドコマンドなし・公開ディレクトリ`site`で設定する(署名済みzipは事前にローカルでコピー済みのため、CF側のビルド環境に署名鍵を置く必要はない)。

## 開発方針(必須)

新規プラグインの実装・改修では以下を必ず守ること。

1. **kintoneドキュメントMCP(`kintone_doc`)を必ず参照する** — JavaScript API/REST APIの仕様や挙動、注意点は実装前に必ずMCP経由で確認する。記憶だけで実装しない。
2. **セキュリティレビュー** — [secureCodingGuideline.md](secureCodingGuideline.md)(XSS/CSSインジェクション対策、認証情報の保存先、外部スクリプトの扱いなどをまとめたkintoneセキュアコーディングガイドライン)を参照し、実装ごとにチェックリストを作成して確認する。
3. **JavaScript APIをREST APIより優先する** — 同じ目的を達成できる場合は`kintone.app.getFormFields()`や`kintone.app.getFormLayout()`のようなJavaScript APIを優先する。REST APIはJavaScript APIで実現できない場合のみ使い、その際もkintone自身への呼び出しに限り`kintone.api()`(内部向けラッパー)を使用する。生の`fetch`/`XHR`で直接URLを組み立てない。
4. **テスト駆動開発(TDD)** — Jestを用いたローカルのユニットテストを先に書いてから実装する。kintoneに依存しない純粋ロジックは`src/js/lib/`配下に切り出し、`src/__tests__/`でテストする(`fiscal_year_numbering`が実装例)。まだJestを導入していないプラグインでは、実装に着手する際にそのプラグインの`package.json`へ追加すること。
5. **プラグインアップローダーによる自動反映** — `npm run upload`(`cli-kintone plugin upload --watch`)で検証環境アプリへプラグインを自動適用しながら開発する。
6. **Puppeteerによる実環境テスト** — 検証環境(`KINTONE_DOMAIN`, 例: `https://lp950u96r3uk.cybozu.com`)上でPuppeteerを使い実際の画面操作を検証する。プラグイン設定画面のURLパターンは以下の通り。

   ```
   https://{KINTONE_DOMAIN}/k/admin/app/{appId}/plugin/config?pluginId={pluginId}
   ```

   共通処理とプラグイン固有のテストは分けて管理する。テストケース設計・スクリプト作成・コンソールエラー確認・
   スクリーンショット方針の詳細は`.claude/skills/e2e-test/SKILL.md`を参照(E2Eテストを書く/見直す際は
   このスキルを使うこと)。

   - `scripts/e2e/common.js` — 全プラグイン共通のヘルパー(`.env`読み込み、ログイン、プラグイン設定画面への遷移、
     `dist/plugin.zip`からのplugin ID取得、スクリーンショット保存)。puppeteer自体はrequireしない
     (このファイルは`node_modules`を持たないため。呼び出し元のプラグインが自分の`node_modules`から
     puppeteerを読み込み、生成した`page`をここの関数に渡す)。
   - `<plugin>/src/e2e/*.e2e.test.js` — そのプラグイン固有のシナリオ。`scripts/e2e/common.js`を
     相対パスで読み込んで使う。Jestを実行エンジンとして使い、ユニットテスト用の`jest.config.js`とは
     別に`jest.e2e.config.js`(`testMatch: e2e/**/*.e2e.test.js`)を用意する。
   - 実行は`pnpm run test:e2e`(内部で`jest --config jest.e2e.config.js`)。事前に`pnpm run build && pnpm run upload`で
     検証環境アプリにプラグインをアップロードしておく必要がある。
   - ログイン画面のセレクター(`scripts/e2e/common.js`の`login()`)は実環境未検証。初回実行時に調整すること。

7. **フィールドの確認は必須、作成は基本不要(ただしLOOKUPは例外)** — `TEST_APP_ID_1`・`TEST_APP_ID_2`は、どちらもkintoneの主要な項目タイプに対応したフィールドをあらかじめ用意済み。そのため`kintone.app.getFormFields()`等で現在のフィールド状況を確認したうえで、本当に不足している場合のみ`scripts/kintone-admin.js`の`ensureFormFields()`でAPI経由で追加する(冪等・既存フィールドは触らない)。**LOOKUP(ルックアップ)フィールドは両アプリとも未設定なので、ルックアップ関連プラグインのE2Eテストでは`ensureFormFields()`で都度作成する前提で設計する。** 詳細は`.claude/skills/e2e-test/SKILL.md`を参照。
8. **スクリーンショットは公開サイト用に1枚あれば良い** — Puppeteerでの動作確認時、代表的なテスト(通常は設定画面が開けることを確認するテスト)の中でスクリーンショットを1枚撮り、`site/plugins/<name>/`配下に保存して公開サイト(`index.html`)から参照できるようにする。全テストケース・全パターンごとに撮る必要はない。
9. **外部パッケージ・外部通信を使わない** — プラグインの実行コード(js/css)には外部ライブラリを一切組み込まず、vanilla JavaScriptのみで実装する。kintone以外のサーバーへの通信(fetch/XHRでの外部API呼び出し)も行わない。この方針により、依存パッケージの脆弱性監査(`npm audit`)や網羅的なクロスブラウザ検証は開発側の必須タスクとせず、個別の不具合は公開後に利用ユーザーからのGitHub Issue報告で対応する。ビルド用のdevDependency(`@kintone/cli`, `eslint`等)はプラグイン本体に含まれないため対象外。

## 検証環境(.env)

ルートの`.env`(git管理外)に検証環境の接続情報を保持する。

```
KINTONE_DOMAIN=
KINTONE_USERNAME=
KINTONE_PASSWORD=
TEST_APP_ID_1=570
TEST_APP_ID_2=571
```

- `TEST_APP_ID_1`/`TEST_APP_ID_2`は動作確認用に用意されたkintoneアプリのIDで、プラグイン設定・レコード操作の検証に使う。
- 認証情報はフロントエンドコードやプラグイン設定(`kintone.plugin.app.setConfig()`)には埋め込まない([secureCodingGuideline.md](secureCodingGuideline.md)参照)。

## ドキュメント作成について

このリポジトリ内で作成するドキュメント(idea.md、セキュリティチェックリスト、READMEなど)は日本語で作成する。
