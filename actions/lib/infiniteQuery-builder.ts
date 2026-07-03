import {and, or, eq, gt, lt, desc, asc, sql, type SQL} from 'drizzle-orm';
import {productsTable} from '@/drizzle/db/schema';

import {NEW_PRODUCT_DAYS} from '@/lib/constants';
import type {SortField, SortOrder} from '@/lib/types/query-types';

// Filter, cursor-pagination and ordering SQL fragments for the catalog grid —
// no DB access here, so the module stays unit-testable (see
// infiniteQuery-builder.test.ts). Search fragments live in search-builder.ts.

/* ------------------------------- Filters ------------------------------- */

/**
 * Category and gender filters; always hides products scheduled for future
 * publish.
 * @param category Slug or null for any
 * @param gender Slug or null for any
 */
export function buildCategoryGenderFilters(
  category: string | null,
  gender: string | null,
) {
  const conditions = [];
  if (gender) conditions.push(eq(productsTable.gender, gender));
  if (category) conditions.push(eq(productsTable.category, category));

  conditions.push(sql`${productsTable.published_at} <= NOW()`);

  return conditions;
}

/**
 * Single source of truth for the "is new" predicate: published within
 * NEW_PRODUCT_DAYS. Add `.as('isNew')` when used as a selected column.
 */
export const isNewSql = () =>
  sql<boolean>`${productsTable.published_at} > NOW() - INTERVAL '${sql.raw(NEW_PRODUCT_DAYS.toString())} days'`;

/**
 * "New in" filter — products published within NEW_PRODUCT_DAYS.
 * @param isNewOnly When false, returns no extra conditions
 */
export function buildIsNewFilter(isNewOnly: boolean) {
  if (!isNewOnly) return [];

  return [isNewSql()];
}

/**
 * Size (JSONB contains) and color equality filters.
 */
export function buildSizeColorFilters(sizes: string[], color: string[]) {
  const conditions = [];

  if (sizes.length) {
    const sizeConditions = sizes.map(
      (size) => sql`${productsTable.sizes} @> ${JSON.stringify([size])}`,
    );
    conditions.push(or(...sizeConditions));
  }

  if (color.length) {
    const colorConditions = color.map((c) => eq(productsTable.color, c));
    conditions.push(or(...colorConditions));
  }

  return conditions;
}

/* --------------------------- Cursor pagination -------------------------- */

/**
 * Cursor WHERE for the next page. Picks the strategy from the inputs:
 * - first page (lastId null): no conditions
 * - relevance search (rankExpr set, numeric lastValue = last rank): rank cursor
 * - sort by id, or no sort value to resume from: plain id cursor
 * - sort by price/name: field cursor with id tie-break
 */
export function buildPaginationWhere({
  sort,
  order,
  lastId,
  lastValue,
  rankExpr = null,
}: {
  sort: SortField;
  order: SortOrder;
  lastId: string | null;
  lastValue: number | string | null;
  rankExpr?: SQL<number> | null;
}) {
  if (lastId === null) return [];

  if (rankExpr !== null && typeof lastValue === 'number') {
    return buildRankCursor(rankExpr, lastId, lastValue);
  }

  if (sort === 'id' || lastValue === null) {
    return buildIdCursor(order, lastId);
  }

  return buildFieldCursor(sort, order, lastId, lastValue);
}

/**
 * Cursor for relevance-ordered pages:
 * (rank < lastRank) OR (rank = lastRank AND id > lastId).
 */
function buildRankCursor(rankExpr: SQL<number>, lastId: string, lastRank: number) {
  return [
    or(
      sql`${rankExpr} < ${lastRank}`,
      and(sql`${rankExpr} = ${lastRank}`, gt(productsTable.id, lastId)),
    ),
  ];
}

/** Simple ID-based cursor (sort by id). */
function buildIdCursor(order: SortOrder, lastId: string) {
  const cmp = order === 'asc' ? gt : lt;
  return [cmp(productsTable.id, lastId)];
}

/**
 * Cursor on price or name with id tie-breaker:
 * (sortField > lastValue) OR (sortField = lastValue AND id > lastId).
 */
function buildFieldCursor(
  sort: 'price' | 'name',
  order: SortOrder,
  lastId: string,
  lastValue: number | string,
) {
  const sortField = sort === 'price' ? productsTable.price : productsTable.name;
  const cmp = order === 'asc' ? gt : lt;
  // Cursor values compare as strings; Postgres casts back for price.
  const cursorValue = String(lastValue);

  return [
    or(
      cmp(sortField, cursorValue),
      and(eq(sortField, cursorValue), cmp(productsTable.id, lastId)),
    ),
  ];
}

/* ------------------------------- Ordering ------------------------------ */

/**
 * ORDER BY for relevance: best match first, id tie-break for stable
 * pagination. Deliberately ignores the order param.
 */
export function buildRelevanceOrderBy(rankExpr: SQL<number>) {
  return [desc(rankExpr), asc(productsTable.id)];
}

const sortColumns = {
  id: productsTable.id,
  price: productsTable.price,
  name: productsTable.name,
} as const;

/**
 * ORDER BY primary field plus id for stable pagination.
 */
export function buildSortOrderBy(sort: SortField, order: SortOrder) {
  const direction = order === 'asc' ? asc : desc;
  const column = sortColumns[sort] ?? productsTable.id;

  return [direction(column), direction(productsTable.id)];
}
