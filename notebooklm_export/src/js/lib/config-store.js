(function (root) {
  'use strict';

  // プラグイン設定は「出力形式」(txt: NotebookLM向け/既定、md: Markdown対応の他ツール向け)のみ。
  const DEFAULT_CONFIG = { outputFormat: 'txt' };

  const load = (rawConfig) => {
    if (rawConfig && rawConfig.outputFormat === 'md') {
      return { outputFormat: 'md' };
    }
    return { ...DEFAULT_CONFIG };
  };

  const toRawConfig = (config) => ({
    outputFormat: config && config.outputFormat === 'md' ? 'md' : 'txt',
  });

  const ConfigStore = { load, toRawConfig, DEFAULT_CONFIG };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
