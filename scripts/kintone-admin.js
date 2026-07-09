'use strict';

// kintoneアプリの管理系REST APIをまとめた共通ツール。プラグイン開発時に検証環境アプリへ
// フィールドを追加/削除したり、動作テスト環境→運用環境へデプロイしたりする用途で、
// provisioning/*.js や各プラグインのe2eテストのセットアップから共通で使う。
// パスワード認証(X-Cybozu-Authorization)のみを使う。「アプリを作成するAPI」がAPIトークン
// 認証を利用できない仕様のため、他のAPIもすべて同じ認証方式に統一している。
//
// 依存パッケージなし(Node標準の https のみ)。呼び出し側は scripts/e2e/common.js の
// loadEnv()/findRepoRoot() で読み込んだ .env の内容(env)をそのまま渡す。

const https = require('https');

const normalizeDomain = (domain) => domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

// GET/DELETEはクエリ文字列、POST/PUTはJSONボディで送る(kintone REST APIの仕様通り)。
const request = (env, path, method, body) =>
  new Promise((resolve, reject) => {
    const domain = normalizeDomain(env.KINTONE_DOMAIN);
    const auth = Buffer.from(`${env.KINTONE_USERNAME}:${env.KINTONE_PASSWORD}`).toString(
      'base64'
    );
    const headers = { 'X-Cybozu-Authorization': auth };
    let data;
    let fullPath = path;

    if (method === 'GET' || method === 'DELETE') {
      if (body) {
        fullPath += (path.includes('?') ? '&' : '?') + toQueryString(body);
      }
    } else if (body !== undefined) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(
      { hostname: domain, path: fullPath, method, headers },
      (res) => {
        let chunks = '';
        res.on('data', (c) => {
          chunks += c;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(chunks ? JSON.parse(chunks) : {});
          } else {
            reject(new Error(`${method} ${path} -> ${res.statusCode}: ${chunks}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });

// { app: 1, fields: ['a', 'b'] } のようなオブジェクトを、配列を展開したクエリ文字列にする
// (kintone REST APIのGET/DELETEでの配列パラメーターの指定方法に合わせる)。
const toQueryString = (params) => {
  const pairs = [];
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => pairs.push(`${key}[${i}]=${encodeURIComponent(v)}`));
    } else if (value !== undefined) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  return pairs.join('&');
};

// --- アプリのフィールド操作(動作テスト環境) ---

const getFormFields = (env, appId) =>
  request(env, '/k/v1/preview/app/form/fields.json', 'GET', { app: appId }).then(
    (res) => res.properties
  );

const addFormFields = (env, appId, properties, revision) =>
  request(env, '/k/v1/preview/app/form/fields.json', 'POST', {
    app: appId,
    properties,
    revision,
  });

const deleteFormFields = (env, appId, fieldCodes, revision) =>
  request(env, '/k/v1/preview/app/form/fields.json', 'DELETE', {
    app: appId,
    fields: fieldCodes,
    revision,
  });

// --- アプリ作成・デプロイ ---

// 「アプリを作成するAPI」はAPIトークン認証が使えない仕様(このモジュールがパスワード認証のみな理由)。
const createApp = (env, name) =>
  request(env, '/k/v1/preview/app.json', 'POST', { name });

const updateAppPermissions = (env, appId, rights, revision) =>
  request(env, '/k/v1/preview/app/acl.json', 'PUT', { app: appId, rights, revision });

const addPlugin = (env, appId, pluginId, revision) =>
  request(env, '/k/v1/preview/app/plugins.json', 'POST', {
    app: appId,
    ids: [pluginId],
    revision,
  });

const deployApp = async (env, appId) => {
  await request(env, '/k/v1/preview/app/deploy.json', 'POST', { apps: [{ app: appId }] });
  for (;;) {
    const status = await request(env, '/k/v1/preview/app/deploy.json', 'GET', {
      apps: [appId],
    });
    const appStatus = status.apps.find((a) => String(a.app) === String(appId));
    if (appStatus.status === 'SUCCESS') {
      return;
    }
    if (appStatus.status === 'FAIL') {
      throw new Error(`アプリ(${appId})のデプロイに失敗しました。`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
};

// 指定したフィールドコードがすべて存在するかを確認し、なければ追加してデプロイする
// (冪等: 既にあるフィールドは触らない)。E2Eテストのセットアップで使う想定。
const ensureFormFields = async (env, appId, properties) => {
  const existing = await getFormFields(env, appId);
  const missing = Object.keys(properties).filter((code) => !existing[code]);
  if (missing.length === 0) {
    return { added: [] };
  }
  const toAdd = {};
  missing.forEach((code) => {
    toAdd[code] = properties[code];
  });
  await addFormFields(env, appId, toAdd);
  await deployApp(env, appId);
  return { added: missing };
};

module.exports = {
  request,
  getFormFields,
  addFormFields,
  deleteFormFields,
  createApp,
  updateAppPermissions,
  addPlugin,
  deployApp,
  ensureFormFields,
};
