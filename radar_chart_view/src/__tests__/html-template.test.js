const HtmlTemplate = require('../js/lib/html-template');

const buildPayload = (overrides) => ({
  title: 'テストチャート',
  axisLabels: [
    { code: 'sales', label: '売上' },
    { code: 'profit', label: '利益' },
    { code: 'cost', label: '原価' },
  ],
  scaleDivisions: 5,
  series: [{ label: 'A', count: 1, values: [10, 20, 30] }],
  sourceDescription: '表示中のレコード(1件)',
  truncated: false,
  generatedAt: '2026-07-24T00:00:00.000Z',
  ...overrides,
});

describe('HtmlTemplate.escapeScriptClose', () => {
  test('escapes "</" so a JSON blob cannot break out of its <script> tag', () => {
    const json = '{"x":"</script><script>alert(1)</script>"}';
    const escaped = HtmlTemplate.escapeScriptClose(json);
    expect(escaped).not.toMatch(/<\//);
    expect(escaped).toContain('<\\/script>');
  });

  test('leaves ordinary JSON untouched', () => {
    const json = '{"a":1,"b":"hello"}';
    expect(HtmlTemplate.escapeScriptClose(json)).toBe(json);
  });
});

describe('HtmlTemplate.buildRadarHtmlDocument', () => {
  test('returns a full standalone HTML document', () => {
    const html = HtmlTemplate.buildRadarHtmlDocument(buildPayload());
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('id="radar-data"');
    expect(html).toContain('id="radar-card-grid"');
  });

  test('embeds the payload as JSON exactly once, parseable back to the original data', () => {
    const payload = buildPayload();
    const html = HtmlTemplate.buildRadarHtmlDocument(payload);
    const match = html.match(
      /<script type="application\/json" id="radar-data">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    expect(JSON.parse(match[1])).toEqual(payload);
  });

  test('neutralizes "</script>" inside record-derived string values (XSS via label/title)', () => {
    const payload = buildPayload({
      title: '</script><script>alert(1)</script>',
      series: [
        {
          label: '</script><img src=x onerror=alert(1)>',
          count: 1,
          values: [1, 2, 3],
        },
      ],
    });
    const html = HtmlTemplate.buildRadarHtmlDocument(payload);

    // The only real </script> closing tags must be the 2 we author ourselves (JSON data +
    // standalone script). Any occurrence of "</script" coming from record/title data must have
    // been escaped to "<\/script" (backslash breaks the literal "</script" sequence), so the
    // browser's HTML tokenizer (which only looks for a literal "</script" to end a script
    // element) never sees a spurious close tag from user-controlled content.
    const rawScriptCloses = html.match(/<\/script/gi) || [];
    expect(rawScriptCloses.length).toBe(2);

    const match = html.match(
      /<script type="application\/json" id="radar-data">([\s\S]*?)<\/script>/,
    );
    const parsed = JSON.parse(match[1]);
    expect(parsed.title).toBe(payload.title);
    expect(parsed.series[0].label).toBe(payload.series[0].label);
  });

  test('embeds the static rendering script referenced by js/lib/standalone-page-script.js', () => {
    const StandalonePageScript = require('../js/lib/standalone-page-script');
    const html = HtmlTemplate.buildRadarHtmlDocument(buildPayload());
    expect(html).toContain(StandalonePageScript.STANDALONE_SCRIPT);
  });

  test('never uses innerHTML/insertAdjacentHTML in the static shell (textContent-only rendering policy)', () => {
    const html = HtmlTemplate.buildRadarHtmlDocument(buildPayload());
    expect(html).not.toMatch(/innerHTML/);
    expect(html).not.toMatch(/insertAdjacentHTML/);
  });
});
