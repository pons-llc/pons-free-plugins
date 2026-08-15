# GovAppsプラグイン

kintoneの無料プラグインを開発・配布するリポジトリです。配布サイトは
[GovAppsプラグイン](https://govapps-plugin.pons-llc.com)。
運営: [合同会社Pons](https://www.pons-llc.com)(kintoneオフィシャルパートナー)。

## このリポジトリについて

- すべてのプラグインは**無料・広告なし**で配布しています。
- 各プラグインは実装時に[kintoneセキュアコーディングガイドライン](secureCodingGuideline.md)に沿った
  チェックリスト(`<plugin>/security-checklist.md`)を作成し、レビューしています。
- プラグインの実行コードは、原則として外部ライブラリ・外部通信を使わずvanilla JavaScriptのみで
  実装する方針です(例外的に外部ライブラリ・外部通信を使うプラグインは、そのプラグインのページに
  明記します。例: [natural_text_dashboard](natural_text_dashboard/)は選択したAIプロバイダとの通信が
  機能上必須です)。
- 各プラグインは`<plugin_name>/`ディレクトリごとに完全に独立して管理しています。共通コードの
  共有パッケージやバンドラーは(上記の例外を除き)意図的に導入していません。

## ディレクトリ構成

- `<plugin_name>/idea.md` — そのプラグインの仕様メモ
- `<plugin_name>/security-checklist.md` — セキュリティレビューのチェックリスト
- `<plugin_name>/src/` — プラグイン本体(`manifest.json`・`js/`・`css/`・`html/`・`image/`)
- `site/` — 配布サイト(Cloudflare Pages)の公開ディレクトリ
- `secureCodingGuideline.md` — kintoneセキュアコーディングガイドライン(参照用)

## ライセンス

配布しているプラグインのソースコードは、すべて[Apache License 2.0](LICENSE)のもとで提供します。
改変・複製・再配布・商用利用等を、ライセンスの条件の範囲内で自由に行うことができます。

## 不具合報告・改善要望

[GitHub Issue](https://github.com/pons-llc/pons-free-plugins/issues/new)からお願いします。
