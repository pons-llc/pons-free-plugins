(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ReportPromptBuilder;
  const GRID_COLUMNS = 12;
  const CANVAS_BASE_WIDTH = 780;

  // 「レイアウト編集」/「画像配置」の編集モードはページごとの画面上の状態に過ぎず、
  // 保存する設定(config.pages)には含めない。pageオブジェクト自体に持たせるとJSON.stringifyで
  // 保存対象に混ざってしまうため、WeakMapでpageオブジェクトの外に保持する。
  const pageEditorModes = new WeakMap();
  const getEditorMode = (page) => pageEditorModes.get(page) || 'layout';

  // 配置済み項目をドラッグして再配置する際、どの項目をドラッグ中かを覚えておくための
  // モジュールスコープの参照(ユーザー指示「配置方法はドラッグ&ドロップに戻して欲しい」)。
  // ブラウザ上で同時に進行するドラッグ操作は1つだけのため、単純な変数で十分。
  let draggingItemRef = null;

  const dom = {
    form: document.querySelector('.js-submit-settings'),
    cancelButton: document.querySelector('.js-cancel-button'),
    errors: document.getElementById('js-errors'),
    noFieldsWarning: document.getElementById('js-no-fields-warning'),
    outputIndividual: document.querySelector('.js-output-individual'),
    outputBulk: document.querySelector('.js-output-bulk'),
    saveToAttachmentEnabled: document.querySelector(
      '.js-save-to-attachment-enabled',
    ),
    noFileFieldsWarning: document.getElementById('js-no-file-fields-warning'),
    attachmentField: document.querySelector('.js-attachment-field'),
    attachmentFileNamePrefix: document.querySelector(
      '.js-attachment-filename-prefix',
    ),
    pageList: document.getElementById('js-page-list'),
    pageAddButton: document.getElementById('js-page-add'),
    pageTemplate: document.getElementById('js-page-template'),
    sizeIndicator: document.getElementById('js-size-indicator'),
    previewModalOverlay: document.getElementById('js-preview-modal'),
    previewModalClose: document.querySelector('.js-preview-modal-close'),
    previewModalNote: document.querySelector('.js-preview-modal-note'),
    previewModalFrame: document.querySelector('.js-preview-modal-frame'),
    itemSettingsOverlay: document.getElementById('js-item-settings-modal'),
    itemSettingsClose: document.querySelector('.js-item-settings-close'),
    itemSettingsTitle: document.querySelector('.js-item-settings-title'),
    itemSettingsBody: document.querySelector('.js-item-settings-body'),
  };

  if (!(
    dom.form &&
    dom.cancelButton &&
    dom.errors &&
    dom.pageList &&
    dom.pageAddButton &&
    dom.pageTemplate &&
    dom.sizeIndicator &&
    dom.saveToAttachmentEnabled &&
    dom.attachmentField &&
    dom.attachmentFileNamePrefix &&
    dom.previewModalOverlay &&
    dom.previewModalClose &&
    dom.previewModalNote &&
    dom.previewModalFrame &&
    dom.itemSettingsOverlay &&
    dom.itemSettingsClose &&
    dom.itemSettingsTitle &&
    dom.itemSettingsBody
  )) {
    throw new Error('Required elements do not exist.');
  }

  // kintone.app.getFormFields() はプラグイン設定画面でも利用できる(MCP js-api/app/get-form-fields
  // で確認済み)。戻り値はREST APIレスポンスのpropertiesと同様の値がラップされずに直接解決される
  // (CLAUDE.md開発方針1の既知の落とし穴参照)。
  const formFields = await kintone.app.getFormFields();
  const selectableFields = NS.FieldCatalog.listSelectableFields(formFields);
  const tableFields = NS.FieldCatalog.listTableFields(formFields);
  const tableFieldsByCode = Object.fromEntries(
    tableFields.map((table) => [table.code, table]),
  );

  if (selectableFields.length === 0) {
    // domはトップレベルのconstでawait後に再代入され得ないため require-atomic-updates は誤検知。
    // eslint-disable-next-line require-atomic-updates
    dom.noFieldsWarning.style.display = 'block';
  }

  // 個別出力時にPDFを保存する先の候補として、添付ファイルフィールドの選択肢を用意する
  // (ユーザー指示「詳細画面から添付ファイルフィールドに保存できるようにしよう」)。
  const fileFields = NS.FieldCatalog.listFileFields(formFields);
  if (fileFields.length === 0) {
    // eslint-disable-next-line require-atomic-updates
    dom.noFileFieldsWarning.style.display = 'block';
    // eslint-disable-next-line require-atomic-updates
    dom.saveToAttachmentEnabled.disabled = true;
  }
  fileFields.forEach((field) => {
    const optionEl = document.createElement('option');
    optionEl.value = field.code;
    optionEl.textContent = `${field.label} (${field.code})`;
    dom.attachmentField.appendChild(optionEl);
  });

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // プレビュー用に最新レコード1件を取得する(ユーザー指示)。JavaScript APIには任意のレコードを
  // 取得する手段が無く(kintone.app.record.get()はレコード画面でのみ有効)、プラグイン設定画面には
  // 「現在のレコード」という概念自体が無いため、CLAUDE.md開発方針3に従いkintone自身への
  // kintone.api()呼び出しに限定してREST APIを使う。order byを省略すると仕様上レコードIDの降順で
  // 取得されるため(kintone公式ドキュメント「クエリの書き方」で確認済み)、'limit 1'だけで
  // 最新1件が取れる。レコード閲覧権限が無い/レコードが1件も無いアプリではpreviewRecordはnullのまま
  // とし、プレビュー側で案内表示に切り替える。
  let previewRecord = null;
  try {
    const recordsResponse = await kintone.api(
      kintone.api.url('/k/v1/records.json', true),
      'GET',
      { app: kintone.app.getId(), query: 'limit 1' },
    );
    previewRecord =
      (recordsResponse.records && recordsResponse.records[0]) || null;
  } catch {
    previewRecord = null;
  }

  // kintoneのプラグイン設定保存は合計256KBまで(公式ドキュメントで確認済み)。実際のバイト数では
  // なく文字数での概算だが、サイズの大半を占めるのは画像のbase64(ASCII)なのでほぼ実態に近い。
  // config-validation.jsの保存前チェックと同じ上限を、保存前に気づけるようここでも表示する。
  const MAX_TOTAL_CONFIG_SIZE = 200000;
  const updateSizeIndicator = () => {
    const imagesSize = Object.values(config.images).reduce(
      (sum, dataUrl) => sum + (dataUrl ? dataUrl.length : 0),
      0,
    );
    const totalSize =
      JSON.stringify(config.outputModes).length +
      JSON.stringify(config.pages).length +
      imagesSize;
    dom.sizeIndicator.textContent = `設定サイズの目安: 約${Math.round(totalSize / 1024)}KB / ${Math.round(MAX_TOTAL_CONFIG_SIZE / 1024)}KB`;
  };

  // 以前はキャンバスの右隣に、各ページのプレビューをiframeで常時表示していたが、
  // 「プレビューはボタン押すとモーダルで表示するようにしよう。レコードは事前に読み込んどいて」
  // というユーザー指示により、ボタン押下時にモーダルへ描画する方式に変更した。previewRecordは
  // 従来どおり設定画面表示時に1回だけ事前取得しておく(上記のREST呼び出し)。
  // 項目の設定変更のたびに呼んでいたrefreshPreview()は、保存サイズの目安表示の更新だけを行う
  // (呼び出し箇所を大きく変えないよう、関数名はそのまま残している)。
  const refreshPreview = () => {
    updateSizeIndicator();
  };

  // report-model.js/report-dom.jsという、desktop.jsが実際の出力に使うのと全く同じレンダリング
  // 処理をモーダル内のiframeに対して使い回す。プレビュー専用の別ロジックを持たないことで、
  // 見た目のズレが起きない。
  const closePreviewModal = () => {
    dom.previewModalOverlay.style.display = 'none';
  };
  const openPreviewModal = (page) => {
    dom.previewModalOverlay.style.display = 'flex';
    const previewDoc = dom.previewModalFrame.contentDocument;
    previewDoc.head.innerHTML = '';
    previewDoc.body.innerHTML = '';

    if (!previewRecord) {
      dom.previewModalNote.textContent =
        'プレビュー用のレコードがありません(このアプリにレコードが無いか、閲覧権限がありません)。';
      return;
    }
    dom.previewModalNote.textContent = '';

    const pageModel = NS.ReportModel.buildPageModel(
      page,
      previewRecord,
      config.images,
    );
    NS.ReportDom.renderReportDocument(previewDoc, [pageModel]);

    // 帳票本体はA4実寸(190mm)固定で組んでいるため、モーダル枠がそれより狭いと横スクロールが
    // 発生してしまう。モーダル枠の実幅に収まるようzoomで縮小する(zoomはtransform:scaleと
    // 異なりレイアウト上の占有幅自体を縮めるため、横スクロールが残らない)。
    const reportPageEl = previewDoc.querySelector('.report-page');
    if (reportPageEl) {
      const naturalWidth = reportPageEl.getBoundingClientRect().width;
      const availableWidth = dom.previewModalFrame.clientWidth;
      if (naturalWidth > 0 && availableWidth > 0) {
        previewDoc.body.style.zoom = String(
          Math.min(1, availableWidth / naturalWidth),
        );
      }
    }
  };
  dom.previewModalClose.addEventListener('click', closePreviewModal);
  dom.previewModalOverlay.addEventListener('click', (event) => {
    if (event.target === dom.previewModalOverlay) {
      closePreviewModal();
    }
  });

  // 歯車アイコンから開く、項目ごとの設定ポップアップ(ユーザー指示「歯車つけて押すとポップアップで
  // 入力項目が出てくる」)。キャンバス上の項目ボックスはタイトル・歯車・削除・リサイズハンドルのみの
  // 最小限の見た目にし、実際の入力コントロール(ラベル位置・文字位置・枠線・文字pt・折返し・
  // テーブルの列選択・自由テキストの内容・画像アップローダー)はすべてこちらへ集約する。
  const closeItemSettingsModal = () => {
    dom.itemSettingsOverlay.style.display = 'none';
    dom.itemSettingsBody.innerHTML = '';
  };
  const openItemSettingsModal = (item, itemIndex, page, renderCanvasFn) => {
    dom.itemSettingsTitle.textContent = placedItemTitle(item);
    dom.itemSettingsBody.innerHTML = '';
    dom.itemSettingsBody.appendChild(buildItemControls(item));
    if (item.kind === 'TABLE') {
      dom.itemSettingsBody.appendChild(buildTableColumns(item));
    } else if (item.kind === 'TEXT') {
      dom.itemSettingsBody.appendChild(buildTextContentEditor(item));
    } else if (item.kind === 'IMAGE') {
      dom.itemSettingsBody.appendChild(buildImageUploader(item));
    }
    dom.itemSettingsOverlay.style.display = 'flex';
  };
  dom.itemSettingsClose.addEventListener('click', closeItemSettingsModal);
  dom.itemSettingsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.itemSettingsOverlay) {
      closeItemSettingsModal();
    }
  });

  // IMAGE項目(社印・ロゴ)は他の項目に重ねて配置できるようにする(ユーザー指示
  // 「画像は被せられる用にしたい」)。画像を置く/動かす/幅を変えるときは重なりチェック自体を
  // 行わず、他の項目を置く/動かす/幅を変えるときも既存の画像とは重なり判定をしない
  // (画像は単なる重ね貼りのレイヤーとして扱う)。
  const hasOverlap = (items, candidate) => {
    if (candidate.kind === 'IMAGE') {
      return false;
    }
    const rangesOverlap = (a, b) => {
      const aEnd = a.colStart + a.colSpan - 1;
      const bEnd = b.colStart + b.colSpan - 1;
      return a.colStart <= bEnd && b.colStart <= aEnd;
    };
    return items.some(
      (item) =>
        item.kind !== 'IMAGE' &&
        item.row === candidate.row &&
        rangesOverlap(item, candidate),
    );
  };

  // 社印・ロゴなどの画像は、kintoneのプラグイン設定保存の上限(1キューあたり最大65,535文字)に
  // 収まるよう、選択されたファイルをcanvasで縮小・再圧縮してからdata URLとして扱う
  // (idea.md「圧縮方針」参照、ユーザー承認済み)。PNG(透過を保ちたい社印で多い)はPNGのまま、
  // それ以外はJPEG(品質0.82)に変換する。拡大はしない(縮小のみ)。
  const MAX_IMAGE_DIMENSION_PX = 240;
  const MAX_IMAGE_DATA_URL_LENGTH = 60000;

  const loadAndCompressImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error('画像の読み込みに失敗しました。'));
      reader.onload = () => {
        const imgEl = new Image();
        imgEl.onerror = () =>
          reject(new Error('画像として読み込めませんでした。'));
        imgEl.onload = () => {
          const scale = Math.min(
            1,
            MAX_IMAGE_DIMENSION_PX /
              Math.max(imgEl.naturalWidth, imgEl.naturalHeight),
          );
          const width = Math.max(1, Math.round(imgEl.naturalWidth * scale));
          const height = Math.max(1, Math.round(imgEl.naturalHeight * scale));
          const canvasEl = document.createElement('canvas');
          canvasEl.width = width;
          canvasEl.height = height;
          canvasEl.getContext('2d').drawImage(imgEl, 0, 0, width, height);
          resolve(
            file.type === 'image/png'
              ? canvasEl.toDataURL('image/png')
              : canvasEl.toDataURL('image/jpeg', 0.82),
          );
        };
        imgEl.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  const generateImageId = () =>
    `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 配置済みのIMAGE項目のサムネイル表示・ファイル選択・削除を扱う。実体(dataURL)は項目自体では
  // なく共有のconfig.imagesに持たせ、item.imageIdで参照する(idea.md「データモデル」参照)。
  const buildImageUploader = (item) => {
    const wrapEl = document.createElement('div');
    wrapEl.className = 'rpb-image-uploader';

    const previewEl = document.createElement('div');
    wrapEl.appendChild(previewEl);

    const renderThumbnail = () => {
      previewEl.innerHTML = '';
      const existing = item.imageId && config.images[item.imageId];
      if (existing) {
        const imgEl = document.createElement('img');
        imgEl.src = existing;
        imgEl.alt = '';
        previewEl.appendChild(imgEl);
      } else {
        const placeholderEl = document.createElement('div');
        placeholderEl.className = 'rpb-image-placeholder';
        placeholderEl.textContent = '画像未設定';
        previewEl.appendChild(placeholderEl);
      }
    };
    renderThumbnail();

    const fileInputEl = document.createElement('input');
    fileInputEl.type = 'file';
    fileInputEl.accept = 'image/*';
    fileInputEl.addEventListener('change', async () => {
      const file = fileInputEl.files && fileInputEl.files[0];
      fileInputEl.value = '';
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
      }

      let dataUrl;
      try {
        dataUrl = await loadAndCompressImage(file);
      } catch (error) {
        alert(error.message || '画像の読み込みに失敗しました。');
        return;
      }
      if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        alert(
          '圧縮後も画像のサイズが大きすぎます。より小さい・シンプルな画像を選んでください。',
        );
        return;
      }

      const newImageId = generateImageId();
      config.images[newImageId] = dataUrl;
      item.imageId = newImageId;
      renderThumbnail();
      refreshPreview();
    });
    wrapEl.appendChild(fileInputEl);

    const removeButtonEl = document.createElement('button');
    removeButtonEl.type = 'button';
    removeButtonEl.className = 'kintoneplugin-button-normal';
    removeButtonEl.textContent = '画像を削除';
    removeButtonEl.addEventListener('click', () => {
      item.imageId = '';
      renderThumbnail();
      refreshPreview();
    });
    wrapEl.appendChild(removeButtonEl);

    return wrapEl;
  };

  const createChip = (kind, code, label, extra) => {
    const chipEl = document.createElement('div');
    chipEl.className =
      kind === 'TABLE' ? 'rpb-chip rpb-chip-table' : 'rpb-chip';
    chipEl.draggable = true;
    chipEl.textContent = `${label} (${code})`;
    chipEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ source: 'palette', kind, code, label, ...extra }),
      );
    });
    return chipEl;
  };

  const renderPalette = (paletteFieldEl, paletteTableEl, noTablesNoteEl) => {
    selectableFields.forEach((field) => {
      paletteFieldEl.appendChild(
        createChip('FIELD', field.code, field.label, {
          type: field.type,
          isNumeric: field.isNumeric,
          unit: field.unit,
          unitPosition: field.unitPosition,
          digit: field.digit,
        }),
      );
    });
    if (tableFields.length === 0) {
      noTablesNoteEl.style.display = 'block';
    }
    tableFields.forEach((table) => {
      paletteTableEl.appendChild(createChip('TABLE', table.code, table.label));
    });
  };

  const createControlLabel = (text, controlEl) => {
    const labelEl = document.createElement('label');
    if (text) {
      labelEl.appendChild(document.createTextNode(text));
    }
    labelEl.appendChild(controlEl);
    return labelEl;
  };

  // チェックボックス+右側にラベル文言、という並び(<label><input>文言</label>)を作る。
  const createCheckboxLabel = (checked, trailingText, onChange) => {
    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.checked = checked;
    inputEl.addEventListener('change', () => onChange(inputEl.checked));

    const labelEl = document.createElement('label');
    labelEl.appendChild(inputEl);
    labelEl.appendChild(document.createTextNode(trailingText));
    return labelEl;
  };

  const createSelect = (value, options, onChange) => {
    const selectEl = document.createElement('select');
    selectEl.className = 'kintoneplugin-select';
    options.forEach((option) => {
      const optionEl = document.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      optionEl.selected = option.value === value;
      selectEl.appendChild(optionEl);
    });
    selectEl.addEventListener('change', () => onChange(selectEl.value));
    return selectEl;
  };

  const createNumberInput = (value, min, max, onCommit) => {
    const inputEl = document.createElement('input');
    inputEl.type = 'number';
    inputEl.min = String(min);
    inputEl.max = String(max);
    inputEl.value = String(value);
    inputEl.addEventListener('change', () => {
      const parsed = Math.round(Number(inputEl.value));
      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        inputEl.value = String(value);
        return;
      }
      onCommit(parsed, inputEl);
    });
    return inputEl;
  };

  // FIELD項目のunit/unitPosition/isNumericは配置した時点のkintoneフィールド設定をコピーした
  // ものでしかなく、その後もう一度参照はしない。そのため、フィールドを配置した後にkintone側で
  // 単位を設定した(または変更した)場合、以前のまま古い値が残り続け、「単位を表示」の
  // チェックボックス自体が出ない(item.unitが空のまま)という状態になる
  // (ユーザー指示「計算フィールドもちゃんと単位あったらつけて欲しい」)。歯車ポップアップを
  // 開くたびに、最新のフィールドカタログ(selectableFields、kintoneから取得した現在の定義)を
  // 使ってunit/unitPosition/isNumericを同期し直す。桁区切り・単位表示の有効/無効という
  // ユーザー自身の選択(showUnit/digitGrouping)は、既にisNumericを持っていた場合は保持し、
  // 初めて数値項目として認識された場合のみkintone側の初期値を踏襲する。
  const syncFieldItemWithCatalog = (item) => {
    if (item.kind !== 'FIELD') {
      return;
    }
    const catalogField = selectableFields.find(
      (field) => field.code === item.code,
    );
    if (!catalogField) {
      return;
    }
    const wasNumericKnown = typeof item.isNumeric !== 'undefined';
    item.isNumeric = !!catalogField.isNumeric;
    item.unit = catalogField.unit || '';
    item.unitPosition =
      catalogField.unitPosition === 'BEFORE' ? 'BEFORE' : 'AFTER';
    if (!wasNumericKnown) {
      item.showUnit = !!catalogField.isNumeric && !!catalogField.unit;
      item.digitGrouping = !!catalogField.isNumeric && !!catalogField.digit;
    }
  };

  const buildItemControls = (item) => {
    syncFieldItemWithCatalog(item);
    const controlsEl = document.createElement('div');
    controlsEl.className = 'rpb-placed-item-controls';

    if (item.kind === 'FIELD') {
      controlsEl.appendChild(
        createCheckboxLabel(item.showLabel, 'ラベル表示', (checked) => {
          item.showLabel = checked;
          refreshPreview();
        }),
      );
      controlsEl.appendChild(
        createControlLabel(
          'ラベル位置',
          createSelect(
            item.labelPosition,
            [
              { value: 'TOP', label: '上' },
              { value: 'LEFT', label: '左' },
            ],
            (value) => {
              item.labelPosition = value;
              refreshPreview();
            },
          ),
        ),
      );

      if (item.isNumeric) {
        controlsEl.appendChild(
          createCheckboxLabel(item.digitGrouping, '桁区切り', (checked) => {
            item.digitGrouping = checked;
            refreshPreview();
          }),
        );
        if (item.unit) {
          controlsEl.appendChild(
            createCheckboxLabel(
              item.showUnit,
              `単位を表示(${item.unit})`,
              (checked) => {
                item.showUnit = checked;
                refreshPreview();
              },
            ),
          );
        }
      }
    }

    if (item.kind === 'FIELD' || item.kind === 'TEXT') {
      controlsEl.appendChild(
        createControlLabel(
          '文字位置',
          createSelect(
            item.textAlign,
            [
              { value: 'LEFT', label: '左' },
              { value: 'CENTER', label: '中央' },
              { value: 'RIGHT', label: '右' },
            ],
            (value) => {
              item.textAlign = value;
              refreshPreview();
            },
          ),
        ),
      );
    }

    // 自由テキストの上下位置(ユーザー指示「任意テキストの上下位置も選択したい」)。
    if (item.kind === 'TEXT') {
      controlsEl.appendChild(
        createControlLabel(
          '上下位置',
          createSelect(
            item.verticalAlign,
            [
              { value: 'TOP', label: '上' },
              { value: 'MIDDLE', label: '中央' },
              { value: 'BOTTOM', label: '下' },
            ],
            (value) => {
              item.verticalAlign = value;
              refreshPreview();
            },
          ),
        ),
      );
    }

    controlsEl.appendChild(
      createCheckboxLabel(item.bordered, '枠線', (checked) => {
        item.bordered = checked;
        refreshPreview();
      }),
    );

    // テーブルは列ごとに文字pt・折返しを持つため(ユーザー指示「テーブルのフィールドも通常
    // フィールド同様に...表示できるように」)、ここでは項目全体の文字pt・折返しは出さない。
    if (item.kind !== 'IMAGE' && item.kind !== 'TABLE') {
      controlsEl.appendChild(
        createControlLabel(
          '文字pt',
          createNumberInput(item.fontSizePt, 6, 72, (parsed) => {
            item.fontSizePt = parsed;
            refreshPreview();
          }),
        ),
      );

      controlsEl.appendChild(
        createCheckboxLabel(item.wrap, '折返す', (checked) => {
          item.wrap = checked;
          refreshPreview();
        }),
      );
    }

    return controlsEl;
  };

  // テーブルの列を選択したときの初期値。通常のFIELD項目(buildNewItemのFIELD分岐)と同じ考え方で、
  // 単位表示・桁区切りの初期値はkintone側の設定(unit/digit)を踏襲する
  // (ユーザー指示「テーブルのフィールドも通常フィールド同様に...表示できるように」)。
  const buildTableColumnEntry = (column) => ({
    code: column.code,
    label: column.label,
    type: column.type,
    isNumeric: !!column.isNumeric,
    unit: column.unit || '',
    unitPosition: column.unitPosition === 'BEFORE' ? 'BEFORE' : 'AFTER',
    showUnit: !!column.isNumeric && !!column.unit,
    digitGrouping: !!column.isNumeric && !!column.digit,
    fontSizePt: 10,
    wrap: true,
    textAlign: 'LEFT',
  });

  // 選択済みの列1つぶんの表示設定(文字位置・文字pt・折返し・単位・桁区切り)。通常のFIELD項目の
  // コントロールと同じ項目を、列(columnEntry)に対して用意する。
  const buildColumnDisplayControls = (columnEntry) => {
    const controlsEl = document.createElement('div');
    controlsEl.className = 'rpb-placed-item-controls';

    controlsEl.appendChild(
      createControlLabel(
        '文字位置',
        createSelect(
          columnEntry.textAlign,
          [
            { value: 'LEFT', label: '左' },
            { value: 'CENTER', label: '中央' },
            { value: 'RIGHT', label: '右' },
          ],
          (value) => {
            columnEntry.textAlign = value;
            refreshPreview();
          },
        ),
      ),
    );

    controlsEl.appendChild(
      createControlLabel(
        '文字pt',
        createNumberInput(columnEntry.fontSizePt, 6, 72, (parsed) => {
          columnEntry.fontSizePt = parsed;
          refreshPreview();
        }),
      ),
    );

    controlsEl.appendChild(
      createCheckboxLabel(columnEntry.wrap, '折返す', (checked) => {
        columnEntry.wrap = checked;
        refreshPreview();
      }),
    );

    if (columnEntry.isNumeric) {
      controlsEl.appendChild(
        createCheckboxLabel(
          columnEntry.digitGrouping,
          '桁区切り',
          (checked) => {
            columnEntry.digitGrouping = checked;
            refreshPreview();
          },
        ),
      );
      if (columnEntry.unit) {
        controlsEl.appendChild(
          createCheckboxLabel(
            columnEntry.showUnit,
            `単位を表示(${columnEntry.unit})`,
            (checked) => {
              columnEntry.showUnit = checked;
              refreshPreview();
            },
          ),
        );
      }
    }

    return controlsEl;
  };

  // テーブル項目のcolumnsのunit/unitPosition/isNumericを、最新のフィールドカタログ
  // (tableFieldsByCode、kintoneから取得した現在の定義)で同期し直す。列ごとの表示設定を
  // 追加する前に選択されていた列は{code,label,type}のみの古い形式のまま保存されている
  // (isNumericが無い)。また、列を選択した後にkintone側で単位を設定・変更した場合も、
  // unit/unitPositionが古いまま残り、「単位を表示」のチェックボックス自体が出ない状態になる
  // (ユーザー指示「サブテーブルの桁区切りがない。単位の表示ができない」「計算フィールドも
  // ちゃんと単位あったらつけて欲しい」)。桁区切り・単位表示の有効/無効というユーザー自身の
  // 選択は、既にisNumericを持っていた場合は保持し、初めて数値列として認識された場合のみ
  // kintone側の初期値を踏襲する。保存(Save)ボタン押下時にも全項目に対して呼び出すため
  // (ユーザー指示「桁区切りと単位の設定はセーブボタン押した時に再度全部計算するようにできない
  // の」)、歯車ポップアップのDOM構築とは独立した関数にしている。
  const syncTableItemColumnsWithCatalog = (item) => {
    const tableDef = tableFieldsByCode[item.code];
    const catalogColumns = (tableDef && tableDef.columns) || [];
    (item.columns || []).forEach((existingColumn, index) => {
      const column = catalogColumns.find((c) => c.code === existingColumn.code);
      if (!column) {
        return;
      }
      const wasNumericKnown = typeof existingColumn.isNumeric !== 'undefined';
      item.columns[index] = {
        ...buildTableColumnEntry(column),
        fontSizePt: existingColumn.fontSizePt || 10,
        wrap:
          typeof existingColumn.wrap === 'boolean' ? existingColumn.wrap : true,
        textAlign: existingColumn.textAlign || 'LEFT',
        ...(wasNumericKnown
          ? {
              showUnit: !!existingColumn.showUnit,
              digitGrouping: !!existingColumn.digitGrouping,
            }
          : {}),
      };
    });
  };

  const buildTableColumns = (item) => {
    syncTableItemColumnsWithCatalog(item);
    const columnsEl = document.createElement('div');
    columnsEl.className = 'rpb-table-columns';
    const tableDef = tableFieldsByCode[item.code];

    ((tableDef && tableDef.columns) || []).forEach((column) => {
      const columnRowEl = document.createElement('div');
      columnRowEl.className = 'rpb-table-column';

      const renderColumnControls = () => {
        const existingHostEl = columnRowEl.querySelector(
          '.js-column-controls-host',
        );
        if (existingHostEl) {
          existingHostEl.remove();
        }
        const columnEntry = (item.columns || []).find(
          (c) => c.code === column.code,
        );
        if (!columnEntry) {
          return;
        }
        const hostEl = document.createElement('div');
        hostEl.className = 'js-column-controls-host';
        hostEl.appendChild(buildColumnDisplayControls(columnEntry));
        columnRowEl.appendChild(hostEl);
      };

      const onChange = (checked) => {
        item.columns = item.columns || [];
        if (checked) {
          if (!item.columns.find((c) => c.code === column.code)) {
            item.columns.push(buildTableColumnEntry(column));
          }
        } else {
          item.columns = item.columns.filter((c) => c.code !== column.code);
        }
        refreshPreview();
        renderColumnControls();
      };

      const existing = (item.columns || []).find((c) => c.code === column.code);
      columnRowEl.appendChild(
        createCheckboxLabel(
          !!existing,
          `${column.label} (${column.code})`,
          onChange,
        ),
      );
      renderColumnControls();
      columnsEl.appendChild(columnRowEl);
    });

    return columnsEl;
  };

  // TEXT項目はフィールドに紐付かないため、テキスト自体を入力するテキストエリアを表示する。
  // グリッド上のレイアウトには影響しない編集操作なので、キャンバス自体の再描画(renderCanvasFn)は
  // 不要だが、右側プレビューへの反映は必要なのでrefreshPreview()のみ呼ぶ。
  const buildTextContentEditor = (item) => {
    const wrapEl = document.createElement('div');
    wrapEl.className = 'rpb-text-content';
    const textareaEl = document.createElement('textarea');
    textareaEl.className = 'kintoneplugin-input-text';
    textareaEl.rows = 2;
    textareaEl.value = item.text || '';
    textareaEl.addEventListener('change', () => {
      item.text = textareaEl.value;
      refreshPreview();
    });
    wrapEl.appendChild(textareaEl);
    return wrapEl;
  };

  const placedItemTitle = (item) => {
    if (item.kind === 'TEXT') {
      return '自由テキスト';
    }
    if (item.kind === 'IMAGE') {
      return '画像';
    }
    return `${item.label} (${item.code})`;
  };

  // 現在のモードで操作対象ではない項目(画像配置モード中の他の項目/レイアウト編集モード中の画像)は、
  // クリックを透過するゴースト表示にする。画像は他の項目に重ねて配置できるため(ユーザー指示)、
  // 重なった状態でも常にどちらか一方を邪魔なく操作できるようにするための表示切り替え。
  const createGhostItem = (item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'rpb-placed-item rpb-placed-item-ghost';
    itemEl.style.gridColumn = `${item.colStart} / span ${item.colSpan}`;
    itemEl.textContent = placedItemTitle(item);
    return itemEl;
  };

  // 幅を変更するリサイズハンドル(右端をマウスでドラッグ、ユーザー指示
  // 「幅を広げる操作はマウス操作」)。ドラッグ中はitemElのgrid-columnを直接書き換えて
  // 即座に見た目へ反映し、マウスを離した時点でhasOverlapを確認してから確定する。
  const attachResizeHandle = (
    itemEl,
    item,
    itemIndex,
    page,
    renderCanvasFn,
  ) => {
    const handleEl = document.createElement('div');
    handleEl.className = 'rpb-resize-handle';
    handleEl.draggable = false;

    handleEl.addEventListener('mousedown', (mousedownEvent) => {
      mousedownEvent.preventDefault();
      mousedownEvent.stopPropagation();
      const gridEl = itemEl.parentElement;
      const colWidth = gridEl.getBoundingClientRect().width / GRID_COLUMNS;
      const startX = mousedownEvent.clientX;
      const startColSpan = item.colSpan;
      let pendingColSpan = startColSpan;

      const onMouseMove = (moveEvent) => {
        const deltaCols = Math.round((moveEvent.clientX - startX) / colWidth);
        pendingColSpan = Math.min(
          Math.max(startColSpan + deltaCols, 1),
          GRID_COLUMNS - item.colStart + 1,
        );
        itemEl.style.gridColumn = `${item.colStart} / span ${pendingColSpan}`;
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const candidate = { ...item, colSpan: pendingColSpan };
        const others = page.items.filter((_, idx) => idx !== itemIndex);
        if (hasOverlap(others, candidate)) {
          alert('その幅にすると他の項目と重なります。');
          renderCanvasFn();
          return;
        }
        item.colSpan = pendingColSpan;
        renderCanvasFn();
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    itemEl.appendChild(handleEl);
  };

  const createPlacedItem = (item, itemIndex, page, renderCanvasFn) => {
    const itemEl = document.createElement('div');
    itemEl.className =
      item.kind === 'TABLE'
        ? 'rpb-placed-item rpb-placed-item-table'
        : 'rpb-placed-item';
    itemEl.style.gridColumn = `${item.colStart} / span ${item.colSpan}`;

    // 配置済み項目自体をドラッグして再配置できるようにする(ユーザー指示
    // 「配置方法はドラッグ&ドロップに戻して欲しい」)。歯車・削除・リサイズハンドルは
    // draggable=falseにして、これらの操作がドラッグ開始と競合しないようにする。以前は
    // 項目内のチェックボックス・数値入力等とドラッグが競合して挙動が不安定だったが、
    // それらの入力コントロールは歯車ポップアップへ移したため、キャンバス上の項目ボックス自体には
    // ボタン類しか残っておらず、競合が起きにくくなっている。
    itemEl.draggable = true;
    itemEl.addEventListener('dragstart', (event) => {
      draggingItemRef = { item, itemIndex, page };
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ source: 'existing' }),
      );
    });
    itemEl.addEventListener('dragend', () => {
      draggingItemRef = null;
    });

    const headEl = document.createElement('div');
    headEl.className = 'rpb-placed-item-head';
    const titleEl = document.createElement('span');
    titleEl.className = 'rpb-placed-item-title';
    titleEl.textContent = placedItemTitle(item);

    const gearEl = document.createElement('span');
    gearEl.className = 'rpb-placed-item-gear';
    gearEl.draggable = false;
    gearEl.title = '設定';
    gearEl.textContent = '⚙';
    gearEl.addEventListener('click', (event) => {
      event.stopPropagation();
      openItemSettingsModal(item, itemIndex, page, renderCanvasFn);
    });

    const removeEl = document.createElement('span');
    removeEl.className = 'rpb-placed-item-remove';
    removeEl.draggable = false;
    removeEl.textContent = '×';
    removeEl.addEventListener('click', (event) => {
      event.stopPropagation();
      page.items.splice(itemIndex, 1);
      renderCanvasFn();
    });
    headEl.appendChild(titleEl);
    headEl.appendChild(gearEl);
    headEl.appendChild(removeEl);
    itemEl.appendChild(headEl);

    attachResizeHandle(itemEl, item, itemIndex, page, renderCanvasFn);

    return itemEl;
  };

  const createRowGuides = () => {
    const fragment = document.createDocumentFragment();
    for (let col = 1; col <= GRID_COLUMNS; col += 1) {
      const guideEl = document.createElement('div');
      guideEl.className = 'rpb-grid-guide';
      guideEl.dataset.col = String(col);
      guideEl.style.gridColumn = `${col} / span 1`;
      fragment.appendChild(guideEl);
    }
    return fragment;
  };

  // ドラッグ中、マウス位置からドロップ先の開始列を求める(常に幅1マスとして扱う。
  // ユーザー指示「ドラッグした先ではまた幅を1に戻す」)。
  const computeDropColStart = (event, gridEl) => {
    const rect = gridEl.getBoundingClientRect();
    const colWidth = rect.width / GRID_COLUMNS;
    const colStart = Math.floor((event.clientX - rect.left) / colWidth) + 1;
    return Math.min(Math.max(colStart, 1), GRID_COLUMNS);
  };

  // ドラッグ中、実際にどの列へ配置されるかを分かりやすく表示する
  // (ユーザー指示「どのセルに配置されるか分かりやすく表示してほしい」)。
  const highlightDropTarget = (gridEl, colStart) => {
    gridEl.querySelectorAll('.rpb-grid-guide').forEach((guideEl) => {
      guideEl.classList.toggle(
        'rpb-grid-guide-drop-target',
        Number(guideEl.dataset.col) === colStart,
      );
    });
  };

  const clearDropHighlight = (gridEl) => {
    gridEl
      .querySelectorAll('.rpb-grid-guide-drop-target')
      .forEach((guideEl) =>
        guideEl.classList.remove('rpb-grid-guide-drop-target'),
      );
  };

  const buildNewItem = (payload, rowNumber, colStart, colSpan) => {
    if (payload.kind === 'TABLE') {
      return {
        kind: 'TABLE',
        code: payload.code,
        label: payload.label,
        bordered: true,
        row: rowNumber,
        colStart,
        colSpan,
        columns: [],
      };
    }
    if (payload.kind === 'TEXT') {
      return {
        kind: 'TEXT',
        text: 'テキストを入力',
        fontSizePt: 11,
        wrap: true,
        bordered: true,
        textAlign: 'LEFT',
        verticalAlign: 'TOP',
        row: rowNumber,
        colStart,
        colSpan,
      };
    }
    if (payload.kind === 'IMAGE') {
      return {
        kind: 'IMAGE',
        imageId: '',
        bordered: false,
        row: rowNumber,
        colStart,
        colSpan,
      };
    }
    return {
      kind: 'FIELD',
      code: payload.code,
      label: payload.label,
      type: payload.type,
      showLabel: true,
      fontSizePt: 11,
      wrap: true,
      bordered: true,
      labelPosition: 'TOP',
      textAlign: 'LEFT',
      isNumeric: !!payload.isNumeric,
      unit: payload.unit || '',
      unitPosition: payload.unitPosition === 'BEFORE' ? 'BEFORE' : 'AFTER',
      // 単位表示・桁区切りの初期値は、kintone側でそのフィールドに既に設定されている内容を
      // そのまま踏襲する(単位が無いフィールドで初期表示だけオンにしても意味が無いため)。
      showUnit: !!payload.isNumeric && !!payload.unit,
      digitGrouping: !!payload.isNumeric && !!payload.digit,
      row: rowNumber,
      colStart,
      colSpan,
    };
  };

  // パレットからのドロップ(新規配置)と、配置済み項目をドラッグしての再配置の両方を扱う
  // (ユーザー指示「配置方法はドラッグ&ドロップに戻して欲しい」)。どちらの場合も、ドロップ先では
  // 幅を1マスに戻す(ユーザー指示「ドラッグした先ではまた幅を1に戻す」)。幅を広げる操作は
  // 別途リサイズハンドルのマウス操作で行う。
  const handleDrop = (event, page, rowNumber, renderCanvasFn, gridEl) => {
    event.preventDefault();
    gridEl.classList.remove('rpb-row-grid-over');
    clearDropHighlight(gridEl);
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) {
      return;
    }
    const payload = JSON.parse(raw);
    const colStart = computeDropColStart(event, gridEl);

    if (payload.source === 'existing') {
      if (!draggingItemRef || draggingItemRef.page !== page) {
        // ページをまたいだ移動は非対応(異なるページのiframeを跨ぐドラッグは行わない)。
        return;
      }
      const { item, itemIndex } = draggingItemRef;
      const candidate = { ...item, row: rowNumber, colStart, colSpan: 1 };
      const others = page.items.filter((_, idx) => idx !== itemIndex);
      if (hasOverlap(others, candidate)) {
        alert('この位置には既に別の項目が配置されています。');
        return;
      }
      item.row = rowNumber;
      item.colStart = colStart;
      item.colSpan = 1;
      renderCanvasFn();
      return;
    }

    const candidate = buildNewItem(payload, rowNumber, colStart, 1);
    if (hasOverlap(page.items, candidate)) {
      alert(
        'この位置には既に別の項目が配置されています。空いている場所にドロップしてください。',
      );
      return;
    }
    page.items.push(candidate);
    renderCanvasFn();
  };

  const renderCanvas = (canvasEl, page) => {
    canvasEl.innerHTML = '';
    page.rowPadding = page.rowPadding || {};
    const usedRows = page.items.map((item) => item.row);
    const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 0;

    const renderCanvasFn = () => renderCanvas(canvasEl, page);

    for (let rowNumber = 1; rowNumber <= maxRow + 1; rowNumber += 1) {
      const rowEl = document.createElement('div');
      rowEl.className = 'rpb-canvas-row';

      const labelEl = document.createElement('div');
      labelEl.className = 'rpb-row-label';
      labelEl.appendChild(document.createTextNode(`行${rowNumber} `));
      labelEl.appendChild(
        createControlLabel(
          '上下の余白px',
          createNumberInput(
            page.rowPadding[rowNumber] || 0,
            0,
            100,
            (parsed) => {
              page.rowPadding[rowNumber] = parsed;
              refreshPreview();
            },
          ),
        ),
      );
      rowEl.appendChild(labelEl);

      const gridEl = document.createElement('div');
      gridEl.className = 'rpb-row-grid';
      gridEl.appendChild(createRowGuides());

      // 画像配置モードでは画像だけを操作対象にし、それ以外はゴースト表示にする
      // (逆にレイアウト編集モードでは画像がゴースト表示になる)。画像は他の項目に重ねて
      // 配置できるため(ユーザー指示)、操作対象の項目を常に手前(DOM上で最後)に描画して、
      // 重なっていてもクリックできるようにする。
      const mode = getEditorMode(page);
      const isInteractive = (item) =>
        mode === 'image' ? item.kind === 'IMAGE' : item.kind !== 'IMAGE';
      page.items
        .map((item, itemIndex) => ({ item, itemIndex }))
        .filter(({ item }) => item.row === rowNumber)
        .sort((a, b) => {
          const aInteractive = isInteractive(a.item) ? 1 : 0;
          const bInteractive = isInteractive(b.item) ? 1 : 0;
          if (aInteractive !== bInteractive) {
            return aInteractive - bInteractive;
          }
          return a.item.colStart - b.item.colStart;
        })
        .forEach(({ item, itemIndex }) => {
          gridEl.appendChild(
            isInteractive(item)
              ? createPlacedItem(item, itemIndex, page, renderCanvasFn)
              : createGhostItem(item),
          );
        });

      gridEl.addEventListener('dragover', (event) => {
        event.preventDefault();
        gridEl.classList.add('rpb-row-grid-over');
        highlightDropTarget(gridEl, computeDropColStart(event, gridEl));
      });
      gridEl.addEventListener('dragleave', () => {
        gridEl.classList.remove('rpb-row-grid-over');
        clearDropHighlight(gridEl);
      });
      gridEl.addEventListener('drop', (event) =>
        handleDrop(event, page, rowNumber, renderCanvasFn, gridEl),
      );

      rowEl.appendChild(gridEl);
      canvasEl.appendChild(rowEl);
    }

    refreshPreview();
  };

  const applyZoom = (canvasEl, canvasScrollEl, zoomSelectEl) => {
    if (zoomSelectEl.value === 'fit') {
      const availableWidth = canvasScrollEl.clientWidth - 24;
      canvasEl.style.zoom = String(
        Math.min(1, availableWidth / CANVAS_BASE_WIDTH),
      );
    } else {
      canvasEl.style.zoom = zoomSelectEl.value;
    }
  };

  const renderPageTitles = () => {
    dom.pageList.querySelectorAll('.js-page').forEach((pageEl, index) => {
      pageEl.querySelector('.js-page-title').textContent = `ページ${index + 1}`;
    });
  };

  const createPageRow = (page) => {
    const fragment = dom.pageTemplate.content.cloneNode(true);
    const pageEl = fragment.querySelector('.js-page');
    const removeEl = pageEl.querySelector('.js-page-remove');
    const fieldPaletteEl = pageEl.querySelector('.js-field-palette');
    const tablePaletteEl = pageEl.querySelector('.js-table-palette');
    const noTablesNoteEl = pageEl.querySelector('.js-no-tables-note');
    const textChipEl = pageEl.querySelector('.js-text-chip');
    const imageChipEl = pageEl.querySelector('.js-image-chip');
    const zoomSelectEl = pageEl.querySelector('.js-zoom');
    const canvasScrollEl = pageEl.querySelector('.js-canvas-scroll');
    const canvasEl = pageEl.querySelector('.js-canvas');
    const layoutPaletteEl = pageEl.querySelector('.js-layout-palette');
    const imagePaletteEl = pageEl.querySelector('.js-image-palette');
    const modeTabEls = pageEl.querySelectorAll('.js-mode-tab');
    const previewButtonEl = pageEl.querySelector('.js-preview-button');

    previewButtonEl.addEventListener('click', () => openPreviewModal(page));

    // 「レイアウト編集」/「画像配置」タブの切り替え。パレット(ドラッグ元チップ)も
    // 現在のモードに合わせて表示を切り替える(画像は他の項目に重ねて配置できるため、
    // 操作対象を混在させず分離する)。
    const applyEditorMode = (mode) => {
      pageEditorModes.set(page, mode);
      layoutPaletteEl.style.display = mode === 'layout' ? '' : 'none';
      imagePaletteEl.style.display = mode === 'image' ? '' : 'none';
      modeTabEls.forEach((tabEl) => {
        tabEl.classList.toggle('is-active', tabEl.dataset.mode === mode);
      });
      renderCanvas(canvasEl, page);
    };
    modeTabEls.forEach((tabEl) => {
      tabEl.addEventListener('click', () =>
        applyEditorMode(tabEl.dataset.mode),
      );
    });
    applyEditorMode(getEditorMode(page));

    renderPalette(fieldPaletteEl, tablePaletteEl, noTablesNoteEl);
    textChipEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ source: 'palette', kind: 'TEXT' }),
      );
    });
    imageChipEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ source: 'palette', kind: 'IMAGE' }),
      );
    });
    // 初回描画はapplyEditorMode()内のrenderCanvas()で行う(モードに応じたゴースト表示を
    // 最初から反映するため、二重描画は避ける)。
    zoomSelectEl.addEventListener('change', () =>
      applyZoom(canvasEl, canvasScrollEl, zoomSelectEl),
    );

    removeEl.addEventListener('click', () => {
      // pageEl.remove()はDOMからの削除に過ぎず、保存時に読み取るconfig.pages配列からは
      // 削除されない(以前はこの同期漏れにより、削除したはずのページが保存され続けるバグが
      // あった)。config.pages側からも同じオブジェクト参照を取り除く。
      const pageDataIndex = config.pages.indexOf(page);
      if (pageDataIndex !== -1) {
        config.pages.splice(pageDataIndex, 1);
      }
      pageEl.remove();
      renderPageTitles();
      refreshPreview();
    });

    return pageEl;
  };

  const renderPages = () => {
    dom.pageList.innerHTML = '';
    config.pages.forEach((page) => {
      dom.pageList.appendChild(createPageRow(page));
    });
    renderPageTitles();
  };
  renderPages();
  refreshPreview();

  // domはトップレベルのconstでawait後に再代入され得ないため require-atomic-updates は誤検知。

  dom.outputIndividual.checked = !!config.outputModes.individual;

  dom.outputBulk.checked = !!config.outputModes.bulk;

  // 添付ファイルフィールドへの保存(任意)の初期状態。フィールドが1つも無いアプリでは
  // チェックボックス自体を無効化しているため、保存済みのfieldCodeが選択肢に存在するときだけ反映する。

  dom.saveToAttachmentEnabled.checked = !!config.saveToAttachment.enabled;
  if (
    fileFields.some((field) => field.code === config.saveToAttachment.fieldCode)
  ) {
    dom.attachmentField.value = config.saveToAttachment.fieldCode;
  }
  // ファイル名の固定部分(ユーザー指示「ファイル保存時の名称は固定テキスト+タイムスタンプ。
  // configで設定できるように」)。未設定時はconfig-store.jsのDEFAULTSと同じ「帳票」を表示する。
  dom.attachmentFileNamePrefix.value =
    config.saveToAttachment.fileNamePrefix || '帳票';
  const applySaveToAttachmentUI = () => {
    dom.attachmentField.disabled = !dom.saveToAttachmentEnabled.checked;
    dom.attachmentFileNamePrefix.disabled =
      !dom.saveToAttachmentEnabled.checked;
  };
  dom.saveToAttachmentEnabled.addEventListener(
    'change',
    applySaveToAttachmentUI,
  );
  applySaveToAttachmentUI();

  dom.pageAddButton.addEventListener('click', () => {
    // config.pages(保存時に読み取る配列)にも同じオブジェクト参照を追加しておく必要がある
    // (追加しないと、新しいページの内容が保存されないバグになる)。
    const newPage = { items: [] };
    config.pages.push(newPage);
    dom.pageList.appendChild(createPageRow(newPage));
    renderPageTitles();
    // createPageRow内部のrenderCanvas()は、この新しいページのiframeがまだdom.pageListに
    // 追加される前(appendChildの前)に呼ばれているため、この時点で改めて呼び直す必要がある。
    refreshPreview();
  });

  dom.cancelButton.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  dom.form.addEventListener('submit', (event) => {
    event.preventDefault();

    // 保存の直前に、全ページ・全項目の単位/桁区切り関連の設定(FIELD項目・テーブルの列)を
    // 最新のkintoneフィールド定義で同期し直す。以前は歯車ポップアップを開いたときだけ
    // 同期していたが、項目数が多いと1つずつ開くのが手間なため、保存時に一括で行うようにした
    // (ユーザー指示「桁区切りと単位の設定はセーブボタン押した時に再度全部計算するように
    // できないの」)。
    config.pages.forEach((page) => {
      (page.items || []).forEach((item) => {
        if (item.kind === 'FIELD') {
          syncFieldItemWithCatalog(item);
        } else if (item.kind === 'TABLE') {
          syncTableItemColumnsWithCatalog(item);
        }
      });
    });

    // 削除・差し替えで、どの項目からも参照されなくなった画像(孤立したconfig.imagesのエントリ)を
    // 保存前に取り除く。放置するとkintoneのプラグイン設定の容量上限を無駄に圧迫し続けるため。
    const referencedImageIds = new Set();
    config.pages.forEach((page) => {
      (page.items || []).forEach((item) => {
        if (item.kind === 'IMAGE' && item.imageId) {
          referencedImageIds.add(item.imageId);
        }
      });
    });
    Object.keys(config.images).forEach((imageId) => {
      if (!referencedImageIds.has(imageId)) {
        delete config.images[imageId];
      }
    });

    const nextConfig = {
      outputModes: {
        individual: dom.outputIndividual.checked,
        bulk: dom.outputBulk.checked,
      },
      pages: config.pages,
      images: config.images,
      saveToAttachment: {
        enabled: dom.saveToAttachmentEnabled.checked,
        fieldCode: dom.attachmentField.value,
        fileNamePrefix: dom.attachmentFileNamePrefix.value,
      },
    };

    const { valid, errors } = NS.ConfigValidation.validateConfig(nextConfig);
    if (!valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果のみを表示しており外部入力ではないが、
      // 念のためinnerHTMLではなくtextContentで出力する。
      dom.errors.textContent = errors.join('\n');
      return;
    }
    dom.errors.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
