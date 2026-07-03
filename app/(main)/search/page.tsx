import type {Metadata} from 'next';
import {getInfiniteProducts} from '@/actions/product.actions';
import type {Result} from '@/lib/types/query-types';
import ProductFilterWrapper from '@/components/products/product-grid/ProductFilterWrapper';
import {parseFilterSearchParams} from '@/utils/filterSort';

type Props = {
  searchParams: Promise<{[key: string]: string | string[] | undefined}>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const {q} = await searchParams;
  const query = typeof q === 'string' ? q : '';

  return {
    title: query ? `Search results for "${query}"` : 'Search products',
    description: query
      ? `See our products matching "${query}"`
      : 'Search our product range',
  };
}

export default async function SearchPage({searchParams}: Props) {
  const resolvedSearchParams = await searchParams;
  const q =
    typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : '';
  const {color, sizes, sort, order, hasFilterParams} =
    parseFilterSearchParams(resolvedSearchParams);

  const result: Result = q
    ? await getInfiniteProducts({
        query: q,
        limit: 8,
        color,
        sizes,
        sort,
        order,
        metadata: true,
        includeCount: true,
      })
    : {products: [], hasMore: false};

  const noResults = !result.products || result.products.length === 0;

  // Only bail out fully when no filters are active; with filters the wrapper
  // stays so they can be cleared.
  if (noResults && !hasFilterParams) {
    return (
      <div className='flex items-center justify-center min-h-[calc(100vh-400px)]'>
        <div className='text-center max-w-full '>
          <p className='px-6 uppercase text-base md:text-lg font-medium break-words '>
            No matches for <span className='italic'>{`"${q}"`}</span>.
          </p>
        </div>
      </div>
    );
  }
  // TODO: Implement separate category-aware autocomplete/live-suggestion search
  // 1. Implement a separate search input for category-aware suggestions.
  // 2. Use the same search query input for the main search.
  // 3. Add URL parameter for main category.
  // 4. Inherit initial category from navigation context (e.g., navigating "Men" sets param and scopes suggestions to "Men").
  // 5. Allow category overriding: If the user searches for a different main category (e.g., "Women"), update the URL param.
  // 6. Sync URL param changes back to the main navigation to update the active UI state.

  return (
    <div className='w-full flex justify-center py-4'>
      <div className='w-full'>
        <ProductFilterWrapper
          mode='search'
          query={q}
          initialProducts={result.products}
          initialHasMore={result.hasMore}
          initialSearchMode={result.searchMode}
          totalCount={result.totalCount}
          metadata={result.metadata}
        />
      </div>
    </div>
  );
}
