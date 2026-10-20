'use strict';

// genogram のE2Eで使う、TEST_APP_ID_2 の準備と設定画面での保存。
// TEST_APP_ID_2 は他プラグインのE2Eと共用のため、既存のフィールド・レイアウトは書き換えず、
// このプラグイン専用のフィールド(文字列(複数行))とスペースを無ければ追加するだけにする(冪等)。
// (既存の文字列(複数行) dback_archive_json は delete_backup のE2E用なので使わない)

const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const JSON_FIELD = 'genogram_json';
const SPACE_ID = 'genogram_space';

// 図はスペースの幅で表示されるため、実際の運用に合わせて1行に単独・幅広のスペースを置く
// (kintone-admin.js の ensureSpacerInLayout() は幅200固定のため使わない)。
const ensureFixtures = async (env, appId) => {
  await kintoneAdmin.ensureFormFields(env, appId, {
    [JSON_FIELD]: {
      type: 'MULTI_LINE_TEXT',
      code: JSON_FIELD,
      label: 'ジェノグラムデータ(E2E)',
    },
  });
  const { layout, revision } = await kintoneAdmin.getFormLayout(env, appId);
  const hasSpace = (rows) =>
    rows.some((row) =>
      row.type === 'GROUP'
        ? hasSpace(row.layout || [])
        : (row.fields || []).some(
            (f) => f.type === 'SPACER' && f.elementId === SPACE_ID,
          ),
    );
  if (!hasSpace(layout)) {
    await kintoneAdmin.updateFormLayout(
      env,
      appId,
      [
        ...layout,
        {
          type: 'ROW',
          fields: [
            {
              type: 'SPACER',
              elementId: SPACE_ID,
              size: { width: '1100', height: '100' },
            },
          ],
        },
      ],
      revision,
    );
    await kintoneAdmin.deployApp(env, appId);
  }
};

// 設定画面で2項目を選んで保存し、デプロイする(setConfig()はデプロイまでプレビューにしか反映されない)。
const configureViaScreen = async (page, env, appId, pluginId) => {
  await common.openPluginConfig(page, env, appId, pluginId);
  await page.waitForSelector(`#js-json-field option[value="${JSON_FIELD}"]`, {
    timeout: 15000,
  });
  await page.select('#js-json-field', JSON_FIELD);
  await page.select('#js-space', SPACE_ID);
  await page.$eval('#js-hide-json', (el) => {
    el.checked = true;
  });
  await Promise.all([
    page.waitForFunction(() => !location.href.includes('plugin/config'), {
      timeout: 20000,
    }),
    page.$eval('.js-save-button', (el) => el.click()),
  ]);
  await kintoneAdmin.deployApp(env, appId);
};

module.exports = { JSON_FIELD, SPACE_ID, ensureFixtures, configureViaScreen };
