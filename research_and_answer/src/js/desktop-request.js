(function (global, kintone) {
  'use strict';

  // 依頼アプリ側の動作: フォーム定義の保存時バリデーション+JSON化、レコード詳細でのプレビュー、
  // 回答アプリの分析への遷移ボタン。

  const NS = global.ResearchAnswer;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  if (config.role !== 'request') {
    return;
  }

  const FormModel = NS.FormModel;
  const FormUI = NS.FormUI;

  // 回答アプリのフィールド一覧(insert_columnの存在チェック用)。
  // REST APIレスポンスは {properties: {...}} にラップされている(kintone.app.getFormFields()と
  // 違いラップありなのが正、CLAUDE.mdの既知の落とし穴参照)。
  const fetchAnswerAppFields = async () => {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/app/form/fields.json', true),
      'GET',
      {
        app: config.answerAppId,
      },
    );
    return resp.properties;
  };

  // --- 保存時: バリデーションとJSON生成 ---
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    async (event) => {
      const record = event.record;
      if (!record.questions || !record.json) {
        // 必要フィールドが未生成のアプリでは何もしない(設定画面の自動作成を促すのはconfig側の役割)
        return event;
      }

      const check = FormModel.validateFormLayout(record.questions.value);
      if (!check.isValid) {
        event.error = check.messages.join('\n');
        return event;
      }

      // insert_columnが回答アプリに実在するフィールドコードかを確認する。
      // submitイベントはPromise対応のため、解決までkintone側が保存を待つ。
      // (require-atomic-updates対策でエラーメッセージをローカル変数に集約してから代入する)
      let asyncError = null;
      try {
        const answerProps = await fetchAnswerAppFields();
        const missing = record.questions.value
          .map((row) => row.value.insert_column.value)
          .filter((code) => code && !answerProps[code]);
        if (missing.length > 0) {
          asyncError = `回答アプリ(アプリID: ${config.answerAppId})に存在しないフィールドコードが指定されています: ${missing.join(', ')}`;
        }
      } catch (e) {
        console.error('回答アプリのフィールド取得に失敗しました', e);
        asyncError =
          '回答アプリのフィールド情報を取得できませんでした。プラグイン設定の「回答アプリのアプリID」と閲覧権限を確認してください。';
      }
      if (asyncError) {
        // eslint-disable-next-line require-atomic-updates -- submitのeventは自イベント内でのみ使う
        event.error = asyncError;
        return event;
      }

      // 関連リンクのリッチテキスト生成(URLスキーム検証+エスケープはFormModel側で実施)
      if (record.related_links && record.related_rich_text) {
        record.related_rich_text.value = FormModel.buildRelatedLinksHtml(
          record.related_links.value,
        );
      }

      // 表示順で並べ替えてから、回答アプリが読むJSONを生成して保存する
      record.questions.value.sort(
        (a, b) =>
          (Number(a.value.order && a.value.order.value) || 0) -
          (Number(b.value.order && b.value.order.value) || 0),
      );
      record.json.value = FormModel.buildSettingJson(
        record.questions.value,
        record.condition_json ? record.condition_json.value : '',
      );

      return event;
    },
  );

  // フォーム定義JSON(json)は保存時に自動生成される内部データのため、レコード画面には出さない
  // (kintone.app.record.setFieldShown(): フィールドコード指定、存在しないコードはエラーに
  // ならず何も起きない仕様。desktop-answer-form.jsのhideBackingFieldsと同じ方針)
  kintone.events.on(
    [
      'app.record.detail.show',
      'app.record.create.show',
      'app.record.edit.show',
    ],
    (event) => {
      if (event.record.json) {
        kintone.app.record.setFieldShown('json', false);
      }
      return event;
    },
  );

  // --- レコード詳細: プレビュー描画と「集計・分析」ボタン ---
  kintone.events.on('app.record.detail.show', (event) => {
    const record = event.record;

    // 集計・分析ボタン(回答アプリの一覧へ、この照会レコードで絞り込んで遷移)。
    // レコード詳細画面のメニュー右側の要素は kintone.app.record.getHeaderMenuSpaceElement()
    // (record付き)。kintone.app.getHeaderMenuSpaceElement()はレコード一覧画面用でここではnull
    // (E2Eで実際にボタンが出ない不具合として検出)。
    // 編集権限がないユーザーには表示しない(kintone.app.record.getPermissions()はレコード詳細画面
    // でのみ利用可能・Promiseを返す非同期API。kintone_doc MCPで戻り値{editRecord, deleteRecord}を
    // 確認済み)。
    kintone.app.record.getPermissions().then((permissions) => {
      const space = kintone.app.record.getHeaderMenuSpaceElement();
      if (
        permissions.editRecord &&
        space &&
        !document.getElementById('ra-move-list')
      ) {
        const btn = document.createElement('button');
        btn.id = 'ra-move-list';
        btn.type = 'button';
        btn.textContent = '集計・分析';
        btn.classList.add('kintoneplugin-button-normal');
        btn.addEventListener('click', () => {
          const query = encodeURIComponent(
            `lookup = ${event.record.$id.value}`,
          );
          window.location.href = `/k/${config.answerAppId}/?query=${query}`;
        });
        space.appendChild(btn);
      }
    });

    // プレビュー描画(保存済みJSONを優先、無ければ画面上のテーブルから)
    const spaceField = kintone.app.record.getSpaceElement(
      config.previewSpaceId,
    );
    if (!spaceField) {
      return event;
    }
    let layout = [];
    let condition = [];
    if (record.json && record.json.value) {
      const setting = FormModel.parseSettingJson(record.json.value);
      layout = setting.layout;
      condition = setting.condition;
    } else if (record.questions && record.questions.value.length > 0) {
      layout = record.questions.value;
      condition = FormModel.safeParseJson(
        record.condition_json ? record.condition_json.value : '',
        [],
      );
    }

    if (layout.length === 0) {
      spaceField.textContent =
        'プレビューデータがありません。質問項目を入力してください。';
      return event;
    }

    FormUI.renderForm(
      spaceField,
      layout,
      condition,
      (fieldCode) => (record[fieldCode] ? record[fieldCode].value : ''),
      false,
    );
    return event;
  });
})(window, kintone);
