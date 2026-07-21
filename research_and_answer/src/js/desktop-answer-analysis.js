(function (global, kintone) {
  'use strict';

  // 回答アプリの「分析」一覧: 現在の絞り込み条件で全件取得し、フィルター・KPI・グラフ(自前SVG)・
  // 表・エクスポートを備えたダッシュボードを描画する。
  //
  // 旧カスタマイズ(analysis.js)からの主な仕様変更はidea.md 4.2参照:
  //   Chart.js(CDN)廃止 / confirm()廃止で自動取得 / グラフ表示を「条件」から独立 /
  //   設定JSONテキストエリア廃止(localStorageへ自動保存) / グラフクリック絞り込みの修正

  const NS = global.ResearchAnswer;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  if (config.role !== 'answer') {
    return;
  }

  const Core = NS.AnalysisCore;
  const ChartLite = NS.ChartLite;

  // グラフ・フィルターに向かないタイプ
  const UNCHARTABLE_TYPES = [
    'リッチエディター',
    'リンク',
    '文字列 (複数行)',
    '添付ファイル',
  ];

  const el = (tag, attrs = {}, children = []) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.assign(element.dataset, value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'selected') {
        element.selected = !!value;
      } else if (key === 'checked') {
        element.checked = !!value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element[key] = value;
      } else if (value !== undefined && value !== null) {
        // setAttribute(key, undefined)は値が文字列"undefined"の属性として設定されてしまい、
        // 例えばdisabled属性では「値に関わらず属性が存在する=無効化」というHTMLの仕様上、
        // 「無効化しない」つもりのundefinedが常に無効化として効いてしまう
        // (chart-type-selectが常にdisabledになる不具合として実際に確認)。
        element.setAttribute(key, value);
      }
    }
    const childrenArray = Array.isArray(children) ? children : [children];
    childrenArray.forEach((child) => {
      if (child === null || child === undefined || child === false) {
        return;
      }
      if (child instanceof Node) {
        element.appendChild(child);
      } else {
        element.appendChild(document.createTextNode(String(child)));
      }
    });
    return element;
  };

  const clear = (element) => {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  };

  // 集計セレクトの隣に置く「?」ヘルプアイコン。クリックで説明ポップアップを開閉する
  // (ネイティブtitle属性のホバーではなく、クリックで開くポップアップにしてほしいという要望に対応)。
  const helpIcon = (text) => {
    const popover = el('div', { className: 'ra-help-popover hidden' }, text);
    const btn = el(
      'button',
      { type: 'button', className: 'ra-help-icon', 'aria-label': '説明' },
      '?',
    );
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = popover.classList.contains('hidden');
      document
        .querySelectorAll('.ra-help-popover')
        .forEach((p) => p.classList.add('hidden'));
      if (willOpen) {
        popover.classList.remove('hidden');
      }
    });
    return el('span', { className: 'ra-help-wrap' }, [btn, popover]);
  };
  document.addEventListener('click', () => {
    document
      .querySelectorAll('.ra-help-popover')
      .forEach((p) => p.classList.add('hidden'));
  });

  // 回答レコードのjson(フォーム定義)はLOOKUPコピーのため、依頼レコードを編集しても既存の
  // 回答レコード側には反映されない(kintoneのLOOKUP仕様。ルックアップの値を選び直すまでコピー元の
  // 現在値には自動追従しない)。「依頼フォームを直したのに分析に反映されない」という問い合わせの
  // 原因になるため、表示のたびに依頼アプリから直接最新のjsonをREST取得し、コピー値より優先する。
  const fetchLatestJson = async (configRecord, answerProperties) => {
    const fallback = configRecord.json.value;
    const lookupField = answerProperties && answerProperties.lookup;
    const relatedKeyField =
      lookupField && lookupField.lookup && lookupField.lookup.relatedKeyField;
    if (!config.requestAppId || !relatedKeyField || !configRecord.lookup) {
      return fallback;
    }
    try {
      const query = Core.buildRequestRecordQuery(
        relatedKeyField,
        configRecord.lookup.value,
      );
      const resp = await kintone.api(
        kintone.api.url('/k/v1/records.json', true),
        'GET',
        { app: config.requestAppId, query, fields: ['json'] },
      );
      const latest = resp.records && resp.records[0] && resp.records[0].json;
      return latest ? latest.value : fallback;
    } catch (e) {
      console.error(
        '依頼アプリから最新のフォーム定義を取得できませんでした',
        e,
      );
      return fallback;
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewName !== config.analysisViewName) {
      return event;
    }
    if (!event.records || event.records.length < 1) {
      const headerMenu = kintone.app.getHeaderMenuSpaceElement();
      if (headerMenu) {
        headerMenu.textContent = 'レコードがありません。';
      }
      return event;
    }

    const queryString = kintone.app.getQueryCondition() || '';
    if (!queryString.includes('lookup')) {
      kintone.showNotification(
        'ERROR',
        '照会で絞り込まれていないため分析を表示できません。集計リストから遷移してください。',
      );
      return event;
    }

    const configRecord = event.records[0];
    if (!configRecord || !configRecord.json || !configRecord.json.value) {
      kintone.showNotification(
        'ERROR',
        'フォームレイアウト(json)が読み込まれていません。',
      );
      return event;
    }

    // --- 実フィールド定義取得(依頼アプリのレコードキー特定にも使う) ---
    // REST APIレスポンスは {properties: {...}} にラップされている(kintone.app.getFormFields()の
    // 「ラップされない」仕様とは逆。CLAUDE.mdの既知の落とし穴参照)
    let answerProperties = {};
    try {
      const appFieldsResp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        { app: kintone.app.getId() },
      );
      answerProperties = appFieldsResp.properties;
    } catch (e) {
      console.error('フィールド情報の取得に失敗しました', e);
    }

    // --- レイアウト: フォーム定義(依頼アプリから最新を直接取得) + 実フィールド(ステータス・
    // 作成日時等)のマージ ---
    const latestJson = await fetchLatestJson(configRecord, answerProperties);
    const setting = NS.FormModel.parseSettingJson(latestJson);
    const baseLayout = NS.FormModel.sortLayoutByOrder(setting.layout);
    const layout = Core.buildMergedLayout(baseLayout, answerProperties);
    const configMap = Core.getConfigMap(layout);
    const allKeys = layout.map((i) => i.value.insert_column.value);
    const useFields = ['$id', ...allKeys];

    // --- 表示設定の保存・復元(localStorage、認証情報は含まない表示設定のみ) ---
    const lookupMatch = queryString.match(/lookup[^0-9]*(\d+)/);
    const storageKey = `ra-analysis-settings:${kintone.app.getId()}:${lookupMatch ? lookupMatch[1] : 'all'}`;
    const loadSettings = () => {
      try {
        return JSON.parse(global.localStorage.getItem(storageKey)) || {};
      } catch {
        return {};
      }
    };
    const persistSettings = () => {
      try {
        global.localStorage.setItem(
          storageKey,
          JSON.stringify({
            visibleColumns,
            visibleFilters,
            visibleCharts,
            fieldLogics,
            chartTypes,
            trendMeasures,
            aggregationTypes,
          }),
        );
      } catch {
        // プライベートモード等で保存できなくても動作は継続する
      }
    };

    // --- 状態 ---
    const chartableKeys = allKeys.filter(
      (k) => !UNCHARTABLE_TYPES.includes(configMap[k].type),
    );
    const saved = loadSettings();
    let records = [];
    let filters = {};
    let visibleColumns = saved.visibleColumns || ['$id', ...allKeys];
    let visibleFilters = saved.visibleFilters || [...chartableKeys];
    let visibleCharts = saved.visibleCharts || [...chartableKeys];
    let fieldLogics = saved.fieldLogics || {};
    let chartTypes = saved.chartTypes || {};
    let trendMeasures = saved.trendMeasures || {};
    let aggregationTypes = saved.aggregationTypes || {};

    const getNormalized = () => Core.normalizeRecords(records);
    const getFiltered = () =>
      Core.applyFilters(
        getNormalized(),
        filters,
        visibleFilters,
        fieldLogics,
        configMap,
      );

    // --- ダッシュボードの骨組み(静的HTMLのみ。ユーザー入力値は含めない) ---
    const initDashboard = () => {
      if (document.getElementById('ra-dashboard')) {
        return;
      }
      const container = document.createElement('div');
      container.id = 'ra-dashboard';
      container.className = 'dashboard-container';
      container.innerHTML = `
        <div class="ra-dashboard-header">
          <h1 class="ra-dashboard-title"></h1>
          <span class="ra-record-count"></span>
        </div>
        <div class="top-toolbar">
          <div class="toolbar-left" id="mainTabs">
            <button type="button" class="tab-button active" data-tab="dashboard">ダッシュボード</button>
            <button type="button" class="tab-button" data-tab="table">データ一覧</button>
          </div>
          <div class="toolbar-right">
            <button type="button" id="openConfig" class="tab-button">表示設定</button>
            <button type="button" id="openDownload" class="tab-button">エクスポート</button>
            <button type="button" id="pdfExport" class="tab-button">PDF保存</button>
          </div>
        </div>
        <div id="view-dashboard" class="layout-main">
          <div id="filterList"></div>
          <div class="content-right">
            <div id="kpiContainer"></div>
            <div id="chartsGrid"></div>
          </div>
        </div>
        <div id="view-table" class="hidden">
          <table id="mainTable"><thead></thead><tbody></tbody></table>
        </div>
        <div id="configModal" class="hidden">
          <div>
            <div>
              <span>表示設定</span>
              <span class="ra-modal-header-actions">
                <button type="button" id="clearAllSettingsBtn" class="kintoneplugin-button-dialog-cancel">全てOFF</button>
                <button type="button" id="closeConfig">×</button>
              </span>
            </div>
            <div><div id="fieldManager"></div></div>
            <div>
              <button type="button" id="resetVisibilityBtn" class="kintoneplugin-button-dialog-cancel">表示リセット</button>
              <button type="button" id="resetFiltersBtn" class="kintoneplugin-button-dialog-cancel">条件リセット</button>
              <button type="button" id="applyConfig" class="primary-btn">閉じて反映</button>
            </div>
          </div>
        </div>
        <div id="downloadModal" class="hidden">
          <div>
            <div>
              <span>データエクスポート</span>
              <button type="button" id="closeDownload">×</button>
            </div>
            <div>
              <div class="filter-item">
                <label class="filter-label">対象データ</label>
                <div class="ra-download-scope">
                  <label><input type="radio" name="downloadScope" value="all" checked> 全件</label>
                  <label><input type="radio" name="downloadScope" value="filtered"> フィルター適用後のみ</label>
                </div>
              </div>
              <div class="filter-item">
                <label class="filter-label">フォーマット</label>
                <select id="downloadFormat" class="filter-select">
                  <option value="csv">CSV (カンマ区切り)</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div id="encodingSection" class="filter-item">
                <label class="filter-label">文字コード (CSV用)</label>
                <select id="downloadEncoding" class="filter-select">
                  <option value="utf8bom">UTF-8 (BOM付) - Excel推奨</option>
                  <option value="utf8">UTF-8</option>
                </select>
              </div>
            </div>
            <div>
              <button type="button" id="execDownload" class="primary-btn">ダウンロード</button>
            </div>
          </div>
        </div>`;
      const space = kintone.app.getHeaderSpaceElement();
      if (space) {
        clear(space);
        space.appendChild(container);
      } else {
        document.body.prepend(container);
      }
      container.querySelector('.ra-dashboard-title').textContent =
        configRecord.title ? configRecord.title.value : '';
    };
    initDashboard();

    const setRecordCount = (text) => {
      const countEl = document.querySelector('.ra-record-count');
      if (countEl) {
        countEl.textContent = text;
      }
    };

    // --- 描画 ---
    const renderKPIs = () => {
      const data = getFiltered();
      const container = document.getElementById('kpiContainer');
      clear(container);
      container.appendChild(
        el('div', { className: 'kpi-card' }, [
          el('p', { className: 'kpi-label' }, '対象レコード数'),
          el('h3', { className: 'kpi-value' }, data.length),
        ]),
      );
      Object.entries(configMap).forEach(([key, info]) => {
        if (info.type !== '数値' || !visibleColumns.includes(key)) {
          return;
        }
        const currentAgg = aggregationTypes[key] || 'sum';
        const total = data.reduce(
          (acc, r) => acc + (parseFloat(r[key]) || 0),
          0,
        );
        const nonBlankCount = data.filter(
          (r) => !Core.isBlankValue(r[key]),
        ).length;
        const displayValue =
          currentAgg === 'avg'
            ? data.length > 0
              ? total / data.length
              : 0
            : currentAgg === 'count'
              ? nonBlankCount
              : total;
        const select = el('select', { className: 'chart-measure-select' }, [
          el(
            'option',
            { value: 'sum', selected: currentAgg === 'sum' },
            '合計',
          ),
          el(
            'option',
            { value: 'avg', selected: currentAgg === 'avg' },
            '平均',
          ),
          el(
            'option',
            { value: 'count', selected: currentAgg === 'count' },
            '件数',
          ),
        ]);
        select.addEventListener('change', (e) => {
          aggregationTypes[key] = e.target.value;
          persistSettings();
          updateUI();
        });
        container.appendChild(
          el('div', { className: 'kpi-card' }, [
            el('div', { className: 'ra-kpi-header' }, [
              el('span', { className: 'kpi-label' }, info.label),
              select,
              helpIcon(
                '合計=値を全部足す、平均=合計÷対象レコード数、件数=この項目に値が入っているレコード数、を表示します。',
              ),
            ]),
            el(
              'h3',
              { className: 'kpi-value highlight' },
              displayValue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            ),
          ]),
        );
      });
    };

    const renderFilters = () => {
      const data = getNormalized();
      const container = document.getElementById('filterList');
      clear(container);
      Object.entries(configMap).forEach(([key, info]) => {
        if (!visibleFilters.includes(key)) {
          return;
        }
        const filterState = filters[key] || {
          operator: '',
          value: Core.MULTI_VALUE_TYPES.includes(info.type) ? [] : '',
        };
        const logic = fieldLogics[key] || 'AND';
        const toggle = el('div', { className: 'logic-toggle' }, [
          el(
            'span',
            {
              className: `logic-switch ${logic === 'AND' ? 'logic-active' : 'logic-inactive'}`,
              dataset: { logic: 'AND' },
            },
            'AND',
          ),
          el(
            'span',
            {
              className: `logic-switch ${logic === 'OR' ? 'logic-active' : 'logic-inactive'}`,
              dataset: { logic: 'OR' },
            },
            'OR',
          ),
        ]);
        toggle.addEventListener('click', (e) => {
          if (e.target.dataset.logic) {
            fieldLogics[key] = e.target.dataset.logic;
            persistSettings();
            updateUI();
          }
        });
        const div = el('div', { className: 'filter-item' }, [
          el('div', { className: 'filter-header' }, [
            el('label', { className: 'filter-label' }, info.label),
            Core.MULTI_VALUE_TYPES.includes(info.type) ? toggle : null,
          ]),
        ]);

        const isDateLike = Core.DATE_LIKE_TYPES.includes(info.type);
        if (['数値', '時刻'].includes(info.type) || isDateLike) {
          const opSelect = el('select', { className: 'filter-select' }, [
            el('option', { value: '' }, '条件なし'),
            el(
              'option',
              { value: 'eq', selected: filterState.operator === 'eq' },
              '等しい',
            ),
            el(
              'option',
              { value: 'gte', selected: filterState.operator === 'gte' },
              '以降 (>=)',
            ),
            el(
              'option',
              { value: 'lte', selected: filterState.operator === 'lte' },
              '以前 (<=)',
            ),
            el(
              'option',
              { value: 'gt', selected: filterState.operator === 'gt' },
              'より後 (>)',
            ),
            el(
              'option',
              { value: 'lt', selected: filterState.operator === 'lt' },
              'より前 (<)',
            ),
            el(
              'option',
              { value: 'blank', selected: filterState.operator === 'blank' },
              '空白',
            ),
          ]);
          let inputType = 'text';
          if (info.type === '数値') {
            inputType = 'number';
          } else if (info.type === '日付') {
            inputType = 'date';
          } else if (info.type === '時刻') {
            inputType = 'time';
          } else if (isDateLike) {
            inputType = 'datetime-local';
          }
          const input = el('input', {
            type: inputType,
            value: filterState.value,
            className: `filter-input ${filterState.operator === 'blank' ? 'hidden' : ''}`,
          });
          opSelect.addEventListener('change', (e) => {
            filters[key] = { ...filterState, operator: e.target.value };
            if (e.target.value === 'blank') {
              filters[key].value = '';
            }
            updateUI();
          });
          input.addEventListener('change', (e) => {
            filters[key] = { ...filterState, value: e.target.value };
            updateUI();
          });
          div.appendChild(opSelect);
          div.appendChild(input);
        } else if (Core.MULTI_VALUE_TYPES.includes(info.type)) {
          const uniqueVals = new Set();
          data.forEach((r) =>
            Core.parseCommaSeparated(r[key]).forEach((v) => uniqueVals.add(v)),
          );
          const listContainer = el('div', {
            className: 'filter-checkbox-list',
          });
          Array.from(uniqueVals)
            .sort()
            .forEach((val) => {
              const isChecked =
                Array.isArray(filterState.value) &&
                filterState.value.includes(val);
              const lbl = el('label', { className: 'filter-checkbox-item' }, [
                el('input', {
                  type: 'checkbox',
                  checked: isChecked,
                  className: 'checkbox-input',
                }),
                el(
                  'span',
                  {
                    className: isChecked
                      ? 'checkbox-text checked'
                      : 'checkbox-text',
                  },
                  val,
                ),
              ]);
              lbl.addEventListener('click', (e) => {
                e.preventDefault();
                const current = Array.isArray(filterState.value)
                  ? filterState.value
                  : [];
                filters[key] = {
                  ...filterState,
                  value: isChecked
                    ? current.filter((v) => v !== val)
                    : [...current, val],
                };
                updateUI();
              });
              listContainer.appendChild(lbl);
            });
          div.appendChild(listContainer);
        } else {
          const uniqueVals = [
            ...new Set(data.map((r) => r[key] || '(空白)')),
          ].sort();
          const select = el('select', { className: 'filter-select' }, [
            el('option', { value: '' }, 'すべて'),
            ...uniqueVals.map((v) =>
              el('option', { value: v, selected: filterState.value === v }, v),
            ),
          ]);
          select.addEventListener('change', (e) => {
            filters[key] = {
              ...filterState,
              operator: e.target.value ? 'eq' : '',
              value: e.target.value,
            };
            updateUI();
          });
          div.appendChild(select);
        }
        container.appendChild(div);
      });
    };

    const renderCharts = () => {
      const data = getFiltered();
      const container = document.getElementById('chartsGrid');
      clear(container);

      Object.entries(configMap).forEach(([key, info]) => {
        if (
          !visibleCharts.includes(key) ||
          UNCHARTABLE_TYPES.includes(info.type)
        ) {
          return;
        }
        const chartType = chartTypes[key] || 'bar-h';
        const rawMeasureKey = trendMeasures[key] || '_count';
        const isCategoricalMeasure = (k) =>
          !!(
            configMap[k] &&
            Core.CATEGORICAL_MEASURE_TYPES.includes(configMap[k].type)
          );
        // 選択肢ごとの内訳(項目別)は折れ線グラフでしか系列分割していないため、横棒・円グラフでは
        // 保存済みの選択が選択肢型フィールドでも「レコード数」扱いにフォールバックする
        // (見た目上「項目別」を選んだのに何も変わらない、という分かりにくさの原因だった)。
        const measureKey =
          chartType !== 'line' && isCategoricalMeasure(rawMeasureKey)
            ? '_count'
            : rawMeasureKey;
        const aggType = aggregationTypes[key] || 'sum';
        const isTimeline = Core.TIMELINE_TYPES.includes(info.type);
        const isMeasureNumeric =
          configMap[measureKey] && configMap[measureKey].type === '数値';

        const card = el('div', { className: 'chart-card' });
        const headerChildren = [
          el('h4', { className: 'chart-title' }, [
            el('span', { className: 'chart-title-icon' }),
            info.label,
          ]),
        ];
        if (isTimeline || measureKey !== '_count') {
          const controls = el('div', { className: 'ra-chart-controls' });
          if (isTimeline) {
            const measureSelect = el(
              'select',
              { className: 'chart-measure-select' },
              [
                el(
                  'option',
                  { value: '_count', selected: rawMeasureKey === '_count' },
                  'レコード数',
                ),
                ...Object.entries(configMap)
                  .filter(([, i]) => !UNCHARTABLE_TYPES.includes(i.type))
                  .filter(
                    ([k]) => chartType === 'line' || !isCategoricalMeasure(k),
                  )
                  .map(([k, i]) =>
                    el(
                      'option',
                      { value: k, selected: rawMeasureKey === k },
                      i.label +
                        (Core.CATEGORICAL_MEASURE_TYPES.includes(i.type)
                          ? ' (項目別)'
                          : ''),
                    ),
                  ),
              ],
            );
            measureSelect.addEventListener('change', (e) => {
              trendMeasures[key] = e.target.value;
              persistSettings();
              updateUI();
            });
            controls.appendChild(measureSelect);
            controls.appendChild(
              helpIcon(
                '集計対象を「レコード数」以外に変えると、その項目の値を集計してグラフの値にします。選択肢型の項目(ラジオボタン等)を選ぶと「(項目別)」と表示されますが、内訳を分けて表示できるのは折れ線グラフのときだけです。横棒・円グラフでは選択肢型の項目は選べません。',
              ),
            );
          }
          if (isMeasureNumeric) {
            const aggSelect = el(
              'select',
              { className: 'chart-measure-select' },
              [
                el(
                  'option',
                  { value: 'sum', selected: aggType === 'sum' },
                  '合計',
                ),
                el(
                  'option',
                  { value: 'avg', selected: aggType === 'avg' },
                  '平均',
                ),
                el(
                  'option',
                  { value: 'count', selected: aggType === 'count' },
                  '件数',
                ),
              ],
            );
            aggSelect.addEventListener('change', (e) => {
              aggregationTypes[key] = e.target.value;
              persistSettings();
              updateUI();
            });
            controls.appendChild(aggSelect);
            controls.appendChild(
              helpIcon(
                '数値項目の集計方法です。合計=値を全部足す、平均=合計÷対象レコード数、件数=その項目に値が入っているレコード数、を表示します。',
              ),
            );
          }
          headerChildren.push(controls);
        }
        card.appendChild(
          el('div', { className: 'chart-header' }, headerChildren),
        );

        const chartContainer = el('div', {
          className: 'chart-canvas-container',
        });
        card.appendChild(chartContainer);
        container.appendChild(card);

        // グラフクリックで同値絞り込み(旧カスタマイズではonclick(小文字)でChart.jsに
        // 認識されず動いていなかった機能の再実装)
        const onValueClick = (name) => {
          filters[key] = {
            operator: 'eq',
            value: name === '(空白)' ? '' : name,
          };
          updateUI();
        };

        if (chartType === 'line') {
          const timeline = Core.aggregateTimeline(
            data,
            key,
            info,
            measureKey,
            aggType,
            configMap,
          );
          ChartLite.render(chartContainer, 'line', {
            buckets: timeline.buckets,
            datasets: timeline.datasets,
            showLegend: timeline.isCategorical,
            onValueClick,
          });
        } else {
          const limit = chartType === 'pie' ? 10 : 20;
          const agg = Core.aggregateCategory(
            data,
            key,
            info,
            measureKey,
            aggType,
            configMap,
            limit,
          );
          ChartLite.render(chartContainer, chartType, {
            labels: agg.labels,
            values: agg.values,
            onValueClick,
          });
        }
      });
    };

    const renderTable = () => {
      const data = getFiltered();
      const table = document.getElementById('mainTable');
      const head = table.querySelector('thead');
      const body = table.querySelector('tbody');
      clear(head);
      clear(body);
      const cols = Object.keys(configMap).filter((k) =>
        visibleColumns.includes(k),
      );
      head.appendChild(
        el('tr', {}, [
          el('th', { className: 'table-header-cell' }, 'ID'),
          ...cols.map((k) =>
            el('th', { className: 'table-header-cell' }, configMap[k].label),
          ),
        ]),
      );
      data.forEach((row) => {
        body.appendChild(
          el('tr', { className: 'table-row' }, [
            el('td', { className: 'table-cell id-cell' }, row.$id),
            ...cols.map((key) =>
              el('td', { className: 'table-cell' }, [
                row[key] || el('span', { className: 'empty-cell' }, '空白'),
              ]),
            ),
          ]),
        );
      });
    };

    const renderFieldManager = () => {
      const container = document.getElementById('fieldManager');
      clear(container);
      layout.forEach((item) => {
        const key = item.value.insert_column.value;
        const label = item.value.question.value;
        const fieldType = configMap[key].type;
        const currentChartType = chartTypes[key] || 'bar-h';
        const canBeLine = Core.TIMELINE_TYPES.includes(fieldType);
        const chartable = !UNCHARTABLE_TYPES.includes(fieldType);

        const typeSelect = el(
          'select',
          {
            dataset: { key },
            className: 'chart-type-select',
            disabled: !chartable ? 'disabled' : undefined,
          },
          [
            el(
              'option',
              { value: 'bar-h', selected: currentChartType === 'bar-h' },
              '横棒',
            ),
            el(
              'option',
              { value: 'bar-v', selected: currentChartType === 'bar-v' },
              '縦棒',
            ),
            el(
              'option',
              { value: 'pie', selected: currentChartType === 'pie' },
              '円',
            ),
            canBeLine
              ? el(
                  'option',
                  { value: 'line', selected: currentChartType === 'line' },
                  '折れ線',
                )
              : null,
          ],
        );
        typeSelect.addEventListener('change', (e) => {
          chartTypes[key] = e.target.value;
          persistSettings();
        });

        const makeCheck = (labelText, checked, onChange, disabled) => {
          const input = el('input', {
            type: 'checkbox',
            checked,
            className: 'config-checkbox',
            dataset: { key },
          });
          if (disabled) {
            input.disabled = true;
          }
          input.addEventListener('change', (e) => {
            onChange(e.target.checked);
            persistSettings();
          });
          return el('label', { className: 'checkbox-group' }, [
            el('span', { className: 'checkbox-label' }, labelText),
            input,
          ]);
        };

        const row = el('div', { className: 'field-manager-row' }, [
          el('div', { className: 'field-info' }, [
            el('div', { className: 'field-label', title: label }, label),
            el('div', { className: 'field-key' }, `${key} / ${fieldType}`),
          ]),
          el('div', { className: 'field-controls' }, [
            el('div', { className: 'control-group' }, [
              el('span', { className: 'control-label' }, '形式'),
              typeSelect,
            ]),
            makeCheck('表', visibleColumns.includes(key), (on) => {
              visibleColumns = on
                ? [...visibleColumns, key]
                : visibleColumns.filter((k) => k !== key);
            }),
            makeCheck(
              '条件',
              visibleFilters.includes(key),
              (on) => {
                visibleFilters = on
                  ? [...visibleFilters, key]
                  : visibleFilters.filter((k) => k !== key);
              },
              !chartable,
            ),
            makeCheck(
              'グラフ',
              visibleCharts.includes(key),
              (on) => {
                visibleCharts = on
                  ? [...visibleCharts, key]
                  : visibleCharts.filter((k) => k !== key);
              },
              !chartable,
            ),
          ]),
        ]);
        container.appendChild(row);
      });
    };

    const updateUI = () => {
      renderKPIs();
      renderFilters();
      renderCharts();
      renderTable();
    };

    // --- エクスポート ---
    const downloadData = () => {
      const scope = document.querySelector(
        'input[name="downloadScope"]:checked',
      ).value;
      const format = document.getElementById('downloadFormat').value;
      const encoding = document.getElementById('downloadEncoding').value;
      const targetData = scope === 'all' ? getNormalized() : getFiltered();
      let blob;
      let fileName = `export_${Date.now()}`;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(targetData, null, 2)], {
          type: 'application/json',
        });
        fileName += '.json';
      } else {
        let content = Core.buildCsv(targetData, layout);
        if (encoding === 'utf8bom') {
          content = '\uFEFF' + content;
        }
        blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        fileName += '.csv';
      }
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: fileName });
      a.click();
      URL.revokeObjectURL(url);
      toggleDownloadModal(false);
    };

    const switchTab = (tab) => {
      document
        .getElementById('view-dashboard')
        .classList.toggle('hidden', tab !== 'dashboard');
      document
        .getElementById('view-table')
        .classList.toggle('hidden', tab !== 'table');
      document
        .querySelectorAll('#mainTabs button')
        .forEach(
          (btn) =>
            (btn.className = `tab-button ${btn.dataset.tab === tab ? 'active' : ''}`),
        );
    };
    const toggleConfigModal = (show) => {
      if (show) {
        renderFieldManager();
      }
      document.getElementById('configModal').classList.toggle('hidden', !show);
      if (!show) {
        updateUI();
      }
    };
    const toggleDownloadModal = (show) => {
      document
        .getElementById('downloadModal')
        .classList.toggle('hidden', !show);
    };

    // --- イベント配線 ---
    document.getElementById('mainTabs').addEventListener('click', (e) => {
      if (e.target.dataset.tab) {
        switchTab(e.target.dataset.tab);
      }
    });
    document
      .getElementById('openConfig')
      .addEventListener('click', () => toggleConfigModal(true));
    document
      .getElementById('closeConfig')
      .addEventListener('click', () => toggleConfigModal(false));
    document
      .getElementById('applyConfig')
      .addEventListener('click', () => toggleConfigModal(false));
    document
      .getElementById('openDownload')
      .addEventListener('click', () => toggleDownloadModal(true));
    document
      .getElementById('closeDownload')
      .addEventListener('click', () => toggleDownloadModal(false));
    document
      .getElementById('execDownload')
      .addEventListener('click', downloadData);
    document
      .getElementById('downloadFormat')
      .addEventListener('change', (e) => {
        document
          .getElementById('encodingSection')
          .classList.toggle('hidden', e.target.value === 'json');
      });
    document
      .getElementById('pdfExport')
      .addEventListener('click', () => window.print());
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
      filters = {};
      updateUI();
    });
    document
      .getElementById('resetVisibilityBtn')
      .addEventListener('click', () => {
        visibleColumns = ['$id', ...allKeys];
        visibleFilters = [...chartableKeys];
        visibleCharts = [...chartableKeys];
        chartTypes = {};
        trendMeasures = {};
        aggregationTypes = {};
        fieldLogics = {};
        persistSettings();
        renderFieldManager();
        updateUI();
      });
    document
      .getElementById('clearAllSettingsBtn')
      .addEventListener('click', () => {
        visibleColumns = [];
        visibleFilters = [];
        visibleCharts = [];
        persistSettings();
        renderFieldManager();
        updateUI();
      });

    // ウィンドウ幅変更でグラフを描き直す(SVGはviewBoxで伸縮するが、極端な変化に追従するため)
    let resizeTimer = null;
    global.addEventListener('resize', () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(renderCharts, 300);
    });

    // --- 全件取得(confirm()は廃止し自動で取得する) ---
    const fetchAll = async () => {
      setRecordCount('全件データを取得しています…');
      try {
        const body = {
          app: kintone.app.getId(),
          query: queryString,
          size: 500,
          fields: useFields,
        };
        const cursorResp = await kintone.api(
          kintone.api.url('/k/v1/records/cursor', true),
          'POST',
          body,
        );
        let allRecords = [];
        for (;;) {
          const resp = await kintone.api(
            kintone.api.url('/k/v1/records/cursor', true),
            'GET',
            {
              id: cursorResp.id,
            },
          );
          allRecords = allRecords.concat(resp.records);
          if (!resp.next) {
            break;
          }
        }
        records = allRecords;
        setRecordCount(`全${records.length}件`);
        updateUI();
      } catch (e) {
        console.error(e);
        setRecordCount('');
        kintone.showNotification(
          'ERROR',
          `データの取得に失敗しました: ${e.message || e}`,
        );
      }
    };

    updateUI();
    fetchAll();
    return event;
  });
})(window, kintone);
