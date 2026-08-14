#solutions

進捗管理: 「状態」列を使う。未着手 → 執筆中 → 公開済み(git push済み) の順に更新すること。

**2026-08-14 整理統合**: 当初S01〜S20は1テーマ=ほぼ1プラグインの狭いページとして
全て執筆・公開したが、`/articles/<同slug>/`と1対1対応するページが多く、solutionsと
articlesでキーワードを奪い合う状態(キーワードカニバリゼーション)になっていた。
「複数プラグインにまたがる真に広いユースケースか」を基準に、6ページは維持、7ページは
既存ピラー(scheduling/lookup/bulk-update/input-control)へ吸収して削除、
7ページは3つの新規統合ページ(list-visualization/aggregation/data-protection)に
再編した。削除したURLは`site/_redirects`で301リダイレクト設定済み。判断基準の詳細は
`.claude/skills/solutions-page/SKILL.md`の「1プラグイン=1ページを作らない」節を参照。

| #   | 状態    | URL                                  | Title                                          | H1                          | 狙う検索語                                     | 内部リンク先                                                              |
| --- | ----- | -------------------------------------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| S01 | 統合済み | ~~`/solutions/bulk-record-creation/`~~ | → `/solutions/scheduling/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S02 | 公開済み | `/solutions/bulk-update/`              | kintoneのレコードを一括更新する方法｜無料プラグインでまとめて変更 | kintoneのレコードを一括更新する方法           | `kintone 一括更新` / `kintone レコード 一括更新`             | `/plugins/bulk_field_update/` `/plugins/bulk_approval/`。旧S03(一括承認)を統合済み |
| S03 | 統合済み | ~~`/solutions/bulk-approval/`~~        | → `/solutions/bulk-update/`に統合(S02が既に両プラグインを扱っていたため) | ― | ― | ― |
| S04 | 統合済み | ~~`/solutions/calendar/`~~             | → `/solutions/scheduling/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S05 | 統合済み | ~~`/solutions/kanban/`~~               | → `/solutions/list-visualization/`に統合(旧S19と合体) | ― | ― | ― |
| S06 | 統合済み | ~~`/solutions/budget-management/`~~    | → `/solutions/aggregation/`に統合(旧S07・S10と合体) | ― | ― | ― |
| S07 | 統合済み | ~~`/solutions/related-record-summary/`~~ | → `/solutions/aggregation/`に統合(旧S06・S10と合体) | ― | ― | ― |
| S08 | 統合済み | ~~`/solutions/user-information/`~~     | → `/solutions/lookup/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S09 | 統合済み | ~~`/solutions/organization-information/`~~ | → `/solutions/lookup/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S10 | 統合済み | ~~`/solutions/related-record/`~~       | → `/solutions/aggregation/`に統合(旧S06・S07と合体、一般論のリード文を流用) | ― | ― | ― |
| S11 | 統合済み | ~~`/solutions/field-display-control/`~~ | → `/solutions/input-control/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S12 | 公開済み | `/solutions/tab-layout/`               | kintoneのフォームをタブ表示にする方法｜入力画面を整理       | kintoneのフォームをタブ表示にする方法          | `kintone タブ表示` / `kintone フォーム タブ`               | `/plugins/tab_layout/` `/plugins/field_input_panel/`                                                 |
| S13 | 統合済み | ~~`/solutions/record-delete-backup/`~~ | → `/solutions/data-protection/`に統合(旧S14と合体) | ― | ― | ― |
| S14 | 統合済み | ~~`/solutions/field-encryption/`~~     | → `/solutions/data-protection/`に統合(旧S13と合体) | ― | ― | ― |
| S15 | 公開済み | `/solutions/box-google-drive/`         | kintoneにBox・Google Driveを埋め込む方法      | kintoneにBox・Google Driveを埋め込む方法 | `kintone Google Drive 埋め込み` / `kintone Box 埋め込み` | `/plugins/box_gdrive_iframe/`                                                                        |
| S16 | 公開済み | `/solutions/japanese-calendar/`        | kintoneの日付を和暦表示する方法｜西暦・令和を自動変換       | kintoneの日付を和暦表示する方法             | `kintone 和暦` / `kintone 日付 和暦`                   | `/articles/fiscal-year-numbering/` `/plugins/wareki_date_format/`                                    |
| S17 | 公開済み | `/solutions/text-processing/`          | kintoneの文字列を分割・抽出する方法｜文字列処理を自動化      | kintoneの文字列を分割・抽出する方法           | `kintone 文字列 分割` / `kintone 文字列 抽出`              | `/plugins/text_split/` `/plugins/text_slice/` `/plugins/number_extract/`                             |
| S18 | 公開済み | `/solutions/print-control/`            | kintoneの印刷項目を制御する方法｜不要なフィールドを非表示     | kintoneの印刷項目を制御する方法             | `kintone 印刷 非表示` / `kintone 印刷 項目`               | `/plugins/printSelect/`                                                                              |
| S19 | 統合済み | ~~`/solutions/record-highlight/`~~     | → `/solutions/list-visualization/`に統合(旧S05と合体) | ― | ― | ― |
| S20 | 統合済み | ~~`/solutions/confirmation-dialog/`~~  | → `/solutions/input-control/`に吸収(単一プラグインで既存ピラーに掲載済みのため) | ― | ― | ― |
| S21 | 公開済み | `/solutions/list-visualization/`       | kintoneの一覧を見やすくする方法｜カンバン表示・色分け強調の無料プラグイン | kintoneの一覧を見やすくする方法 | `kintone カンバン` / `kintone 一覧 色分け` / `kintone タスク管理` | `/plugins/kanban_view/` `/plugins/list_highlight/`。旧S05・S19を統合 |
| S22 | 公開済み | `/solutions/aggregation/`              | kintoneでレコードを集計する方法｜予算管理・関連レコード集計の無料プラグイン | kintoneでレコードを集計する方法 | `kintone 予算管理` / `kintone 関連レコード 集計` | `/plugins/budget_meter/` `/plugins/related_record_summary/`。旧S06・S07・S10を統合 |
| S23 | 公開済み | `/solutions/data-protection/`          | kintoneで大切なデータを守る方法｜誤削除防止・暗号化の無料プラグイン | kintoneで大切なデータを守る方法 | `kintone 削除 バックアップ` / `kintone 暗号化` | `/plugins/delete_backup/` `/plugins/field_encryption/` `/articles/plugin-security-checklist/`。旧S13・S14を統合 |


# articles

| #   | 状態   | URL                                   | Title                                    | H1                           | 狙う検索語                             | 内部リンク先                                                              |
| --- | ---- | --------------------------------------- | ---------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| A01 | 公開済み | `/articles/bulk-record-creation/`     | kintoneでレコードを一括作成する方法｜複数レコードをまとめて登録      | kintoneでレコードを一括作成する方法        | `kintone レコード 一括作成`               | `/solutions/bulk-record-creation/` `/plugins/bulk_record_creation/` |
| A02 | 公開済み | `/articles/bulk-field-update/`        | kintoneのレコードを一括更新する方法｜条件に一致するレコードをまとめて変更 | kintoneのレコードを一括更新する方法        | `kintone 一括更新 方法`                 | `/solutions/bulk-update/` `/plugins/bulk_field_update/`             |
| A03 | 公開済み | `/articles/bulk-approval/`            | kintoneで複数レコードを一括承認する方法                  | kintoneで複数レコードを一括承認する方法      | `kintone 一括承認 方法`                 | `/solutions/bulk-approval/` `/solutions/approval/`                  |
| A04 | 公開済み | `/articles/calendar-view/`            | kintoneの予定をカレンダーで表示する方法                  | kintoneの予定をカレンダー表示する方法       | `kintone カレンダー表示`                 | `/solutions/calendar/` `/plugins/calendar_view/`                    |
| A05 | 公開済み | `/articles/kanban-board/`             | kintoneでカンバンボードを作る方法｜案件・タスクを見える化         | kintoneでカンバンボードを作る方法         | `kintone カンバンボード`                 | `/solutions/kanban/` `/plugins/kanban_view/`                        |
| A06 | 公開済み | `/articles/budget-management/`        | kintoneで予算と実績を管理する方法｜予算消化率を自動表示          | kintoneで予算と実績を管理する方法         | `kintone 予算 実績 管理`                | `/solutions/budget-management/` `/plugins/budget_meter/`            |
| A07 | 公開済み | `/articles/related-record-summary/`   | kintoneの関連レコードを件数・合計・平均で集計する方法           | kintoneの関連レコードを集計する方法        | `kintone 関連レコード 集計 方法`            | `/solutions/related-record-summary/`                                |
| A08 | 対応不要 | `/articles/user-code-lookup/`         | kintoneのユーザーコードから氏名・所属を取得する方法            | kintoneのユーザーコードから情報を取得する方法   | `kintone ユーザーコード 氏名`              | 既存の`/articles/user-info-lookup/`(氏名・メールアドレス自動取得)と主題が重複するため新規作成を見送り。重複コンテンツ化を避けた。 |
| A09 | 公開済み | `/articles/organization-code-lookup/` | kintoneの組織コードから組織名を取得する方法                | kintoneの組織コードから情報を取得する方法     | `kintone 組織コード 組織名`               | `/solutions/organization-information/` `/plugins/org_lookup/`       |
| A10 | 公開済み | `/articles/conditional-display/`      | kintoneで条件によってフィールドを非表示にする方法             | kintoneで条件によってフィールドを非表示にする方法 | `kintone 条件 フィールド 非表示`            | `/solutions/field-display-control/`                                 |
| A11 | 公開済み | `/articles/tab-layout/`               | kintoneの入力フォームをタブ化する方法                   | kintoneのフォームをタブ表示する方法        | `kintone フォーム タブ化`                | `/solutions/tab-layout/`                                            |
| A12 | 公開済み | `/articles/delete-backup/`            | kintoneでレコードを削除する前にバックアップする方法            | kintoneのレコード削除前にバックアップする方法   | `kintone レコード削除 バックアップ`           | `/solutions/record-delete-backup/`                                  |
| A13 | 公開済み | `/articles/field-encryption/`         | kintoneで個人情報を暗号化して保存する方法                 | kintoneのフィールドを暗号化して保存する方法    | `kintone 個人情報 暗号化`                | `/solutions/field-encryption/`                                      |
| A14 | 公開済み | `/articles/google-drive-embed/`       | kintoneにGoogle Driveのファイルを表示・埋め込む方法      | kintoneにGoogle Driveを埋め込む方法  | `kintone Google Drive 埋め込み`       | `/solutions/box-google-drive/`                                      |
| A15 | 公開済み | `/articles/wareki-date/`              | kintoneの日付を令和・和暦に変換する方法                  | kintoneの日付を和暦に変換する方法         | `kintone 令和 日付` / `kintone 和暦 変換` | `/solutions/japanese-calendar/`                                     |
| A16 | 公開済み | `/articles/text-split/`               | kintoneの文字列を区切り文字で分割する方法                 | kintoneの文字列を分割する方法           | `kintone 文字列 分割`                  | `/solutions/text-processing/`                                       |
| A17 | 公開済み | `/articles/text-extract-number/`      | kintoneの文字列から数字だけを抽出する方法                 | kintoneの文字列から数字を抽出する方法       | `kintone 数字 抽出`                   | `/solutions/text-processing/`                                       |
| A18 | 公開済み | `/articles/list-highlight/`           | kintoneの一覧を条件によって色分けする方法                 | kintoneの一覧を条件で色分けする方法        | `kintone 一覧 色分け 方法`               | `/solutions/record-highlight/`                                      |
| A19 | 公開済み | `/articles/confirm-modal/`            | kintoneで削除・保存時に確認ダイアログを表示する方法            | kintoneで確認ダイアログを表示する方法       | `kintone 確認ダイアログ 方法`              | `/solutions/confirmation-dialog/`                                   |
| A20 | 公開済み | `/articles/self-lookup/`              | kintoneで同じアプリの別レコードを検索して値を取得する方法         | kintoneで同一アプリのレコードを参照する方法    | `kintone 同一アプリ ルックアップ`            | `/solutions/lookup/` `/plugins/self_lookup/`                        |
