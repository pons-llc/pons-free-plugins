(function (root) {
  'use strict';

  // 描画命令(scene.js)からSVG要素を作る処理と、凡例・メモ一覧・画像の保存。PC・モバイル共通。
  // 利用者の入力値はtextContentでのみ設定し、innerHTML等は使わない(XSS対策)。

  const NS = root.Genogram;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // 画像として保存したときも同じ見た目になるよう、スタイルはSVGの中に埋め込む(固定の文字列のみ)。
  const SVG_STYLE = [
    'text{font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;}',
    '.g-person{fill:#fff;stroke:#333;stroke-width:2;}',
    '.g-person.is-selected{stroke:#3498db;stroke-width:3.5;}',
    '.g-union,.g-rel{fill:none;stroke:#333;stroke-width:2;}',
    '.g-slash,.g-descent,.g-sibling,.g-child{stroke:#333;stroke-width:2;}',
    '.g-deceased{stroke:#333;stroke-width:1.5;}',
    '.g-hit{fill:none;stroke:transparent;stroke-width:14;}',
    '.g-rel-close{stroke:#27ae60;stroke-width:4;}',
    '.g-rel-conflict{stroke:#e74c3c;}',
    '.g-rel-distant{stroke:#7f8c8d;}',
    '.g-rel-cutoff{stroke:#8e44ad;}',
    '.g-cutoff-bar{stroke:#8e44ad;stroke-width:2;}',
    '.g-household{fill:rgba(52,152,219,0.06);stroke:#3498db;stroke-width:1.5;stroke-dasharray:6 4;}',
    '.g-household-label{fill:#2980b9;font-size:12px;}',
    '.g-age{font-size:13px;text-anchor:middle;fill:#333;}',
    '.g-name{font-size:13px;text-anchor:middle;font-weight:bold;fill:#222;}',
    '.g-note{font-size:11px;text-anchor:middle;fill:#666;}',
    // 線の上に重なっても読めるよう、文字に白い縁取りを付ける
    '.g-name,.g-note,.g-age,.g-household-label{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round;}',
    '.g-memo-badge{fill:#f39c12;}',
    '.g-memo-badge-text{fill:#fff;font-size:11px;text-anchor:middle;font-weight:bold;}',
  ].join('');

  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((key) => {
      const value = attrs[key];
      if (
        value !== undefined &&
        value !== null &&
        NS.Scene.isSafeAttrName(key)
      ) {
        el.setAttribute(key, String(value));
      }
    });
    return el;
  };

  // scene: Scene.buildScene()の戻り値
  const renderSvg = (scene) => {
    const svg = svgEl('svg', {
      xmlns: SVG_NS,
      class: 'gng-svg',
      width: scene.width,
      height: scene.height,
      viewBox: `0 0 ${scene.width} ${scene.height}`,
      role: 'img',
    });
    const style = svgEl('style');
    style.textContent = SVG_STYLE;
    svg.appendChild(style);
    const background = svgEl('rect', {
      x: 0,
      y: 0,
      width: scene.width,
      height: scene.height,
      fill: '#fff',
    });
    svg.appendChild(background);

    scene.items.forEach((item) => {
      const el = svgEl(item.tag, item.attrs);
      if (item.text !== undefined) {
        el.textContent = item.text;
      }
      if (item.title) {
        const title = svgEl('title');
        title.textContent = item.title;
        el.appendChild(title);
      }
      if (item.target) {
        el.setAttribute('data-gtype', item.target.type);
        el.setAttribute('data-gid', item.target.id);
      }
      svg.appendChild(el);
    });
    return svg;
  };

  // ---- 汎用のDOMヘルパー ----

  // h('div', { className: 'x', onclick: fn }, [子要素 or 文字列])。文字列はテキストノードとして追加する。
  const h = (tag, props, children) => {
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((key) => {
      const value = props[key];
      if (value === undefined || value === null) {
        return;
      }
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2), value);
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key in el && typeof value !== 'string') {
        el[key] = value;
      } else if (
        key === 'className' ||
        key === 'textContent' ||
        key === 'value'
      ) {
        el[key] = value;
      } else {
        el.setAttribute(key, value);
      }
    });
    (children || []).forEach((child) => {
      if (child === null || child === undefined || child === false) {
        return;
      }
      el.appendChild(
        typeof child === 'string' ? document.createTextNode(child) : child,
      );
    });
    return el;
  };

  const personLabel = (person) => {
    if (!person) {
      return '(削除された人物)';
    }
    return (
      person.name || `(名前未入力・${NS.Model.LABELS.gender[person.gender]})`
    );
  };

  // ---- 凡例 ----

  const legendIcon = (draw) => {
    const svg = svgEl('svg', {
      width: 44,
      height: 22,
      viewBox: '0 0 44 22',
      class: 'gng-legend-icon',
    });
    const style = svgEl('style');
    style.textContent = SVG_STYLE;
    svg.appendChild(style);
    draw(svg);
    return svg;
  };

  const LEGEND = [
    [
      '男性',
      (s) =>
        s.appendChild(
          svgEl('rect', {
            class: 'g-person',
            x: 14,
            y: 3,
            width: 16,
            height: 16,
          }),
        ),
    ],
    [
      '女性',
      (s) =>
        s.appendChild(
          svgEl('circle', { class: 'g-person', cx: 22, cy: 11, r: 8 }),
        ),
    ],
    [
      '不明・その他',
      (s) =>
        s.appendChild(
          svgEl('polygon', {
            class: 'g-person',
            points: '22,1 32,11 22,21 12,11',
          }),
        ),
    ],
    [
      '本人',
      (s) => {
        s.appendChild(
          svgEl('rect', {
            class: 'g-person',
            x: 12,
            y: 1,
            width: 20,
            height: 20,
          }),
        );
        s.appendChild(
          svgEl('rect', {
            class: 'g-person',
            x: 15,
            y: 4,
            width: 14,
            height: 14,
          }),
        );
      },
    ],
    [
      '死亡',
      (s) => {
        s.appendChild(
          svgEl('rect', {
            class: 'g-person',
            x: 14,
            y: 3,
            width: 16,
            height: 16,
          }),
        );
        s.appendChild(
          svgEl('line', { class: 'g-deceased', x1: 14, y1: 3, x2: 30, y2: 19 }),
        );
        s.appendChild(
          svgEl('line', { class: 'g-deceased', x1: 30, y1: 3, x2: 14, y2: 19 }),
        );
      },
    ],
    [
      '婚姻',
      (s) =>
        s.appendChild(
          svgEl('path', { class: 'g-union', d: 'M4 4 V16 H40 V4' }),
        ),
    ],
    [
      '内縁・事実婚・交際',
      (s) =>
        s.appendChild(
          svgEl('path', {
            class: 'g-union',
            d: 'M4 4 V16 H40 V4',
            'stroke-dasharray': NS.Scene.DASH.dashed,
          }),
        ),
    ],
    [
      '別居',
      (s) => {
        s.appendChild(
          svgEl('path', { class: 'g-union', d: 'M4 4 V16 H40 V4' }),
        );
        s.appendChild(
          svgEl('line', { class: 'g-slash', x1: 18, y1: 21, x2: 26, y2: 9 }),
        );
      },
    ],
    [
      '離婚',
      (s) => {
        s.appendChild(
          svgEl('path', { class: 'g-union', d: 'M4 4 V16 H40 V4' }),
        );
        s.appendChild(
          svgEl('line', { class: 'g-slash', x1: 14, y1: 21, x2: 22, y2: 9 }),
        );
        s.appendChild(
          svgEl('line', { class: 'g-slash', x1: 22, y1: 21, x2: 30, y2: 9 }),
        );
      },
    ],
    [
      '実子',
      (s) =>
        s.appendChild(
          svgEl('line', { class: 'g-child', x1: 22, y1: 1, x2: 22, y2: 21 }),
        ),
    ],
    [
      '養子',
      (s) =>
        s.appendChild(
          svgEl('line', {
            class: 'g-child',
            x1: 22,
            y1: 1,
            x2: 22,
            y2: 21,
            'stroke-dasharray': NS.Scene.DASH.dashed,
          }),
        ),
    ],
    [
      '里子',
      (s) =>
        s.appendChild(
          svgEl('line', {
            class: 'g-child',
            x1: 22,
            y1: 1,
            x2: 22,
            y2: 21,
            'stroke-dasharray': NS.Scene.DASH.dotted,
          }),
        ),
    ],
    [
      '親密',
      (s) =>
        s.appendChild(
          svgEl('path', { class: 'g-rel g-rel-close', d: 'M4 11 H40' }),
        ),
    ],
    [
      '対立',
      (s) =>
        s.appendChild(
          svgEl('path', {
            class: 'g-rel g-rel-conflict',
            d: 'M4 11 L8 6 L14 16 L20 6 L26 16 L32 6 L36 16 L40 11',
          }),
        ),
    ],
    [
      '疎遠',
      (s) =>
        s.appendChild(
          svgEl('path', {
            class: 'g-rel g-rel-distant',
            d: 'M4 11 H40',
            'stroke-dasharray': NS.Scene.DASH.dotted,
          }),
        ),
    ],
    [
      '断絶',
      (s) => {
        s.appendChild(
          svgEl('path', { class: 'g-rel g-rel-cutoff', d: 'M4 11 H40' }),
        );
        s.appendChild(
          svgEl('line', {
            class: 'g-cutoff-bar',
            x1: 19,
            y1: 3,
            x2: 19,
            y2: 19,
          }),
        );
        s.appendChild(
          svgEl('line', {
            class: 'g-cutoff-bar',
            x1: 25,
            y1: 3,
            x2: 25,
            y2: 19,
          }),
        );
      },
    ],
    [
      '同居',
      (s) =>
        s.appendChild(
          svgEl('rect', {
            class: 'g-household',
            x: 3,
            y: 2,
            width: 38,
            height: 18,
            rx: 5,
          }),
        ),
    ],
  ];

  const renderLegend = (open) => {
    const details = h('details', { className: 'gng-legend', open: !!open }, [
      h('summary', {}, ['凡例']),
    ]);
    const list = h('ul', { className: 'gng-legend-list' });
    LEGEND.forEach(([label, draw]) => {
      list.appendChild(
        h('li', { className: 'gng-legend-item' }, [legendIcon(draw), label]),
      );
    });
    details.appendChild(list);
    return details;
  };

  // ---- メモ一覧 ----

  // options.onDelete(memoId)を渡すと削除ボタンを出す(編集画面のみ)。
  const renderMemoList = (model, options) => {
    const opts = options || {};
    const personById = new Map(model.persons.map((p) => [p.id, p]));
    const memos = opts.filterTargetId
      ? model.memos.filter((m) => m.targetId === opts.filterTargetId)
      : model.memos;
    const list = h('ul', { className: 'gng-memo-list' });
    if (memos.length === 0) {
      list.appendChild(
        h('li', { className: 'gng-memo-empty' }, ['メモはまだありません。']),
      );
      return list;
    }
    memos.forEach((memo) => {
      const target = memo.targetId
        ? personLabel(personById.get(memo.targetId))
        : '全体';
      const meta = [
        NS.Model.formatDateTime(memo.at),
        memo.author.name || memo.author.code,
      ]
        .filter(Boolean)
        .join(' ');
      list.appendChild(
        h('li', { className: 'gng-memo-item' }, [
          h('div', { className: 'gng-memo-head' }, [
            h('span', { className: 'gng-memo-target' }, [target]),
            h('span', { className: 'gng-memo-meta' }, [meta]),
            opts.onDelete
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'gng-link-button gng-memo-delete',
                    onclick: () => opts.onDelete(memo.id),
                  },
                  ['削除'],
                )
              : null,
          ]),
          h('div', { className: 'gng-memo-text' }, [memo.text]),
        ]),
      );
    });
    return list;
  };

  // ---- 画像(PNG)の保存 ----

  const exportPng = (svg, filename) =>
    new Promise((resolve, reject) => {
      const width = Number(svg.getAttribute('width'));
      const height = Number(svg.getAttribute('height'));
      const clone = svg.cloneNode(true);
      // 縮小表示用のstyle(width:100%等)は画像に持ち込まない
      clone.removeAttribute('style');
      const source = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((png) => {
          if (!png) {
            reject(new Error('画像を作成できませんでした。'));
            return;
          }
          const link = document.createElement('a');
          link.href = URL.createObjectURL(png);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
          resolve();
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を作成できませんでした。'));
      };
      image.src = url;
    });

  const buildSvgFor = (model, options) => {
    const layout = NS.Layout.layout(model);
    return renderSvg(NS.Scene.buildScene(model, layout, options));
  };

  NS.Renderer = {
    renderSvg,
    buildSvgFor,
    renderLegend,
    renderMemoList,
    exportPng,
    personLabel,
    h,
  };
})(window);
