'use strict';

// ジェノグラム作成プラグインの紹介動画: 架空の相談ケース(本人・両親・弟・元夫・内縁のパートナーなど)を、
// レコード追加画面のエディターで1人ずつ追加してジェノグラムにし、保存して詳細画面で確認するまでを録画する。
// 死亡・離婚・内縁・別居・養子・里子・親密/対立/断絶/疎遠・同居/独居・メモの表記をひととおり使う。
// 人物・団体はすべて架空(実在の人物とは関係ない)。
//
// 録画の仕組み(ffmpeg・Homebrew等の追加インストールは不要。macOSが前提):
//   1. 操作中の画面を Chrome DevTools Protocol の Page.startScreencast でタイムスタンプ付きのJPEGとして保存
//   2. macOS標準の AVFoundation(QuickTimeと同じエンジン)で、30fps固定のH.264 MP4に書き出す
//      (encode-mp4.swift を、macOS標準の swift コマンドで実行)。
//      ※ブラウザ内蔵の MediaRecorder で作ったMP4は断片化MP4で、QuickTimeでは開けなかったため使わない。
// 画面には、操作が分かるよう疑似カーソル・クリックの波紋・手順の字幕を重ねる(録画用の表示のみ)。
//
// 事前準備: NODE_PATH=genogram/src/node_modules node articles/genogram-case-example/setup.js
// 実行:     NODE_PATH=genogram/src/node_modules node articles/genogram-case-example/record-video.js
// 出力:     articles/genogram-case-example/video/genogram-case-example.mp4

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');

const VIEW = { width: 1440, height: 900 };
const SPEED = 1.5; // 完成動画の再生速度(録画時の何倍か)
const TYPE_DELAY = 110; // 1文字の入力間隔(ms)
const OUT_DIR = path.join(__dirname, 'video');
const OUT_BASENAME = 'genogram-case-example';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- 録画用の表示(疑似カーソル・波紋・字幕)。ページ遷移のたびに入れ直す ----
const installOverlay = () => {
  if (document.getElementById('demo-overlay-style')) {
    return;
  }
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

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genogram-frames-'));

  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${VIEW.width},${VIEW.height}`],
  });
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', (dialog) => dialog.accept());

  // ---- 操作のヘルパー ----
  const overlay = () => page.evaluate(installOverlay);
  const caption = async (title, sub, hold = 1200) => {
    await page.evaluate((t, s) => window.__demoCaption(t, s), title, sub || '');
    await sleep(hold);
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
    if (rect.top < 150 || rect.bottom > rect.vh - 120) {
      await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await sleep(800);
    }
  };
  const clickHandle = async (handle, { ctrl = false } = {}) => {
    await ensureVisible(handle);
    const box = await handle.boundingBox();
    await glide(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(150);
    if (ctrl) {
      await page.keyboard.down('Control');
    }
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
    if (ctrl) {
      await page.keyboard.up('Control');
    }
    await sleep(380);
  };
  const click = async (selector, options) =>
    clickHandle(await page.waitForSelector(selector, { visible: true, timeout: 15000 }), options);
  const typeInto = async (selector, text) => {
    await click(selector);
    await page.$eval(selector, (el) => el.select && el.select());
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
    await sleep(450);
  };
  const check = (selector) => click(selector);
  // 図の人物の記号(名前で探す)。名前が未入力の人は、性別で「名前のない人」を探す
  const person = (name) =>
    page.evaluateHandle((n) => {
      const svg = document.querySelector('.gng-edit .gng-svg, .gng-view .gng-svg');
      const label = Array.from(svg.querySelectorAll('text.g-name')).find((t) => t.textContent === n);
      const id = label.getAttribute('data-gid');
      return Array.from(svg.querySelectorAll('.g-person')).find(
        (el) => el.getAttribute('data-gid') === id && !el.classList.contains('g-client-outer'),
      );
    }, name);
  const unnamed = (gender) =>
    page.evaluateHandle((g) => {
      const svg = document.querySelector('.gng-edit .gng-svg');
      const named = new Set(Array.from(svg.querySelectorAll('text.g-name')).map((t) => t.getAttribute('data-gid')));
      return Array.from(svg.querySelectorAll(`.g-person.g-${g}`)).find(
        (el) => !named.has(el.getAttribute('data-gid')),
      );
    }, gender);
  const clickPerson = async (name, options) => clickHandle(await person(name), options);
  const fillPerson = async ({ name, gender, age, note, client, deceased, childType }) => {
    if (name) await typeInto('.js-gng-person-name', name);
    if (gender) await choose('.js-gng-person-gender', gender);
    if (age) await typeInto('.js-gng-person-age', age);
    if (client) await check('.js-gng-person-client');
    if (deceased) await check('.js-gng-person-deceased');
    if (childType) await choose('.js-gng-person-childtype', childType);
    if (note) await typeInto('.js-gng-person-note', note);
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
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/edit`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.gng-edit', { timeout: 20000 });
    await overlay();
    await page.mouse.move(720, 450);

    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 85,
      maxWidth: VIEW.width,
      maxHeight: VIEW.height,
      everyNthFrame: 1,
    });
    const recordStartWall = Date.now() / 1000;

    // ---- このケース用の追加ヘルパー ----
    // 夫婦の一覧から、2人の名前を含む行の「編集」を押す
    const editUnion = async (nameA, nameB) => {
      const button = await page.evaluateHandle(
        (a, b) => {
          const row = Array.from(document.querySelectorAll('.gng-lists .gng-item')).find(
            (li) => li.textContent.includes(a) && li.textContent.includes(b),
          );
          return row.querySelector('.js-gng-list-edit');
        },
        nameA,
        nameB,
      );
      await clickHandle(button);
    };
    // プルダウンの選択肢を、表示名で選ぶ
    const chooseByText = async (selector, text) => {
      const value = await page.$$eval(
        `${selector} option`,
        (options, t) => options.find((o) => o.textContent === t).value,
        text,
      );
      await choose(selector, value);
    };
    const addRelation = async (nameA, nameB, kind) => {
      await click('.js-gng-new-relation');
      await chooseByText('.js-gng-pair-a', nameA);
      await chooseByText('.js-gng-pair-b', nameB);
      await choose('.js-gng-pair-type', kind);
      await click('.js-gng-pair-submit');
      await sleep(500);
    };
    const addMemoFor = async (name, text) => {
      await clickPerson(name);
      await click('.js-gng-memo-for');
      await typeInto('.gng-memos .js-gng-memo-text', text);
      await click('.gng-memos .js-gng-memo-add');
      await sleep(500);
    };

    await caption('ジェノグラム作成プラグイン', '架空の相談ケースで、離婚・内縁・養子・関係性などの表記をひととおり作ります', 3500);
    await caption('ケース名を入力', '', 600);
    // ヘッダーの検索欄ではなく、フォームの「ケース名」フィールドの入力欄(ラベルの文字で探す)
    const titleInput = await page.evaluateHandle(() => {
      const label = Array.from(document.querySelectorAll('.control-label-text-gaia, span, div')).find(
        (el) => el.children.length === 0 && el.textContent.trim() === 'ケース名',
      );
      let box = label;
      while (box && !box.querySelector('input[type="text"]')) {
        box = box.parentElement;
      }
      return box.querySelector('input[type="text"]');
    });
    await clickHandle(titleInput);
    await page.keyboard.type('佐藤 美咲さん(架空のケース)', { delay: TYPE_DELAY });
    await sleep(300);

    await caption('① 本人(相談者)を追加', '「本人」にチェックすると二重線の記号になります', 900);
    await click('.js-gng-add-person');
    await fillPerson({ name: '佐藤 美咲', gender: 'female', age: '38', client: true, note: 'パート勤務' });

    await caption('② 両親を追加', '亡くなった人は「死亡」にチェック → 記号に×', 900);
    await clickPerson('佐藤 美咲');
    await click('.js-gng-add-parents');
    await fillPerson({ name: '佐藤 健一', age: '68', deceased: true, note: '3年前に死去' });
    await clickHandle(await unnamed('female'));
    await fillPerson({ name: '佐藤 和子', age: '66', note: '要介護2・独居' });

    await caption('③ 弟を追加', '', 600);
    await clickPerson('佐藤 健一');
    await click('.js-gng-add-child');
    await fillPerson({ name: '佐藤 大輔', gender: 'male', age: '35' });

    await caption('④ 元夫と、2人の子', '夫婦の一覧の「編集」で「離婚」に → 線に斜線2本(//)', 900);
    await clickPerson('佐藤 美咲');
    await click('.js-gng-add-partner');
    await fillPerson({ name: '山本 拓也', age: '40' });
    await editUnion('佐藤 美咲', '山本 拓也');
    await choose('.js-gng-union-status', 'divorced');
    await typeInto('.js-gng-union-note', '5年前に離婚');
    await click('.js-gng-union-add-child');
    await fillPerson({ name: '山本 翔太', gender: 'male', age: '12', note: '中学1年' });
    await editUnion('佐藤 美咲', '山本 拓也');
    await click('.js-gng-union-add-child');
    await fillPerson({ name: '山本 結衣', gender: 'female', age: '9' });

    await caption('⑤ 今のパートナー(内縁)', '「内縁・事実婚・交際」は破線になります', 900);
    await clickPerson('佐藤 美咲');
    await click('.js-gng-add-partner');
    await fillPerson({ name: '中村 誠', age: '41' });
    await editUnion('佐藤 美咲', '中村 誠');
    await choose('.js-gng-union-status', 'cohabiting');
    await sleep(500);

    await caption('⑥ パートナーの元妻と娘', '再婚・離婚が重なっても、相手を左右に並べて自動で配置します', 900);
    await clickPerson('中村 誠');
    await click('.js-gng-add-partner');
    await fillPerson({ name: '中村 恵', age: '40' });
    await editUnion('中村 誠', '中村 恵');
    await choose('.js-gng-union-status', 'divorced');
    await click('.js-gng-union-add-child');
    await fillPerson({ name: '中村 陽菜', gender: 'female', age: '15', note: '母と同居' });

    await caption('⑦ 弟の家族: 別居中の妻', '「別居」は斜線1本(/)', 900);
    await clickPerson('佐藤 大輔');
    await click('.js-gng-add-partner');
    await fillPerson({ name: '佐藤 由紀', age: '36' });
    await editUnion('佐藤 大輔', '佐藤 由紀');
    await choose('.js-gng-union-status', 'separated');

    await caption('⑧ 養子と里子', '続柄で「養子」は破線、「里子」は点線で親とつながります', 900);
    await click('.js-gng-union-add-child');
    await fillPerson({ name: '佐藤 蓮', gender: 'male', age: '6', childType: 'adopted' });
    await editUnion('佐藤 大輔', '佐藤 由紀');
    await click('.js-gng-union-add-child');
    await fillPerson({ name: 'さくら', gender: 'female', age: '4', childType: 'foster' });

    await caption('⑨ 関係性を追加', '親密(太線)・対立(ジグザグ)・断絶(縦線2本)・疎遠(点線)', 1200);
    await addRelation('佐藤 美咲', '佐藤 和子', 'close');
    await addRelation('佐藤 美咲', '山本 拓也', 'conflict');
    await addRelation('佐藤 美咲', '佐藤 大輔', 'cutoff');
    await addRelation('山本 翔太', '中村 誠', 'distant');

    await caption('⑩ 同居している人を囲む', 'Ctrl+クリックで複数選択 →「選択した人で同居(世帯)を作る」', 1200);
    await clickPerson('佐藤 美咲');
    for (const name of ['中村 誠', '山本 翔太', '山本 結衣']) {
      await clickPerson(name, { ctrl: true });
    }
    await click('.js-gng-multi-household');
    await typeInto('.js-gng-household-label', '本人世帯');
    await click('.js-gng-household-submit');
    await sleep(700);
    await clickPerson('佐藤 大輔');
    for (const name of ['佐藤 蓮', 'さくら']) {
      await clickPerson(name, { ctrl: true });
    }
    await click('.js-gng-multi-household');
    await typeInto('.js-gng-household-label', '大輔世帯');
    await click('.js-gng-household-submit');
    await sleep(700);

    await caption('⑩ 1人暮らしも枠で表せます', '「＋ 同居(世帯)」から、母を選んで「独居」', 900);
    await click('.js-gng-new-household');
    await typeInto('.js-gng-household-label', '独居');
    const kazukoBox = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll('.gng-panel .js-gng-member')).find((el) =>
        el.parentElement.textContent.includes('佐藤 和子'),
      ),
    );
    await clickHandle(kazukoBox);
    await click('.js-gng-household-submit');
    await sleep(700);

    await caption('⑪ 支援の記録をメモで残す', '人物ごとに、記入者・日時つきで追記できます', 900);
    await addMemoFor('佐藤 和子', '訪問介護を週3回利用。美咲さんが週末に通っている');
    await addMemoFor('山本 翔太', '学校より連絡。2学期に入り欠席が増えている');

    await caption('完成! 保存します', '', 600);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(900);
    await clickHandle(await page.waitForSelector('button.gaia-ui-actionmenu-save'));
    await page.waitForFunction(() => !location.pathname.endsWith('/edit'), { timeout: 30000 });
    await page.waitForSelector('.gng-view', { timeout: 30000 });
    await overlay();
    await page.evaluate((x, y) => {
      window.__demoX = x;
      window.__demoY = y;
    }, 720, 450);

    // scrollIntoView(start)だとkintoneの固定ヘッダーの下に図の上端が隠れるため、ヘッダーの高さ分を空けて止める
    const scrollToDiagram = () =>
      page.evaluate(() => {
        const el = document.querySelector('.gng-view .gng-canvas');
        const top = el.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    await caption('保存すると、詳細画面にジェノグラムが表示されます', '凡例つき・画像(PNG)としても保存できます', 600);
    await page.waitForSelector('.gng-view .gng-canvas');
    await scrollToDiagram();
    await sleep(3200);
    await caption('人物をクリックすると詳細とメモを表示', '', 600);
    await clickPerson('山本 翔太');
    await page.evaluate(() => window.scrollBy({ top: 360, behavior: 'smooth' }));
    await sleep(3200);
    await scrollToDiagram();
    await sleep(1200);
    await caption('ジェノグラム作成プラグイン', 'GovAppsプラグイン ― 無料・広告なし・オープンソース', 4000);

    await client.send('Page.stopScreencast');
    const recordEndWall = Date.now() / 1000;
    console.log(`録画したフレーム数: ${times.length}`);
    if (pageErrors.length > 0) {
      console.warn('ページエラー:', pageErrors);
    }
    // 確認用に、完成した図の静止画も残す
    await page.screenshot({ path: path.join(OUT_DIR, `${OUT_BASENAME}-final.png`) });

    // ---- 動画に変換(macOS標準のAVFoundation。encode-mp4.swift) ----
    // 画面に変化が無い間はフレームが来ないため、最後の字幕を表示し続けた時間まで動画に含めるよう、
    // 終了時刻は記録を止めた時刻にする。スクリーンキャストの時刻はUNIX時刻(秒)だが、念のため
    // 記録開始時の時計と大きくずれていたら、最後のフレームから3秒後を終了時刻にする。
    const isWallClock = Math.abs(times[0] - recordStartWall) < 60;
    const end = isWallClock ? recordEndWall : times[times.length - 1] + 3;
    fs.writeFileSync(
      path.join(frameDir, 'frames.json'),
      JSON.stringify({ times, end, width: VIEW.width, height: VIEW.height }),
    );
    const outPath = path.join(OUT_DIR, `${OUT_BASENAME}.mp4`);
    console.log(`エンコード中(約${Math.round((end - times[0]) / SPEED)}秒の動画)...`);
    execFileSync(
      'swift',
      [path.join(__dirname, 'encode-mp4.swift'), frameDir, outPath, String(SPEED)],
      { stdio: 'inherit' },
    );
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
