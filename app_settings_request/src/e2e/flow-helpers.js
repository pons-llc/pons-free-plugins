'use strict';

// 依頼の作成〜「承認する」(→完了)までの、record-flow / view-flow 共通のE2Eヘルパー。
// page・envはテストのbeforeAllで決まるため、取得関数(getPage/getEnv)を受け取って遅延参照する。

const kintoneAdmin = require('../../../scripts/kintone-admin');
const ChangeRequest = require('../js/lib/change-request.js');
const { REQUEST_APP_ID } = require('./fixtures');

const makeFlowHelpers = ({ getPage, getEnv }) => {
  let page;

  let env;
  const bind = () => {
    page = getPage();
    env = getEnv();
  };

  // 依頼レコードをRESTで作成し「申請する」まで進める(承認待ち)。
  const createPendingRequest = async (change) => {
    const resp = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
      app: REQUEST_APP_ID,
      record: {
        asr_app_id: { value: change.app.id },
        asr_app_name: { value: change.app.name },
        asr_change_json: { value: ChangeRequest.serialize(change) },
      },
    });
    await kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', {
      app: REQUEST_APP_ID,
      id: resp.id,
      action: '申請する',
    });
    return resp.id;
  };

  // kintoneAdmin.getFormFields()は動作テスト環境(preview)を返すため、運用環境はRESTで直接取得する。
  const getLiveFields = async (appId) =>
    (
      await kintoneAdmin.request(env, '/k/v1/app/form/fields.json', 'GET', {
        app: appId,
      })
    ).properties;

  const getRecord = async (id) =>
    (
      await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
        app: REQUEST_APP_ID,
        id,
      })
    ).record;

  const openDetail = async (id) => {
    await page.goto('about:blank');
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${REQUEST_APP_ID}/show#record=${id}`,
      { waitUntil: 'networkidle0' },
    );
    await page.waitForSelector('.asr-detail');
  };

  // アクションボタンはReact/Closure系のハンドラーのため、実際のマウスイベントでクリックする
  // (common.goToEditScreenFromDetail()と同じ理由)。
  const clickAction = async (name) => {
    await page.waitForSelector('span.gaia-app-statusbar-action');
    const handle = await page.evaluateHandle(
      (n) =>
        Array.from(
          document.querySelectorAll('span.gaia-app-statusbar-action'),
        ).find((s) => s.innerText.trim() === n),
      name,
    );
    const box = await handle.asElement().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // アクションを押すと「次のステータス」と[キャンセル][実行]のポップアップが出る(実環境で確認)。
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('button, a, span')).some(
          (b) => b.innerText && b.innerText.trim() === '実行' && b.offsetParent,
        ),
      { timeout: 15000 },
    );
    const runHandle = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll('button, a, span')).find(
        (b) => b.innerText && b.innerText.trim() === '実行' && b.offsetParent,
      ),
    );
    const runBox = await runHandle.asElement().boundingBox();
    await page.mouse.click(
      runBox.x + runBox.width / 2,
      runBox.y + runBox.height / 2,
    );
  };

  // 完了アクションの前に出る確認ダイアログ(kintone.createDialog)に答え、本文(依頼内容の表)を返す。
  // kintone自身の[実行]ポップアップのボタンも button[name="ok"] で、確認ダイアログの裏に表示されたまま
  // 残っている(実環境で確認)ため、本文(.asr-confirm)を含むダイアログの中のボタンだけを探す。
  const answerConfirmDialog = async (answer) => {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('.asr-confirm')).some(
          (d) => d.offsetParent !== null,
        ),
      { timeout: 30000 },
    );
    return page.evaluate((name) => {
      const body = Array.from(document.querySelectorAll('.asr-confirm')).find(
        (d) => d.offsetParent !== null,
      );
      let container = body.parentElement;
      while (container && !container.querySelector(`button[name="${name}"]`)) {
        container = container.parentElement;
      }
      container.querySelector(`button[name="${name}"]`).click();
      return body.innerText;
    }, answer);
  };

  // 「承認する」→ kintoneの[実行] → 確認ダイアログに答える。
  const approve = async (answer = 'ok') => {
    await clickAction('承認する');
    return answerConfirmDialog(answer);
  };

  const waitForStatus = async (id, expected, timeoutMs = 120000) => {
    const started = Date.now();
    for (;;) {
      const record = await getRecord(id);
      if (record['ステータス'].value === expected) {
        return record;
      }
      if (Date.now() - started > timeoutMs) {
        // 失敗の原因が分かるよう、画面上に出ているエラー表示も添える
        // kintoneの画面上部のエラー表示は「エラー」という見出しで始まる(実環境で確認)
        const shown = await page.evaluate(() => {
          const text = document.body.innerText;
          const index = text.indexOf('エラー');
          return index === -1 ? '' : text.slice(index, index + 300);
        });
        throw new Error(
          `ステータスが${expected}になりません(現在: ${record['ステータス'].value}、画面のエラー: ${shown || 'なし'})`,
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const wrap =
    (fn) =>
    async (...args) => {
      bind();
      return fn(...args);
    };

  return {
    createPendingRequest: wrap(createPendingRequest),
    getLiveFields: wrap(getLiveFields),
    getRecord: wrap(getRecord),
    openDetail: wrap(openDetail),
    clickAction: wrap(clickAction),
    answerConfirmDialog: wrap(answerConfirmDialog),
    approve: wrap(approve),
    waitForStatus: wrap(waitForStatus),
  };
};

module.exports = { makeFlowHelpers };
