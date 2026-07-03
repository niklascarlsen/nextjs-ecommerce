'use client';

import {memo} from 'react';
import type {GridLayout} from '@/components/products/product-grid/ProductGrid';
import GridIcon from '@/components/icons/GridIcon';
import SquareIcon from '@/components/icons/SquareIcon';

interface FilterBarProps {
  dialogId: string;
  onOpen: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  gridLayout: GridLayout;
  onGridLayoutChange: (layout: GridLayout) => void;
}

function FilterBar({
  dialogId,
  onOpen,
  activeFilterCount,
  hasActiveFilters,
  gridLayout,
  onGridLayoutChange,
}: FilterBarProps) {
  return (
    <div className='sticky top-14 w-full bg-white py-4 pb-5 px-4 sm:px-8 text-base flex justify-between items-center z-20'>
      <button
        type='button'
        command='show-modal'
        commandfor={dialogId}
        onClick={onOpen}
        className='flex items-center gap-2 hover:text-gray-700 transition-colors cursor-pointer'
      >
        <span
          className={`text-[13px] font-semibold uppercase group ${hasActiveFilters ? 'text-black' : ''}`}
        >
          Filter and sort{' '}
          {hasActiveFilters && (
            <span className='inline-flex items-center text-black'>
              ({activeFilterCount})
            </span>
          )}
        </span>
      </button>
      <div
        className='flex items-center -mb-1 gap-x-3'
        role='group'
        aria-label='Product grid layout'
      >
        <button
          type='button'
          onClick={() => onGridLayoutChange('compact')}
          aria-pressed={gridLayout === 'compact'}
          aria-label='More products per row'
          className={`cursor-pointer p-0.5 pb-1.5 border-b transition-colors ${
            gridLayout === 'compact'
              ? 'border-black text-black/80'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <GridIcon className='size-4' />
        </button>
        <button
          type='button'
          onClick={() => onGridLayoutChange('comfortable')}
          aria-pressed={gridLayout === 'comfortable'}
          aria-label='Larger cards, fewer per row'
          className={`cursor-pointer p-0.5 pb-1.5 border-b transition-colors ${
            gridLayout === 'comfortable'
              ? 'border-black text-black/80'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <SquareIcon className='size-4' />
        </button>
      </div>
    </div>
  );
}

export default memo(FilterBar);
