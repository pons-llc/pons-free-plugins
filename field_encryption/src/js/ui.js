(function (global) {
  'use strict';

  // スペースフィールドへの「パスフレーズ設定フォーム」「復号フォーム」「結果表示」
  // 「復号結果の表示エリア」を描画する共通モジュール。document.createElement + textContentのみで
  // 構築する(innerHTML不使用)。
  //
  // 復号したプレースホルダー/結果は必ずこのモジュールが管理するスペース要素側のDOMにのみ書き込み、
  // kintone.app.record.getFieldElement()で取得した実フィールドの要素には(マスク文字列を1回だけ
  // 書き込む用途を除いて)一切書き込まない。これにより「取得した要素の内部構造を変更しない」という
  // kintoneガイドラインを機械的に守れる設計にしている(idea.md参照)。

  const PREFIX = 'fe-';
  const cls = (name) => PREFIX + name;

  const clearChildren = (el) => {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  // 二重描画防止(org_lookup/src/js/desktop.jsのspaceEl.dataset.orglButtonRenderedと同じパターン)。
  const ensureRoot = (spaceEl) => {
    if (spaceEl.dataset.feRendered) {
      return spaceEl.querySelector(`.${cls('root')}`);
    }
    spaceEl.dataset.feRendered = '1';

    const rootEl = document.createElement('div');
    rootEl.className = cls('root');

    ['trigger', 'setup', 'decrypt', 'result', 'values'].forEach((section) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = cls(section);
      rootEl.appendChild(sectionEl);
    });

    spaceEl.appendChild(rootEl);
    return rootEl;
  };

  const section = (spaceEl, name) => {
    const rootEl = ensureRoot(spaceEl);
    return rootEl.querySelector(`.${cls(name)}`);
  };

  const renderSetupForm = (spaceEl, { minLength }) => {
    const setupEl = section(spaceEl, 'setup');
    clearChildren(setupEl);

    const noteEl = document.createElement('p');
    noteEl.className = 'kintoneplugin-desc';
    noteEl.textContent =
      'このレコードの暗号化対象フィールドを保護するパスフレーズを設定してください。' +
      'パスフレーズはどこにも保存されません。紛失すると暗号化されたデータは復号できなくなります。';
    setupEl.appendChild(noteEl);

    const passphraseEl = document.createElement('input');
    passphraseEl.type = 'password';
    passphraseEl.autocomplete = 'new-password';
    passphraseEl.className = `kintoneplugin-input-text ${cls('passphrase-input')}`;
    passphraseEl.placeholder = `パスフレーズ(${minLength}文字以上)`;
    setupEl.appendChild(passphraseEl);

    const confirmEl = document.createElement('input');
    confirmEl.type = 'password';
    confirmEl.autocomplete = 'new-password';
    confirmEl.className = `kintoneplugin-input-text ${cls('passphrase-confirm-input')}`;
    confirmEl.placeholder = 'パスフレーズ(確認用)';
    setupEl.appendChild(confirmEl);
  };

  const getSetupPassphrase = (spaceEl) => {
    const el = spaceEl.querySelector(`.${cls('passphrase-input')}`);
    return el ? el.value : '';
  };

  const getSetupConfirmPassphrase = (spaceEl) => {
    const el = spaceEl.querySelector(`.${cls('passphrase-confirm-input')}`);
    return el ? el.value : '';
  };

  const isSetupFormRendered = (spaceEl) =>
    !!spaceEl.querySelector(`.${cls('passphrase-input')}`);

  // モバイル用: スペース要素にはボタン(トリガー)だけを置き、実際のパスフレーズ入力は
  // openBottomSheet()が作るボトムシートで行う(idea.md「モバイル対応」参照。
  // kintone.mobile.showConfirmBottomSheet()は確認ダイアログ専用でテキスト入力欄を持てないため、
  // 入力が必要なこの用途では自前でボトムシート風のUIを構築している)。
  const renderTrigger = (spaceEl, { label, onTap }) => {
    const triggerEl = section(spaceEl, 'trigger');
    clearChildren(triggerEl);

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = `kintoneplugin-button-normal ${cls('trigger-button')}`;
    buttonEl.textContent = label;
    triggerEl.appendChild(buttonEl);

    buttonEl.addEventListener('click', async () => {
      buttonEl.disabled = true;
      try {
        await onTap();
      } finally {
        buttonEl.disabled = false;
      }
    });
  };

  const setTriggerLabel = (spaceEl, label) => {
    const buttonEl = spaceEl.querySelector(`.${cls('trigger-button')}`);
    if (buttonEl) {
      buttonEl.textContent = label;
    }
  };

  // 復号ボタン押下時にonSubmit(passphrase)を呼び出す。処理中はボタンを無効化し、成功・失敗を
  // 問わず入力欄のパスフレーズはDOM上から消す(パスフレーズをDOMに残さないため)。
  const renderDecryptForm = (spaceEl, { onSubmit }) => {
    const decryptEl = section(spaceEl, 'decrypt');
    clearChildren(decryptEl);

    const passphraseEl = document.createElement('input');
    passphraseEl.type = 'password';
    passphraseEl.autocomplete = 'current-password';
    passphraseEl.className = `kintoneplugin-input-text ${cls('decrypt-passphrase-input')}`;
    passphraseEl.placeholder = 'パスフレーズ';
    decryptEl.appendChild(passphraseEl);

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = `kintoneplugin-button-normal ${cls('decrypt-button')}`;
    buttonEl.textContent = '復号';
    decryptEl.appendChild(buttonEl);

    buttonEl.addEventListener('click', async () => {
      const passphrase = passphraseEl.value;
      buttonEl.disabled = true;
      try {
        await onSubmit(passphrase);
      } finally {
        // buttonEl.disabledによる連打防止があるため実際に競合することはないが、
        // require-atomic-updatesの検出対象になるため明示的に無効化する。
        // eslint-disable-next-line require-atomic-updates
        passphraseEl.value = '';
        buttonEl.disabled = false;
      }
    });
  };

  const showResult = (spaceEl, { status, message }) => {
    const resultEl = section(spaceEl, 'result');
    clearChildren(resultEl);
    const messageEl = document.createElement('p');
    messageEl.className = `${cls('result-message')} ${cls(`result-${status}`)}`;
    messageEl.textContent = message;
    resultEl.appendChild(messageEl);
  };

  const clearResult = (spaceEl) => {
    clearChildren(section(spaceEl, 'result'));
  };

  // 復号結果は実フィールドのDOMではなく、スペース要素側の専用エリアに表示する(詳細画面用)。
  const showDecryptedField = (spaceEl, { label, plaintext }) => {
    const valuesEl = section(spaceEl, 'values');

    const rowEl = document.createElement('div');
    rowEl.className = cls('value-row');

    const labelEl = document.createElement('div');
    labelEl.className = cls('value-label');
    labelEl.textContent = label;
    rowEl.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.className = cls('value-text');
    valueEl.style.whiteSpace = 'pre-wrap';
    valueEl.textContent = plaintext;
    rowEl.appendChild(valueEl);

    valuesEl.appendChild(rowEl);
  };

  const clearDecryptedFields = (spaceEl) => {
    clearChildren(section(spaceEl, 'values'));
  };

  // openBottomSheet()のDOM組み立て部分だけを切り出したもの(statement数を抑えるための分割)。
  // fields: [{ key, placeholder, autocomplete }] の配列。type="password"の入力欄を並べる。
  const buildSheetContent = (
    sheetEl,
    { title, note, fields, submitLabel, cancelLabel },
  ) => {
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = cls('sheet-title');
      titleEl.textContent = title;
      sheetEl.appendChild(titleEl);
    }

    if (note) {
      const noteEl = document.createElement('p');
      noteEl.className = cls('sheet-note');
      noteEl.textContent = note;
      sheetEl.appendChild(noteEl);
    }

    const errorEl = document.createElement('p');
    errorEl.className = cls('sheet-error');
    sheetEl.appendChild(errorEl);

    const inputEls = {};
    fields.forEach((field) => {
      const inputEl = document.createElement('input');
      inputEl.type = 'password';
      inputEl.autocomplete = field.autocomplete || 'off';
      inputEl.placeholder = field.placeholder || '';
      inputEl.className = cls('sheet-input');
      sheetEl.appendChild(inputEl);
      inputEls[field.key] = inputEl;
    });

    const buttonRowEl = document.createElement('div');
    buttonRowEl.className = cls('sheet-buttons');
    sheetEl.appendChild(buttonRowEl);

    const cancelButtonEl = document.createElement('button');
    cancelButtonEl.type = 'button';
    cancelButtonEl.className = `kintoneplugin-button-normal ${cls('sheet-cancel')}`;
    cancelButtonEl.textContent = cancelLabel || 'キャンセル';
    buttonRowEl.appendChild(cancelButtonEl);

    const submitButtonEl = document.createElement('button');
    submitButtonEl.type = 'button';
    submitButtonEl.className = `kintoneplugin-button-normal ${cls('sheet-submit')}`;
    submitButtonEl.textContent = submitLabel || 'OK';
    buttonRowEl.appendChild(submitButtonEl);

    return { errorEl, inputEls, cancelButtonEl, submitButtonEl };
  };

  // document.body直下に、下から迫り上がるボトムシートを構築する(モバイル専用)。
  // spaceEl(getSpaceElement()で取得したフィールド一覧内の要素)には設置しない。ボトムシートは
  // レコード画面全体を覆うオーバーレイであり、フォームの一部として特定のフィールド位置に
  // 収まっている必要が無いため。
  //
  // onSubmit(values) は values(キーごとの入力値)を受け取り、
  // { success: boolean, message?: string } を解決するPromiseを返すこと。
  // success:trueならシートを閉じる。false(パスフレーズ誤り等)なら入力欄をクリアしたうえで
  // シートを開いたままエラーメッセージを表示し、その場で再入力できるようにする。
  const openBottomSheet = ({
    title,
    note,
    fields,
    submitLabel,
    cancelLabel,
    onSubmit,
  }) => {
    const backdropEl = document.createElement('div');
    backdropEl.className = cls('sheet-backdrop');

    const sheetEl = document.createElement('div');
    sheetEl.className = cls('sheet-panel');
    backdropEl.appendChild(sheetEl);

    const { errorEl, inputEls, cancelButtonEl, submitButtonEl } =
      buildSheetContent(sheetEl, {
        title,
        note,
        fields,
        submitLabel,
        cancelLabel,
      });

    document.body.appendChild(backdropEl);
    // 追加直後にクラスを付けると transition が発火しないブラウザがあるため、
    // 次フレームまで待ってからスライドインの状態に切り替える。
    requestAnimationFrame(() => {
      backdropEl.classList.add(cls('sheet-open'));
    });

    const clearInputs = () => {
      Object.values(inputEls).forEach((el) => {
        el.value = '';
      });
    };

    const close = () => {
      backdropEl.classList.remove(cls('sheet-open'));
      clearInputs();
      window.setTimeout(() => {
        if (backdropEl.parentNode) {
          backdropEl.parentNode.removeChild(backdropEl);
        }
      }, 200);
    };

    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl) {
        close();
      }
    });
    cancelButtonEl.addEventListener('click', close);

    submitButtonEl.addEventListener('click', async () => {
      const values = {};
      Object.keys(inputEls).forEach((key) => {
        values[key] = inputEls[key].value;
      });

      submitButtonEl.disabled = true;
      cancelButtonEl.disabled = true;
      try {
        const result = await onSubmit(values);
        if (result && result.success) {
          close();
          return;
        }
        errorEl.textContent =
          (result && result.message) || 'エラーが発生しました。';
        clearInputs();
      } finally {
        // clearInputs()はcloseパス・エラーパスの両方から呼ばれるため、awaitの前後で
        // inputEls側の値を読み書きしていてもrequire-atomic-updatesの対象にはならないが、
        // ボタンのdisabled解除はここでのみ行うため明示しておく。
        submitButtonEl.disabled = false;
        cancelButtonEl.disabled = false;
      }
    });

    return { close };
  };

  const UI = {
    renderSetupForm,
    getSetupPassphrase,
    getSetupConfirmPassphrase,
    isSetupFormRendered,
    renderDecryptForm,
    renderTrigger,
    setTriggerLabel,
    openBottomSheet,
    showResult,
    clearResult,
    showDecryptedField,
    clearDecryptedFields,
  };

  global.FieldEncryption = global.FieldEncryption || {};
  global.FieldEncryption.UI = UI;
})(window);
