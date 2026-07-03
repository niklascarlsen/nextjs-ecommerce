'use server';

import {and, asc, count, sql} from 'drizzle-orm';
import {productsTable} from '@/drizzle/db/schema';
import type {Params, Result, SearchMode} from '@/lib/types/query-types';
import {
  buildRelevanceOrderBy,
  buildCategoryGenderFilters,
  buildSizeColorFilters,
  buildIsNewFilter,
  buildPaginationWhere,
  buildSortOrderBy,
  isNewSql,
} from '@/actions/lib/infiniteQuery-builder';
import {
  buildSearchFilters,
  buildSearchRankExpr,
  shouldFallBackToFuzzy,
} from '@/actions/lib/search-builder';
import {productSearchTsQuery} from '@/lib/search-query';
import {sortSizes} from '@/utils/filterSort';
import {db} from '@/drizzle/index';

export async function getInfiniteProducts({
  limit = 0,
  query,
  order = 'asc',
  sort = 'id',
  lastId = null,
  lastValue = null,
  category = null,
  gender = null,
  color = [],
  sizes = [],
  metadata = false,
  isNewOnly = false,
  includeCount = false,
  searchMode,
}: Params): Promise<Result> {
  try {
    const hasSearch = productSearchTsQuery(query) !== null;
    const staticConditions = [
      ...buildCategoryGenderFilters(category, gender),
      ...buildSizeColorFilters(sizes, color),
      ...buildIsNewFilter(isNewOnly),
    ];

    const runPage = async (mode: SearchMode) => {
      const searchConditions = hasSearch ? buildSearchFilters(query, mode) : [];
      // Relevance ordering only on the default sort, explicit price/name
      // sorts keep their ordering and cursor semantics.
      const rankExpr =
        hasSearch && sort === 'id' ? buildSearchRankExpr(query, mode) : null;
      const baseConditions = [...searchConditions, ...staticConditions];

      const paginationConditions = buildPaginationWhere({
        sort,
        order,
        lastId,
        lastValue,
        rankExpr,
      });

      const orderByFields = rankExpr
        ? buildRelevanceOrderBy(rankExpr)
        : buildSortOrderBy(sort, order);

      const productWhereConditions = [
        ...baseConditions,
        ...paginationConditions,
      ];
      const productWhereClause =
        productWhereConditions.length > 0
          ? and(...productWhereConditions)
          : undefined;

      const rows = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          price: productsTable.price,
          brand: productsTable.brand,
          color: productsTable.color,
          sizes: productsTable.sizes,
          images: productsTable.images,
          slug: productsTable.slug,
          created_at: productsTable.created_at,
          isNew: isNewSql().as('isNew'),
          ...(rankExpr ? {rank: rankExpr.as('rank')} : {}),
        })
        .from(productsTable)
        .where(productWhereClause)
        .orderBy(...orderByFields)
        .limit(limit + 1);

      return {rows, baseConditions};
    };

    let mode: SearchMode = searchMode ?? 'fts';
    let {rows, baseConditions} = await runPage(mode);

    if (hasSearch && shouldFallBackToFuzzy(mode, lastId, rows.length)) {
      mode = 'fuzzy';
      ({rows, baseConditions} = await runPage(mode));
    }

    const hasMore = rows.length > limit;
    const products = hasMore ? rows.slice(0, limit) : rows;

    const result: Result = {
      products,
      hasMore,
    };
    if (hasSearch) {
      result.searchMode = mode;
    }

    // Count/metadata only after the search mode is final, so the total
    // reflects the conditions that actually produced the page.
    const baseWhereClause =
      baseConditions.length > 0 ? and(...baseConditions) : undefined;

    const [countResult, metadataResult] = await Promise.all([
      includeCount
        ? db.select({count: count()}).from(productsTable).where(baseWhereClause)
        : Promise.resolve(null),
      metadata
        ? fetchAvailableFilterOptions({
            gender,
            category,
            isNewOnly,
            query: hasSearch ? query : undefined,
            searchMode: mode,
          })
        : Promise.resolve(null),
    ]);

    if (includeCount) {
      result.totalCount = countResult?.[0]?.count ?? 0;
    }

    if (metadataResult) {
      result.metadata = metadataResult;
    }

    return result;
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      products: [],
      hasMore: false,
      totalCount: includeCount ? 0 : undefined,
      metadata: metadata
        ? {
            availableColors: [],
            availableSizes: [],
            availableCategories: [],
          }
        : undefined,
    };
  }
}

/**
 * Distinct colors, sizes, and categories available for the current filter
 * scope. Not exported: only getInfiniteProducts needs it, so it is not
 * exposed as a server action.
 */
async function fetchAvailableFilterOptions({
  gender,
  category,
  isNewOnly = false,
  query,
  searchMode = 'fts',
}: {
  gender: string | null;
  category: string | null;
  isNewOnly?: boolean;
  query?: string;
  searchMode?: SearchMode;
}) {
  const conditions = [
    ...buildCategoryGenderFilters(category, gender),
    ...buildIsNewFilter(isNewOnly),
    ...(query ? buildSearchFilters(query, searchMode) : []),
  ];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const colorsQuery = db
    .selectDistinct({color: productsTable.color})
    .from(productsTable)
    .where(whereClause)
    .orderBy(asc(productsTable.color));

  const categoriesQuery = db
    .selectDistinct({category: productsTable.category})
    .from(productsTable)
    .where(whereClause);

  const sizesQuery = db
    .select({
      size: sql<string>`jsonb_array_elements_text(${productsTable.sizes})`.as(
        'size',
      ),
    })
    .from(productsTable)
    .where(
      whereClause
        ? and(whereClause, sql`jsonb_typeof(${productsTable.sizes}) = 'array'`)
        : sql`jsonb_typeof(${productsTable.sizes}) = 'array'`,
    )
    .groupBy(sql`size`);

  const [colorRows, categoryRows, sizeRows] = await Promise.all([
    colorsQuery,
    categoriesQuery,
    sizesQuery,
  ]);

  const availableColors = colorRows.map((r) => r.color).filter(Boolean);
  const availableCategories = categoryRows
    .map((r) => r.category)
    .filter(Boolean);
  const availableSizes = sortSizes(sizeRows.map((r) => r.size));

  return {
    availableColors,
    availableSizes,
    availableCategories,
  };
}
