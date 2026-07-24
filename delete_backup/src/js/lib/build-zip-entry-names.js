(function (root) {
  'use strict';

  // collect-file-fields.jsが抽出したファイル一覧に、zip内のエントリー名(パス)を割り当てる。
  // フィールドコードごとにディレクトリを分けることで、異なるフィールド間でのファイル名衝突を防ぐ。
  // 同一フィールド内でファイル名が重複した場合のみ、「name (2).ext」のように連番を付けて回避する。
  const splitExtension = (name) => {
    const dotIndex = name.lastIndexOf('.');
    // 先頭がドットのみ(隠しファイル的な名前)や、ドットが無い場合は拡張子無し扱いにする。
    if (dotIndex <= 0) {
      return { base: name, ext: '' };
    }
    return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) };
  };

  const buildZipEntryNames = (files) => {
    const usedPathsByDir = new Map();

    return files.map((file) => {
      const dir = `files/${file.fieldCode}`;
      const used = usedPathsByDir.get(dir) || new Set();
      const { base, ext } = splitExtension(file.name);

      let candidate = `${dir}/${file.name}`;
      let suffix = 2;
      while (used.has(candidate)) {
        candidate = `${dir}/${base} (${suffix})${ext}`;
        suffix += 1;
      }
      used.add(candidate);
      usedPathsByDir.set(dir, used);

      return { ...file, entryName: candidate };
    });
  };

  const BuildZipEntryNames = { buildZipEntryNames };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildZipEntryNames;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.BuildZipEntryNames = BuildZipEntryNames;
  }
})(typeof window !== 'undefined' ? window : globalThis);
