'use strict';

const SessionStore = require('../js/lib/session-store');

// 編集画面の最重要ロジック: 「復号しなかった暗号化済みフィールドは元の暗号文をsubmit時に復元する」
// 「復号したフィールドは同じパスフレーズで再暗号化する」の判定を、kintone非依存でテストする。

describe('SessionStore', () => {
  test('captureFieldしただけ(復号していない)の暗号化済みフィールドはrestore-originalになる', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'secret', {
      originalValue: 'FE1:元の暗号文',
      wasEncrypted: true,
    });

    const result = SessionStore.resolveSubmitAction(
      session,
      'secret',
      '🔒 暗号化されています(プレースホルダー)',
    );
    expect(result).toEqual({
      action: 'restore-original',
      value: 'FE1:元の暗号文',
    });
  });

  test('復号して値を変更したフィールドはreencryptになる', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'secret', {
      originalValue: 'FE1:元の暗号文',
      wasEncrypted: true,
    });
    SessionStore.markDecrypted(session, 'secret', 'my-passphrase');

    const result = SessionStore.resolveSubmitAction(
      session,
      'secret',
      '編集後の値',
    );
    expect(result).toEqual({ action: 'reencrypt', plaintext: '編集後の値' });
  });

  test('元々平文で、編集後も値がある場合はencrypt-newになる(パスフレーズが使えるかはgetSharedPassphraseで別途判定)', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'memo', {
      originalValue: '平文のまま',
      wasEncrypted: false,
    });

    const result = SessionStore.resolveSubmitAction(
      session,
      'memo',
      '平文のまま',
    );
    expect(result).toEqual({ action: 'encrypt-new', plaintext: '平文のまま' });
  });

  test('元々平文で、編集後も空のままならleave-as-isになる(保護すべき値が無い)', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'memo', {
      originalValue: '',
      wasEncrypted: false,
    });

    const result = SessionStore.resolveSubmitAction(session, 'memo', '');
    expect(result).toEqual({ action: 'leave-as-is', value: '' });
  });

  test('captureFieldされていないフィールドコードはleave-as-isにフォールバックする', () => {
    const session = SessionStore.createSession();
    const result = SessionStore.resolveSubmitAction(
      session,
      'untouched',
      '何か',
    );
    expect(result).toEqual({ action: 'leave-as-is', value: '何か' });
  });

  test('getSharedPassphrase()は何も復号していなければundefinedを返す', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'secret', {
      originalValue: 'FE1:暗号文',
      wasEncrypted: true,
    });
    expect(SessionStore.getSharedPassphrase(session)).toBeUndefined();
  });

  test('getSharedPassphrase()は復号済みフィールドがあればそのパスフレーズを返す', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'a', {
      originalValue: 'FE1:a',
      wasEncrypted: true,
    });
    SessionStore.captureField(session, 'b', {
      originalValue: 'FE1:b',
      wasEncrypted: true,
    });
    SessionStore.markDecrypted(session, 'a', 'shared-pass');

    expect(SessionStore.getSharedPassphrase(session)).toBe('shared-pass');
  });

  test('getSharedPassphrase()は複数フィールドを復号しても同一のパスフレーズを返す(1レコード1パスフレーズの不変条件)', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'a', {
      originalValue: 'FE1:a',
      wasEncrypted: true,
    });
    SessionStore.captureField(session, 'b', {
      originalValue: 'FE1:b',
      wasEncrypted: true,
    });
    SessionStore.markDecrypted(session, 'a', 'shared-pass');
    SessionStore.markDecrypted(session, 'b', 'shared-pass');

    expect(SessionStore.getSharedPassphrase(session)).toBe('shared-pass');
  });

  test('setPassphrase()は復号を経由せずにgetSharedPassphrase()から取得できる値を設定する(モバイルの設定ボトムシート用)', () => {
    const session = SessionStore.createSession();
    SessionStore.captureField(session, 'memo', {
      originalValue: '',
      wasEncrypted: false,
    });

    expect(SessionStore.getSharedPassphrase(session)).toBeUndefined();
    SessionStore.setPassphrase(session, 'new-passphrase');
    expect(SessionStore.getSharedPassphrase(session)).toBe('new-passphrase');
  });
});
