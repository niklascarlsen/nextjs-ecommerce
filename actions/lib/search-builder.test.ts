import {describe, it, expect} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';
import {
  buildSearchFilters,
  buildSearchRankExpr,
  shouldFallBackToFuzzy,
} from '@/actions/lib/search-builder';

// Fragments render to plain {sql, params} — assertable without a database.
const pg = new PgDialect();
const render = (fragment: SQL | undefined) => {
  if (!fragment) throw new Error('expected a SQL fragment');
  const {sql, params} = pg.sqlToQuery(fragment);
  return {sql, params};
};

describe('buildSearchFilters', () => {
  it('fts: matches search_vector against a bound prefix tsquery', () => {
    const filters = buildSearchFilters('nike air', 'fts');

    expect(filters).toHaveLength(1);
    expect(render(filters[0])).toEqual({
      sql: `"products"."search_vector" @@ to_tsquery('english', $1)`,
      params: ['nike:* & air:*'],
    });
  });

  it('fts: returns no filters for an empty or whitespace query', () => {
    expect(buildSearchFilters(undefined, 'fts')).toEqual([]);
    expect(buildSearchFilters('   ', 'fts')).toEqual([]);
  });

  it('fuzzy: ORs word_similarity over name, color and category', () => {
    const filters = buildSearchFilters('nikee', 'fuzzy');

    expect(filters).toHaveLength(1);
    const {sql, params} = render(filters[0]);
    expect(sql).toBe(
      '(word_similarity($1, "products"."name") > $2 or word_similarity($3, "products"."color") > $4 or word_similarity($5, "products"."category") > $6)',
    );
    expect(params).toEqual(['nikee', 0.3, 'nikee', 0.3, 'nikee', 0.3]);
  });

  it('fuzzy: normalizes whitespace and returns no filters when empty', () => {
    const filters = buildSearchFilters('nike   air ', 'fuzzy');
    expect(render(filters[0]).params[0]).toBe('nike air');

    expect(buildSearchFilters('  ', 'fuzzy')).toEqual([]);
  });
});

describe('buildSearchRankExpr', () => {
  it('fts: ts_rank on search_vector, cast to float8 for cursor equality', () => {
    const {sql, params} = render(buildSearchRankExpr('nike', 'fts')!);

    expect(sql).toBe(
      `(ts_rank("products"."search_vector", to_tsquery('english', $1)))::float8`,
    );
    expect(params).toEqual(['nike:*']);
  });

  it('fuzzy: greatest of weighted similarities, cast to float8', () => {
    const {sql, params} = render(buildSearchRankExpr('nike', 'fuzzy')!);

    expect(sql).toContain('greatest(');
    expect(sql).toContain('"products"."color") * 0.5');
    expect(sql).toContain('"products"."category") * 0.25');
    expect(sql).toContain('::float8');
    expect(params).toEqual(['nike', 'nike', 'nike']);
  });

  it('returns null for an empty query in both modes', () => {
    expect(buildSearchRankExpr(undefined, 'fts')).toBeNull();
    expect(buildSearchRankExpr(' ', 'fuzzy')).toBeNull();
  });
});

describe('shouldFallBackToFuzzy', () => {
  it('retries when a first-page fts search finds nothing', () => {
    expect(shouldFallBackToFuzzy('fts', null, 0)).toBe(true);
  });

  it('never retries in fuzzy mode', () => {
    expect(shouldFallBackToFuzzy('fuzzy', null, 0)).toBe(false);
  });

  it('never retries past the first page (mode is sticky via searchMode)', () => {
    expect(shouldFallBackToFuzzy('fts', 'last-id', 0)).toBe(false);
  });

  it('does not retry when fts found results', () => {
    expect(shouldFallBackToFuzzy('fts', null, 5)).toBe(false);
  });
});
