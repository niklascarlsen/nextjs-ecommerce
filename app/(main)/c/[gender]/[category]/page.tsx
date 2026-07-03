import {getInfiniteProducts} from '@/actions/product.actions';
import Newsletter from '@/components/shared/Newsletter';
import ProductFilterWrapper from '@/components/products/product-grid/ProductFilterWrapper';
import {Metadata} from 'next';
import {parseFilterSearchParams} from '@/utils/filterSort';
import {
  isNewCollectionSlug,
  parseCollectionSlug,
} from '@/actions/utils/virtualCategories';

interface CategoryPageProps {
  params: Promise<{
    gender: string;
    category: string;
  }>;
  searchParams: Promise<{[key: string]: string | string[] | undefined}>;
}

async function getCategoryProducts(
  category: string,
  gender: string,
  searchParams: {[key: string]: string | string[] | undefined},
) {
  const {color, sizes, sort, order} = parseFilterSearchParams(searchParams);

  const {actualCategory, isNewOnly} = parseCollectionSlug(category);

  const result = await getInfiniteProducts({
    limit: 8,
    lastId: null,
    category: actualCategory,
    gender,
    color,
    sizes,
    sort,
    order,
    metadata: true,
    isNewOnly,
    includeCount: false,
  });
  return result;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{gender: string; category: string}>;
}): Promise<Metadata> {
  const {gender, category} = await params;
  const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);

  if (isNewCollectionSlug(category)) {
    const newLabel = category === 'new-now' ? 'New Now' : 'New in';
    return {
      title: `${capitalizedGender} - ${newLabel}`,
      description: `Discover the latest ${gender} fashion—new products and styles.`,
    };
  }

  const capitalizedCategory =
    category.charAt(0).toUpperCase() + category.slice(1);

  return {
    title: `${capitalizedGender} - ${capitalizedCategory}`,
    description: `Explore the latest ${category} styles and trends for ${gender}.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const {gender, category} = await params;
  const resolvedSearchParams = await searchParams;
  const result = await getCategoryProducts(
    category,
    gender,
    resolvedSearchParams,
  );

  return (
    <div className='mx-auto px-0 bg-white z-10'>
      <ProductFilterWrapper
        mode='category'
        initialProducts={result.products}
        metadata={result.metadata}
        initialHasMore={result.hasMore}
        gender={gender}
        category={category}
      />
      <Newsletter />
    </div>
  );
}
