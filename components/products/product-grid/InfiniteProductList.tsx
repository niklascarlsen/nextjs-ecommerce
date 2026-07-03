'use client';

import {useEffect, useMemo, useRef} from 'react';
import {useInView} from 'react-intersection-observer';
import {useSearchParams} from 'next/navigation';
import type {ProductCard} from '@/lib/types/db-types';
import type {SearchMode} from '@/lib/types/query-types';
import ProductGrid from '@/components/products/product-grid/ProductGrid';
import type {GridLayout} from '@/components/products/product-grid/ProductGrid';
import {useInfiniteProducts} from '@/hooks/useInfiniteProducts';
import SpinningLogo from '@/components/shared/ui/SpinningLogo';

/** Shared config so category and search modes stay aligned. */
const INFINITE_SCROLL_ROOT_MARGIN = '0px 0px 40% 0px';

export type InfiniteProductListProps =
  | {
      mode: 'category';
      initialProducts: ProductCard[];
      initialHasMore: boolean;
      className?: string;
      gender?: string;
      category?: string;
      gridLayout?: GridLayout;
    }
  | {
      mode: 'search';
      initialProducts: ProductCard[];
      initialHasMore: boolean;
      /** Search mode of the SSR first page (fts or fuzzy fallback). */
      initialSearchMode?: SearchMode;
      query: string;
      className?: string;
      gridLayout?: GridLayout;
    };

export default function InfiniteProductList(props: InfiniteProductListProps) {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const color = searchParams.get('color')?.split(',').filter(Boolean) || [];
  const sizes = searchParams.get('sizes')?.split(',').filter(Boolean) || [];
  const sort = searchParams.get('sort') || undefined;

  const infiniteArgs =
    props.mode === 'category'
      ? {
          category: props.category,
          gender: props.gender,
          color,
          sizes,
          sort,
          initialHasMore: props.initialHasMore,
          initialProducts: props.initialProducts,
        }
      : {
          query: props.query,
          color,
          sizes,
          sort,
          initialProducts: props.initialProducts,
          initialHasMore: props.initialHasMore,
          initialSearchMode: props.initialSearchMode,
        };

  const {data, fetchNextPage, hasNextPage, isFetchingNextPage, error} =
    useInfiniteProducts(infiniteArgs);

  const {ref, inView} = useInView({
    threshold: 0.1,
    rootMargin: INFINITE_SCROLL_ROOT_MARGIN,
    triggerOnce: false,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const products = useMemo(
    () =>
      data?.pages.flatMap((page: {products: ProductCard[]}) => page.products) ??
      [],
    [data],
  );

  const displayProducts = useMemo(
    () => (products.length > 0 ? products : props.initialProducts),
    [products, props.initialProducts],
  );

  const emptyMessage =
    props.mode === 'search'
      ? 'No search results to show.'
      : 'The clothes in this category are on the run right now — check back soon.';

  const endOfListMessage =
    props.mode === 'search'
      ? 'No more search results to show.'
      : 'No more products to show.';

  if (error) {
    return (
      <div className='text-center py-12 min-h-[calc(100vh-400px)]'>
        <p className='text-red-800 font-semibold italic'>
          An error occurred:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (displayProducts.length === 0) {
    return (
      <div className='flex items-center justify-center text-center py-12 min-h-[calc(100vh-400px)]'>
        <p className='text-gray-600 text-sm sm:text-base md:text-lg font-normal max-w-md px-4'>
          {emptyMessage}
        </p>
      </div>
    );
  }

  const sentinel = (
    <>
      {hasNextPage && props.initialHasMore && (
        <div ref={ref} className='flex justify-center opacity-70 py-8'>
          {isFetchingNextPage ? (
            <SpinningLogo width='45' height='37' />
          ) : (
            <div />
          )}
        </div>
      )}

      {!hasNextPage && displayProducts.length > 8 && (
        <div className='text-center pt-6 pb-12 lg:pb-24 lg:pt-12'>
          <p className='text-gray-500 text-xs lg:text-sm font-semibold '>
            {endOfListMessage}
          </p>
        </div>
      )}
    </>
  );

  return (
    <div ref={containerRef} className={props.className}>
      <ProductGrid products={displayProducts} gridLayout={props.gridLayout} />
      {sentinel}
    </div>
  );
}
