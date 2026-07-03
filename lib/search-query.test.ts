import {describe, it, expect} from 'vitest';
import {
  normalizeProductSearchQuery,
  productSearchTsQuery,
  productSearchIlikePattern,
  productSearchGenderExactIlikePattern,
} from '@/lib/search-query';

describe('normalizeProductSearchQuery', () => {
  it('returns an empty string for undefined or empty input', () => {
    expect(normalizeProductSearchQuery(undefined)).toBe('');
    expect(normalizeProductSearchQuery('')).toBe('');
  });

  it('trims and collapses internal whitespace', () => {
    expect(normalizeProductSearchQuery('  nike \t  air \n jordan ')).toBe(
      'nike air jordan',
    );
  });
});

describe('productSearchTsQuery', () => {
  it('returns null when there is nothing to search for', () => {
    expect(productSearchTsQuery(undefined)).toBeNull();
    expect(productSearchTsQuery('   ')).toBeNull();
    expect(productSearchTsQuery('!!!')).toBeNull();
  });

  it('builds prefix terms joined with AND', () => {
    expect(productSearchTsQuery('nike')).toBe('nike:*');
    expect(productSearchTsQuery('nike air')).toBe('nike:* & air:*');
  });

  it('keeps hyphens in compounds to align with to_tsvector', () => {
    expect(productSearchTsQuery('t-shir')).toBe('t-shir:*');
    expect(productSearchTsQuery('v-neck')).toBe('v-neck:*');
    expect(productSearchTsQuery('long-sleeve')).toBe('long-sleeve:*');
    expect(productSearchTsQuery('t--shirt')).toBe('t--shirt:*');
    expect(productSearchTsQuery('-shirt')).toBe('shirt:*');
    expect(productSearchTsQuery('shirt-')).toBe('shirt:*');
  });

  it('unifies t-shirt spelling variants so all become real FTS matches', () => {
    const group = '(t-shirt:* | tshirt:* | tshirts:*)';
    expect(productSearchTsQuery('t-shirt')).toBe(group);
    expect(productSearchTsQuery('tshirt')).toBe(group);
    expect(productSearchTsQuery('tshirts')).toBe(group);
    expect(productSearchTsQuery('t shirt')).toBe('t:* & shirt:*');
    expect(productSearchTsQuery('red t-shirt')).toBe(`red:* & ${group}`);
  });

  it('keeps unicode letters and digits', () => {
    expect(productSearchTsQuery('kläder 42')).toBe('kläder:* & 42:*');
  });

  it('expands irregular-plural synonyms into an OR group, case-insensitively', () => {
    expect(productSearchTsQuery('man')).toBe('(man:* | men:*)');
    expect(productSearchTsQuery('WOMEN')).toBe('(woman:* | women:*)');
    expect(productSearchTsQuery('men jacket')).toBe(
      '(man:* | men:*) & jacket:*',
    );
  });
});

describe('productSearchIlikePattern', () => {
  it('returns null for empty input', () => {
    expect(productSearchIlikePattern(undefined)).toBeNull();
    expect(productSearchIlikePattern('  ')).toBeNull();
  });

  it('wraps the normalized query in % wildcards', () => {
    expect(productSearchIlikePattern(' nike ')).toBe('%nike%');
  });

  it('escapes LIKE metacharacters so they match literally', () => {
    expect(productSearchIlikePattern('50%')).toBe('%50\\%%');
    expect(productSearchIlikePattern('a_b')).toBe('%a\\_b%');
    expect(productSearchIlikePattern('a\\b')).toBe('%a\\\\b%');
  });
});

describe('productSearchGenderExactIlikePattern', () => {
  it('returns null for empty input', () => {
    expect(productSearchGenderExactIlikePattern(undefined)).toBeNull();
    expect(productSearchGenderExactIlikePattern(' ')).toBeNull();
  });

  it('returns the normalized query without wildcards (exact match)', () => {
    expect(productSearchGenderExactIlikePattern(' men ')).toBe('men');
  });

  it('escapes LIKE metacharacters', () => {
    expect(productSearchGenderExactIlikePattern('50%')).toBe('50\\%');
  });
});
