'use strict';

// アプリ設定変更依頼プラグインの紹介動画:
//   ① フィールドの設定変更(件名を必須にする)を依頼 → 申請 → 承認(確認ダイアログ)→ 対象アプリに反映
//   ② 一覧画面で絞り込み・並べ替えたURLから一覧の作成を依頼 → 承認 → 対象アプリに一覧ができる
// までを録画する。検証環境の専用アプリ(依頼アプリ790 / 変更対象アプリ791。e2e/fixtures.js参照)を使う。
//
// 録画の仕組みは articles/genogram-case-example/record-video.js と同じ(ffmpeg等の追加インストール不要):
//   1. Chrome DevTools Protocol の Page.startScreencast でタイムスタンプ付きJPEGを保存
//   2. macOS標準の AVFoundation で30fps固定のH.264 MP4に書き出す(encode-mp4.swift を swift で実行)
// 画面には疑似カーソル・クリックの波紋・手順の字幕を重ねる(録画用の表示のみ)。
//
// 実行: NODE_PATH=app_settings_request/src/node_modules node app_settings_request/demo/record-video.js
// 出力: app_settings_request/demo/video/app-settings-request.mp4

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');
const {
  REQUEST_APP_ID,
  TARGET_APP_ID,
  resetTargetApp,
  ensureRequestApp,
} = require('../src/e2e/fixtures');

const VIEW = { width: 1440, height: 900 };
const SPEED = 1.5; // 完成動画の再生速度(録画時の何倍か)
const TYPE_DELAY = 90; // 1文字の入力間隔(ms)
const OUT_DIR = path.join(__dirname, 'video');
const OUT_BASENAME = 'app-settings-request';
const DEMO_VIEW_NAME = '見積案件(金額の大きい順)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- 録画用の表示(疑似カーソル・波紋・字幕)。ページ遷移のたびに入れ直す ----
const installOverlay = () => {
  // kintoneは画面の一部だけを描き直すことがあるため、関数の有無で判定し、残骸は消してから入れ直す
  if (window.__demoCaption && document.getElementById('demo-caption')) {
    return;
  }
  ['demo-overlay-style', 'demo-cursor', 'demo-caption'].forEach((id) => {
    const old = document.getElementById(id);
    if (old) {
      old.remove();
    }
  });
  const style = document.createElement('style');
  style.id = 'demo-overlay-style';
  style.textContent = [
    '#demo-cursor{position:fixed;left:0;top:0;width:22px;height:30px;z-index:2147483647;pointer-events:none;transition:none;}',
    '.demo-ripple{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:3px solid rgba(231,76,60,.85);z-index:2147483646;pointer-events:none;animation:demo-ripple .5s ease-out forwards;}',
    '@keyframes demo-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}',
    '#demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;max-width:1100px;padding:14px 28px;border-radius:12px;background:rgba(20,30,40,.86);color:#fff;font:bold 24px/1.5 "Hiragino Sans","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.25);}',
    '#demo-caption small{display:block;font-weight:normal;font-size:17px;opacity:.85;}',
    '#demo-caption[hidden]{display:none;}',
  ].join('');
  document.head.appendChild(style);

  const NS = 'http://www.w3.org/2000/svg';
  const cursor = document.createElementNS(NS, 'svg');
  cursor.id = 'demo-cursor';
  cursor.setAttribute('viewBox', '0 0 22 30');
  const arrow = document.createElementNS(NS, 'path');
  arrow.setAttribute('d', 'M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z');
  arrow.setAttribute('fill', '#111');
  arrow.setAttribute('stroke', '#fff');
  arrow.setAttribute('stroke-width', '1.6');
  cursor.appendChild(arrow);
  document.body.appendChild(cursor);
  const moveCursor = (x, y) => {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  moveCursor(window.__demoX || 720, window.__demoY || 450);
  document.addEventListener(
    'mousemove',
    (e) => {
      window.__demoX = e.clientX;
      window.__demoY = e.clientY;
      moveCursor(e.clientX, e.clientY);
    },
    true,
  );
  window.__demoRipple = (x, y) => {
    const ripple = document.createElement('div');
    ripple.className = 'demo-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };
  document.addEventListener(
    'mousedown',
    (e) => window.__demoRipple(e.clientX, e.clientY),
    true,
  );

  const caption = document.createElement('div');
  caption.id = 'demo-caption';
  caption.hidden = true;
  document.body.appendChild(caption);
  window.__demoCaption = (title, sub) => {
    caption.textContent = '';
    if (!title) {
      caption.hidden = true;
      return;
    }
    caption.appendChild(document.createTextNode(title));
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      caption.appendChild(small);
    }
    caption.hidden = false;
  };
};

// 録画の前に、変更対象アプリを「件名: 任意」・デモ用の一覧なし・デモ用のレコードの状態にそろえる
// (791は本プラグイン専用の検証アプリ。レコードはデモ用に入れ直す)。
const prepare = async (env) => {
  await ensureRequestApp(env, env.KINTONE_USERNAME);
  await resetTargetApp(env);
  const views = (
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'GET', {
      app: TARGET_APP_ID,
    })
  ).views;
  if (views[DEMO_VIEW_NAME]) {
    delete views[DEMO_VIEW_NAME];
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', {
      app: TARGET_APP_ID,
      views,
    });
    await kintoneAdmin.deployApp(env, TARGET_APP_ID);
  }
  await kintoneAdmin.deleteAllRecords(env, TARGET_APP_ID);
  await kintoneAdmin.addRecords(
    env,
    TARGET_APP_ID,
    [
      ['【見積】A社 システム改修', '1200000', 'A'],
      ['【請求】B社 保守 10月分', '80000', 'B'],
      ['【見積】C社 ライセンス追加', '350000', 'B'],
      ['【見積】D社 研修', '600000', 'A'],
      ['【請求】E社 開発 第2期', '1500000', 'A'],
    ].map(([title, amount, kind]) => ({
      title: { value: title },
      amount: { value: amount },
      kind: { value: kind },
    })),
  );
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  await prepare(env);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-frames-'));

  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${VIEW.width},${VIEW.height}`],
  });
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', (dialog) => dialog.accept());
  const base = `https://${env.KINTONE_DOMAIN}`;

  // ---- 操作のヘルパー ----
  const overlay = () => page.evaluate(installOverlay);
  const caption = async (title, sub, hold = 1200) => {
    await page.evaluate(installOverlay);
    await page.evaluate((t, s) => window.__demoCaption(t, s), title, sub || '');
    await sleep(hold);
  };
  const goto = async (url, waitSelector) => {
    await page.goto(url, { waitUntil: 'networkidle0' });
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 30000 });
    }
    await overlay();
  };
  const glide = async (x, y) => {
    const from = await page.evaluate(() => [window.__demoX || 720, window.__demoY || 450]);
    const dist = Math.hypot(x - from[0], y - from[1]);
    await page.mouse.move(x, y, { steps: Math.max(8, Math.min(35, Math.round(dist / 18))) });
  };
  // kintoneの固定ヘッダー・字幕に隠れないよう、必要なときだけ画面中央へスクロールする
  const ensureVisible = async (handle) => {
    const rect = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    if (rect.top < 150 || rect.bottom > rect.vh - 130) {
      await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await sleep(800);
    }
  };
  const clickHandle = async (handle) => {
    await ensureVisible(handle);
    const box = await handle.boundingBox();
    await glide(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(150);
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
    await sleep(380);
  };
  const click = async (selector) =>
    clickHandle(await page.waitForSelector(selector, { visible: true, timeout: 20000 }));
  const clickByText = async (selector, text) => {
    const handle = await page.waitForFunction(
      (sel, t) =>
        Array.from(document.querySelectorAll(sel)).find(
          (el) => el.offsetParent !== null && el.innerText.trim() === t,
        ),
      { timeout: 20000 },
      selector,
      text,
    );
    await clickHandle(handle.asElement());
  };
  const typeInto = async (selector, text) => {
    await click(selector);
    await page.keyboard.type(text, { delay: TYPE_DELAY });
    await sleep(250);
  };
  // ヘッドレスではプルダウンの一覧が描画されないため、カーソルを合わせて波紋を出してから値を選ぶ
  const choose = async (selector, value) => {
    const handle = await page.waitForSelector(selector, { visible: true });
    await ensureVisible(handle);
    const box = await handle.boundingBox();
    await glide(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate((x, y) => window.__demoRipple(x, y), box.x + box.width / 2, box.y + box.height / 2);
    await sleep(300);
    await page.select(selector, value);
    await sleep(500);
  };
  const scrollToTop = async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(700);
  };
  const scrollToEl = async (selector, offset = 140) => {
    await page.evaluate(
      (sel, off) => {
        const el = document.querySelector(sel);
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      },
      selector,
      offset,
    );
    await sleep(900);
  };
  // 依頼理由(文字列複数行)の入力欄はラベルの文字で探す
  const reasonInput = () =>
    page.evaluateHandle(() => {
      const label = Array.from(document.querySelectorAll('span, div')).find(
        (el) => el.children.length === 0 && el.textContent.trim() === '依頼理由',
      );
      let box = label;
      while (box && !box.querySelector('textarea')) {
        box = box.parentElement;
      }
      return box.querySelector('textarea');
    });
  const saveRecord = async () => {
    await scrollToTop();
    await click('button.gaia-ui-actionmenu-save');
    await page.waitForFunction(() => location.href.includes('/show'), { timeout: 30000 });
    await page.waitForSelector('.asr-detail', { timeout: 30000 });
    await overlay();
  };
  // プロセス管理のアクション → kintoneの[実行]
  const runAction = async (name) => {
    await scrollToTop();
    await clickByText('span.gaia-app-statusbar-action', name);
    await sleep(500);
    await clickByText('button[name="ok"]', '実行');
  };
  // ステータスの変化はRESTで確かめる(画面の表示文言に依存しない)。失敗時は画面を保存して原因を見られるようにする。
  const waitStatus = async (status) => {
    const id = new URL(page.url()).hash.match(/record=(\d+)/)[1];
    const started = Date.now();
    for (;;) {
      const { record } = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
        app: REQUEST_APP_ID,
        id,
      });
      if (record['ステータス'].value === status) {
        await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 }).catch(() => {});
        await page.waitForSelector('.asr-detail', { timeout: 30000 });
        await overlay();
        return;
      }
      if (Date.now() - started > 90000) {
        await page.screenshot({ path: path.join(OUT_DIR, 'debug-wait-status.png') });
        throw new Error(`ステータスが${status}になりません(現在: ${record['ステータス'].value})`);
      }
      await sleep(1000);
    }
  };

  // ---- 録画(CDPのスクリーンキャスト) ----
  const times = [];
  const client = await page.target().createCDPSession();
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    fs.writeFileSync(path.join(frameDir, `${times.length}.jpg`), Buffer.from(data, 'base64'));
    times.push(metadata.timestamp);
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  try {
    await common.login(page, env);
    await goto(`${base}/k/${REQUEST_APP_ID}/edit`, '.asr-editor');
    await page.mouse.move(720, 450);

    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 85,
      maxWidth: VIEW.width,
      maxHeight: VIEW.height,
      everyNthFrame: 1,
    });
    const recordStartWall = Date.now() / 1000;

    // ===== ① フィールドの設定変更 =====
    await caption('アプリ設定変更依頼プラグイン', 'アプリの設定変更をレコードで依頼・承認し、承認されたら自動で反映します', 3500);
    await caption('① 対象アプリをアプリ名で検索', '', 600);
    await typeInto('.asr-js-keyword', '変更対象');
    await click('.asr-js-search');
    await page.waitForSelector(`.asr-js-app-results option[value="${TARGET_APP_ID}"]`);
    await choose('.asr-js-app-results', TARGET_APP_ID);
    await page.waitForSelector('.asr-js-field option[value="title"]', { timeout: 30000 });

    await caption('② フィールドと変更内容を選ぶ', '選べる変更内容は、フィールドの種類に合わせて自動で絞り込まれます', 900);
    await choose('.asr-js-field', 'title');
    await choose('.asr-js-operation', 'required');
    await sleep(600);
    await caption('「件名」を必須項目にする依頼', '現在の設定(任意)も表示されます', 1600);
    await clickHandle(await reasonInput());
    await page.keyboard.type('件名の入力漏れが多いため', { delay: TYPE_DELAY });
    await sleep(300);

    await caption('保存して、申請します', '', 600);
    await saveRecord();
    await scrollToEl('.asr-detail');
    await caption('詳細画面に依頼内容が表示されます', '承認者はこの内容を見て判断します', 2600);
    await runAction('申請する');
    await waitStatus('承認待ち');
    await sleep(800);

    await caption('③ 承認者が「承認する」', 'ステータスが「完了」になるときに、対象アプリへ反映します', 1200);
    await runAction('承認する');
    await page.waitForSelector('.asr-confirm', { visible: true, timeout: 20000 });
    await caption('反映前に、変更内容をあらためて確認', '「反映する」を押すと、承認者の権限で設定を変更し、アプリを更新します', 3000);
    await clickByText('button[name="ok"]', '反映する');
    await caption('対象アプリの管理権限を確認 → 設定を変更 → アプリを更新', '', 600);
    await waitStatus('完了');
    await page.waitForSelector('.asr-detail');
    await overlay();
    await scrollToEl('.asr-detail');
    await sleep(600);
    // 反映結果のフィールドまでゆっくり下げる
    await page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' }));
    await caption('完了! 反映結果と反映日時が記録されます', '', 2800);

    await caption('対象アプリを開くと…', '', 600);
    await goto(`${base}/k/${TARGET_APP_ID}/edit`, '.control-gaia');
    await sleep(600);
    await caption('「件名」が必須項目(*)になりました', '', 3000);

    // ===== ② 一覧の作成 =====
    await caption('② 一覧の作成も依頼できます', 'まず対象アプリの一覧画面で、絞り込みと並べ替えをします', 1500);
    await goto(`${base}/k/${TARGET_APP_ID}/`, 'button.gaia-argoui-app-filterbutton');
    await sleep(800);
    await click('button.gaia-argoui-app-filterbutton');
    await sleep(1500);
    const pick = async (index, label) => {
      const combos = await page.$$('.gaia-argoui-app-filter-dialog .gaia-ui-fieldselect-combobox input');
      const combo = index === -1 ? combos[combos.length - 1] : combos[index];
      await clickHandle(combo);
      await combo.click({ clickCount: 3 });
      await page.keyboard.type(label, { delay: TYPE_DELAY });
      await sleep(800);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await sleep(900);
    };
    await caption('条件「件名に『見積』を含む」', '', 600);
    await pick(0, '件名');
    // 演算子(文字列の初期値は「=(等しい)」)を「次のキーワードを含む」に変える
    await click('.gaia-argoui-app-filter-dialog .filter-item-input-gaia .gaia-argoui-select');
    await sleep(500);
    await clickByText('.goog-menuitem', '次のキーワードを含む');
    const valueInput = await page.$('.gaia-argoui-app-filter-dialog .filter-item-input-gaia input[type="text"]');
    await clickHandle(valueInput);
    await page.keyboard.type('見積', { delay: TYPE_DELAY });
    await caption('並び順「金額の降順」', '', 600);
    await pick(-1, '金額');
    await clickByText('.gaia-argoui-app-filter-dialog button', '適用');
    await page.waitForFunction(() => location.search.includes('q='), { timeout: 20000 });
    await sleep(1000);
    const listUrl = page.url();
    await caption('このページのURLをコピーします', 'URLには絞り込み条件・並び順が含まれています', 2400);

    await goto(`${base}/k/${REQUEST_APP_ID}/edit`, '.asr-editor');
    await caption('依頼画面で「一覧」を選ぶ', '', 600);
    await typeInto('.asr-js-app-id', TARGET_APP_ID);
    await click('.asr-js-load-id');
    await page.waitForSelector('.asr-js-field option[value="title"]', { timeout: 30000 });
    await click('input.asr-js-target-kind[value="view"]');
    await page.waitForSelector('.asr-view-editor[data-loaded="1"]');
    await choose('.asr-js-view-op', 'viewCreate');
    await typeInto('.asr-js-view-name', DEMO_VIEW_NAME);
    await caption('コピーしたURLを貼り付けて「変換」', '', 600);
    await click('.asr-js-view-url');
    await page.$eval(
      '.asr-js-view-url',
      (el, url) => {
        el.value = url;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      listUrl,
    );
    await sleep(600);
    await click('.asr-js-view-convert');
    await page.waitForSelector('.asr-converted', { timeout: 40000 });
    await sleep(400);
    await caption('絞り込み条件と並び順に変換されました', '表示するフィールドも選べます', 3000);

    await clickHandle(await reasonInput());
    await page.keyboard.type('見積中の案件を金額順に確認したい', { delay: TYPE_DELAY });
    await saveRecord();
    await scrollToEl('.asr-detail');
    await caption('申請 → 承認', '', 1800);
    await runAction('申請する');
    await waitStatus('承認待ち');
    await sleep(600);
    await runAction('承認する');
    await page.waitForSelector('.asr-confirm', { visible: true, timeout: 20000 });
    await caption('確認ダイアログで内容を確認して「反映する」', '', 2400);
    await clickByText('button[name="ok"]', '反映する');
    await waitStatus('完了');
    await sleep(1200);

    await caption('対象アプリに、新しい一覧ができました', '', 600);
    const views = (
      await kintoneAdmin.request(env, '/k/v1/app/views.json', 'GET', { app: TARGET_APP_ID })
    ).views;
    const created = views[DEMO_VIEW_NAME];
    await goto(`${base}/k/${TARGET_APP_ID}/?view=${created.id}`, '.recordlist-row-gaia, .recordlist-gaia');
    await sleep(3200);
    await caption('アプリ設定変更依頼プラグイン', 'GovAppsプラグイン ― 無料・広告なし・オープンソース', 4000);

    await client.send('Page.stopScreencast');
    const recordEndWall = Date.now() / 1000;
    console.log(`録画したフレーム数: ${times.length}`);
    if (pageErrors.length > 0) {
      console.warn('ページエラー:', pageErrors);
    }
    await page.screenshot({ path: path.join(OUT_DIR, `${OUT_BASENAME}-final.png`) });

    // ---- 動画に変換(macOS標準のAVFoundation。encode-mp4.swift) ----
    const isWallClock = Math.abs(times[0] - recordStartWall) < 60;
    const end = isWallClock ? recordEndWall : times[times.length - 1] + 3;
    fs.writeFileSync(
      path.join(frameDir, 'frames.json'),
      JSON.stringify({ times, end, width: VIEW.width, height: VIEW.height }),
    );
    const outPath = path.join(OUT_DIR, `${OUT_BASENAME}.mp4`);
    console.log(`エンコード中(約${Math.round((end - times[0]) / SPEED)}秒の動画)...`);
    execFileSync('swift', [path.join(__dirname, 'encode-mp4.swift'), frameDir, outPath, String(SPEED)], {
      stdio: 'inherit',
    });
    const size = fs.statSync(outPath).size;
    console.log(`動画を保存しました: ${outPath}(${(size / 1024 / 1024).toFixed(1)}MB)`);
  } finally {
    await browser.close();
    fs.rmSync(frameDir, { recursive: true, force: true });
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
