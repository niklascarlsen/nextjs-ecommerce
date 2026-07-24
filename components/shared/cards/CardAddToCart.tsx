'use client';

import {useState} from 'react';
import {Plus} from 'lucide-react';
import {twMerge} from 'tailwind-merge';
import {useSizeDrawer} from '@/context/SizeDrawerProvider';
import {useAddToCart} from '@/hooks/useAddToCart';

type CardAddToCartProps = {
  productId: string;
  name: string;
  sizes: string[];
  className?: string;
  // Touch + over the image (compact). Comfortable uses a full-width button instead.
  showTouchPlus?: boolean;
};

export default function CardAddToCart({
  productId,
  name,
  sizes,
  className,
  showTouchPlus = true,
}: CardAddToCartProps) {
  const {openSizeDrawer} = useSizeDrawer();
  const addToCart = useAddToCart();
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (size: string, returnFocusEl: HTMLElement) => {
    setIsAdding(true);
    try {
      await addToCart({product_id: productId, quantity: 1, size}, {returnFocusEl});
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className={className}>
      {/* Desktop: size row grows up from the image bottom on hover/focus. */}
      <div
        className={twMerge(
          'hidden pointer-fine:block absolute inset-x-0 bottom-0 z-10 overflow-hidden bg-gray-50/90',
          // invisible while collapsed to avoid hint targets (e.g. Vimium)
          'invisible h-0 transition-[height] duration-300 ease-out',
          'group-hover:visible group-hover:h-11 sm:group-hover:h-13',
          'group-focus-within:visible group-focus-within:h-11 sm:group-focus-within:h-13',
        )}
      >
        <div className='flex h-11 items-center justify-center gap-1 px-2'>
          {sizes.map((size) => (
            <button
              key={size}
              type='button'
              disabled={isAdding}
              className='px-2 py-1 text-xs sm:text-sm font-semibold text-gray-800 hover:underline underline-offset-3 disabled:opacity-50'
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdd(size, e.currentTarget);
              }}
              aria-label={`Add ${name} size ${size} to cart`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Touch: plus button opens the shared size bottom sheet. */}
      {showTouchPlus && (
        <button
          type='button'
          className='pointer-fine:hidden absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center bg-white/90 text-gray-800'
          aria-label={`Choose a size for ${name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openSizeDrawer({productId, sizes});
          }}
        >
          <Plus size={18} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
