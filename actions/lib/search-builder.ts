import {or, sql, type SQL} from 'drizzle-orm';
import {productsTable} from '@/drizzle/db/schema';

import {
  normalizeProductSearchQuery,
  productSearchTsQuery,
  FUZZY_WORD_SIMILARITY_THRESHOLD,
} from '@/lib/search-query';
import type {SearchMode} from '@/lib/types/query-types';

// Search SQL fragments and mode decisions for the catalog grid — no DB access
// here, so the module stays unit-testable (see search-builder.test.ts).
// String preparation lives in lib/search-query.ts.

/**
 * Build WHERE clauses for product search.
 * 'fts': weighted full-text search on the generated search_vector column
 * (stemming + per-term prefix matching, GIN-indexed). "men" does not match
 * "women" since prefix matching anchors at the start of each lexeme.
 * 'fuzzy': pg_trgm word similarity on name/color/category — the typo
 * fallback when FTS finds nothing.
 */
export function buildSearchFilters(query: string | undefined, mode: SearchMode) {
  if (mode === 'fts') {
    const tsquery = productSearchTsQuery(query);
    if (!tsquery) return [];
    return [
      sql`${productsTable.search_vector} @@ to_tsquery('english', ${tsquery})`,
    ];
  }

  const normalized = normalizeProductSearchQuery(query);
  if (!normalized) return [];
  // Function form instead of the <% operator: the operator only uses the trgm
  // index at pg_trgm.word_similarity_threshold (default 0.6, too strict for
  // typos) and lowering it needs SET LOCAL inside a transaction.
  return [
    or(
      sql`word_similarity(${normalized}, ${productsTable.name}) > ${FUZZY_WORD_SIMILARITY_THRESHOLD}`,
      sql`word_similarity(${normalized}, ${productsTable.color}) > ${FUZZY_WORD_SIMILARITY_THRESHOLD}`,
      sql`word_similarity(${normalized}, ${productsTable.category}) > ${FUZZY_WORD_SIMILARITY_THRESHOLD}`,
    ),
  ];
}

/**
 * Relevance score for ORDER BY and the rank cursor. ts_rank weights follow
 * the setweight labels on search_vector (name 1.0 > color 0.4 > category 0.2
 * > gender 0.1); the fuzzy score weights columns the same way, name first.
 * Cast to float8: ts_rank/word_similarity return float4, which does not
 * round-trip exactly through the driver, breaking cursor equality.
 */
export function buildSearchRankExpr(
  query: string | undefined,
  mode: SearchMode,
): SQL<number> | null {
  if (mode === 'fts') {
    const tsquery = productSearchTsQuery(query);
    if (!tsquery) return null;
    return sql<number>`(ts_rank(${productsTable.search_vector}, to_tsquery('english', ${tsquery})))::float8`;
  }

  const normalized = normalizeProductSearchQuery(query);
  if (!normalized) return null;
  return sql<number>`(greatest(word_similarity(${normalized}, ${productsTable.name}), word_similarity(${normalized}, ${productsTable.color}) * 0.5, word_similarity(${normalized}, ${productsTable.category}) * 0.25))::float8`;
}

/**
 * First-page FTS miss -> retry with the trigram fallback. Later pages carry
 * the decided mode via searchMode and must never re-decide.
 */
export function shouldFallBackToFuzzy(
  mode: SearchMode,
  lastId: string | null,
  rowCount: number,
) {
  return mode === 'fts' && lastId === null && rowCount === 0;
}
