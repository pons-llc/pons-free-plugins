# box、googleドライブ埋め込みプラグイン

## 機能
URLフィールドに埋め込み用URLを入力すると、特定のスペースにboxかgoogleDriveの埋め込みが可能になるプラグイン

## 設定画面
kintone.app.getFormLayout()でスペースフィールドとSingleLineTextとLINKフィールドを取得
スペースIDとリンク先フィールドをドロップダウンから選択、幅と高さを指定、googleかboxか選択
tabUIにして複数埋め込み対応を可能にする。

## 詳細画面、作成画面、編集画面
画面を開いた時にiframeで埋め込みを表示する。googleドライブはリスト型を表示。

## 実装
kintoneDocumentationMCPを参照しながら実装
特にセキュアコーディングガイドラインでリスクチェックを行うこと