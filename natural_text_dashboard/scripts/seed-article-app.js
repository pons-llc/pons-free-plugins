'use strict';

// natural_text_dashboard の動作確認用に、.envのARTICLE_APP_IDアプリを一時的に「案件管理」風の
// サンプルアプリとして流用し、5000件のダミーレコードを投入するワンショットスクリプト。
// ARTICLE_APP_IDは本来 articles/*/setup.js が記事ごとに白紙へ戻して使うアプリ(CLAUDE.md参照)なので、
// 次に実際の記事用に使うときはそちらのスキルで白紙化してから使うこと。
//
// 実行: node natural_text_dashboard/scripts/seed-article-app.js

const path = require('path');
const common = require('../../scripts/e2e/common');
const admin = require('../../scripts/kintone-admin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RECORD_COUNT = 5000;
const BATCH_SIZE = 100;

const REGIONS = {
  北海道: [43.06, 141.35],
  東北: [38.27, 140.87],
  関東: [35.68, 139.69],
  中部: [35.18, 136.91],
  近畿: [34.69, 135.5],
  中国: [34.4, 132.46],
  四国: [33.84, 133.53],
  九州沖縄: [33.59, 130.4],
};
const REGION_NAMES = Object.keys(REGIONS);

const CATEGORIES = ['新規', '既存', '更新', '解約'];
const PRIORITIES = ['高', '中', '低'];
const TAG_OPTIONS = ['重要', '要フォロー', '紹介', 'キャンペーン'];
const CHANNEL_OPTIONS = ['Web', '紹介', '展示会', '広告'];
const STATUSES = ['商談中', '受注', '失注', '保留'];
const ASSIGNEES = [
  '佐藤太郎', '鈴木花子', '高橋健一', '田中美咲', '伊藤大輔',
  '渡辺由美', '山本翔太', '中村愛', '小林隼人', '加藤恵',
];
const CUSTOMER_SUFFIXES = ['株式会社', '合同会社', '有限会社'];
const CUSTOMER_NAMES = [
  '青山商事', '大和物産', 'サンライズ工業', 'みらい設計', '北斗システムズ',
  '花丸フーズ', '東西トレーディング', '緑風エンジニアリング', 'すばる印刷', '柏木製作所',
  '波光通信', '若葉建設', '白鳥ロジスティクス', '桜庭メディカル', '金沢テキスタイル',
];

const FIELDS = {
  deal_name: { type: 'SINGLE_LINE_TEXT', code: 'deal_name', label: '案件名' },
  customer_name: { type: 'SINGLE_LINE_TEXT', code: 'customer_name', label: '取引先名' },
  amount: { type: 'NUMBER', code: 'amount', label: '金額', unit: '円', unitPosition: 'AFTER' },
  quantity: { type: 'NUMBER', code: 'quantity', label: '数量' },
  category: {
    type: 'DROP_DOWN', code: 'category', label: 'カテゴリ',
    options: optsOf(CATEGORIES),
  },
  priority: {
    type: 'RADIO_BUTTON', code: 'priority', label: '優先度',
    options: optsOf(PRIORITIES),
  },
  tags: {
    type: 'CHECK_BOX', code: 'tags', label: 'タグ',
    options: optsOf(TAG_OPTIONS),
  },
  channels: {
    type: 'MULTI_SELECT', code: 'channels', label: '流入チャネル',
    options: optsOf(CHANNEL_OPTIONS),
  },
  region: {
    type: 'DROP_DOWN', code: 'region', label: '地域',
    options: optsOf(REGION_NAMES),
  },
  assignee_name: {
    type: 'DROP_DOWN', code: 'assignee_name', label: '担当者',
    options: optsOf(ASSIGNEES),
  },
  deal_status: {
    type: 'DROP_DOWN', code: 'deal_status', label: 'ステータス',
    options: optsOf(STATUSES),
  },
  deal_date: { type: 'DATE', code: 'deal_date', label: '商談日' },
  closed_at: { type: 'DATETIME', code: 'closed_at', label: '成約日時' },
  notes: { type: 'MULTI_LINE_TEXT', code: 'notes', label: '備考' },
  latitude: { type: 'NUMBER', code: 'latitude', label: '緯度' },
  longitude: { type: 'NUMBER', code: 'longitude', label: '経度' },
};

function optsOf(labels) {
  const out = {};
  labels.forEach((label, i) => {
    out[label] = { label, index: String(i) };
  });
  return out;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, maxCount) {
  const count = Math.floor(Math.random() * (maxCount + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomDateWithinDays(daysAgoMax) {
  const now = Date.now();
  const past = now - Math.floor(Math.random() * daysAgoMax) * 24 * 60 * 60 * 1000;
  return new Date(past);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function buildRecord(i) {
  const region = pick(REGION_NAMES);
  const [baseLat, baseLng] = REGIONS[region];
  const dealDate = randomDateWithinDays(540); // 過去約18ヶ月
  const status = pick(STATUSES);
  const isClosed = status === '受注' || status === '失注';
  const closedAt = isClosed
    ? new Date(dealDate.getTime() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
    : null;

  return {
    deal_name: { value: `${pick(CUSTOMER_NAMES)}向け案件 #${i + 1}` },
    customer_name: { value: `${pick(CUSTOMER_NAMES)}${pick(CUSTOMER_SUFFIXES)}` },
    amount: { value: String(Math.round((5 + Math.random() * 495) * 10000)) },
    quantity: { value: String(1 + Math.floor(Math.random() * 50)) },
    category: { value: pick(CATEGORIES) },
    priority: { value: pick(PRIORITIES) },
    tags: { value: pickSome(TAG_OPTIONS, 3) },
    channels: { value: pickSome(CHANNEL_OPTIONS, 2) },
    region: { value: region },
    assignee_name: { value: pick(ASSIGNEES) },
    deal_status: { value: status },
    deal_date: { value: toDateStr(dealDate) },
    closed_at: closedAt ? { value: closedAt.toISOString() } : { value: '' },
    notes: { value: '' },
    latitude: { value: (baseLat + (Math.random() - 0.5)).toFixed(6) },
    longitude: { value: (baseLng + (Math.random() - 0.5)).toFixed(6) },
  };
}

async function main() {
  const env = common.loadEnv(REPO_ROOT);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) throw new Error('.env に ARTICLE_APP_ID が設定されていません。');

  console.log(`[1/4] app ${appId} の既存フィールド・レコードを削除して白紙化します...`);
  await admin.deleteAllRecords(env, appId);
  await admin.deleteAllFormFields(env, appId);

  console.log('[2/4] 案件管理サンプル用のフィールドを追加してデプロイします...');
  await admin.addFormFields(env, appId, FIELDS);
  await admin.deployApp(env, appId);

  console.log(`[3/4] ${RECORD_COUNT}件のサンプルレコードを生成して投入します...`);
  let inserted = 0;
  for (let i = 0; i < RECORD_COUNT; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, RECORD_COUNT); j++) {
      batch.push(buildRecord(j));
    }
    await admin.addRecords(env, appId, batch);
    inserted += batch.length;
    if (inserted % 500 === 0 || inserted === RECORD_COUNT) {
      console.log(`  ${inserted}/${RECORD_COUNT}`);
    }
  }

  console.log('[4/4] 完了。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
