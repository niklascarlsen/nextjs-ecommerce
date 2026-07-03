import {getInfiniteProducts} from '@/actions/product.actions';
import Newsletter from '@/components/shared/Newsletter';
import ProductFilterWrapper from '@/components/products/product-grid/ProductFilterWrapper';
import {notFound} from 'next/navigation';
import {Metadata} from 'next';
import {parseFilterSearchParams} from '@/utils/filterSort';

interface GenderPageProps {
  params: Promise<{
    gender: string;
  }>;
  searchParams: Promise<{[key: string]: string | string[] | undefined}>;
}

async function getGenderProducts(
  gender: string,
  searchParams: {[key: string]: string | string[] | undefined},
) {
  const {color, sizes, sort, order} = parseFilterSearchParams(searchParams);

  const result = await getInfiniteProducts({
    limit: 8,
    lastId: null,
    category: null,
    gender,
    color,
    sizes,
    sort,
    order,
    metadata: true,
    includeCount: false,
  });
  if (!result.products || result.products.length === 0) {
    notFound();
  }
  return result;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{gender: string}>;
}): Promise<Metadata> {
  const {gender} = await params;
  const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);

  return {
    title: capitalizedGender,
    description: `Explore the latest styles and trends for ${gender}.`,
  };
}

export default async function GenderPage({
  params,
  searchParams,
}: GenderPageProps) {
  const {gender} = await params;
  const resolvedSearchParams = await searchParams;
  const result = await getGenderProducts(gender, resolvedSearchParams);

  return (
    <div className='mx-auto'>
      <ProductFilterWrapper
        mode='category'
        initialProducts={result.products}
        initialHasMore={result.hasMore}
        metadata={result.metadata}
        gender={gender}
      />

      <Newsletter />
    </div>
  );
}
