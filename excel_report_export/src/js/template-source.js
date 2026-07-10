(function (global, kintone) {
  'use strict';

  // テンプレート参照先(アプリID + レコードID + 添付ファイルフィールドのフィールドコード)から、
  // Excelテンプレートの実バイト列(ArrayBuffer)を取得する。
  //
  // - レコード取得(GET /k/v1/record.json)は kintone.api() で行う(kintone自身への呼び出し)。
  // - ファイルダウンロード(GET /k/v1/file.json)は kintone.api() が「利用できないAPI」として
  //   明記しているため(公式ドキュメント「kintone REST APIリクエストを送信する」の制限事項)、
  //   ドキュメントのサンプルコードどおり fetch() を使う。ただしURLは kintone.api.url() で
  //   組み立てており(secureCodingGuideline.mdの「URLの取得」に準拠)、宛先は常にkintone自身の
  //   `/k/v1/file.json` のみで、外部サーバーへは一切通信しない。判断記録.md参照。

  const NS = global.ExcelReportExport;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);
  const fileUrl = (fileKey) =>
    `${kintone.api.url('/k/v1/file.json', true)}?fileKey=${encodeURIComponent(fileKey)}`;

  // テンプレート参照先レコードを取得する。対象アプリ/レコードが削除されている、または
  // 閲覧権限がない場合はkintone.api()がエラーを返すので、そのまま呼び出し元へ伝播させる
  // (暫定対応: エラーメッセージを表示し処理を中断する。判断記録.md参照)。
  const fetchTemplateRecord = async (templateSource) => {
    if (!templateSource || !templateSource.appId || !templateSource.recordId) {
      throw new Error(
        'テンプレート参照先(アプリID・レコードID)が設定されていません。',
      );
    }
    const resp = await kintone.api(recordUrl(), 'GET', {
      app: templateSource.appId,
      id: templateSource.recordId,
    });
    return resp.record;
  };

  // 添付ファイルフィールドの1番目のファイルのfileKeyを取り出す。
  // フィールドが存在しない/添付ファイル型でない/ファイルが1つもない場合は、
  // 原因を特定できるメッセージ付きの例外を投げる。
  const extractFirstFileKey = (record, fieldCode) => {
    const field = record && record[fieldCode];
    if (!field) {
      throw new Error(
        `テンプレート参照先レコードにフィールド「${fieldCode}」が見つかりません。フィールドコードが変更・削除された可能性があります。`,
      );
    }
    if (field.type !== 'FILE') {
      throw new Error(
        `フィールド「${fieldCode}」は添付ファイルフィールドではありません(type: ${field.type})。`,
      );
    }
    if (!field.value || field.value.length === 0) {
      throw new Error(
        `フィールド「${fieldCode}」にファイルが添付されていません。`,
      );
    }
    return field.value[0].fileKey;
  };

  const downloadFileArrayBuffer = async (fileKey) => {
    const resp = await fetch(fileUrl(fileKey), {
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!resp.ok) {
      throw new Error(
        `テンプレートファイルのダウンロードに失敗しました(HTTP ${resp.status})。`,
      );
    }
    const blob = await resp.blob();
    return blob.arrayBuffer();
  };

  // テンプレート参照先設定からテンプレートファイルのArrayBufferまでを一気通貫で取得する。
  const fetchTemplateArrayBuffer = async (templateSource) => {
    const record = await fetchTemplateRecord(templateSource);
    const fileKey = extractFirstFileKey(record, templateSource.fieldCode);
    return downloadFileArrayBuffer(fileKey);
  };

  NS.TemplateSource = {
    fetchTemplateRecord,
    extractFirstFileKey,
    downloadFileArrayBuffer,
    fetchTemplateArrayBuffer,
  };
})(window, kintone);
