# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの目的

kintoneの無料プラグインを開発し、Cloudflare Pages(`site/`)で配布するためのリポジトリ。プラグインは各ディレクトリで完全に独立して管理する方針で、共通コードの共有パッケージやバンドラーは意図的に導入していない。新規プラグインを作る際は、既存プラグイン(`box_gdrive_iframe/`)のディレクトリ構成をコピーし、使えそうなコードは都度コピペする。

## ディレクトリ構成

- `<plugin_name>/idea.md` — そのプラグインの仕様メモ
- `<plugin_name>/src/` — `manifest.json`、`js/`、`css/`、`html/`、`image/`、`package.json`、`private.ppk`(署名鍵。git管理外)
- `<plugin_name>/src/dist/plugin.zip` — `cli-kintone plugin pack`の成果物(git管理外)
- `site/` — Cloudflare Pagesの公開ディレクトリ。`index.html`が`plugins.json`を読み込んでプラグイン一覧を表示し、`plugins/<name>/plugin.zip`が実際の配布ファイル(git管理下)
- `scripts/publish.sh <plugin_dir_name>` — 対象プラグインを`npm run build`し、生成された`plugin.zip`を`site/plugins/<name>/`にコピーする

新しいプラグインを追加したときは、`site/plugins.json`にも1エントリ(id/name/description/version/zip)を追加すること。

## よく使うコマンド

プラグイン個別の作業は各`<plugin>/src`ディレクトリ内で実行する(`box_gdrive_iframe/src`が現在唯一の実装例)。

```bash
cd <plugin>/src
npm install
npm run build      # cli-kintone plugin pack --private-key private.ppk --output dist/plugin.zip --input manifest.json
npm run develop    # build --watch
npm run upload     # cli-kintone plugin upload --input dist/plugin.zip --watch (検証環境アプリへの自動反映)
npm run lint       # eslint .
```

初回のみ、プラグインごとに署名鍵を生成する(生成済みなら不要、鍵は使い回す)。

```bash
npm run keygen     # cli-kintone plugin keygen --output private.ppk
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
4. **テスト駆動開発(TDD)** — Jestを用いたローカルのユニットテストを先に書いてから実装する。現時点ではどのプラグインにもJestは未導入なので、実装に着手する際にそのプラグインの`package.json`へ追加すること。
5. **プラグインアップローダーによる自動反映** — `npm run upload`(`cli-kintone plugin upload --watch`)で検証環境アプリへプラグインを自動適用しながら開発する。
6. **Puppeteerによる実環境テスト** — 検証環境(`KINTONE_DOMAIN`, 例: `https://lp950u96r3uk.cybozu.com`)上でPuppeteerを使い実際の画面操作を検証する。Puppeteerも現時点では未導入。プラグイン設定画面のURLパターンは以下の通り。

   ```
   https://{KINTONE_DOMAIN}/k/admin/app/{appId}/plugin/config?pluginId={pluginId}
   ```

7. **必要なフィールド/スペースはAPIで都度作成する** — 固定のテストデータに依存せず、`kintone.app.getFormFields()`等で現在のフィールド状況を確認したうえで、不足分をAPI経由で作成する。
8. **スクリーンショットを都度取得し公開サイトに反映する** — Puppeteerでの動作確認時にスクリーンショットを撮り、`site/plugins/<name>/`配下に保存して公開サイト(`index.html`)から参照できるようにする。
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
