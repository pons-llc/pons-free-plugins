(function (root) {
  'use strict';

  // 編集画面のセッション内(画面を開いてから保存/離脱するまでの間だけ)の状態管理。
  // パスフレーズ・復号済みかどうかはここにのみ保持し、どこにも永続化しない
  // (edit.show/edit.submitの間、desktop.js側のクロージャ変数として持ち回す想定)。
  //
  // 「復号しなかった暗号化済みフィールドはsubmit時に元の暗号文を復元する」を怠ると、
  // マスク用のプレースホルダー文字列がそのまま保存されてデータが失われるため、これが
  // このモジュールの最重要の責務。

  const createSession = () => ({ fields: {}, passphrase: undefined });

  // edit.show時点の値をキャプチャする。wasEncryptedは、その時点で既に暗号化済みだったかどうか
  // (BlobCodec.isEncrypted()の結果を呼び出し側から渡す)。
  const captureField = (
    session,
    fieldCode,
    { originalValue, wasEncrypted },
  ) => {
    session.fields[fieldCode] = {
      originalValue,
      wasEncrypted,
      decrypted: false,
      passphrase: undefined,
    };
  };

  // 1レコード1パスフレーズの不変条件: このセッションでは常にセッション直下の1つの値として
  // パスフレーズを保持する(フィールドごとに別々には持たない)。
  const markDecrypted = (session, fieldCode, passphrase) => {
    const entry = session.fields[fieldCode];
    if (entry) {
      entry.decrypted = true;
    }
    session.passphrase = passphrase;
  };

  // 復号を経由しない場合(暗号化対象フィールドがまだ1つも暗号化されていないレコードで、新規に
  // パスフレーズを設定する場合)にもgetSharedPassphrase()から同じ値を取得できるようにする
  // (モバイルのボトムシートでのパスフレーズ設定フローが使う、idea.md「モバイル対応」参照)。
  const setPassphrase = (session, passphrase) => {
    session.passphrase = passphrase;
  };

  const getSharedPassphrase = (session) => session.passphrase;

  // edit.submit時に、各対象フィールドに対して何をすべきかを判定する。
  //   - restore-original: このセッションで復号しなかった暗号化済みフィールド。
  //     プレースホルダーではなく元の暗号文をそのまま保存する。
  //   - reencrypt: このセッションで復号したフィールド。同じパスフレーズ(getSharedPassphrase()で
  //     取得)で、新しいsalt/IVを使って再暗号化する。
  //   - encrypt-new: edit.show時点では平文だったフィールドに値がある場合。共有パスフレーズが
  //     使えるかどうかは呼び出し側がgetSharedPassphrase()で別途判定し、使えなければ保存をブロックする。
  //   - leave-as-is: 保護すべき値が無い(空のまま)、またはこのプラグインの対象外のフィールドコード。
  const resolveSubmitAction = (session, fieldCode, currentValue) => {
    const entry = session.fields[fieldCode];
    if (!entry) {
      return { action: 'leave-as-is', value: currentValue };
    }
    if (entry.wasEncrypted) {
      if (entry.decrypted) {
        return { action: 'reencrypt', plaintext: currentValue };
      }
      return { action: 'restore-original', value: entry.originalValue };
    }
    if (currentValue) {
      return { action: 'encrypt-new', plaintext: currentValue };
    }
    return { action: 'leave-as-is', value: currentValue };
  };

  const SessionStore = {
    createSession,
    captureField,
    markDecrypted,
    setPassphrase,
    getSharedPassphrase,
    resolveSubmitAction,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionStore;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.SessionStore = SessionStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
