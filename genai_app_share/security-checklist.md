# genai_app_share セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-03

## 前提: このプラグインは意図的に「コードを実行させる」機能である(最重要)

secureCodingGuideline.mdの一般的なXSS対策(値を`textContent`で描画する、`innerHTML`を避ける等)は、
「利用者が入力した値を画面に安全に表示する」ためのものであり、本プラグインの目的(利用者が入力した
HTML/CSS/JSをブラウザで実際に実行させる)には原理的に適用できない。そのため、このチェックリストは
「実行させないようにする」対策ではなく、「実行させた場合の影響範囲を限定する」対策と、
「利用者への注意喚起」を中心に構成する。idea.md「セキュリティ設計」も参照。

## 実行環境の分離(核心対策)

- [x] 別タブで開くページ自体(殻ページ)には、利用者が入力したHTML/CSS/JSを一切含めない。
      実際のHTML/CSS/JSは、`sandbox="allow-scripts allow-modals allow-forms allow-popups"`を
      指定した`<iframe>`の中(`src`は別途発行したBlob URL)でのみ実行する
- [x] sandbox属性に`allow-same-origin`を含めていない。これにより、iframe内で実行されるコードは
      (読み込んだBlob URLの見た目上のオリジンに関わらず)一意のopaqueオリジンとして扱われ
      (HTML Living Standardの仕様)、kintoneのクッキー・セッション・`localStorage`・
      `kintone.api()`相当のCookie付きリクエストに一切アクセスできない
- [x] sandbox属性に`allow-top-navigation`系の権限を含めていない。iframe内のコードが外側の殻ページや
      kintoneの画面自体をナビゲートさせることはできない(タブジャッキング対策)
- [x] `js/lib/build-preview-html.js`のテスト(`__tests__/build-preview-html.test.js`)で、
      sandbox許可リストに`allow-same-origin`・`allow-top-navigation`が含まれないことを
      回帰テストとして固定している(将来の変更でうっかり緩めてしまうことを防ぐ)
- [x] 別タブへのリンク(`<a>`)には`target="_blank" rel="noopener noreferrer"`を設定している
      (開いたタブから`window.opener`経由で元のkintoneタブを操作されることを防ぐ、定石の対策)

## HTML/CSS/JSの埋め込み時の考慮(実行を妨げない範囲での構造保護)

- [x] HTMLフィールドの値はエスケープしない(実行させることが機能そのものであるため、意図的な設計判断)
- [x] CSS中の`</style`、JS中の`</script`(大文字小文字を問わない)は埋め込み前に`<\/style`・
      `<\/script`へ置換し、生成するHTMLドキュメントの構造(タグの範囲)自体が壊れることを防いでいる
      (`__tests__/build-preview-html.test.js`で確定的に検証済み)
- [x] JSは`<script type="module">`として埋め込む。CDN経由のESモジュールimport(Reactなど)を
      利用者が自分のコードに書けるようにするためで、本プラグイン自身が外部ライブラリを
      バンドルしたり外部URLへ通信することはない(CLAUDE.md開発方針9。外部モジュールを読み込むか
      どうか・どこから読み込むかは、sandbox化されたiframe内で実行される利用者自身のコード次第)

## 利用者への注意喚起(確定仕様)

- [x] レコード詳細画面のリンク直下に、常時表示の警告文
      (「⚠️ このリンクは、{作成者名}さんが入力したコードをブラウザで実行します。信頼できる相手が
      入力した内容か確認してから開いてください。」)を表示する。初回のみのダイアログにはせず、
      開くたびに視界に入るようにしている
- [x] 作成者名はフィールドコードを決め打ちせず、`event.record`の値から`type === 'CREATOR'`の
      フィールドを探して取得する(`js/lib/find-creator-name.js`、アプリごとにフィールドコードが
      変わりうるため)
- [x] プラグイン設定画面にも同様の注意書きを常時表示し、「HTML/CSS/JSフィールドを誰が編集できるかは
      フィールドのアクセス権設定で管理者が別途制限してください」と明記している
      (idea.md「なぜフィールドを自動作成しないか」、元メモの「ユーザーフィールドやラジオなどの
      状態管理で権限管理をすることを推奨」に対応)

## 実行方式の選択(Blob / Data URL、確定・v2で追加)

- [x] 設定画面で`blob`(既定)/`data`のいずれかを選択させ、選択肢の直下にそれぞれの仕組みと
      リスクの違いを明記している(「別タブが確実に開けるが仕組みが複雑」「仕組みはシンプルだが
      別タブ遷移がブロックされる場合がある」。idea.md「実行方式の選択」参照)
- [x] `data`方式でも、`blob`方式と同じくHTMLフィールドの値はエスケープしない設計を維持しつつ、
      `data:`URLは作成元を継承せず常に独立したopaqueオリジンになる(Web標準の仕様)ため、
      sandbox iframeによる分離が無くても同等以上にkintoneオリジンから隔離される
- [x] `data`方式ではBlobを一切発行しないため(`URL.createObjectURL()`を呼ばない)、Blob URLの
      ライフサイクル管理(revoke)自体が不要であり、実装上も分岐して呼び出していない
- [x] 「別タブ遷移がブロックされる場合がある」というリスクは実機(E2Eテスト環境のChrome)で
      実際に再現することを確認済み(idea.md参照)。理論上の懸念ではなく実際に起こりうる制約として、
      既定を`blob`にする・設定画面で明記する、という設計判断の根拠にしている
- [x] `data`方式で追加した自己リロードガード(`buildSelfReloadGuardScript()`)は、生成した
      ドキュメント自身をもう一度読み込み直すだけの処理であり、外部への通信・新しいデータの取得は
      一切発生しない(利用者が手動でF5キーを押す操作を自動化しているだけで、セキュリティ上の
      新しいリスクを追加するものではない)
- [x] 自己リロードの無限ループ防止は`location.hash`(`reload()`後もURLの一部として確実に
      保持される)を条件にしており、`data:`URLのオリジンの扱いに依存する`sessionStorage`等は
      使っていない(idea.md参照)

## React/JSXサポート(オプトインの外部CDN例外、確定・v2で追加)

- [x] 既定はOFFであり、OFFのままなら外部通信は一切発生しない(v1と完全に同じ挙動)。ONにするのは
      設定画面で管理者が明示的にチェックを入れた場合のみ(`plugin_catalog_builder`の「簡易AI検索は
      設定でON/OFFできる」という既存の例外運用と同じ考え方、CLAUDE.md開発方針9の意図的な例外)
- [x] ONにした場合に読み込むCDNは、設定画面の説明文と`js/lib/build-preview-html.js`のコメントに
      すべて列挙している(esm.sh: React/ReactDOM/lucide-react/recharts、unpkg.com: Babel
      standalone、cdn.tailwindcss.com: Tailwind CSS)。網羅的なパッケージ対応ではないことも明記し、
      import mapに無いパッケージをimportした場合は「そのパッケージの読み込みだけ失敗する」という
      挙動になることを利用者に伝えている
- [x] これらのCDN読み込みはいずれも**生成ページ(sandbox化iframe内、またはdata:URL先。kintoneとは
      別オリジン)の中でのみ**発生し、プラグイン自身の実行コード(`js/desktop.js`・`js/config.js`、
      kintoneのレコード画面上で動くコード)は一切外部通信を行わない。ONにしても「実行環境の分離
      (核心対策)」で説明したオリジン分離の設計自体は変わらない(Reactやライブラリのコードも、
      あくまでsandbox化・オリジン分離されたコンテキストの中で動く)
- [x] JSXのトランスパイル(Babel standalone)はブラウザの標準機能(`<script type="text/babel"
      data-type="module">`の自動実行)を使っており、プラグイン自身が独自のコード変換・評価
      (`eval`等)を行っていない

## 権限管理はプラグインの範囲外であることの明記

- [x] 本プラグインはHTML/CSS/JSフィールドの編集可否を制御しない(フィールドを自動作成しないため、
      アクセス権はkintone標準のフィールド単位アクセス権に完全に委ねる設計。idea.md参照)。
      この境界を設定画面の説明文・idea.mdの両方に明記した

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.GenaiAppShare`)のみを
      公開している(`js/lib/build-preview-html.js`・`js/lib/find-creator-name.js`・
      `js/lib/config-store.js`・`js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] `kintone.app.record.setFieldShown()`・`kintone.app.record.getHeaderMenuSpaceElement()`・
      `kintone.app.getFormFields()`のみを使用し、REST APIやkintone内部のDOM構造への依存は無い

## 対応画面の限定(確定・スコープ)

- [x] モバイルには一切処理を行わない(`manifest.json`に`mobile`キー自体を持たない)。
      `getHeaderMenuSpaceElement()`がモバイル非対応であり、モバイルのヘッダー下要素は
      レコードごとの表示に使えないため、「フィールドは消えるがリンクも無い」中途半端な状態を
      作らないための意図的なスコープ限定(idea.md参照)
- [x] レコード印刷画面でも入力フィールドを非表示にし、印刷物に生のHTML/CSS/JSがそのまま
      出力されることを防いでいる(リンクは印刷物として意味を持たないため表示しない)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でHTMLフィールド未選択、HTML/CSS/JSフィールドの
      重複選択を検出し、保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、
      `js/lib/config-store.js`の`load()`は例外を投げず既定値を返す
- [x] 設定済みのフィールドコードがフォームから削除されていても、`event.record[fieldCode]`が
      無い場合は空文字列として扱い、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- [x] プラグイン自身(`js/desktop.js`・`js/config.js`)はREST API・外部通信を一切行わない。
      使用するのはJavaScript API(`kintone.app.*`)のみ
- [x] `Blob`/`URL.createObjectURL()`はブラウザ内で完結する標準APIであり、生成したHTML/CSS/JSの
      内容がkintone以外のどこかへ送信されることはない
- [x] React/JSXサポート(既定OFF)を有効にした場合のみ、生成ページ(kintoneとは別オリジン)が
      上記「React/JSXサポート」に列挙したCDNへ通信する。この例外は設定画面で明示的にON/OFFでき、
      デフォルトでは発生しない

## Blob URLのライフサイクル管理(メモリリーク対策)

- [x] `app.record.detail.show`が再発火するたび(ページ送り・編集後の詳細復帰・ステータス変更後等)に、
      直前に発行したBlob URL(内側・外側の両方)を`URL.revokeObjectURL()`で解放してから
      新しいものを発行し、無制限に増え続けることを防いでいる(revoke後も、既に開いた別タブ自体の
      表示は失われない。idea.md参照)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
