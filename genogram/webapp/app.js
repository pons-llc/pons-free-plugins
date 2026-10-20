(function () {
  'use strict';

  // オフライン版(1つのHTMLファイル)の画面。kintone版と同じエディター(js/editor.js)を使い、
  // データの保存・読み込みはケースファイル(.json)で行う。ブラウザのストレージには何も保存しない
  // (共用パソコンに個人情報を残さないため)。未保存の変更がある状態で閉じる・新規・開く場合は確認する。

  const NS = window.Genogram;
  const { Model, CaseFile } = NS;

  const $ = (selector) => document.querySelector(selector);
  const caseInput = $('.js-app-case-name');
  const authorInput = $('.js-app-author');
  const fileInput = $('.js-app-file');
  const statusEl = $('.js-app-status');
  const editorEl = $('.js-app-editor');
  const printTitleEl = $('.js-app-print-title');

  // エディターはこのオブジェクトを参照し続けるため、ファイル名は書き換えれば反映される
  const editorOptions = {
    getAuthor: () => ({ code: '', name: authorInput.value.trim() }),
    filename: CaseFile.fileName('', new Date(), 'png'),
  };
  let editor = null;
  let savedSnapshot = '';

  // 変更の有無の判定用(保存日時は除く)
  const snapshot = () =>
    editor
      ? CaseFile.serialize(editor.getModel(), {
          caseName: caseInput.value,
          savedAt: '-',
        })
      : '';
  const isDirty = () => snapshot() !== savedSnapshot;

  let statusTimer = 0;
  const showStatus = (message, isError) => {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
    clearTimeout(statusTimer);
    if (!isError) {
      statusTimer = setTimeout(() => {
        statusEl.textContent = '';
      }, 5000);
    }
  };

  const onCaseNameChange = () => {
    editorOptions.filename = CaseFile.fileName(
      caseInput.value,
      new Date(),
      'png',
    );
    printTitleEl.textContent = caseInput.value
      ? `ジェノグラム: ${caseInput.value}`
      : 'ジェノグラム';
    document.title = caseInput.value
      ? `${caseInput.value} - ジェノグラム作成(オフライン版)`
      : 'ジェノグラム作成(オフライン版)';
  };

  const mount = (model, caseName) => {
    caseInput.value = caseName || '';
    onCaseNameChange();
    editor = NS.Editor.mountEditor(editorEl, model, editorOptions);
    savedSnapshot = snapshot();
  };

  const confirmDiscard = () =>
    !isDirty() ||
    window.confirm(
      '保存していない変更があります。変更を破棄してよろしいですか？',
    );

  const download = (text, name, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const save = () => {
    const name = CaseFile.fileName(caseInput.value, new Date(), 'json');
    download(
      CaseFile.serialize(editor.getModel(), { caseName: caseInput.value }),
      name,
      'application/json',
    );
    savedSnapshot = snapshot();
    showStatus(
      `「${name}」として保存しました(ブラウザのダウンロード先を確認してください)。`,
    );
  };

  const openFile = (file) => {
    if (!file) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = CaseFile.parse(reader.result);
      if (!result.ok) {
        showStatus(`「${file.name}」を開けませんでした: ${result.error}`, true);
        return;
      }
      mount(result.model, result.caseName);
      showStatus(`「${file.name}」を開きました。`);
    };
    reader.onerror = () => {
      showStatus(`「${file.name}」を読み込めませんでした。`, true);
    };
    reader.readAsText(file);
  };

  $('.js-app-new').addEventListener('click', () => {
    if (confirmDiscard()) {
      mount(Model.empty(), '');
      showStatus('新しいケースを作成しました。');
    }
  });
  $('.js-app-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    openFile(fileInput.files[0]);
    fileInput.value = ''; // 同じファイルを続けて開けるように
  });
  $('.js-app-save').addEventListener('click', save);
  $('.js-app-print').addEventListener('click', () => window.print());
  caseInput.addEventListener('input', onCaseNameChange);

  // ファイルを画面にドラッグ&ドロップして開く
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      document.body.classList.add('is-dragover');
    }
  });
  document.addEventListener('dragleave', (e) => {
    if (
      e.target === document.documentElement ||
      e.clientX <= 0 ||
      e.clientY <= 0
    ) {
      document.body.classList.remove('is-dragover');
    }
  });
  document.addEventListener('drop', (e) => {
    document.body.classList.remove('is-dragover');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      openFile(e.dataTransfer.files[0]);
    }
  });

  // Ctrl+S / ⌘+S で保存
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  // 閉じた<details>の中身はCSSだけでは印刷に出せないため、印刷の間だけ凡例を開く
  let legendsOpenedForPrint = [];
  window.addEventListener('beforeprint', () => {
    legendsOpenedForPrint = Array.from(
      document.querySelectorAll('.gng-legend:not([open])'),
    );
    legendsOpenedForPrint.forEach((el) => {
      el.open = true;
    });
  });
  window.addEventListener('afterprint', () => {
    legendsOpenedForPrint.forEach((el) => {
      el.open = false;
    });
    legendsOpenedForPrint = [];
  });

  window.addEventListener('beforeunload', (e) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  mount(Model.empty(), '');
})();
