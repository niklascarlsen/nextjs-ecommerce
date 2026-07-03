import {describe, it, expect} from 'vitest';
import {
  buildCategoryTree,
  transformTreeToNavLinks,
} from '@/actions/lib/categoryTree-builder';
import type {Category} from '@/lib/types/category-types';

// Minimal factory: only the fields the builders read matter; the rest are
// filled with valid defaults so we get a real Category shape.
const cat = (overrides: Partial<Category> & Pick<Category, 'id'>): Category => ({
  name: `cat-${overrides.id}`,
  slug: `slug-${overrides.id}`,
  type: 'SUB-CATEGORY',
  displayOrder: 0,
  isActive: true,
  desktopImage: null,
  mobileImage: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  parentId: null,
  ...overrides,
});

describe('buildCategoryTree', () => {
  it('returns an empty array for no input', () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it('nests children under their parent by parentId', () => {
    const flat = [
      cat({id: 1, parentId: null}),
      cat({id: 2, parentId: 1}),
      cat({id: 3, parentId: 1}),
    ];

    const tree = buildCategoryTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children?.map((c) => c.id)).toEqual([2, 3]);
  });

  it('nests recursively to grandchildren', () => {
    const flat = [
      cat({id: 1, parentId: null}),
      cat({id: 2, parentId: 1}),
      cat({id: 3, parentId: 2}),
    ];

    const tree = buildCategoryTree(flat);

    expect(tree[0].children?.[0].id).toBe(2);
    expect(tree[0].children?.[0].children?.[0].id).toBe(3);
  });

  it('omits the children key entirely for leaf nodes', () => {
    const flat = [cat({id: 1, parentId: null})];

    const tree = buildCategoryTree(flat);

    expect('children' in tree[0]).toBe(false);
  });

  it('preserves input order (does not sort)', () => {
    const flat = [
      cat({id: 1, parentId: null, displayOrder: 5}),
      cat({id: 2, parentId: null, displayOrder: 1}),
    ];

    const tree = buildCategoryTree(flat);

    expect(tree.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe('transformTreeToNavLinks', () => {
  it('builds a /c/{slug} href for a top-level category', () => {
    const tree = buildCategoryTree([
      cat({id: 1, slug: 'men', type: 'MAIN-CATEGORY'}),
    ]);

    const [link] = transformTreeToNavLinks(tree);

    expect(link.title).toBe('cat-1');
    expect(link.href).toBe('/c/men');
    // Leaf nodes have no children key, so isFolder is undefined (falsy), not false.
    expect(link.isFolder).toBeFalsy();
  });

  it('accumulates ancestor slugs into nested hrefs', () => {
    const tree = buildCategoryTree([
      cat({id: 1, slug: 'men', type: 'MAIN-CATEGORY'}),
      cat({id: 2, slug: 't-shirts', parentId: 1}),
    ]);

    const [men] = transformTreeToNavLinks(tree);

    expect(men.isFolder).toBe(true);
    expect(men.children?.[0].href).toBe('/c/men/t-shirts');
  });

  it('CONTAINER nodes get a null href and add no URL segment', () => {
    // men > [CONTAINER "clothing"] > t-shirts
    const tree = buildCategoryTree([
      cat({id: 1, slug: 'men', type: 'MAIN-CATEGORY'}),
      cat({id: 2, slug: 'clothing', type: 'CONTAINER', parentId: 1}),
      cat({id: 3, slug: 't-shirts', parentId: 2}),
    ]);

    const [men] = transformTreeToNavLinks(tree);
    const container = men.children![0];
    const tshirts = container.children![0];

    expect(container.href).toBeNull();
    // The container's own slug is skipped, so the leaf stays at /c/men/t-shirts
    expect(tshirts.href).toBe('/c/men/t-shirts');
  });

  it('passes displayOrder through to the nav link', () => {
    const tree = buildCategoryTree([
      cat({id: 1, slug: 'men', displayOrder: 3}),
    ]);

    const [link] = transformTreeToNavLinks(tree);

    expect(link.displayOrder).toBe(3);
  });
});
