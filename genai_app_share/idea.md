# 生成AIアプリ共有プラグイン(genai_app_share)

`plugin_idea.md`「生成AIアプリ共有プラグイン」の詳細仕様。Gemini Canvas等でその場で生成した
HTML/CSS/JS(React等のCDN経由の外部モジュールを含むことも想定)を、文字列複数行フィールドに
コピペするだけで「動くアプリ」としてレコードから開けるようにするプラグイン。

## 機能概要

- アプリ側に、HTML/CSS/JSをそれぞれ貼り付ける文字列複数行(MULTI_LINE_TEXT)フィールドを**管理者が
  自由に配置**する(このプラグイン自身はフィールドを作成しない。後述「なぜフィールドを自動作成しない
  か」参照)。プラグイン設定画面で、どのフィールドがHTML/CSS/JS担当かを紐付ける。
- **レコード詳細画面**: 紐付けたHTML/CSS/JSの入力フィールドを`setFieldShown()`で非表示にし、
  代わりにヘッダー上部(`kintone.app.record.getHeaderMenuSpaceElement()`)に
  「生成AIアプリを開く」リンクを表示する。クリックすると、HTML/CSS/JSを組み合わせた1つのページを
  **別タブ**で開く。
- **レコード作成・編集画面**: 何もしない(HTML/CSS/JSの入力フィールドは通常どおり編集可能、
  リンクは表示しない)。ただし詳細画面から編集画面へ遷移した際にDOM状態が引き継がれるケースに備え、
  `app.record.create.show`/`app.record.edit.show`で明示的に`setFieldShown(code, true)`を呼び、
  入力フィールドが必ず表示される状態を保証する(確定仕様)。
- HTML/JSフィールドがどちらも空の場合はリンクの代わりに「HTML/JSのどちらも未入力です」という
  文言を表示する(React/JSXサポート時はHTMLが空でもJSだけでDOMを組み立てる構成が一般的なため、
  HTML単独の空チェックにはしていない。後述)。

## セキュリティ設計(最重要・確定仕様)

このプラグインは**利用者(HTML/CSS/JSフィールドの入力者)が書いた任意のコードをブラウザで実行する**
という、他のプラグインには無い性質を持つ。secureCodingGuideline.mdの一般的なXSS対策(値を
`textContent`で描画する等)はそもそも適用できない(コードを実行させることが機能そのものであるため)。
そのため、通常のXSS対策とは別に、以下の技術的な緩和策と警告表示の両方を実装する。

### 技術的な緩和策: sandbox属性付きiframeでの実行(確定)

`URL.createObjectURL()`で作成したBlob URLは、作成元のページ(kintoneのアプリ画面)と**同一オリジン**
として扱われる(Web標準の一般的な仕様。blob:スキームURLのオリジンは作成元ドキュメントを継承する)。
つまり、生成したHTMLを素朴に`window.open(blobUrl)`で別タブに開くと、そのタブの中のJavaScriptは
kintoneと同一オリジンとして扱われ、理論上`fetch`等でkintoneのREST APIを閲覧者のセッションのまま
呼び出せてしまう(閲覧者のクッキーを使ってkintoneのデータを盗み出す・改ざんするコードを、
HTML/JSフィールドに入力するだけで仕込めることになる)。これはこの機能の性質上避けられないリスクだが、
実害を大きく減らせる対策があるため実装する。

**対策**: 別タブで開くページ自体はプラグインが用意する最小限の「殻」ページとし、その中に
`<iframe sandbox="allow-scripts allow-modals allow-forms allow-popups" src="(内容のBlob URL)">`
を配置して、実際のHTML/CSS/JSはこのiframeの中だけで実行する。`sandbox`属性に`allow-same-origin`を
**含めない**ことで、iframe内のコンテンツは(読み込んだBlob URLの見た目上のオリジンに関わらず)
一意のopaqueオリジンとして扱われる(HTML Living Standardの仕様。`allow-same-origin`が無い
sandbox化されたブラウジングコンテキストは常にunique opaque originを持つ)。これにより、
iframe内のコードはkintoneのクッキー・セッション・`localStorage`等に一切アクセスできなくなり、
kintoneへの同一オリジンリクエストも拒否される。

含める権限と理由:
- `allow-scripts`: 生成されたJS(Reactを含む)を実行するために必須。
- `allow-modals`: `alert`/`confirm`/`prompt`を使う簡易アプリが多いため許可。
- `allow-forms`: フォーム入力を伴う生成アプリのため許可。
- `allow-popups`: 生成アプリ自身が`window.open`等でさらに別タブを開くケースを許可。

意図的に**含めない**権限と理由:
- `allow-same-origin`: 上記の同一オリジン漏洩を防ぐための核心。絶対に付与しない。
- `allow-top-navigation`系: iframe内のコードが外側の殻ページや(万一)kintoneの画面自体を
  ナビゲートさせられないようにする(タブジャッキング対策)。

外側の殻ページ自体(プラグインが組み立てる固定文字列、利用者の入力を一切含まない)には
`allow-same-origin`のような機微な権限は関係しない(iframeの外なので通常のkintoneと同一オリジンの
ページだが、殻ページ自体にはユーザー由来のロジックが無いため実害が無い)。

### 実行方式の選択: Blob(sandbox iframe) / Data URL(確定・v2で追加)

上記のBlob+sandbox iframe方式は「別タブが確実に開ける」ことを優先した設計だが、実は`data:`
スキームのURLは`blob:`と違って**作成元を継承せず、常に独立したopaqueオリジンになる**
(Web標準の仕様。`blob:`は作成元ドキュメントのオリジンを継承するのに対し、`data:`は毎回一意の
opaqueオリジンを持つ)。そのため`data:`URLを直接使えば、そもそもsandbox iframeという2段構成が
不要になり、仕組みがシンプルになる。

ただし`data:`URLには別の弱点がある。主要ブラウザはフィッシング対策として、トップレベル
(タブ全体)を`data:`URLへ直接遷移させる操作(リンククリック・`window.open`)を制限・警告する
傾向があり、環境によっては「別タブで開くリンク」という要件そのものが不安定になりうる。

**実機確認済み(重要)**: 理論上のリスクとして記載していたこの制限は、実際にE2Eテスト環境の
Chrome(Puppeteerがバンドルするバージョン)で再現した。`<a target="_blank"
href="data:text/html;charset=utf-8,...">`をクリックしても、`targetcreated`イベントが一切
発火せず(別タブが全く開かない)ことを実機で確認済み(`src/e2e/react-mode.e2e.test.js`の
開発時に発見。詳細はそのファイルの先頭コメント参照)。そのため`data`方式のE2E確認
(`src/e2e/data-url-mode.e2e.test.js`)は、実際のクリック・別タブ遷移を伴わず、
`href`が正しく`data:text/html`形式で組み立てられていることの確認にとどめている。
これは実装の不具合ではなく、`data`方式を選んだ場合に実際に起こりうる制約そのものであり、
設定画面の説明文にも反映している。

**実機確認済み(その2)・自己リロード対策**: 別途、実際の(Puppeteerではない通常の)Chromeで
利用者が確認したところ、上記の「開かない」ケースとは別に「別タブは開くが初回は白紙のまま
描画が止まり、手動でリロード(F5)すると表示される」という挙動も確認された。長い`data:`URIを
新規タブで開んだ際に初回描画がトリガーされないという、Chromiumの描画パイプラインに関する
既知寄りの挙動と考えられる。これに対しては、生成ドキュメントの`<head>`先頭付近に
自己リロードのガードスクリプト(`js/lib/build-preview-html.js`の`buildSelfReloadGuardScript()`)を
埋め込み、利用者の手動リロードと同じ効果を自動化した(`data`方式のときのみ、
`buildInnerDocument({ ..., selfReloadOnce: true })`)。

- 無限リロードを防ぐガード条件には`sessionStorage`等を使わない。`data:`URLのオリジンの扱いが
  ブラウザ・状況によって不確実なため、状態が確実に残ると言い切れない。代わりに`location.hash`に
  印を付けてから`location.reload()`する(`reload()`はURL全体〈hashを含む〉を保ったまま現在の
  ドキュメントを再読み込みするため、リロード後に自分自身が付けた印を確実に検出できる)。
- この自動リロード自体の効果(白紙が実際に解消するか)はPuppeteerのヘッドレスChromeでは
  この症状自体を再現できなかったため自動テストで検証できておらず、実機のChromeでの動作確認に
  委ねている(`src/e2e/data-url-mode.e2e.test.js`はガードスクリプトが生成ドキュメントに
  含まれることの確認までにとどめている)。

**方式の一長一短をユーザーに判断してもらうため、設定画面で選択式にする**(`executionMode`:
`'blob'`〈既定〉/`'data'`)。それぞれの技術的な違いとリスクを設定画面に明記する(後述「設定画面」)。

- `blob`(既定): 別タブが開くことの確実性を優先。仕組みはやや複雑(殻ページ+sandbox iframeの
  2段構成)。
- `data`: 仕組みがシンプルで、殻ページ・iframeが一切不要(生成したHTMLドキュメントをそのまま
  `data:`URLとしてリンクの`href`にするだけ)。ただし環境によっては別タブへの遷移がブロック・
  警告される可能性がある。

`js/lib/build-preview-html.js`の`buildDataUrl(innerDocumentString)`が
`'data:text/html;charset=utf-8,' + encodeURIComponent(innerDocumentString)`を組み立てる
(純粋関数、Jestでテスト)。`data`方式ではBlob URLを一切発行しないため、
`URL.revokeObjectURL()`によるライフサイクル管理も不要になる。

### 警告表示(確定仕様)

上記の対策を行ってもなお、iframe内のコードは「閲覧者のブラウザで実際に実行される」こと自体は
変わらない(ネットワーク的なフィッシング・意図しない外部送信・不快なコンテンツ表示等のリスクは
sandboxでも防げない)。そのため、リンクの直下に**常時表示**の警告文を出す(初回のみのダイアログにはしない。
繰り返し見るたびに注意を意識してもらうため)。

- 「⚠️ このリンクは、{作成者名}さんが入力したコードをブラウザで実行します。信頼できる相手が
  入力した内容か確認してから開いてください。」
- 作成者名は`event.record`の値の中から`type === 'CREATOR'`のフィールドを探して`.value.name`を
  使う(フィールドコードがアプリごとに異なりうるため、コードを決め打ちしない。
  `js/lib/find-creator-name.js`参照)。

### なぜフィールドを自動作成しないか

`plugin_catalog_builder`のようにプラグインがフィールドを自動作成する方式も検討したが、
本プラグインは以下の理由で**管理者が手動でフィールドを配置し、設定画面で紐付ける方式**にした
(元メモ「フィールドの追加は自由なので、ユーザーフィールドやラジオなどの状態管理で権限管理をすることを
推奨」)。

- 権限管理(誰がHTML/JS/CSSフィールドを編集できるか)は、フィールドのアクセス権設定
  (kintoneのフィールド単位のアクセス権)で管理者が個別に設定する前提であり、そのためには
  管理者がフィールドの配置・命名を完全にコントロールできる必要がある。
- ユーザー選択フィールドやラジオボタン(承認ステータス等)を横に並べて運用する構成を
  管理者が自由に設計できるようにするため、フィールドコードを固定しない。

## React/JSXサポート(任意・オプトイン、確定・v2で追加)

元メモ「Reactにも対応したい」への対応。v1では「JSフィールドに`type="module"`で外部URLから
importするコードを書けば動く」という最小限の対応だったが、実際にGemini Canvas等が出力する
React用コードは次の理由でそのままでは動かない。

- `import React, { useState } from 'react';`のような**ベア指定子**(`'react'`のようなURLではない
  パッケージ名)は、ブラウザのネイティブESモジュール解決では扱えない(import map が無いと
  `Failed to resolve module specifier` になる)。
- JSX構文(`<div className="...">`等)はブラウザが直接解釈できず、事前にJavaScriptへ変換
  (トランスパイル)する必要がある。

これらはこのプラグイン自身のコード(`js/desktop.js`・`js/config.js`)を変更しなくても実現できず、
かつCDN通信を伴うため、**設定画面で明示的にONにした場合のみ**有効にする(`enableReact`、既定
`false`)。OFFのままなら外部通信は一切発生しない(v1の挙動と完全に同じ)。ONにした場合のみ、
生成ページ(iframe内、またはdata:URL先。いずれもkintoneとは別オリジンで実行される。上記
「セキュリティ設計」参照)が以下の外部CDNを読み込む。`plugin_catalog_builder`の「簡易AI検索は
設定でON/OFFでき、ONの場合のみ外部CDN通信が発生する」という既存の例外運用と同じ考え方。

| 用途 | CDN | 備考 |
| :-- | :-- | :-- |
| React本体 | `https://esm.sh/react@18` 他(react-dom、react-dom/client、react/jsx-runtime) | メジャーバージョンのみ固定 |
| よく使われるアイコン/グラフライブラリ | `https://esm.sh/lucide-react` / `https://esm.sh/recharts`(`?external=react`等でReact本体の重複読み込みを回避) | Gemini Canvas等が頻用するパッケージを重点的にカバー(網羅的ではない。import mapに無いパッケージをimportした場合はそのパッケージの読み込みだけ失敗する) |
| JSXトランスパイラ | `https://unpkg.com/@babel/standalone@7/babel.min.js` | ブラウザ上でJSX→`React.createElement()`変換のみ行う(import/export文はそのまま残す設定〈`data-type="module"`〉) |
| ユーティリティCSS | `https://cdn.tailwindcss.com`(Tailwind公式のPlay CDN) | Gemini Canvas等の出力はTailwindのユーティリティクラス前提であることが非常に多いため同時に有効化 |

**利用者側の規約(確定)**: JSフィールドには`export default function App() { ... }`という形で
ルートコンポーネントを書く(Gemini Canvas等の標準的な出力形式と一致)。プラグイン側が
自動的に`<div id="root">`(無ければ作成)へ`createRoot(...).render(<App />)`する
ブートストラップコードを末尾に追加する。`App`が見つからない場合はコンソールにエラーを出す
だけで、画面をクラッシュさせない。

`js/lib/build-preview-html.js`の`buildInnerDocument({ html, css, js, reactMode: true })`が、
通常の`<script type="module">`の代わりに`<script type="text/babel" data-type="module"
data-presets="react">`でJSを埋め込み、`<head>`にimport map・Babel standalone・Tailwind CDNの
`<script>`タグを追加する。

## 生成ページの組み立て(確定仕様)

`js/lib/build-preview-html.js`(純粋関数、Jestでテスト)が担う。

1. `buildInnerDocument({ html, css, js, reactMode })`: HTML/CSS/JSフィールドの値から1つの
   HTMLドキュメントを組み立てる。
   ```html
   <!doctype html>
   <html>
   <head>
   <meta charset="utf-8">
   <style>{css}</style>
   </head>
   <body>
   {html}
   <script type="module">{js}</script>
   </body>
   </html>
   ```
   - `reactMode`が偽(既定)の場合はJSを`type="module"`にする。ES Modules構文(フルURL指定の
     import)はそのまま使える。`reactMode`が真の場合は上記「React/JSXサポート」のとおり
     `text/babel`+import map+CDN読み込みに切り替える。
   - CSS中の`</style`、JS中の`</script`(大文字小文字を問わない)は、それぞれ`<\/style`・`<\/script`に
     置換してから埋め込む(タグの途中で本来のHTML構造が壊れることを防ぐ、`</script>`をHTMLへ
     文字列展開する際の標準的な対策。`type="text/babel"`も同じ`<script>`要素であるため同様に
     必要)。
   - HTMLフィールドの値はエスケープしない(実行させることが機能そのものであるため。上記
     「セキュリティ設計」のsandbox化で実害を抑える設計)。
2. `buildOuterShellDocument({ innerUrl })`: 内側のBlob URLを`src`に持つsandbox化iframeだけの
   最小限の殻ページを組み立てる(iframeがビューポート全体を覆うスタイル、`executionMode: 'blob'`
   のときのみ使用)。
3. `buildDataUrl(innerDocumentString)`: `buildInnerDocument()`の結果を`data:`URLへ変換する
   (`executionMode: 'data'`のときのみ使用、上記「実行方式の選択」参照)。

`js/desktop.js`(kintone依存のグルーコード)は`executionMode`に応じて分岐する。

- `blob`(既定): 2つの`Blob`(`type: 'text/html'`)を作り、`URL.createObjectURL()`で得たURLのうち
  外側(殻ページ)のものをリンクの`href`にする。
- `data`: `buildDataUrl()`の結果をそのままリンクの`href`にする(Blobは一切発行しない)。

リンクは`target="_blank" rel="noopener noreferrer"`(タブナビング対策の定石、方式によらず共通)。

`app.record.detail.show`が再度発火するたび(ページ送り・編集後の詳細復帰・ステータス変更後等)に
作り直すため、`blob`方式では直前に発行したBlob URL(内側・外側とも)を`URL.revokeObjectURL()`で
解放してから新しいものを発行する(無制限に増え続けることを防ぐ)。ただし、既に開いた別タブ自体は
ブラウザに読み込み済みのため、revoke後も表示は失われない(`URL.revokeObjectURL()`は「今後の新規
参照」を無効化するだけで、既存の読み込み済みドキュメントには影響しない)。`data`方式はそもそも
Blobを発行しないため、このライフサイクル管理自体が不要になる。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- HTMLフィールド(必須、MULTI_LINE_TEXTのみ選択可)
- CSSフィールド(任意)
- JSフィールド(任意)
- **実行方式**(ラジオボタン、既定`blob`): 「別タブは確実に開けるが仕組みが複雑(sandbox化した
  iframe内で実行)」の`blob`か、「仕組みはシンプルだが環境によっては別タブへの遷移がブロックされる
  ことがある」の`data`かを選ばせる。両方の特徴・リスクを選択肢の直下に明記する
  (上記「実行方式の選択」参照)。
- **React/JSXサポート**(チェックボックス、既定OFF): ONにすると、生成ページを開いたときだけ
  React/ReactDOM/Babel/Tailwind等を外部CDNから読み込むようになる旨と、対象CDN・
  「`export default function App() {...}`の形式で書く」という規約をチェックボックスの直下に
  明記する(上記「React/JSXサポート」参照)。
- 保存時、HTML未選択・CSS/JS/HTMLの重複選択・実行方式の不正値をエラーにする
  (`js/lib/config-validation.js`)

`kintone.app.getFormFields()`(JavaScript API)でMULTI_LINE_TEXTフィールドの一覧を取得する
(戻り値はREST APIの`properties`と同様の値そのもので、`{properties: {...}}`のようにラップされない。
CLAUDE.md開発方針1の既知の落とし穴を踏まえて確認済み)。

## 対応画面(確定・スコープ)

- PC: レコード詳細画面(リンク表示)/レコード作成・編集画面(フィールド表示保証)/
  レコード印刷画面(HTML/CSS/JSの入力フィールドを非表示。印刷時に生のコードが出力されるのを防ぐ。
  `setFieldShown()`は印刷画面でも利用できるAPIのため対応する)。
- モバイル: **非対応**。`kintone.app.record.getHeaderMenuSpaceElement()`(リンクの設置場所)は
  PC専用でモバイル版が無く、モバイルのヘッダー下要素(`kintone.mobile.app.getHeaderSpaceElement()`
  相当)は詳細画面のレコードごとの表示ではなくアプリ全体で共通の要素のため、レコードごとに
  異なるリンクを差し込む用途には使えない。`setFieldShown()`自体はモバイルでも動くため、
  フィールドの非表示だけモバイルで行うと「フィールドは消えるがリンクも無い」という中途半端な
  状態になるため、モバイルでは本プラグインの処理自体を何もしない(確定)。

## エッジケース

- HTML/JSフィールドがどちらも未入力: リンクの代わりに「HTML/JSのどちらも未入力です」の文言を
  表示し、Blob/data:URLは作らない。HTMLのみ未入力でJSに内容がある場合(React/JSXサポート時に
  典型的な構成)はリンクを表示する。
- 設定でCSS/JSフィールドを指定しない: それぞれ空文字列として扱い、`<style></style>`/
  `<script type="module"></script>`が空のまま出力される(エラーにしない)。
- 設定済みのフィールドコードがフォームから削除された場合: `event.record[fieldCode]`が
  存在しないため、該当フィールドは空文字列として扱う(画面をクラッシュさせない)。
- 同じフィールドをHTML/CSS/JSで重複指定: 設定画面の保存時バリデーションで弾く。
- 作成者情報が record 内に見つからない場合(理論上は起こらないが防御的に): 警告文は
  「(作成者不明)さんが入力したコード」のように表示する。
- React/JSXサポートON時、JSフィールドに`export default function App() {...}`が無い場合:
  画面はクラッシュさせず、生成ページのコンソールにエラーを出すだけにする(ブートストラップの
  `typeof App === 'function'`ガード)。
- `data`方式で、環境の制限により別タブへの遷移がブロックされた場合: プラグイン側では検知できない
  (ブラウザが遷移自体を止めるため)。設定画面の説明文でこの可能性を明記し、確実性を求める場合は
  `blob`方式を選ぶよう案内する。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする。

- `build-preview-html.js`: `buildInnerDocument`/`buildOuterShellDocument`/`buildDataUrl`。
  `</style`/`</script`のエスケープ、HTML/CSS/JS未入力時の挙動、`reactMode`有効時のimport map・
  Babel・Tailwind CDN読み込み・ブートストラップコードの埋め込みを含めてテストする。
- `find-creator-name.js`: `event.record`から`type === 'CREATOR'`のフィールドを探して名前を返す
  (見つからない場合のフォールバック文言を含む)。
- `config-store.js`: 設定(htmlFieldCode/cssFieldCode/jsFieldCode/executionMode/enableReact)の
  読み書きと既定値。
- `config-validation.js`: HTML未選択・フィールドコード重複・実行方式の不正値のバリデーション。

kintone依存のグルーコード(`js/desktop.js`、`js/config.js`、Blob/URL API呼び出し)は
`src/e2e/*.e2e.test.js`(Puppeteer)で実環境テストする。

## 実装

kintoneドキュメントMCPを参照しながら実装した(`setFieldShown()`のPC/モバイル別の利用可能画面、
`getHeaderMenuSpaceElement()`がモバイル非対応であること、`app.record.detail.show`のイベント仕様を
確認済み)。sandbox化iframeによるオリジン分離はkintone固有の仕様ではなくWeb標準(HTML Living
Standard)の一般的な仕組みであり、既存の実績ある手法(CodeSandbox/StackBlitz等のコードプレビュー
機能と同種の設計)を踏襲した。セキュアコーディングガイドラインでのリスクチェックは
`security-checklist.md`を参照。
