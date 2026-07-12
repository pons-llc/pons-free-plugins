(function (global) {
  'use strict';

  const NS = (global.StatusCelebration = global.StatusCelebration || {});

  // 派手すぎない基準として、演出時間は2.4秒・パーティクル数は控えめ(idea.md「演出パターン」参照)。
  const DURATION_MS = 2400;
  const CANVAS_ID = 'stc-canvas';
  const BANNER_ID = 'stc-banner';
  const COLORS = [
    '#FFC107',
    '#FF7043',
    '#66BB6A',
    '#42A5F5',
    '#AB47BC',
    '#FF5C8A',
  ];

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

  const removeById = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.remove();
    }
  };

  const createCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.className = 'stc-canvas';
    canvas.width = global.innerWidth;
    canvas.height = global.innerHeight;
    document.body.appendChild(canvas);
    return canvas;
  };

  // 紙吹雪パーティクル1つ分の状態(位置・速度・色・回転)を生成する。
  const makeParticle = (opts) => ({
    x: opts.x,
    y: opts.y,
    vx: opts.vx,
    vy: opts.vy,
    size: opts.size,
    color: pickColor(),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.2, 0.2),
    gravity: opts.gravity,
  });

  // パターンごとの初期パーティクル配置(idea.mdの演出パターン説明に対応)。
  // - CONFETTI: 画面上部全体からゆっくり降る(最も控えめ)
  // - CRACKER: 画面下部の左右2箇所から斜め上に放たれる
  // - KUSUDAMA(既定): 画面上部中央から放射状に広がって落ちる
  const buildParticles = (pattern, width, height) => {
    const particles = [];

    if (pattern === 'CONFETTI') {
      for (let i = 0; i < 60; i += 1) {
        particles.push(
          makeParticle({
            x: randomBetween(0, width),
            y: randomBetween(-height * 0.3, 0),
            vx: randomBetween(-0.5, 0.5),
            vy: randomBetween(1, 2.2),
            size: randomBetween(6, 10),
            gravity: 0.02,
          }),
        );
      }
      return particles;
    }

    if (pattern === 'CRACKER') {
      const origins = [
        { x: width * 0.08, y: height },
        { x: width * 0.92, y: height },
      ];
      origins.forEach((origin) => {
        for (let i = 0; i < 32; i += 1) {
          const angle = randomBetween(-Math.PI * 0.75, -Math.PI * 0.25);
          const speed = randomBetween(4, 9);
          particles.push(
            makeParticle({
              x: origin.x,
              y: origin.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: randomBetween(5, 9),
              gravity: 0.18,
            }),
          );
        }
      });
      return particles;
    }

    const origin = { x: width / 2, y: height * 0.18 };
    for (let i = 0; i < 70; i += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(2, 6);
      particles.push(
        makeParticle({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.6,
          size: randomBetween(6, 10),
          gravity: 0.09,
        }),
      );
    }
    return particles;
  };

  const drawParticle = (ctx, p, alpha) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  };

  const runAnimation = (pattern, canvas) => {
    const ctx = canvas.getContext('2d');
    const particles = buildParticles(pattern, canvas.width, canvas.height);
    let startTime = null;
    let rafId = null;

    const step = (timestamp) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      // 終盤の0.4秒でフェードアウトさせ、消え方を急にしない。
      const alpha = Math.min(1, (DURATION_MS - elapsed) / 400);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        drawParticle(ctx, p, Math.max(0, alpha));
      });

      if (elapsed < DURATION_MS) {
        rafId = global.requestAnimationFrame(step);
      } else {
        canvas.remove();
      }
    };
    rafId = global.requestAnimationFrame(step);

    return () => {
      if (rafId !== null) {
        global.cancelAnimationFrame(rafId);
      }
      canvas.remove();
    };
  };

  const showBanner = (message) => {
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'stc-banner';
    // メッセージはアプリ管理者が設定画面で入力した文字列。innerHTMLではなくtextContentで描画する
    // (secureCodingGuideline.md参照)。
    banner.textContent = message;
    document.body.appendChild(banner);
    global.setTimeout(() => {
      banner.remove();
    }, DURATION_MS);
  };

  // お祝い演出を1回再生する。pattern: 'KUSUDAMA' | 'CRACKER' | 'CONFETTI'
  // 既に再生中の演出があれば先に片付けてから再生する(連続して発火した場合に多重表示させない)。
  const play = (pattern, options = {}) => {
    removeById(CANVAS_ID);
    removeById(BANNER_ID);

    const canvas = createCanvas();
    runAnimation(pattern, canvas);
    if (options.message) {
      showBanner(options.message);
    }
  };

  NS.Effects = { play, DURATION_MS };
})(typeof window !== 'undefined' ? window : globalThis);
