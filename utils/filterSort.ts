import type {SortParams} from '@/lib/types/query-types';

type PageSearchParams = {[key: string]: string | string[] | undefined};

export type ParsedFilterParams = SortParams & {
  color?: string[];
  sizes?: string[];
  hasFilterParams: boolean;
};

function parseListParam(param?: string | string[]): string[] | undefined {
  if (!param) return undefined;
  const list = typeof param === 'string' ? param.split(',') : param;
  const filtered = list.filter(Boolean);
  return filtered.length > 0 ? filtered : undefined;
}

// Parses color/sizes/sort page searchParams shared by category and search pages
export function parseFilterSearchParams(
  searchParams: PageSearchParams,
): ParsedFilterParams {
  const color = parseListParam(searchParams.color);
  const sizes = parseListParam(searchParams.sizes);
  const sortParam =
    typeof searchParams.sort === 'string' ? searchParams.sort : undefined;
  const {sort, order} = parseSortParam(sortParam);

  return {
    color,
    sizes,
    sort,
    order,
    hasFilterParams: !!color || !!sizes || !!sortParam,
  };
}

export function parseSortParam(sortParam?: string | null): SortParams {
  if (!sortParam) return {sort: 'id', order: 'asc'};

  switch (sortParam) {
    case 'price_asc':
      return {sort: 'price', order: 'asc'};
    case 'price_desc':
      return {sort: 'price', order: 'desc'};
    case 'name_asc':
      return {sort: 'name', order: 'asc'};
    default:
      return {sort: 'id', order: 'asc'};
  }
}

const SIZE_ORDER: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  XXXL: 7,
};

export function sortSizes(sizes: string[]): string[] {
  const text: string[] = [];
  const numeric: string[] = [];

  for (const sz of sizes) {
    const upper = sz.toUpperCase();
    if (SIZE_ORDER[upper] !== undefined) {
      text.push(sz);
    } else {
      numeric.push(sz);
    }
  }

  text.sort(
    (a, b) => SIZE_ORDER[a.toUpperCase()] - SIZE_ORDER[b.toUpperCase()]
  );

  numeric.sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'sv');
  });

  return [...text, ...numeric];
}
