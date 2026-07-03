import {describe, it, expect} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';
import {
  buildCategoryGenderFilters,
  buildIsNewFilter,
  buildSizeColorFilters,
  buildPaginationWhere,
  buildRelevanceOrderBy,
  buildSortOrderBy,
} from '@/actions/lib/infiniteQuery-builder';
import {buildSearchRankExpr} from '@/actions/lib/search-builder';
import {NEW_PRODUCT_DAYS} from '@/lib/constants';

// Fragments render to plain {sql, params} — assertable without a database.
const pg = new PgDialect();
const render = (fragment: SQL | undefined) => {
  if (!fragment) throw new Error('expected a SQL fragment');
  const {sql, params} = pg.sqlToQuery(fragment);
  return {sql, params};
};

describe('buildPaginationWhere', () => {
  it('returns no conditions on the first page (lastId null)', () => {
    const where = buildPaginationWhere({
      sort: 'price',
      order: 'asc',
      lastId: null,
      lastValue: 500,
    });

    expect(where).toEqual([]);
  });

  it('sort by id: plain id cursor following the sort direction', () => {
    const asc = buildPaginationWhere({
      sort: 'id',
      order: 'asc',
      lastId: 'last-id',
      lastValue: null,
    });
    expect(render(asc[0])).toEqual({
      sql: '"products"."id" > $1',
      params: ['last-id'],
    });

    const desc = buildPaginationWhere({
      sort: 'id',
      order: 'desc',
      lastId: 'last-id',
      lastValue: null,
    });
    expect(render(desc[0]).sql).toBe('"products"."id" < $1');
  });

  it('sort by price: field cursor with id tie-break, value bound as string', () => {
    const where = buildPaginationWhere({
      sort: 'price',
      order: 'asc',
      lastId: 'last-id',
      lastValue: 500,
    });

    expect(where).toHaveLength(1);
    expect(render(where[0])).toEqual({
      sql: '("products"."price" > $1 or ("products"."price" = $2 and "products"."id" > $3))',
      params: ['500', '500', 'last-id'],
    });
  });

  it('sort by name desc: comparators flip for both field and tie-break', () => {
    const where = buildPaginationWhere({
      sort: 'name',
      order: 'desc',
      lastId: 'last-id',
      lastValue: 'Acme Jacket',
    });

    expect(render(where[0])).toEqual({
      sql: '("products"."name" < $1 or ("products"."name" = $2 and "products"."id" < $3))',
      params: ['Acme Jacket', 'Acme Jacket', 'last-id'],
    });
  });

  it('falls back to the id cursor when there is no sort value to resume from', () => {
    const where = buildPaginationWhere({
      sort: 'price',
      order: 'asc',
      lastId: 'last-id',
      lastValue: null,
    });

    expect(render(where[0]).sql).toBe('"products"."id" > $1');
  });

  it('rank cursor when a rank expression and numeric last rank are given', () => {
    const rankExpr = buildSearchRankExpr('nike', 'fts')!;
    const where = buildPaginationWhere({
      sort: 'id',
      order: 'asc',
      lastId: 'last-id',
      lastValue: 0.42,
      rankExpr,
    });

    expect(where).toHaveLength(1);
    const {sql, params} = render(where[0]);
    expect(sql).toMatch(/ts_rank[\s\S]*< \$2 or \([\s\S]*ts_rank[\s\S]*= \$4 and "products"."id" > \$5\)/);
    expect(params).toEqual(['nike:*', 0.42, 'nike:*', 0.42, 'last-id']);
  });

  it('ignores the rank expression when the last value is not a number', () => {
    const rankExpr = buildSearchRankExpr('nike', 'fts')!;
    const where = buildPaginationWhere({
      sort: 'id',
      order: 'asc',
      lastId: 'last-id',
      lastValue: '0.42',
      rankExpr,
    });

    expect(render(where[0]).sql).toBe('"products"."id" > $1');
  });
});

describe('buildSortOrderBy / buildRelevanceOrderBy', () => {
  it('orders by the sort field with an id tie-break in the same direction', () => {
    const priceAsc = buildSortOrderBy('price', 'asc').map((f) => render(f).sql);
    expect(priceAsc).toEqual(['"products"."price" asc', '"products"."id" asc']);

    const nameDesc = buildSortOrderBy('name', 'desc').map((f) => render(f).sql);
    expect(nameDesc).toEqual(['"products"."name" desc', '"products"."id" desc']);

    const idAsc = buildSortOrderBy('id', 'asc').map((f) => render(f).sql);
    expect(idAsc).toEqual(['"products"."id" asc', '"products"."id" asc']);
  });

  it('relevance: best rank first, id ascending tie-break, order param ignored', () => {
    const rankExpr = buildSearchRankExpr('nike', 'fts')!;
    const [primary, tieBreak] = buildRelevanceOrderBy(rankExpr).map(
      (f) => render(f).sql,
    );

    expect(primary).toContain('ts_rank');
    expect(primary).toMatch(/ desc$/);
    expect(tieBreak).toBe('"products"."id" asc');
  });
});

describe('filter builders', () => {
  it('always hides unpublished products, even with no category or gender', () => {
    const filters = buildCategoryGenderFilters(null, null);

    expect(filters).toHaveLength(1);
    expect(render(filters[0]).sql).toBe('"products"."published_at" <= NOW()');
  });

  it('adds equality filters for gender and category', () => {
    const rendered = buildCategoryGenderFilters('t-shirts', 'men').map(render);

    expect(rendered).toEqual([
      {sql: '"products"."gender" = $1', params: ['men']},
      {sql: '"products"."category" = $1', params: ['t-shirts']},
      {sql: '"products"."published_at" <= NOW()', params: []},
    ]);
  });

  it('buildIsNewFilter gates on NEW_PRODUCT_DAYS only when asked', () => {
    expect(buildIsNewFilter(false)).toEqual([]);

    const [isNew] = buildIsNewFilter(true);
    expect(render(isNew).sql).toBe(
      `"products"."published_at" > NOW() - INTERVAL '${NEW_PRODUCT_DAYS} days'`,
    );
  });

  it('sizes filter uses JSONB containment per size, ORed together', () => {
    const [sizes] = buildSizeColorFilters(['M', 'L'], []);

    expect(render(sizes)).toEqual({
      sql: '("products"."sizes" @> $1 or "products"."sizes" @> $2)',
      params: ['["M"]', '["L"]'],
    });
  });

  it('color filter ORs equality per color', () => {
    const [colors] = buildSizeColorFilters([], ['red', 'blue']);

    expect(render(colors)).toEqual({
      sql: '("products"."color" = $1 or "products"."color" = $2)',
      params: ['red', 'blue'],
    });
  });

  it('returns both condition groups when sizes and colors are set', () => {
    expect(buildSizeColorFilters(['M'], ['red'])).toHaveLength(2);
    expect(buildSizeColorFilters([], [])).toEqual([]);
  });
});
