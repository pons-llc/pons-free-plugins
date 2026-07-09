// カウンター専用アプリ(採番の排他制御・追記ログ)を一度だけ作成するセットアップスクリプト。
// 実行: node provisioning/seed-counter-app.js
//
// 「アプリを作成するAPI」(/k/v1/preview/app.json)はAPIトークン認証が使えないため、
// リポジトリルートの.envに書かれたパスワード(KINTONE_USERNAME/KINTONE_PASSWORD)で認証する。
// Node 18+ の組み込み fetch のみを使用し、外部npmパッケージは一切追加しない(CLAUDE.md方針9)。

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

const loadEnv = () => {
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const index = trimmed.indexOf('=');
    if (index === -1) {
      return;
    }
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  });
  return env;
};

const env = loadEnv();
const DOMAIN = env.KINTONE_DOMAIN;
const USERNAME = env.KINTONE_USERNAME;
const PASSWORD = env.KINTONE_PASSWORD;

if (!DOMAIN || !USERNAME || !PASSWORD) {
  console.error(
    '.envにKINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORDを設定してください。'
  );
  process.exit(1);
}

const AUTH_HEADER = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const request = async (urlPath, method, body) => {
  const res = await fetch(`https://${DOMAIN}${urlPath}`, {
    method,
    headers: {
      'X-Cybozu-Authorization': AUTH_HEADER,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} failed: ${JSON.stringify(json)}`);
  }
  return json;
};

const FIELD_PROPERTIES = {
  key_sequence: {
    type: 'SINGLE_LINE_TEXT',
    code: 'key_sequence',
    label: '一意キー(combination_key::連番)',
    required: true,
    unique: true,
  },
  combination_key: {
    type: 'SINGLE_LINE_TEXT',
    code: 'combination_key',
    label: '組み合わせキー(対象アプリID::年度::セグメント)',
    required: true,
  },
  sequence_number: {
    type: 'NUMBER',
    code: 'sequence_number',
    label: '連番',
    required: true,
  },
  target_app_id: {
    type: 'NUMBER',
    code: 'target_app_id',
    label: '対象アプリID',
  },
  fiscal_year: {
    type: 'NUMBER',
    code: 'fiscal_year',
    label: '会計年度',
  },
  era_code: {
    type: 'SINGLE_LINE_TEXT',
    code: 'era_code',
    label: '元号コード',
  },
  era_year: {
    type: 'NUMBER',
    code: 'era_year',
    label: '元号年',
  },
  segment_summary: {
    type: 'MULTI_LINE_TEXT',
    code: 'segment_summary',
    label: 'セグメント内容(監査用)',
  },
};

const waitForDeploySuccess = async (appId) => {
  for (;;) {
    const status = await request(
      `/k/v1/preview/app/deploy.json?apps%5B0%5D=${appId}`,
      'GET'
    );
    const appStatus = status.apps.find((a) => String(a.app) === String(appId));
    if (appStatus.status === 'SUCCESS') {
      return;
    }
    if (appStatus.status === 'FAIL') {
      throw new Error(`アプリ(${appId})のデプロイに失敗しました。`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

(async () => {
  console.log('1/4 カウンター専用アプリを作成しています...');
  const created = await request('/k/v1/preview/app.json', 'POST', {
    name: '採番カウンター(fiscal_year_numbering)',
  });
  const appId = created.app;
  console.log(`  -> アプリID: ${appId}`);

  console.log('2/4 フィールドを追加しています...');
  await request('/k/v1/preview/app/form/fields.json', 'POST', {
    app: appId,
    properties: FIELD_PROPERTIES,
  });

  console.log('3/4 一般権限を「閲覧+作成のみ(編集・削除は不可)」に設定しています...');
  await request('/k/v1/preview/app/acl.json', 'PUT', {
    app: appId,
    rights: [
      {
        entity: { type: 'GROUP', code: 'everyone' },
        appEditable: false,
        recordViewable: true,
        recordAddable: true,
        recordEditable: false,
        recordDeletable: false,
        recordImportable: false,
        recordExportable: false,
      },
      {
        entity: { type: 'CREATOR' },
        appEditable: true,
        recordViewable: true,
        recordAddable: true,
        recordEditable: true,
        recordDeletable: true,
        recordImportable: true,
        recordExportable: true,
      },
    ],
  });

  console.log('4/4 運用環境へ反映しています...');
  await request('/k/v1/preview/app/deploy.json', 'POST', { apps: [{ app: appId }] });
  await waitForDeploySuccess(appId);

  console.log('');
  console.log(`完了しました。カウンター専用アプリID: ${appId}`);
  console.log(
    'このIDを fiscal_year_numbering プラグインの設定画面「カウンター専用アプリID」に入力してください。'
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
