# genogram セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-10-20(v1)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.Genogram`)のみを公開している。画面に追加するDOMのクラス名は`gng-`/`gngc-`、SVG内のクラス名は`g-`接頭辞(SVG内に埋め込んだ`<style>`はSVG内の要素にのみ効くよう`g-`クラスに限定)
- [x] 既存のkintoneグローバルオブジェクトを書き換えていない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] 設定画面のフィールド・レイアウト取得は`kintone.app.getFormFields()`/`kintone.app.getFormLayout()`、スペースは`getSpaceElement()`、フィールドの表示切替は`setFieldShown()`、ログインユーザーは`kintone.getLoginUser()`と、JavaScript APIを優先している
- [x] 追加・編集画面の保存は、保存イベント(`app.record.create.submit`/`edit.submit`)で`event.record`に値を入れるkintone標準の保存で行い、REST APIを呼ばない(`kintone.app.record.set()`はイベントハンドラー内で使えないため、この方式に統一)
- [x] JavaScript APIに相当機能が無い「詳細画面からのメモの追記」のみ、`kintone.api(kintone.api.url(path, true), ...)`(kintone自身への呼び出し専用の内部ラッパー)で`PUT /k/v1/record.json`(競合時のみ`GET`→`PUT`)を実行している。生の`fetch`/`XMLHttpRequest`でURLを組み立てていない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ。図の描画は自前のSVG生成)。kintone以外の外部サーバーへの通信は一切行わない。フォントも外部から読み込まない
- [x] 画像の保存(PNG)は、SVGを`Blob`→`Image`→`canvas`でブラウザ内で変換し、`URL.createObjectURL()`のリンクでダウンロードさせる。外部への送信はしない

## XSS・CSSインジェクション対策

- [x] 名前・年齢・備考・世帯名・メモ・ユーザー名など、利用者の入力値やJSON由来の値は、すべて`textContent`/`createTextNode`で描画している。`innerHTML`・`insertAdjacentHTML`・`outerHTML`は一切使用していない(設定画面・エディター・閲覧・モバイルすべて)
- [x] SVGの描画命令(`js/lib/scene.js`)は、利用者の入力値を属性に入れない(座標などの数値・固定のクラス名のみ)。入力値は`text`/`title`として分け、描画側で`textContent`に設定する(`__tests__/scene.test.js`で`<script>`を含む名前が属性に現れないことを確認)
- [x] SVG要素への`setAttribute()`は、許可リスト(`Scene.isSafeAttrName()`: class/x/y/d/points等)に含まれる属性名だけに限定し、`on*`イベント属性・`href`・`style`は設定できない(`__tests__/scene.test.js`)。図形をクリックで特定するための`data-gtype`/`data-gid`属性はJSON内のIDを値として持つが、`setAttribute()`の値はHTMLとして解釈されず、`querySelector`のセレクター文字列には連結していない
- [x] SVG内に埋め込む`<style>`は固定の文字列のみで、利用者の入力値を含まない。縮小表示のstyle属性も固定値のみ
- [x] 確認ダイアログ(`window.confirm`)のメッセージに人物名を含めるが、`confirm`はテキストとして表示するためHTMLとして解釈されない

## データの妥当性検証・データ消失の防止

- [x] 文字列(複数行)フィールドの値は利用者が直接書き換えられるため、読み込むたびに`js/lib/model.js`で正規化する: 未知の値は既定値、重複ID・存在しない人物への参照(夫婦・関係・親・世帯・メモ)・自分自身との夫婦は除去、文字列は長さを制限(`__tests__/model.test.js`)
- [x] JSONとして読めない値の場合は、編集画面でエディターを出さず、保存イベントでも値を上書きしない(元のデータを消さない)。修正できるよう、データのフィールドを表示してエラーメッセージを出す(E2E`record-flow.e2e.test.js`で、壊れた値のまま保存しても値が変わらないことを確認済み)
- [x] 親の候補から、自分・自分の子孫・それらを含む夫婦を除き、エディターから親子関係の循環を作れないようにしている(`Ops.parentOptions()`、`__tests__/ops.test.js`)。手で書き換えたJSONで循環していても、世代の計算は回数上限で止まる(`__tests__/layout.test.js`)
- [x] 人物の削除時は、その人を含む夫婦・関係・世帯の所属・親の参照・その人へのメモを連動して削除し、壊れた参照を残さない(確認ダイアログあり。`__tests__/ops.test.js`)
- [x] 一覧のインライン編集ではデータのフィールドを編集不可にする(手入力でJSONを壊さないため)
- [x] モバイルは閲覧のみで、追加・編集画面でもデータのフィールドの値に触れない

## レコード更新の安全性(詳細画面からのメモの追記)

- [x] 画面表示時のレコードの`$revision`を必ず`PUT`に指定する(楽観ロック)。他の利用者が先に更新していた場合はkintoneが`GAIA_CO02`で拒否するため上書きは起きない。その場合のみ最新を`GET`してメモを足し直し、そのリビジョンで再度`PUT`する。再試行でも競合した場合は再読み込みを促すエラーにする(`__tests__/memo-saver.test.js`)
- [x] 再試行は1回だけ。本文が空・保存済みの値がJSONとして読めない場合は、APIを呼ぶ前にエラーにして更新しない(壊れた値をメモ付きの新しいJSONで上書きしない)
- [x] 更新するのはデータのフィールドのみで、他のフィールドは`record`に含めない
- [x] レコード・フィールドの編集権限が無いユーザーの場合、`PUT`がkintone側で拒否され、エラーメッセージを表示する(プラグイン独自の権限判定は持たず、kintoneのアクセス権に従う)

## 個人情報の取り扱い

- [x] ジェノグラムは家族構成・死亡・離婚・関係の悪化など機微な個人情報を含む。データは対象レコードの文字列(複数行)フィールドにのみ保存し、閲覧範囲はアプリ・レコード・フィールドのアクセス権に従う。外部へは送信しない
- [x] `localStorage`等のブラウザストレージには何も保存しない(下書き中のメモも画面内のメモリにのみ保持)
- [x] メモの記入者として`kintone.getLoginUser()`のログイン名・表示名をJSONに保存する(誰がいつ書いたかの記録のため)。外部へは送信しない
- [x] 「画像を保存」で書き出したPNGは利用者の端末に保存される。持ち出しの扱いは各組織の運用ルールに従う(idea.md・公開ページで注意喚起する)

## 設定の妥当性検証・エラー処理

- [x] `kintone.plugin.app.getConfig()`が`null`を返す場合でも、`js/lib/config-store.js`は既定値を返す(`__tests__/config-store.test.js`)。未設定なら各画面で何もしない
- [x] データのフィールド・スペースのどちらかが未選択なら保存させない(E2E`config-screen.e2e.test.js`で確認)。`manifest.json`の`required_params`にも両キーを指定
- [x] 設定保存後にフィールドやスペースがフォームから削除された場合は、`getSpaceElement()`が`null`・`event.record`にフィールドが無いことを確認して何もしない(画面をクラッシュさせない)。設定画面では保存済みの値が候補に無ければ未選択に戻す

## オフライン版(webapp/dist/genogram-offline.html)

- [x] 外部ライブラリ・外部リソースを一切読み込まない。スクリプト・スタイル・アイコンはすべて1つのHTMLに埋め込み(`webapp/build.js`)
- [x] Content-Security-Policy(`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; form-action 'none'`)で外部への通信を禁止し、データが外に出ない仕組みにしている。`'unsafe-inline'`は1ファイルで配布するために必要で、埋め込むのはビルド時に固定したこのリポジトリのコードのみ(利用者の入力値からスクリプトを組み立てる箇所は無い)。E2E(`webapp-offline.e2e.test.js`)で、外部へのリクエストが0件・CSP違反を含むコンソールエラーが無いことを確認済み
- [x] `<script>`に埋め込むコード中の`</script`は`<\/script`にエスケープし、HTMLとして途中で閉じないようにしている
- [x] 開いたファイルは`CaseFile.parse()`→`Model.normalize()`で正規化してから使う(kintone版と同じ。壊れた参照・未知の値は捨てる)。JSONとして読めない・ジェノグラムでないファイルはエラーを表示し、今の内容を変えない。描画はkintone版と同じく`textContent`のみ(XSS対策は上記と共通)
- [x] ブラウザのストレージ(localStorage・IndexedDB等)には何も保存しない。データは画面内のメモリと、利用者が保存したファイルにのみある。未保存で閉じる・新規・開く場合は確認する
- [x] ファイル名はケース名から作るが、ファイル名に使えない文字・制御文字は`_`に置き換え、長さを制限する(`__tests__/case-file.test.js`)
- [x] 保存したケースファイル・画像には個人情報が含まれるため、画面の「使い方とデータの扱い」で、保存場所・持ち出しは所属先のルールに従うよう注意喚起している
