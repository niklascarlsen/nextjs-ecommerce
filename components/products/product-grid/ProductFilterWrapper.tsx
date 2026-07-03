'use client';

import {useState, useCallback, useSyncExternalStore} from 'react';
import {useRouter, usePathname, useSearchParams} from 'next/navigation';

import {ProductCard} from '@/lib/types/db-types';
import type {SearchMode} from '@/lib/types/query-types';
import Link from 'next/link';
import {ChevronRight} from 'lucide-react';
import FilterBar from '@/components/products/product-grid/ProductFilterBar';
import FilterPanel from '@/components/products/product-grid/ProductFilterPanel';
import {useScrollLock} from '@/hooks/useScrollLock';
import InfiniteProductList from './InfiniteProductList';
import type {GridLayout} from '@/components/products/product-grid/ProductGrid';

const GRID_LAYOUT_STORAGE_KEY = 'product-grid-layout';

function getGridLayoutSnapshot(): GridLayout {
  const saved = localStorage.getItem(GRID_LAYOUT_STORAGE_KEY);
  if (saved === 'compact' || saved === 'comfortable') return saved;
  return 'compact';
}

function subscribeGridLayout(onStoreChange: () => void) {
  const notify = () => onStoreChange();
  window.addEventListener('storage', notify);
  window.addEventListener(GRID_LAYOUT_STORAGE_KEY, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(GRID_LAYOUT_STORAGE_KEY, notify);
  };
}

type BaseProps = {
  initialProducts: ProductCard[];
  initialHasMore: boolean;
  metadata?: {
    availableColors: string[];
    availableSizes: string[];
    availableCategories: string[];
  };
  className?: string;
};

export type ProductFilterWrapperProps =
  | (BaseProps & {
      mode: 'category';
      gender?: string;
      category?: string;
    })
  | (BaseProps & {
      mode: 'search';
      query: string;
      totalCount?: number;
      initialSearchMode?: SearchMode;
    });

export default function ProductFilterWrapper(props: ProductFilterWrapperProps) {
  const {initialProducts, initialHasMore, metadata, className = ''} = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterDialogId = 'product-filter-dialog';
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const gridLayout = useSyncExternalStore(
    subscribeGridLayout,
    getGridLayoutSnapshot,
    (): GridLayout => 'compact',
  );

  const handleGridLayoutChange = useCallback((layout: GridLayout) => {
    localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, layout);
    window.dispatchEvent(new Event(GRID_LAYOUT_STORAGE_KEY));
  }, []);

  const openFilterDialog = useCallback(() => setIsFilterDialogOpen(true), []);
  const closeFilterDialog = useCallback(() => setIsFilterDialogOpen(false), []);

  useScrollLock(isFilterDialogOpen);

  const colorParam = searchParams.get('color');
  const sizeParam = searchParams.get('sizes');
  const sortParam = searchParams.get('sort');
  const filterParamsKey = `${colorParam ?? ''}|${sizeParam ?? ''}|${sortParam ?? ''}`;

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<string | null>(null);
  const [lastFilterParamsKey, setLastFilterParamsKey] =
    useState(filterParamsKey);

  if (filterParamsKey !== lastFilterParamsKey) {
    setLastFilterParamsKey(filterParamsKey);
    setSelectedColors(colorParam ? colorParam.split(',') : []);
    setSelectedSizes(sizeParam ? sizeParam.split(',') : []);
    setSortOrder(sortParam);
  }

  const toggleColor = useCallback(
    (color: string) => {
      setSelectedColors((prev) =>
        prev.includes(color)
          ? prev.filter((c) => c !== color)
          : [...prev, color],
      );
    },
    [setSelectedColors],
  );

  const toggleSize = useCallback(
    (size: string) => {
      setSelectedSizes((prev) =>
        prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
      );
    },
    [setSelectedSizes],
  );

  const toggleSort = useCallback(
    (newSort: string) => {
      setSortOrder((prev) => (prev === newSort ? null : newSort));
    },
    [setSortOrder],
  );

  const clearFilters = useCallback(() => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setSortOrder(null);
    // Keep unrelated params (e.g. the search query) intact
    const params = new URLSearchParams(searchParams.toString());
    params.delete('color');
    params.delete('sizes');
    params.delete('sort');
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }, [
    router,
    pathname,
    searchParams,
    setSelectedColors,
    setSelectedSizes,
    setSortOrder,
  ]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedColors.length) {
      params.set('color', selectedColors.join(','));
    } else {
      params.delete('color');
    }
    if (selectedSizes.length) {
      params.set('sizes', selectedSizes.join(','));
    } else {
      params.delete('sizes');
    }
    if (sortOrder) {
      params.set('sort', sortOrder);
    } else {
      params.delete('sort');
    }

    const url = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(url);
  }, [
    router,
    pathname,
    searchParams,
    selectedColors,
    selectedSizes,
    sortOrder,
  ]);

  const hasActiveFilters =
    !!sortOrder || selectedColors.length > 0 || selectedSizes.length > 0;

  const activeFilterCount = [
    !!sortOrder,
    selectedColors.length > 0,
    selectedSizes.length > 0,
  ].filter(Boolean).length;

  const isCategoryPage =
    props.mode === 'category' && !!props.gender && !!props.category;
  const isGenderPage =
    props.mode === 'category' && !!props.gender && !props.category;

  const categories = isGenderPage ? (metadata?.availableCategories ?? []) : [];

  const showProductFilters = initialProducts.length > 0 || hasActiveFilters;

  return (
    <div className='relative text-xs font-semibold'>
      {props.mode === 'category' &&
        isCategoryPage &&
        props.gender && (
          <div className='flex  items-center flex-row px-4 sm:px-8 gap-1.5 pt-2 my-2'>
            <Link
              href={`/c/${props.gender}`}
              className='flex items-center uppercase gap-2  font-medium text-gray-500'
            >
              <span className='hover:text-black'>{props.gender}</span>
            </Link>
            <ChevronRight size={13} className='text-gray-500' />
            <h2 className=' font-medium w-fit uppercase'>
              {props.category}
            </h2>
          </div>
        )}

      {isGenderPage && categories.length > 0 && (
        <div className='px-5 sm:px-8 my-2 pt-2'>
          <div className='flex flex-wrap gap-4 uppercase font-medium'>
            <div className='text-black'>All</div>
            {categories.map((category) => (
              <Link
                key={category}
                href={`${pathname}/${category}`}
                className=' text-gray-500 w-fit font-medium hover:text-black'
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      )}

      {props.mode === 'search' && (
        <h2 className='text-base md:text-base uppercase font-medium px-4 sm:px-8 pt-2 pb-2'>
          {props.initialSearchMode === 'fuzzy' ? (
            <>
              No exact matches for &quot;{props.query}&quot; — showing similar
              products
            </>
          ) : (
            <>
              Search results for &quot;{props.query}&quot;
              {props.totalCount ? (
                <span className='ml-2'>({props.totalCount})</span>
              ) : null}
            </>
          )}
        </h2>
      )}

      {showProductFilters && (
        <>
          <FilterBar
            dialogId={filterDialogId}
            onOpen={openFilterDialog}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
            gridLayout={gridLayout}
            onGridLayoutChange={handleGridLayoutChange}
          />
          <FilterPanel
            dialogId={filterDialogId}
            onDialogClose={closeFilterDialog}
            metadata={metadata}
            selectedColors={selectedColors}
            selectedSizes={selectedSizes}
            sortOrder={sortOrder}
            onToggleColor={toggleColor}
            onToggleSize={toggleSize}
            onToggleSort={toggleSort}
            onClearFilters={clearFilters}
            onApplyFilters={applyFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </>
      )}

      <div className='pt-2'>
        {props.mode === 'category' ? (
          <InfiniteProductList
            mode='category'
            initialProducts={initialProducts}
            gender={props.gender}
            category={props.category}
            className={className}
            initialHasMore={initialHasMore}
            gridLayout={gridLayout}
          />
        ) : (
          <InfiniteProductList
            mode='search'
            initialProducts={initialProducts}
            query={props.query}
            initialSearchMode={props.initialSearchMode}
            className={className}
            initialHasMore={initialHasMore}
            gridLayout={gridLayout}
          />
        )}
      </div>
    </div>
  );
}
