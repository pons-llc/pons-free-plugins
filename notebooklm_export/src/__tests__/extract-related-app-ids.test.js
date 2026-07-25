'use strict';

const { extractRelatedAppIds } = require('../js/lib/extract-related-app-ids');

describe('extractRelatedAppIds', () => {
  test('LOOKUPフィールド(コピー元のフィールドタイプで返る)を検出する', () => {
    const properties = {
      ルックアップ_0: {
        type: 'SINGLE_LINE_TEXT',
        code: 'ルックアップ_0',
        lookup: { relatedApp: { app: '100', code: '' } },
      },
    };
    expect(extractRelatedAppIds(properties)).toEqual([
      { fieldCode: 'ルックアップ_0', fieldType: 'LOOKUP', relatedAppId: '100' },
    ]);
  });

  test('REFERENCE_TABLEフィールドを検出する', () => {
    const properties = {
      関連レコード一覧_0: {
        type: 'REFERENCE_TABLE',
        code: '関連レコード一覧_0',
        referenceTable: { relatedApp: { app: '3', code: 'APPB' } },
      },
    };
    expect(extractRelatedAppIds(properties)).toEqual([
      {
        fieldCode: '関連レコード一覧_0',
        fieldType: 'REFERENCE_TABLE',
        relatedAppId: '3',
      },
    ]);
  });

  test('lookup/referenceTableがnull(参照先アプリへの権限が無い)の場合は除外する', () => {
    const properties = {
      ルックアップ_0: {
        type: 'SINGLE_LINE_TEXT',
        code: 'ルックアップ_0',
        lookup: null,
      },
      関連レコード一覧_0: {
        type: 'REFERENCE_TABLE',
        code: '関連レコード一覧_0',
        referenceTable: null,
      },
    };
    expect(extractRelatedAppIds(properties)).toEqual([]);
  });

  test('SUBTABLE内のフィールドも再帰的に走査する', () => {
    const properties = {
      テーブル_0: {
        type: 'SUBTABLE',
        code: 'テーブル_0',
        fields: {
          ルックアップ_1: {
            type: 'NUMBER',
            code: 'ルックアップ_1',
            lookup: { relatedApp: { app: '200', code: '' } },
          },
        },
      },
    };
    expect(extractRelatedAppIds(properties)).toEqual([
      { fieldCode: 'ルックアップ_1', fieldType: 'LOOKUP', relatedAppId: '200' },
    ]);
  });

  test('LOOKUP/REFERENCE_TABLE以外の通常フィールドは無視する', () => {
    const properties = {
      文字列1行_0: { type: 'SINGLE_LINE_TEXT', code: '文字列1行_0' },
    };
    expect(extractRelatedAppIds(properties)).toEqual([]);
  });

  test('propertiesが未定義でも空配列を返す', () => {
    expect(extractRelatedAppIds(undefined)).toEqual([]);
  });
});
