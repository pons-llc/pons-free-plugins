(function (root) {
  'use strict';

  // Chart.js(CDN)の代替となる、外部依存ゼロのSVGチャート描画。
  // 横棒(bar-h)・縦棒(bar-v)・ドーナツ(pie)・折れ線(line)のみ対応する。
  // 目盛り計算・円弧パス等の純粋関数はJestでテストし、DOM生成部はE2E/実機で確認する。

  const COLORS = [
    '#4f46e5',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#f97316',
  ];

  // 最大値から「きりのいい」軸目盛りの上限と刻みを計算する
  const niceScale = (maxValue, tickCount) => {
    const count = tickCount || 4;
    if (!isFinite(maxValue) || maxValue <= 0) {
      return { max: 1, step: 1, ticks: [0, 1] };
    }
    const rawStep = maxValue / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceResidual;
    if (residual < 1.5) {
      niceResidual = 1;
    } else if (residual < 3) {
      niceResidual = 2;
    } else if (residual < 7) {
      niceResidual = 5;
    } else {
      niceResidual = 10;
    }
    const step = niceResidual * magnitude;
    const max = Math.ceil(maxValue / step) * step;
    const ticks = [];
    // 浮動小数の蓄積誤差を避けるため整数カウンタで回す
    for (let i = 0; i * step <= max + step / 2; i++) {
      ticks.push(Math.round(i * step * 1e6) / 1e6);
    }
    return { max, step, ticks };
  };

  // ドーナツの1セグメントのSVGパス(角度はラジアン、12時位置=-90度起点で使う)
  const donutArcPath = (cx, cy, rOuter, rInner, startAngle, endAngle) => {
    // 完全な円(全周)はarcが描けないため2分割する
    if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
      const mid = startAngle + Math.PI;
      return (
        donutArcPath(cx, cy, rOuter, rInner, startAngle, mid) +
        ' ' +
        donutArcPath(cx, cy, rOuter, rInner, mid, endAngle)
      );
    }
    const p = (r, a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      `M ${p(rOuter, startAngle)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p(rOuter, endAngle)}`,
      `L ${p(rInner, endAngle)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p(rInner, startAngle)}`,
      'Z',
    ].join(' ');
  };

  const truncateLabel = (label, maxLength) => {
    const s = String(label === undefined || label === null ? '' : label);
    return s.length > maxLength ? `${s.slice(0, maxLength - 1)}…` : s;
  };

  const formatNumber = (v) =>
    Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

  // ---- ここからDOM生成(ブラウザ専用) ----

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const addTitle = (el, text) => {
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = text;
    el.appendChild(title);
  };

  const baseSvg = (width, height) => {
    const svg = svgEl('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width: '100%',
      height: '100%',
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
    });
    svg.style.display = 'block';
    return svg;
  };

  const containerSize = (container) => ({
    width: Math.max(container.clientWidth || 0, 320),
    height: Math.max(container.clientHeight || 0, 220),
  });

  // 棒グラフ(horizontal=trueで横棒)。onValueClickにラベルを渡す。
  const renderBar = (container, opts) => {
    const { labels, values, horizontal, onValueClick } = opts;
    const { width, height } = containerSize(container);
    const svg = baseSvg(width, height);
    const maxValue = Math.max(0, ...values);
    const scale = niceScale(maxValue, 4);

    const margin = horizontal
      ? { top: 8, right: 24, bottom: 22, left: 110 }
      : { top: 8, right: 8, bottom: 46, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    // 目盛り線と目盛りラベル
    scale.ticks.forEach((tick) => {
      const ratio = tick / scale.max;
      if (horizontal) {
        const x = margin.left + plotW * ratio;
        svg.appendChild(
          svgEl('line', {
            x1: x,
            y1: margin.top,
            x2: x,
            y2: margin.top + plotH,
            stroke: '#e5e7eb',
            'stroke-width': 1,
          }),
        );
        const text = svgEl('text', {
          x,
          y: margin.top + plotH + 14,
          'text-anchor': 'middle',
          'font-size': 10,
          fill: '#9ca3af',
        });
        text.textContent = formatNumber(tick);
        svg.appendChild(text);
      } else {
        const y = margin.top + plotH * (1 - ratio);
        svg.appendChild(
          svgEl('line', {
            x1: margin.left,
            y1: y,
            x2: margin.left + plotW,
            y2: y,
            stroke: '#e5e7eb',
            'stroke-width': 1,
          }),
        );
        const text = svgEl('text', {
          x: margin.left - 6,
          y: y + 3,
          'text-anchor': 'end',
          'font-size': 10,
          fill: '#9ca3af',
        });
        text.textContent = formatNumber(tick);
        svg.appendChild(text);
      }
    });

    const n = labels.length;
    const band = (horizontal ? plotH : plotW) / Math.max(n, 1);
    const barSize = Math.max(Math.min(band * 0.65, 32), 4);

    labels.forEach((label, i) => {
      const value = values[i];
      const ratio = scale.max > 0 ? value / scale.max : 0;
      let rect;
      if (horizontal) {
        const y = margin.top + band * i + (band - barSize) / 2;
        rect = svgEl('rect', {
          x: margin.left,
          y,
          width: Math.max(plotW * ratio, value > 0 ? 2 : 0),
          height: barSize,
          rx: 3,
          fill: COLORS[i % COLORS.length],
        });
        const text = svgEl('text', {
          x: margin.left - 6,
          y: y + barSize / 2 + 3,
          'text-anchor': 'end',
          'font-size': 11,
          fill: '#374151',
        });
        text.textContent = truncateLabel(label, 12);
        svg.appendChild(text);
      } else {
        const x = margin.left + band * i + (band - barSize) / 2;
        const h = plotH * ratio;
        rect = svgEl('rect', {
          x,
          y: margin.top + plotH - h,
          width: barSize,
          height: Math.max(h, value > 0 ? 2 : 0),
          rx: 3,
          fill: COLORS[i % COLORS.length],
        });
        const text = svgEl('text', {
          x: x + barSize / 2,
          y: margin.top + plotH + 12,
          'text-anchor': 'end',
          'font-size': 10,
          fill: '#374151',
          transform: `rotate(-30 ${x + barSize / 2} ${margin.top + plotH + 12})`,
        });
        text.textContent = truncateLabel(label, 10);
        svg.appendChild(text);
      }
      addTitle(rect, `${label}: ${formatNumber(value)}`);
      if (onValueClick) {
        rect.style.cursor = 'pointer';
        rect.addEventListener('click', () => onValueClick(label));
      }
      svg.appendChild(rect);
    });

    container.appendChild(svg);
  };

  // ドーナツグラフ+右側凡例
  const renderDonut = (container, opts) => {
    const { labels, values, onValueClick } = opts;
    const { height } = containerSize(container);

    const wrap = document.createElement('div');
    wrap.className = 'ra-donut-wrap';

    const size = Math.max(Math.min(height, 240), 160);
    const svg = baseSvg(size, size);
    svg.style.flex = '0 0 auto';
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 6;
    const rInner = rOuter * 0.6;

    const total = values.reduce((a, b) => a + b, 0);
    let angle = -Math.PI / 2;
    labels.forEach((label, i) => {
      const value = values[i];
      const sweep = total > 0 ? (value / total) * Math.PI * 2 : 0;
      if (sweep <= 0) {
        return;
      }
      const path = svgEl('path', {
        d: donutArcPath(cx, cy, rOuter, rInner, angle, angle + sweep),
        fill: COLORS[i % COLORS.length],
        stroke: '#ffffff',
        'stroke-width': 1,
      });
      addTitle(
        path,
        `${label}: ${formatNumber(value)} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
      );
      if (onValueClick) {
        path.style.cursor = 'pointer';
        path.addEventListener('click', () => onValueClick(label));
      }
      svg.appendChild(path);
      angle += sweep;
    });

    // 中央に合計値
    const centerText = svgEl('text', {
      x: cx,
      y: cy + 4,
      'text-anchor': 'middle',
      'font-size': 14,
      'font-weight': 'bold',
      fill: '#374151',
    });
    centerText.textContent = formatNumber(total);
    svg.appendChild(centerText);

    const legend = document.createElement('div');
    legend.className = 'ra-chart-legend ra-chart-legend-vertical';
    labels.forEach((label, i) => {
      const item = document.createElement('span');
      item.className = 'ra-legend-item';
      const dot = document.createElement('span');
      dot.className = 'ra-legend-dot';
      dot.style.backgroundColor = COLORS[i % COLORS.length];
      const text = document.createElement('span');
      text.textContent = `${truncateLabel(label, 14)} (${formatNumber(values[i])})`;
      item.appendChild(dot);
      item.appendChild(text);
      if (onValueClick) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => onValueClick(label));
      }
      legend.appendChild(item);
    });

    wrap.appendChild(svg);
    wrap.appendChild(legend);
    container.appendChild(wrap);
  };

  // 折れ線グラフ(複数系列対応)。bucketsがX軸、datasets=[{label, data}]。
  const renderLine = (container, opts) => {
    const { buckets, datasets, showLegend, onValueClick } = opts;
    const { width, height } = containerSize(container);
    const legendH = showLegend ? 24 : 0;
    const svg = baseSvg(width, height - legendH);

    const margin = { top: 8, right: 12, bottom: 40, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - legendH - margin.top - margin.bottom;

    const maxValue = Math.max(0, ...datasets.flatMap((d) => d.data));
    const scale = niceScale(maxValue, 4);

    scale.ticks.forEach((tick) => {
      const y = margin.top + plotH * (1 - tick / scale.max);
      svg.appendChild(
        svgEl('line', {
          x1: margin.left,
          y1: y,
          x2: margin.left + plotW,
          y2: y,
          stroke: '#e5e7eb',
          'stroke-width': 1,
        }),
      );
      const text = svgEl('text', {
        x: margin.left - 6,
        y: y + 3,
        'text-anchor': 'end',
        'font-size': 10,
        fill: '#9ca3af',
      });
      text.textContent = formatNumber(tick);
      svg.appendChild(text);
    });

    const n = buckets.length;
    const xAt = (i) =>
      margin.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const yAt = (v) =>
      margin.top + plotH * (1 - (scale.max > 0 ? v / scale.max : 0));

    // X軸ラベル(多すぎる場合は間引く)
    const labelEvery = Math.max(1, Math.ceil(n / 8));
    buckets.forEach((bucket, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) {
        return;
      }
      const text = svgEl('text', {
        x: xAt(i),
        y: margin.top + plotH + 14,
        'text-anchor': 'end',
        'font-size': 10,
        fill: '#374151',
        transform: `rotate(-30 ${xAt(i)} ${margin.top + plotH + 14})`,
      });
      text.textContent = truncateLabel(bucket, 12);
      svg.appendChild(text);
    });

    datasets.forEach((dataset, di) => {
      const color = COLORS[di % COLORS.length];
      const points = dataset.data
        .map((v, i) => `${xAt(i)},${yAt(v)}`)
        .join(' ');
      if (n > 1) {
        svg.appendChild(
          svgEl('polyline', {
            points,
            fill: 'none',
            stroke: color,
            'stroke-width': 2,
          }),
        );
      }
      dataset.data.forEach((v, i) => {
        const circle = svgEl('circle', {
          cx: xAt(i),
          cy: yAt(v),
          r: 3.5,
          fill: color,
        });
        addTitle(
          circle,
          `${buckets[i]} ${dataset.label !== 'Value' ? `[${dataset.label}] ` : ''}: ${formatNumber(v)}`,
        );
        if (onValueClick) {
          circle.style.cursor = 'pointer';
          circle.addEventListener('click', () => onValueClick(buckets[i]));
        }
        svg.appendChild(circle);
      });
    });

    container.appendChild(svg);

    if (showLegend) {
      const legend = document.createElement('div');
      legend.className = 'ra-chart-legend';
      datasets.forEach((dataset, di) => {
        const item = document.createElement('span');
        item.className = 'ra-legend-item';
        const dot = document.createElement('span');
        dot.className = 'ra-legend-dot';
        dot.style.backgroundColor = COLORS[di % COLORS.length];
        const text = document.createElement('span');
        text.textContent = truncateLabel(dataset.label, 14);
        item.appendChild(dot);
        item.appendChild(text);
        legend.appendChild(item);
      });
      container.appendChild(legend);
    }
  };

  // chartType: 'bar-h' | 'bar-v' | 'pie' | 'line'
  const render = (container, chartType, data) => {
    container.textContent = '';
    if (chartType === 'line') {
      renderLine(container, data);
    } else if (chartType === 'pie') {
      renderDonut(container, data);
    } else {
      renderBar(container, { ...data, horizontal: chartType !== 'bar-v' });
    }
  };

  const ChartLite = {
    COLORS,
    niceScale,
    donutArcPath,
    truncateLabel,
    formatNumber,
    render,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartLite;
  } else {
    root.ResearchAnswer = root.ResearchAnswer || {};
    root.ResearchAnswer.ChartLite = ChartLite;
  }
})(typeof window !== 'undefined' ? window : globalThis);
