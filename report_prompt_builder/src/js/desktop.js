(function (PLUGIN_ID) {
  'use strict';

  const NS = window.ReportPromptBuilder;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const hasPages = (config.pages || []).length > 0;

  const buildPageModels = (record) =>
    config.pages.map((page) =>
      NS.ReportModel.buildPageModel(page, record, config.images),
    );

  const openReportWindow = (records) => {
    if (!records || records.length === 0) {
      alert('出力対象のレコードがありません。');
      return;
    }
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert(
        'ポップアップがブロックされました。ブラウザのポップアップブロックを解除してください。',
      );
      return;
    }

    const pageModels = [];
    records.forEach((record) => {
      buildPageModels(record).forEach((pageModel) =>
        pageModels.push(pageModel),
      );
    });
    NS.ReportDom.renderReportDocument(reportWindow.document, pageModels);
  };

  // ここから、生成した帳票をPDF化してレコードの添付ファイルフィールドへ保存する機能
  // (ユーザー指示「詳細画面から添付ファイルフィールドに保存できるようにしよう」「添付ファイル
  // フィールドに保存するかは選択制にしてね」。config画面のチェックボックスで有効にした場合のみ)。
  // vanilla JSだけでのHTML→PDF変換は現実的でないため、この機能に限り外部ライブラリ
  // (jsPDF/html2canvas、UMDビルドをvendorディレクトリへ同梱・CDN読み込みはしない)の利用を
  // ユーザーに承認済み。CLAUDE.md開発方針9(外部通信をしない)は、ライブラリを実行時に
  // ネットワーク越しに読み込まない(ローカル同梱)ことで維持している。
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  // report-dom.jsの.report-page自体の幅(190mm)に合わせて、A4の中央に配置するオフセット。
  const REPORT_PAGE_WIDTH_MM = 190;
  const REPORT_PAGE_X_OFFSET_MM = (A4_WIDTH_MM - REPORT_PAGE_WIDTH_MM) / 2;
  const CANVAS_SCALE = 2;

  // 帳票をオフスクリーンのiframeへ描画する。config.js「右側ライブプレビュー」と全く同じ
  // 描画処理(ReportModel/ReportDom)を使い回すため、PDF出力の見た目がプレビュー・印刷結果と
  // ズレることはない。画面外(position:fixedで左に大きくずらす)に置くだけで、display:noneには
  // しない(display:noneの要素はレイアウトされずhtml2canvasが正しく描画できないため)。
  const renderOffscreenReport = (pageModels) => {
    const iframeEl = document.createElement('iframe');
    iframeEl.style.position = 'fixed';
    iframeEl.style.left = '-10000px';
    iframeEl.style.top = '0';
    iframeEl.style.width = '800px';
    iframeEl.style.height = '1200px';
    iframeEl.style.border = '0';
    document.body.appendChild(iframeEl);

    const doc = iframeEl.contentDocument;
    NS.ReportDom.renderReportDocument(doc, pageModels);

    return {
      pageEls: Array.from(doc.querySelectorAll('.report-page')),
      cleanup: () => iframeEl.remove(),
    };
  };

  // 1ページ分のcanvasをPDFへ追加する。テーブルの行数が多い等でA4の1ページ分(297mm)を
  // 超える高さになった場合は、ブラウザの印刷ページ送りと同様に複数ページへスライスして追加する
  // (report-dom.jsの.report-pageは高さ固定ではなく内容に応じて伸びるため)。
  const addCanvasToPdf = (doc, canvas, isFirstPage) => {
    const mmPerPx = REPORT_PAGE_WIDTH_MM / canvas.width;
    const maxSliceHeightPx = Math.floor(A4_HEIGHT_MM / mmPerPx);
    let offsetPx = 0;
    let first = isFirstPage;

    while (offsetPx < canvas.height) {
      const sliceHeightPx = Math.min(
        maxSliceHeightPx,
        canvas.height - offsetPx,
      );
      const sliceCanvasEl = document.createElement('canvas');
      sliceCanvasEl.width = canvas.width;
      sliceCanvasEl.height = sliceHeightPx;
      sliceCanvasEl
        .getContext('2d')
        .drawImage(
          canvas,
          0,
          offsetPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );

      if (!first) {
        doc.addPage();
      }
      doc.addImage(
        sliceCanvasEl.toDataURL('image/png'),
        'PNG',
        REPORT_PAGE_X_OFFSET_MM,
        0,
        REPORT_PAGE_WIDTH_MM,
        sliceHeightPx * mmPerPx,
      );
      first = false;
      offsetPx += sliceHeightPx;
    }
  };

  // pageModelsからPDF(Blob)を組み立てる。jsPDFには.html()という高レベルAPIもあるが、内部の
  // 自動ページ分割の挙動が不透明なため使わず、ページごとにhtml2canvasでラスタライズしたものを
  // 自前でスライスしてjsPDFへ画像として貼り付ける方式にしている(挙動を完全に把握できるように)。
  const buildReportPdfBlob = async (pageModels) => {
    const { pageEls, cleanup } = renderOffscreenReport(pageModels);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      for (let i = 0; i < pageEls.length; i += 1) {
        // 1ページずつ順番に描画する必要があるため、あえて直列にawaitしている。
        const canvas = await window.html2canvas(pageEls[i], {
          scale: CANVAS_SCALE,
          backgroundColor: '#ffffff',
        });
        addCanvasToPdf(doc, canvas, i === 0);
      }
      return doc.output('blob');
    } finally {
      cleanup();
    }
  };

  // ファイルのアップロードAPI(/k/v1/file.json)はkintone.api()から利用できないと
  // kintone公式ドキュメントに明記されているため、この1箇所に限りFetch APIを直接使う
  // (CLAUDE.md開発方針3の「REST APIはJavaScript APIで実現できない場合のみ」に合致する、
  // 公式ドキュメントで裏付けられた例外)。CSRFトークンの付与は公式ドキュメントのサンプルどおり。
  const uploadFileToKintone = async (blob, fileName) => {
    const formData = new FormData();
    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
    formData.append('file', blob, fileName);

    const resp = await fetch('/k/v1/file.json', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    });
    if (!resp.ok) {
      throw new Error('ファイルのアップロードに失敗しました。');
    }
    const respData = await resp.json();
    return respData.fileKey;
  };

  // 個別出力時に、生成したPDFをレコードの添付ファイルフィールドへ保存する。添付ファイル
  // フィールドの更新は既存ファイルを含めた全置換のため、現在のレコードの値(record引数、
  // app.record.detail.showのevent.record)から既存のfileKeyを引き継ぐ
  // (NS.AttachmentField.buildUpdatedFileFieldValue、kintone公式ドキュメント
  // 「添付ファイルフィールドを更新するとき」参照)。ファイル名は「固定テキスト+タイムスタンプ」
  // (ユーザー指示「ファイル保存時の名称は固定テキスト+タイムスタンプ。configで設定できるように」、
  // 固定テキストはconfig画面で設定した`fileNamePrefix`)。
  const saveReportAsAttachment = async (record, recordId) => {
    const { fieldCode, fileNamePrefix } = config.saveToAttachment;
    kintone.showLoading('VISIBLE');
    try {
      const pdfBlob = await buildReportPdfBlob(buildPageModels(record));
      const fileName = NS.AttachmentField.buildAttachmentFileName(
        fileNamePrefix,
        new Date(),
      );
      const fileKey = await uploadFileToKintone(pdfBlob, fileName);
      const existingFiles =
        (record[fieldCode] && record[fieldCode].value) || [];
      const updatedValue = NS.AttachmentField.buildUpdatedFileFieldValue(
        existingFiles,
        fileKey,
      );
      await kintone.api(kintone.api.url('/k/v1/record.json', true), 'PUT', {
        app: kintone.app.getId(),
        id: recordId,
        record: { [fieldCode]: updatedValue },
      });
      kintone.showLoading('HIDDEN');
      alert('帳票を添付ファイルフィールドに保存しました。');
      location.reload();
    } catch (error) {
      kintone.showLoading('HIDDEN');
      console.error(error);
      alert('添付ファイルフィールドへの保存に失敗しました。');
    }
  };

  // 個別出力: レコード詳細画面のヘッダースペースにボタンを設置し、押下時に現在の1レコードから
  // 帳票を生成する。設定で有効な場合は、PDFを添付ファイルフィールドへ保存するボタンも並べて置く。
  if (hasPages && config.outputModes.individual) {
    kintone.events.on('app.record.detail.show', (event) => {
      const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
      if (!spaceEl) {
        return event;
      }
      const buttonEl = document.createElement('button');
      buttonEl.className = 'kintoneplugin-button-normal';
      buttonEl.textContent = '帳票を出力';
      buttonEl.addEventListener('click', () => {
        openReportWindow([event.record]);
      });
      spaceEl.appendChild(buttonEl);

      if (
        config.saveToAttachment.enabled &&
        config.saveToAttachment.fieldCode
      ) {
        const saveButtonEl = document.createElement('button');
        saveButtonEl.className = 'kintoneplugin-button-normal';
        saveButtonEl.textContent = 'PDFを添付ファイルに保存';
        saveButtonEl.addEventListener('click', () => {
          saveReportAsAttachment(event.record, kintone.app.record.getId());
        });
        spaceEl.appendChild(saveButtonEl);
      }

      return event;
    });
  }

  // 一括出力: レコード一覧画面のヘッダースペースにボタンを設置する。RESTでの絞り込み再取得は
  // 行わず、app.record.index.show の event.records(=現在一覧に表示されている行)のみを使う。
  // event.recordsはビュー形式(表形式/カレンダー形式/カスタマイズ)によって形が変わり、配列でない
  // 場合(カレンダー形式、ページネーション無効のカスタマイズビュー)があるため、配列でない場合は
  // 一括出力の対象外(0件)として扱う。
  if (hasPages && config.outputModes.bulk) {
    let latestDisplayedRecords = [];

    kintone.events.on('app.record.index.show', (event) => {
      latestDisplayedRecords = Array.isArray(event.records)
        ? event.records
        : [];

      const spaceEl = kintone.app.getHeaderMenuSpaceElement();
      if (spaceEl && !spaceEl.querySelector('.js-bulk-report-button')) {
        const buttonEl = document.createElement('button');
        buttonEl.className =
          'kintoneplugin-button-normal js-bulk-report-button';
        buttonEl.textContent = '表示中のレコードを一括帳票出力';
        buttonEl.addEventListener('click', () => {
          if (latestDisplayedRecords.length === 0) {
            alert(
              '現在の一覧には出力対象のレコードがありません(カレンダー形式など一部のビュー形式では一括出力に対応していません)。',
            );
            return;
          }
          openReportWindow(latestDisplayedRecords);
        });
        spaceEl.appendChild(buttonEl);
      }
      return event;
    });
  }
})(kintone.$PLUGIN_ID);
