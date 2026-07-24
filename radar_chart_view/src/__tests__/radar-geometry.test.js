const RadarGeometry = require('../js/lib/radar-geometry');

const approx = (actual, expected, precision = 6) => {
  expect(actual).toBeCloseTo(expected, precision);
};

describe('RadarGeometry.computeAxisAngles', () => {
  test('starts at the top (-90deg) and spaces axes evenly clockwise', () => {
    const angles = RadarGeometry.computeAxisAngles(4);
    expect(angles).toHaveLength(4);
    approx(angles[0], -Math.PI / 2);
    approx(angles[1], 0);
    approx(angles[2], Math.PI / 2);
    approx(angles[3], Math.PI);
  });

  test('supports the minimum (3) and maximum (8) axis counts', () => {
    expect(RadarGeometry.computeAxisAngles(3)).toHaveLength(3);
    expect(RadarGeometry.computeAxisAngles(8)).toHaveLength(8);
  });
});

describe('RadarGeometry.pointAt', () => {
  test('computes the point straight up from center at the given radius', () => {
    const p = RadarGeometry.pointAt(-Math.PI / 2, 100, { x: 0, y: 0 });
    approx(p.x, 0);
    approx(p.y, -100);
  });

  test('computes the point to the right of center', () => {
    const p = RadarGeometry.pointAt(0, 50, { x: 10, y: 10 });
    approx(p.x, 60);
    approx(p.y, 10);
  });
});

describe('RadarGeometry.computeSeriesPoints', () => {
  const axisAngles = RadarGeometry.computeAxisAngles(4);
  const center = { x: 0, y: 0 };

  test('a value equal to maxValue reaches the full radius', () => {
    const points = RadarGeometry.computeSeriesPoints(
      [100, 100, 100, 100],
      100,
      axisAngles,
      100,
      center,
    );
    approx(points[0].y, -100);
    approx(points[1].x, 100);
  });

  test('a value of 0 stays at the center', () => {
    const points = RadarGeometry.computeSeriesPoints(
      [0, 0, 0, 0],
      100,
      axisAngles,
      100,
      center,
    );
    points.forEach((p) => {
      approx(p.x, 0);
      approx(p.y, 0);
    });
  });

  test('clamps values above maxValue to the outer radius (does not overshoot)', () => {
    const points = RadarGeometry.computeSeriesPoints(
      [500],
      100,
      [axisAngles[0]],
      100,
      center,
    );
    approx(points[0].y, -100);
  });

  test('treats a maxValue of 0 as all-zero (avoids division by zero)', () => {
    const points = RadarGeometry.computeSeriesPoints(
      [10, 20],
      0,
      [axisAngles[0], axisAngles[1]],
      100,
      center,
    );
    approx(points[0].x, 0);
    approx(points[0].y, 0);
  });
});

describe('RadarGeometry.pointsToSvgString', () => {
  test('formats points as an SVG polygon "points" attribute string', () => {
    const str = RadarGeometry.pointsToSvgString([
      { x: 0, y: -100 },
      { x: 100, y: 0 },
    ]);
    expect(str).toBe('0,-100 100,0');
  });
});

describe('RadarGeometry.computeGridRings', () => {
  test('returns one ring per scale division, with proportional tick values', () => {
    const axisAngles = RadarGeometry.computeAxisAngles(4);
    const rings = RadarGeometry.computeGridRings(
      5,
      axisAngles,
      100,
      { x: 0, y: 0 },
      100,
    );
    expect(rings).toHaveLength(5);
    expect(rings.map((r) => r.tickValue)).toEqual([20, 40, 60, 80, 100]);
    // outermost ring reaches the full radius
    approx(rings[4].points[0].y, -100);
    // innermost ring reaches 1/5 of the radius
    approx(rings[0].points[0].y, -20);
  });
});
