'use strict';

const TreeBuilder = require('../js/lib/tree-builder');

const record = (id, parent, name) => ({
  $id: { type: '__ID__', value: id },
  parent_code: { type: 'SINGLE_LINE_TEXT', value: parent },
  name: { type: 'SINGLE_LINE_TEXT', value: name },
});

describe('TreeBuilder.buildTree (basic hierarchy)', () => {
  test('builds a nested tree from flat records using $id as the match field', () => {
    const records = [
      record('1', '', 'root'),
      record('2', '1', 'child-a'),
      record('3', '1', 'child-b'),
      record('4', '2', 'grandchild'),
    ];
    const tree = TreeBuilder.buildTree(records, 'parent_code', '$id');

    expect(tree).toHaveLength(1);
    expect(tree[0].record.name.value).toBe('root');
    expect(tree[0].children.map((c) => c.record.name.value)).toEqual([
      'child-a',
      'child-b',
    ]);
    const childA = tree[0].children[0];
    expect(childA.children.map((c) => c.record.name.value)).toEqual([
      'grandchild',
    ]);
  });

  test('treats records with an empty parent value as roots', () => {
    const records = [record('1', '', 'root-1'), record('2', '', 'root-2')];
    const tree = TreeBuilder.buildTree(records, 'parent_code', '$id');
    expect(tree.map((n) => n.record.name.value)).toEqual(['root-1', 'root-2']);
  });

  test('treats a record whose parent value matches no other record as a root (orphan)', () => {
    const records = [record('1', 'does-not-exist', 'orphan')];
    const tree = TreeBuilder.buildTree(records, 'parent_code', '$id');
    expect(tree).toHaveLength(1);
    expect(tree[0].record.name.value).toBe('orphan');
  });

  test('treats a record pointing to itself as a root instead of self-nesting', () => {
    const records = [record('1', '1', 'self-parent')];
    const tree = TreeBuilder.buildTree(records, 'parent_code', '$id');
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([]);
  });

  test('returns an empty array when there are no records', () => {
    expect(TreeBuilder.buildTree([], 'parent_code', '$id')).toEqual([]);
  });
});

describe('TreeBuilder.buildTree (cycle safety)', () => {
  test('does not hang and surfaces every record exactly once when the data has a cycle', () => {
    // A -> parent B, B -> parent C, C -> parent A (循環参照)
    const records = [
      record('A', 'B', 'a'),
      record('B', 'C', 'b'),
      record('C', 'A', 'c'),
    ];
    const tree = TreeBuilder.buildTree(records, 'parent_code', '$id');

    const collectNames = (nodes) =>
      nodes.reduce(
        (names, node) => [
          ...names,
          node.record.name.value,
          ...collectNames(node.children),
        ],
        [],
      );
    const names = collectNames(tree);
    expect(names.sort()).toEqual(['a', 'b', 'c']);
  });
});
