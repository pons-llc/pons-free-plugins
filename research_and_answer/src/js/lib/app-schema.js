(function (root) {
  'use strict';

  // 設定画面の「必要な項目・一覧を自動作成」で使う、生成すべきフィールド・一覧定義の純粋ロジック。
  // 実際のAPI呼び出し(POST /k/v1/preview/app/form/fields.json 等)はconfig.js側で行い、
  // ここでは「何を作るべきか」「既存に対して何が不足か」だけを計算する。

  const textField = (code, label) => ({
    type: 'SINGLE_LINE_TEXT',
    code,
    label,
  });
  const multiTextField = (code, label) => ({
    type: 'MULTI_LINE_TEXT',
    code,
    label,
  });
  const numberField = (code, label) => ({ type: 'NUMBER', code, label });
  // 組織選択フィールド。defaultValueに{type:'FUNCTION', code:'PRIMARY_ORGANIZATION()'}を
  // 指定すると「優先する組織」が初期値になる(add-form-fields APIドキュメントで確認済み)
  const orgField = (code, label, defaultValue) => ({
    type: 'ORGANIZATION_SELECT',
    code,
    label,
    entities: [],
    defaultValue: defaultValue || [],
  });
  const dropDownField = (code, label, options, defaultValue) => ({
    type: 'DROP_DOWN',
    code,
    label,
    options: Object.fromEntries(
      options.map((opt, i) => [opt, { label: opt, index: String(i) }]),
    ),
    defaultValue: defaultValue || '',
  });

  // 依頼アプリのquestionsテーブルの「タイプ」選択肢(form-ui.jsが描画できるタイプと一致させる)
  const QUESTION_TYPES = [
    '文字列',
    '文字列_複数行',
    '数値',
    '日付',
    '日時',
    '時刻',
    'ラジオボタン',
    'ドロップダウン',
    'チェックボックス',
  ];

  // 回答アプリの予備フィールド定義(analysis-core.jsのSPARE_FIELD_PATTERNと一致する接頭辞)
  const buildSpareFieldDefs = () => {
    const defs = {};
    const add = (prefix, count, factory, labelPrefix) => {
      for (let i = 1; i <= count; i++) {
        const code = `${prefix}${i}`;
        defs[code] = factory(code, `${labelPrefix}${i}`);
      }
    };
    add('text_', 20, textField, '予備 文字列');
    add('multi_text_', 10, multiTextField, '予備 複数行');
    add('number_', 10, numberField, '予備 数値');
    add(
      'date_',
      5,
      (code, label) => ({ type: 'DATE', code, label, defaultNowValue: false }),
      '予備 日付',
    );
    add(
      'datetime_',
      5,
      (code, label) => ({
        type: 'DATETIME',
        code,
        label,
        defaultNowValue: false,
      }),
      '予備 日時',
    );
    add(
      'time_',
      5,
      (code, label) => ({ type: 'TIME', code, label, defaultNowValue: false }),
      '予備 時刻',
    );
    return defs;
  };

  // 依頼アプリの関連レコード一覧(related): 依頼アプリのレコード番号 ↔ 回答アプリのlookup。
  // 依頼アプリ側の生成(回答側にlookupがある場合)と、回答アプリ側の生成(依頼アプリへの
  // 追加、こちらが基本経路)の両方から使う。
  const buildRelatedFieldDef = (options) => ({
    type: 'REFERENCE_TABLE',
    code: 'related',
    label: '回答一覧',
    referenceTable: {
      relatedApp: { app: String(options.answerAppId) },
      condition: { field: options.recordNumberCode, relatedField: 'lookup' },
      displayFields: options.displayFields || ['lookup'],
      sort: '',
      size: '10',
    },
  });

  // 依頼アプリに必要なフィールド(related=関連レコード一覧は回答アプリ側にlookupができてから
  // 追加するため、引数で制御する)
  const buildRequestFieldDefs = (options) => {
    const opts = options || {};
    const defs = {
      title: { ...textField('title', '照会タイトル'), required: true },
      description: multiTextField('description', '照会の説明'),
      requester: { ...orgField('requester', '依頼元部署'), required: true },
      recipients: orgField('recipients', '依頼先部署'),
      deadline: {
        type: 'DATETIME',
        code: 'deadline',
        label: '回答期限',
        defaultNowValue: false,
      },
      attachment: {
        type: 'FILE',
        code: 'attachment',
        label: '関連添付ファイル',
      },
      questions: {
        type: 'SUBTABLE',
        code: 'questions',
        label: '質問項目',
        fields: {
          order: numberField('order', '表示順'),
          question: textField('question', '質問(項目名)'),
          question_detail: multiTextField('question_detail', '詳細説明'),
          field_type: dropDownField(
            'field_type',
            'タイプ',
            QUESTION_TYPES,
            '文字列',
          ),
          insert_column: textField(
            'insert_column',
            '格納フィールドコード(回答アプリの予備フィールド)',
          ),
          choice: textField('choice', '選択肢(カンマ区切り)'),
          question_width: dropDownField(
            'question_width',
            '表示幅',
            ['1/1', '1/2'],
            '1/1',
          ),
          mondatory: dropDownField(
            'mondatory',
            '必須/任意',
            ['必須', '任意'],
            '任意',
          ),
        },
      },
      condition_json: multiTextField('condition_json', '動的必須条件(JSON)'),
      json: multiTextField('json', 'フォーム定義JSON(保存時に自動生成)'),
      related_links: {
        type: 'SUBTABLE',
        code: 'related_links',
        label: '関連リンク',
        fields: {
          link_display_label: textField('link_display_label', '表示ラベル'),
          link_link: {
            type: 'LINK',
            code: 'link_link',
            label: 'URL',
            protocol: 'WEB',
          },
        },
      },
      related_rich_text: {
        type: 'RICH_TEXT',
        code: 'related_rich_text',
        label: '関連リンク(保存時に自動生成)',
      },
    };

    // 関連レコード一覧: このアプリのレコード番号 ↔ 回答アプリのlookupフィールド
    if (opts.answerAppId && opts.recordNumberCode && opts.answerHasLookup) {
      defs.related = buildRelatedFieldDef({
        answerAppId: opts.answerAppId,
        recordNumberCode: opts.recordNumberCode,
        displayFields: opts.answerDisplayFields,
      });
    }
    return defs;
  };

  // 回答アプリに必要なフィールド。lookupの作成には依頼アプリのレコード番号フィールドコードが必要。
  const buildAnswerFieldDefs = (options) => {
    const opts = options || {};
    const defs = {
      title: textField('title', '照会タイトル(自動コピー)'),
      description: multiTextField('description', '照会の説明(自動コピー)'),
      requester: {
        ...orgField('requester', '依頼元部署(自動コピー)'),
        required: true,
      },
      deadline: {
        type: 'DATETIME',
        code: 'deadline',
        label: '回答期限(自動コピー)',
        defaultNowValue: false,
      },
      json: multiTextField('json', 'フォーム定義JSON(自動コピー)'),
      answer_department: {
        ...orgField('answer_department', '回答部署', [
          { type: 'FUNCTION', code: 'PRIMARY_ORGANIZATION()' },
        ]),
        required: true,
      },
      answer_status: {
        type: 'RADIO_BUTTON',
        code: 'answer_status',
        label: '回答状況',
        options: {
          未着手: { label: '未着手', index: '0' },
          対応中: { label: '対応中', index: '1' },
          回答済: { label: '回答済', index: '2' },
        },
        defaultValue: '未着手',
        align: 'HORIZONTAL',
      },
      attachment: { type: 'FILE', code: 'attachment', label: '添付ファイル' },
      ...buildSpareFieldDefs(),
    };
    if (opts.requestAppId && opts.requestRecordNumberCode) {
      defs.lookup = {
        type: 'NUMBER',
        code: 'lookup',
        label: '照会(依頼レコード)',
        required: true,
        lookup: {
          relatedApp: { app: String(opts.requestAppId) },
          relatedKeyField: opts.requestRecordNumberCode,
          fieldMappings: [
            { field: 'title', relatedField: 'title' },
            { field: 'description', relatedField: 'description' },
            { field: 'requester', relatedField: 'requester' },
            { field: 'deadline', relatedField: 'deadline' },
            { field: 'json', relatedField: 'json' },
          ],
          lookupPickerFields: [opts.requestRecordNumberCode, 'title'],
          filterCond: '',
          sort: `${opts.requestRecordNumberCode} desc`,
        },
      };
    }
    return defs;
  };

  // 既存フィールド(GET form/fieldsのproperties)に無いものだけを返す(冪等追加用)。
  // 既存フィールドの設定は一切変更しない。
  const diffMissingFields = (desiredDefs, existingProperties) => {
    const existing = existingProperties || {};
    const missing = {};
    Object.entries(desiredDefs || {}).forEach(([code, def]) => {
      if (!existing[code]) {
        missing[code] = def;
      }
    });
    return missing;
  };

  // 依頼アプリ側の生成に必要な、回答アプリの状態チェック
  const checkAnswerAppReady = (answerProperties) => ({
    hasLookup: !!(answerProperties && answerProperties.lookup),
  });

  // 回答アプリ側の生成に必要な、依頼アプリの状態チェック(lookupのコピー元フィールド一式)
  const checkRequestAppReady = (requestProperties) => {
    const required = ['title', 'description', 'requester', 'deadline', 'json'];
    const missing = required.filter(
      (code) => !(requestProperties && requestProperties[code]),
    );
    return { ready: missing.length === 0, missing };
  };

  const findRecordNumberCode = (properties) => {
    const entry = Object.entries(properties || {}).find(
      ([, p]) => p.type === 'RECORD_NUMBER',
    );
    return entry ? entry[0] : null;
  };

  // GET /k/v1/preview/app/views.json のviewsに、集計リスト(カスタマイズ)と分析(表形式)を
  // マージしたPUT用ペイロードを作る。既存の一覧は名前・種類を保ったままindexだけ後ろにずらす。
  // PUTは「指定しなかった一覧は削除される」仕様のため、必ず既存一覧を含める。
  const buildViewsPayload = (existingViews, names, recordNumberCode) => {
    const views = {};
    let added = 0;
    const listViewName = names.listViewName;
    const analysisViewName = names.analysisViewName;

    if (!existingViews || !existingViews[listViewName]) {
      views[listViewName] = {
        index: '0',
        type: 'CUSTOM',
        name: listViewName,
        html: '<div id="virtual-table-div"></div>',
        pager: true,
        device: 'DESKTOP',
      };
      added += 1;
    }
    if (!existingViews || !existingViews[analysisViewName]) {
      views[analysisViewName] = {
        index: '1',
        type: 'LIST',
        name: analysisViewName,
        fields: [recordNumberCode, 'title'].filter((c) => !!c),
        sort: recordNumberCode ? `${recordNumberCode} desc` : '',
      };
      added += 1;
    }
    if (added === 0) {
      return { views: null, added: 0 };
    }

    // 既存一覧を後ろに並べ直して引き継ぐ(typeごとにPUTで許可されるキーだけ写す)
    const sortedExisting = Object.values(existingViews || {}).sort(
      (a, b) => Number(a.index) - Number(b.index),
    );
    sortedExisting.forEach((view, i) => {
      const base = {
        index: String(added + i),
        type: view.type,
        name: view.name,
      };
      if (view.builtinType === 'ASSIGNEE') {
        // 「(作業者が自分)」はindexとtypeのみ変更可能
        views[view.name] = { index: base.index, type: view.type };
        return;
      }
      if (view.type === 'LIST') {
        views[view.name] = {
          ...base,
          fields: view.fields || [],
          filterCond: view.filterCond || '',
          sort: view.sort || '',
        };
      } else if (view.type === 'CALENDAR') {
        views[view.name] = {
          ...base,
          date: view.date,
          title: view.title,
          filterCond: view.filterCond || '',
          sort: view.sort || '',
        };
      } else if (view.type === 'CUSTOM') {
        views[view.name] = {
          ...base,
          html: view.html || '',
          pager: view.pager !== false,
          device: view.device || 'DESKTOP',
          filterCond: view.filterCond || '',
          sort: view.sort || '',
        };
      }
    });

    return { views, added };
  };

  const AppSchema = {
    QUESTION_TYPES,
    buildSpareFieldDefs,
    buildRelatedFieldDef,
    buildRequestFieldDefs,
    buildAnswerFieldDefs,
    diffMissingFields,
    checkAnswerAppReady,
    checkRequestAppReady,
    findRecordNumberCode,
    buildViewsPayload,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppSchema;
  } else {
    root.ResearchAnswer = root.ResearchAnswer || {};
    root.ResearchAnswer.AppSchema = AppSchema;
  }
})(typeof window !== 'undefined' ? window : globalThis);
