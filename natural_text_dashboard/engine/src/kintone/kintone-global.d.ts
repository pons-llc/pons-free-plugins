/**
 * kintone JS SDKの型は導入せず、グローバルを any として扱う(この私的プラグイン専用のため、
 * @kintone/dts-gen 等の依存追加は見送り、必要なメソッドだけ都度キャストして使う)。
 */
declare const kintone: any;
