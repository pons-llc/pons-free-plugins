'use strict';

// crypto-codec.js が使う crypto.subtle (Web Crypto API) は、Node標準ではグローバルの
// crypto に存在しないバージョンがあるため、Node組み込みのwebcrypto実装を明示的に注入する。
// このリポジトリでWeb Crypto APIを使うのは本プラグインが初めてのため、他のプラグインの
// jest.config.jsにはこの設定はない。
if (!global.crypto || !global.crypto.subtle) {
  global.crypto = require('node:crypto').webcrypto;
}
