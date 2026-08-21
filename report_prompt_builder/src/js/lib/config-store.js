(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  // outputModes: { individual, bulk } … 対応する出力方法(最低1つ有効。config-validationで担保)
  // pages: [{
  //   items: [
  //     { kind:'FIELD', code, label, type, showLabel, fontSizePt, wrap, bordered, labelPosition,
  //       textAlign, row, colStart, colSpan },
  //     { kind:'TABLE', code, label, fontSizePt, wrap, bordered, row, colStart, colSpan,
  //       columns: [{code,label,type}] },
  //     { kind:'TEXT', text, fontSizePt, wrap, bordered, textAlign, row, colStart, colSpan },
  //   ],
  //   rowPadding: { [行番号]: 余白px },
  // }] … ページごとの12列グリッド配置(idea.md「グリッド配置」参照)
  // images: { [imageId]: dataURL(文字列) } … 社印・ロゴなど、レコードに紐付かない固定画像
  //   (IMAGE項目から imageId で参照される)。kintoneのプラグイン設定保存は「1つの値につき
  //   最大65,535文字」のため、pagesとは別に画像1点ごとに専用の設定キー(`image_<imageId>`)へ
  //   平坦に保存する(idea.md「データモデル」参照)。
  // saveToAttachment: { enabled, fieldCode, fileNamePrefix } … 個別出力時に生成したPDFを、
  //   レコードの添付ファイルフィールド(fieldCode)にも保存するかどうか(任意・既定は無効。
  //   ユーザー指示「添付ファイルフィールドに保存するかは選択制にしてね」)。fileNamePrefixは
  //   ファイル名の固定部分で、実際のファイル名は「固定テキスト+タイムスタンプ」になる
  //   (ユーザー指示「ファイル保存時の名称は固定テキスト+タイムスタンプ。configで設定できる
  //   ように」、組み立ては js/lib/attachment-field.js の buildAttachmentFileName)。
  const DEFAULTS = {
    outputModes: { individual: true, bulk: false },
    pages: [],
    images: {},
    saveToAttachment: { enabled: false, fieldCode: '', fileNamePrefix: '帳票' },
  };

  const IMAGE_KEY_PREFIX = 'image_';

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  // 旧バージョン(AIプロンプト生成方式、idea.md「経緯」参照)はpageが{pageSize,orientation,
  // fields,tables}という形でitemsを持たない。そのまま読み込むとconfig.js/report-model.jsの
  // page.items.map()等が例外になるため、items配列を持たないpageは items:[] に正規化する
  // (旧データのfields/tablesはグリッド座標を持たないため自動移行はできず、破棄して空のグリッドに
  // なる。ユーザーが再配置する)。
  const normalizePages = (pages) => {
    if (!Array.isArray(pages)) {
      return DEFAULTS.pages;
    }
    return pages.map((page) => ({
      items: Array.isArray(page && page.items) ? page.items : [],
      rowPadding:
        page &&
        typeof page.rowPadding === 'object' &&
        page.rowPadding !== null &&
        !Array.isArray(page.rowPadding)
          ? page.rowPadding
          : {},
    }));
  };

  // image_<imageId>というキーで平坦に保存された画像を集めてimagesオブジェクトに戻す。
  // 値はJSONではなくdataURLの生文字列なので、そのまま使う。
  const collectImages = (saved) => {
    const images = {};
    Object.keys(saved).forEach((key) => {
      if (key.startsWith(IMAGE_KEY_PREFIX)) {
        images[key.slice(IMAGE_KEY_PREFIX.length)] = saved[key];
      }
    });
    return images;
  };

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体がnull/undefinedでも
  // 例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      outputModes: parseJsonOr(saved.outputModes, DEFAULTS.outputModes),
      pages: normalizePages(parseJsonOr(saved.pages, DEFAULTS.pages)),
      images: collectImages(saved),
      saveToAttachment: parseJsonOr(
        saved.saveToAttachment,
        DEFAULTS.saveToAttachment,
      ),
    };
  };

  const serialize = (config) => {
    const imageEntries = Object.entries(config.images || {}).map(
      ([imageId, dataUrl]) => [`${IMAGE_KEY_PREFIX}${imageId}`, dataUrl],
    );
    return {
      outputModes: JSON.stringify(config.outputModes),
      pages: JSON.stringify(config.pages),
      saveToAttachment: JSON.stringify(
        config.saveToAttachment || DEFAULTS.saveToAttachment,
      ),
      ...Object.fromEntries(imageEntries),
    };
  };

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
