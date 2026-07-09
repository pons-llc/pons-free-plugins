'use strict';

// 各プラグインのPuppeteerテストから共通で使う薄いヘルパー集。
// puppeteer自体はここでは require しない(このファイルはリポジトリルートの
// scripts/e2e/ に置かれ、node_modulesを持たないため)。呼び出し元(各プラグインの
// src/e2e/*.e2e.test.js)がそのプラグインのnode_modulesからpuppeteerを読み込み、
// 生成した`page`をここの関数に渡す(依存性注入)。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const findRepoRoot = (startDir) => {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('リポジトリルート(CLAUDE.mdのある場所)が見つかりませんでした。');
    }
    dir = parent;
  }
};

// リポジトリルートの.env(git管理外)から検証環境の接続情報を読み込む。
const loadEnv = (repoRoot) => {
  const envPath = path.join(repoRoot, '.env');
  const content = fs.readFileSync(envPath, 'utf8');
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

// ビルド済みzip(dist/plugin.zip)から plugin ID を取得する(署名鍵から決まる値のため、
// kintoneにアップロードしなくても`cli-kintone plugin info`で確認できる)。
const getPluginId = (pluginSrcDir, zipRelativePath = 'dist/plugin.zip') => {
  const output = execFileSync(
    'npx',
    ['cli-kintone', 'plugin', 'info', '--input', zipRelativePath],
    { cwd: pluginSrcDir, encoding: 'utf8' }
  );
  const match = output.match(/^id:\s*(\S+)/m);
  if (!match) {
    throw new Error(`plugin idを取得できませんでした: ${output}`);
  }
  return match[1];
};

// NOTE: ログイン画面のセレクターは実際のkintone環境で未検証(ドキュメントに
// DOM構造の記載がないため)。初回実行時にPuppeteerのheadless:falseで開いて
// 実際のセレクターに合わせて調整すること。
const login = async (page, env) => {
  await page.goto(`https://${env.KINTONE_DOMAIN}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', env.KINTONE_USERNAME);
  await page.type('input[name="password"]', env.KINTONE_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ]);
};

const openPluginConfig = async (page, env, appId, pluginId) => {
  const url = `https://${env.KINTONE_DOMAIN}/k/admin/app/${appId}/plugin/config?pluginId=${pluginId}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
};

// スクリーンショットは site/plugins/<pluginName>/screenshots/ に保存し、
// 公開サイトから参照できるようにする(CLAUDE.md項目8)。
const screenshot = async (page, repoRoot, pluginName, label) => {
  const dir = path.join(repoRoot, 'site', 'plugins', pluginName, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
};

module.exports = {
  findRepoRoot,
  loadEnv,
  getPluginId,
  login,
  openPluginConfig,
  screenshot,
};
