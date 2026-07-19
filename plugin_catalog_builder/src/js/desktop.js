(function (global, kintone) {
  'use strict';

  const NS = global.PluginCatalogBuilder;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 例外事項(idea.md「簡易AI検索(設定でON/OFF、CDN例外)」参照): 本プラグインに限り
  // CLAUDE.md開発方針9(外部通信を行わない)の例外として、CDN経由の動的読み込みを認めている。
  // バージョンは完全固定(@latestのような可変指定はしない)。site/js/ai-search.jsと同じライブラリ・モデル。
  const AI_SEARCH_CDN_URL =
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';
  const AI_SEARCH_MODEL_ID = 'Xenova/multilingual-e5-small';
  const AI_SEARCH_TOP_K = 15;

  const appId = kintone.app.getId();
  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const pluginsUrl = () => kintone.api.url('/k/v1/plugins.json', true);
  const pluginAppsUrl = () => kintone.api.url('/k/v1/plugin/apps.json', true);
  const appsUrl = () => kintone.api.url('/k/v1/apps.json', true);

  // ---- REST呼び出し(idea.md「使用するREST API」参照) ----

  const fetchAllPlugins = async () => {
    let plugins = [];
    let offset = 0;
    for (;;) {
      const resp = await kintone.api(pluginsUrl(), 'GET', {
        offset,
        limit: 100,
      });
      plugins = plugins.concat(resp.plugins);
      if (resp.plugins.length < 100) {
        break;
      }
      offset += 100;
    }
    return plugins;
  };

  // GET /k/v1/plugin/apps.json はcybozu.com共通管理者権限を必須とするAPI(idea.md参照)。
  // この権限を持たないユーザーが実行した場合は403で例外がそのまま伝播し、同期全体が中止される。
  const fetchPluginApps = async (pluginId) => {
    let apps = [];
    let offset = 0;
    for (;;) {
      const resp = await kintone.api(pluginAppsUrl(), 'GET', {
        id: pluginId,
        offset,
        limit: 500,
      });
      apps = apps.concat(resp.apps);
      if (resp.apps.length < 500) {
        break;
      }
      offset += 500;
    }
    return apps;
  };

  // 閲覧権限が無いアプリはレスポンスに含まれない(idea.md「アプリ情報を取得できませんでした」参照)。
  const fetchAppsInfo = async (appIds) => {
    const infoById = {};
    const chunkSize = 100;
    for (let i = 0; i < appIds.length; i += chunkSize) {
      const chunk = appIds.slice(i, i + chunkSize);

      const resp = await kintone.api(appsUrl(), 'GET', { ids: chunk });
      resp.apps.forEach((app) => {
        infoById[app.appId] = {
          name: app.name,
          description: app.description,
          spaceId: app.spaceId,
        };
      });
    }
    return infoById;
  };

  const putRecordsBatch = (records) =>
    kintone.api(recordsUrl(), 'PUT', {
      app: appId,
      upsert: true,
      records,
    });

  const fetchCatalogRecordsPage = (lastId) => {
    const query =
      lastId > 0 ? `$id > ${lastId} order by $id asc` : 'order by $id asc';
    return kintone
      .api(recordsUrl(), 'GET', { app: appId, query })
      .then((resp) => resp.records);
  };

  const fetchAllCatalogRecords = () =>
    NS.RecordsFetcher.fetchAllRecords(fetchCatalogRecordsPage);

  // ---- 離脱防止(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」を踏まえ、
  // 処理中に画面遷移されて中断されるのを防ぐ最低限の実装。related_record_summaryと同じ設計) ----

  let unloadGuard = null;
  const enableUnloadGuard = () => {
    unloadGuard = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    global.addEventListener('beforeunload', unloadGuard);
  };
  const disableUnloadGuard = () => {
    if (unloadGuard) {
      global.removeEventListener('beforeunload', unloadGuard);
      unloadGuard = null;
    }
  };

  // ---- 同期(取得してUPSERT)ボタン ----

  const runSync = async () => {
    const gathered = await NS.SyncOrchestrator.gather({
      fetchAllPlugins,
      fetchPluginApps,
      fetchAppsInfo,
    });
    if (gathered.plugins.length === 0) {
      global.alert('インストール済みのプラグインが見つかりませんでした。');
      return;
    }

    const message = NS.ApiEstimate.buildConfirmMessage(gathered.estimate);
    const dialogResult = await kintone.showConfirmDialog({
      title: 'プラグイン利用状況の同期',
      body: message,
      showOkButton: true,
      okButtonText: '実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    if (dialogResult !== 'OK') {
      return;
    }

    enableUnloadGuard();
    await kintone.showLoading('VISIBLE');
    try {
      const result = await NS.SyncOrchestrator.write({
        records: gathered.records,
        putRecordsBatch,
      });
      global.alert(
        `同期が完了しました。${result.writtenCount}件のプラグイン情報を反映しました。`,
      );
    } catch (err) {
      global.alert(`同期に失敗しました: ${err.message}`);
    } finally {
      kintone.showLoading('HIDDEN');
      disableUnloadGuard();
    }
  };

  // kintone.user.getGroups()はクライアント側の表示ゲートに過ぎず、真の権限境界ではない。
  // 真の境界はGET /k/v1/plugin/apps.jsonが要求するcybozu.com共通管理者権限(idea.md参照、
  // related_record_summaryのgroups制限と同じ設計・同じ限界)。
  const renderSyncButtonIfAuthorized = async (headerEl) => {
    if (
      !headerEl ||
      !config.syncGroupCodes ||
      config.syncGroupCodes.length === 0 ||
      headerEl.dataset.pcbSyncButtonRendered
    ) {
      return;
    }
    const groups = await kintone.user.getGroups();
    const isAuthorized = groups.some((g) =>
      config.syncGroupCodes.includes(g.code),
    );
    if (!isAuthorized) {
      return;
    }
    // headerElはconstパラメーターであり、await後に再代入され得ないためrequire-atomic-updatesは誤検知。
    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.pcbSyncButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal pcb-sync-button';
    button.textContent = 'プラグイン利用状況を同期';
    button.addEventListener('click', () => {
      button.disabled = true;
      runSync().finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  // ---- AI用データダウンロードボタン(AI検索の設定に関わらず常時表示、外部通信なし) ----

  const buildDownloadFilename = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `plugin_catalog_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}.txt`
    );
  };

  const runDownload = async () => {
    await kintone.showLoading('VISIBLE');
    try {
      const records = await fetchAllCatalogRecords();
      const content = NS.CatalogExport.buildExportFileContent(records);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchorEl = document.createElement('a');
      anchorEl.href = url;
      anchorEl.download = buildDownloadFilename(new Date());
      document.body.appendChild(anchorEl);
      anchorEl.click();
      anchorEl.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      global.alert(`ダウンロードに失敗しました: ${err.message}`);
    } finally {
      kintone.showLoading('HIDDEN');
    }
  };

  const renderDownloadButton = (headerEl) => {
    if (!headerEl || headerEl.dataset.pcbDownloadButtonRendered) {
      return;
    }
    headerEl.dataset.pcbDownloadButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal pcb-download-button';
    button.textContent = 'AI用データをダウンロード';
    button.addEventListener('click', () => {
      button.disabled = true;
      runDownload().finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  // ---- 簡易AI検索(設定でON時のみ、CDN例外。idea.md参照) ----

  let extractorPromise = null;
  let corpusEmbeddingsPromise = null;

  // onProgressはモデルファイルのダウンロード進捗(0〜100)を通知する。フリーズしたように
  // 見えるという報告への対応として、進捗が全く表示されない状態を避けるために追加した
  // (site/js/ai-search.jsのprogress_callbackと同じ仕組み)。初回ダウンロード後はブラウザの
  // キャッシュが効くため、2回目以降は短時間で解決しonProgressはほぼ呼ばれない。
  const loadExtractor = async (onProgress) => {
    if (!extractorPromise) {
      extractorPromise = (async () => {
        const { pipeline } = await import(AI_SEARCH_CDN_URL);
        return pipeline('feature-extraction', AI_SEARCH_MODEL_ID, {
          dtype: 'q8',
          progress_callback: (data) => {
            if (onProgress && typeof data.progress === 'number') {
              onProgress(data.progress);
            }
          },
        });
      })();
    }
    return extractorPromise;
  };

  // 初回検索時、台帳の全レコードをまとめて1回のextractor()呼び出しで埋め込むと、WASM側の
  // 計算がメインスレッドを長時間ブロックしてタブがフリーズしたように見える(実際の利用者報告により
  // 判明)。少数件ずつのバッチに分割し、バッチの間で`setTimeout(0)`によりイベントループへ制御を
  // 一度返すことで、1回あたりのブロック時間を短く抑え、ダイアログの応答性(閉じるボタン等)を保つ。
  // 合計の計算時間そのものは変わらないが、ブラウザが「固まっている」ように見える状態を避けられる。
  const EMBEDDING_BATCH_SIZE = 8;

  const getCorpusEmbeddings = async (extractor, onProgress) => {
    if (!corpusEmbeddingsPromise) {
      corpusEmbeddingsPromise = (async () => {
        const records = await fetchAllCatalogRecords();
        const corpus = NS.CatalogSearchCorpus.buildCorpus(records);
        if (corpus.length === 0) {
          return [];
        }
        const texts = corpus.map((c) => `passage: ${c.text}`);
        const vectors = [];
        for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

          const output = await extractor(batch, {
            pooling: 'mean',
            normalize: true,
          });
          vectors.push(...output.tolist());
          if (onProgress) {
            onProgress(Math.round(((i + batch.length) / texts.length) * 100));
          }

          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return corpus.map((c, i) => ({ corpus: c, vector: vectors[i] }));
      })();
    }
    return corpusEmbeddingsPromise;
  };

  const searchCatalog = async (query, onCorpusProgress) => {
    const extractor = await loadExtractor();
    const [entries, queryOutput] = await Promise.all([
      getCorpusEmbeddings(extractor, onCorpusProgress),
      extractor([`query: ${query}`], { pooling: 'mean', normalize: true }),
    ]);
    const queryVector = queryOutput.tolist()[0];
    return NS.VectorSearch.topKByQuery(queryVector, entries, AI_SEARCH_TOP_K);
  };

  // config.bodyはそのままダイアログに組み込まれるため、textContentのみで組み立てて
  // XSS(kintone公式ドキュメントの「サニタイズ処理を行ってください」注記)を避ける。
  const renderAiSearchResults = (containerEl, results) => {
    containerEl.textContent = '';
    if (results.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = '該当するプラグインが見つかりませんでした。';
      containerEl.appendChild(emptyEl);
      return;
    }
    results.forEach((result) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'pcb-ai-search-result-item';

      const nameEl = document.createElement('div');
      nameEl.className = 'pcb-ai-search-result-name';
      nameEl.textContent = `${result.name}${result.version ? ` (v${result.version})` : ''}`;

      const descEl = document.createElement('div');
      descEl.className = 'pcb-ai-search-result-desc';
      descEl.textContent = result.description || '';

      const appsEl = document.createElement('div');
      appsEl.className = 'pcb-ai-search-result-apps';
      appsEl.textContent =
        result.appNames.length > 0
          ? `利用アプリ: ${result.appNames.join('、')}`
          : '利用アプリ: なし';

      itemEl.append(nameEl, descEl, appsEl);
      containerEl.appendChild(itemEl);
    });
  };

  const renderAiSearchForm = (bodyEl) => {
    bodyEl.textContent = '';

    const formRowEl = document.createElement('div');
    formRowEl.className = 'pcb-ai-search-form-row';

    const inputEl = document.createElement('input');
    inputEl.type = 'search';
    inputEl.className = 'pcb-ai-search-input';
    inputEl.placeholder = '例: 日付を和暦にしたい';

    const submitButtonEl = document.createElement('button');
    submitButtonEl.type = 'button';
    submitButtonEl.className = 'kintoneplugin-button-normal';
    submitButtonEl.textContent = '検索';

    formRowEl.append(inputEl, submitButtonEl);

    const resultAreaEl = document.createElement('div');
    resultAreaEl.className = 'pcb-ai-search-results';

    bodyEl.append(formRowEl, resultAreaEl);

    const runSearch = async () => {
      const query = inputEl.value.trim();
      if (!query) {
        return;
      }
      // 初回検索時のみ、コーパス(台帳アプリの全レコード)の埋め込み計算が発生する。バッチ分割済み
      // (getCorpusEmbeddings参照)だが、それでも時間はかかるため進捗(%)を表示する。
      const isFirstSearch = corpusEmbeddingsPromise === null;
      resultAreaEl.textContent = isFirstSearch
        ? '初回検索のため、全プラグイン情報を解析しています…(0%)'
        : '検索中…';
      try {
        const results = await searchCatalog(
          query,
          isFirstSearch
            ? (percent) => {
                resultAreaEl.textContent = `初回検索のため、全プラグイン情報を解析しています…(${percent}%)`;
              }
            : undefined,
        );
        renderAiSearchResults(resultAreaEl, results);
      } catch (err) {
        resultAreaEl.textContent = `検索に失敗しました: ${err.message}`;
      }
    };

    submitButtonEl.addEventListener('click', runSearch);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        runSearch();
      }
    });
    inputEl.focus();
  };

  const openAiSearchDialog = async () => {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'pcb-ai-search-body';
    const loadingEl = document.createElement('p');
    loadingEl.textContent =
      '検索モデルを読み込んでいます…初回は数十秒〜数分かかることがあります(外部CDNからの読み込み)。';
    const progressTrackEl = document.createElement('div');
    progressTrackEl.className = 'pcb-ai-search-progress-track';
    const progressBarEl = document.createElement('div');
    progressBarEl.className = 'pcb-ai-search-progress-bar';
    progressTrackEl.appendChild(progressBarEl);
    bodyEl.append(loadingEl, progressTrackEl);

    const dialog = await kintone.createDialog({
      title: 'プラグイン簡易AI検索',
      body: bodyEl,
      showOkButton: false,
      showCancelButton: false,
      showCloseButton: true,
    });
    const showPromise = dialog.show();

    try {
      await loadExtractor((progress) => {
        progressBarEl.style.width = `${Math.max(0, Math.min(100, progress)).toFixed(0)}%`;
      });
      renderAiSearchForm(bodyEl);
    } catch (err) {
      bodyEl.textContent = '';
      const errorEl = document.createElement('p');
      errorEl.textContent = `AI検索の読み込みに失敗しました。通信環境をご確認のうえ再度お試しください。(${err.message})`;
      bodyEl.appendChild(errorEl);
    }

    await showPromise;
  };

  const renderAiSearchButton = (headerEl) => {
    if (
      !config.aiSearchEnabled ||
      !headerEl ||
      headerEl.dataset.pcbAiSearchButtonRendered
    ) {
      return;
    }
    headerEl.dataset.pcbAiSearchButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal pcb-ai-search-button';
    button.textContent = 'プラグインを簡易AI検索';
    button.addEventListener('click', () => {
      openAiSearchDialog();
    });
    headerEl.appendChild(button);
  };

  // ---- 一覧画面表示時にボタン群を設置する ----

  kintone.events.on('app.record.index.show', (event) => {
    const headerEl = kintone.app.getHeaderMenuSpaceElement();
    renderDownloadButton(headerEl);
    renderAiSearchButton(headerEl);
    renderSyncButtonIfAuthorized(headerEl);
    return event;
  });
})(window, kintone);
