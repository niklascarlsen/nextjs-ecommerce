'use client';

import {memo} from 'react';
import {Accordion} from '@/components/shared/ui/Accordion';
import {CheckboxOption} from '@/components/shared/ui/CheckboxOption';
import {RadioOption} from '@/components/shared/ui/RadioOption';
import {ModalDialog} from '@/components/shared/modal/ModalDialog';
import {ModalCloseButton} from '@/components/shared/modal/ModalCloseButton';
import {FocusHeading} from '@/components/shared/FocusHeading';
import {Button} from '@/components/shared/ui/button';

interface FilterPanelProps {
  dialogId: string;
  onDialogClose: () => void;
  metadata?: {
    availableColors: string[];
    availableSizes: string[];
    availableCategories: string[];
  };
  selectedColors: string[];
  selectedSizes: string[];
  sortOrder: string | null;
  onToggleColor: (color: string) => void;
  onToggleSize: (size: string) => void;
  onToggleSort: (sort: string) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
  hasActiveFilters: boolean;
}

function FilterPanel({
  dialogId,
  onDialogClose,
  metadata,
  selectedColors,
  selectedSizes,
  sortOrder,
  onToggleColor,
  onToggleSize,
  onToggleSort,
  onClearFilters,
  onApplyFilters,
  hasActiveFilters,
}: FilterPanelProps) {
  const sizes = metadata?.availableSizes || [];
  const colors = metadata?.availableColors || [];

  const label =
    sortOrder === 'price_asc'
      ? 'Price: Low to high'
      : sortOrder === 'price_desc'
        ? 'Price: High to low'
        : sortOrder === 'name_asc'
          ? 'Name: A–Z'
          : '';

  const handleApply = () => {
    onApplyFilters();
  };

  return (
    <ModalDialog
      id={dialogId}
      variant='right'
      className='w-full max-w-full md:max-w-[500px]'
      onClose={onDialogClose}
      aria-labelledby='filter-panel-title'
    >
      <div className='flex flex-col h-full justify-between py-4 md:py-6 px-4 sm:px-5'>
        <div className='flex items-center justify-between mb-10'>
          <FocusHeading
            id='filter-panel-title'
            className='text-sm font-semibold uppercase'
          >
            Filter and sort
          </FocusHeading>
          <ModalCloseButton
            dialogId={dialogId}
            size={14}
            strokeWidth={1.5}
            className='p-2'
            aria-label='Close filter panel'
          />
        </div>

        <div className='h-[calc(100dvh-15rem)] uppercase overflow-y-auto gap-4 px-1 py-2'>
          <Accordion.Root type='single' collapsible={true}>
            {sizes.length > 0 && (
              <Accordion.Item value='sizes' className='border-b'>
                <Accordion.Trigger>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Size</span>
                    {selectedSizes.length > 0 && (
                      <span className='font-normal text-xs uppercase text-gray-600'>
                        {selectedSizes.join(', ')}
                      </span>
                    )}
                  </div>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className='grid grid-cols-1 gap-3 py-1 font-medium'>
                    {sizes.map((size) => (
                      <CheckboxOption
                        key={size}
                        id={`size-${size}`}
                        label={size}
                        checked={selectedSizes.includes(size)}
                        onChange={() => onToggleSize(size)}
                      />
                    ))}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            )}

            {colors.length > 0 && (
              <Accordion.Item value='colors' className='border-b'>
                <Accordion.Trigger>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Color</span>
                    {selectedColors.length > 0 && (
                      <span className='font-normal text-xs uppercase text-gray-600'>
                        {selectedColors.join(', ')}
                      </span>
                    )}
                  </div>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className='grid grid-cols-1 gap-4 py-1 font-medium'>
                    {colors.map((color) => (
                      <CheckboxOption
                        key={color}
                        id={`color-${color}`}
                        label={color}
                        checked={selectedColors.includes(color)}
                        onChange={() => onToggleColor(color)}
                      />
                    ))}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            )}

            <Accordion.Item value='sort' className='border-b'>
              <Accordion.Trigger>
                <div className='flex flex-col'>
                  <span className='text-sm relative font-medium'>Sort by</span>
                  {sortOrder && (
                    <span className='font-normal pt-1 text-xs uppercase text-gray-600'>
                      {label}
                    </span>
                  )}
                </div>
              </Accordion.Trigger>
              <Accordion.Content>
                <div className='grid grid-cols-1 font-medium gap-4 py-1'>
                  <RadioOption
                    id='sort-price-asc'
                    name='sort'
                    label='Price: Low to high'
                    key='sort-price-asc'
                    checked={sortOrder === 'price_asc'}
                    onChange={() => onToggleSort('price_asc')}
                  />
                  <RadioOption
                    id='sort-price-desc'
                    name='sort'
                    label='Price: High to low'
                    key='sort-price-desc'
                    checked={sortOrder === 'price_desc'}
                    onChange={() => onToggleSort('price_desc')}
                  />
                  <RadioOption
                    id='sort-name-asc'
                    name='sort'
                    label='Name: A–Z'
                    key='sort-name-asc'
                    checked={sortOrder === 'name_asc'}
                    onChange={() => onToggleSort('name_asc')}
                  />
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </div>

        <div className='flex flex-col'>
          <Button
            variant='default'
            className='w-full uppercase text-xs font-semibold'
            disabled={!hasActiveFilters}
            onClick={handleApply}
            command='close'
            commandfor={dialogId}
          >
            Show products
          </Button>
          <Button
            variant='outline'
            className='mt-2 text-gray-600 text-xs font-semibold w-full uppercase'
            disabled={!hasActiveFilters}
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}

export default memo(FilterPanel);
