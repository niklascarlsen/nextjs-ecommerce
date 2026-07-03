import {describe, it, expect} from 'vitest';
import {parseFilterSearchParams} from '@/utils/filterSort';

describe('parseFilterSearchParams', () => {
  it('returns defaults when no filter params are present', () => {
    expect(parseFilterSearchParams({})).toEqual({
      color: undefined,
      sizes: undefined,
      sort: 'id',
      order: 'asc',
      hasFilterParams: false,
    });
  });

  it('splits comma-separated string params', () => {
    const result = parseFilterSearchParams({color: 'red,blue', sizes: 'S,M'});
    expect(result.color).toEqual(['red', 'blue']);
    expect(result.sizes).toEqual(['S', 'M']);
    expect(result.hasFilterParams).toBe(true);
  });

  it('accepts repeated params as arrays', () => {
    const result = parseFilterSearchParams({color: ['red', 'blue']});
    expect(result.color).toEqual(['red', 'blue']);
  });

  it('filters out empty segments and treats all-empty as absent', () => {
    expect(parseFilterSearchParams({color: 'red,,blue'}).color).toEqual([
      'red',
      'blue',
    ]);
    const empty = parseFilterSearchParams({color: ','});
    expect(empty.color).toBeUndefined();
    expect(empty.hasFilterParams).toBe(false);
  });

  it('maps sort params to sort field and order', () => {
    expect(parseFilterSearchParams({sort: 'price_desc'})).toMatchObject({
      sort: 'price',
      order: 'desc',
      hasFilterParams: true,
    });
    expect(parseFilterSearchParams({sort: 'name_asc'})).toMatchObject({
      sort: 'name',
      order: 'asc',
    });
  });

  it('falls back to default sort for unknown or non-string sort values', () => {
    expect(parseFilterSearchParams({sort: 'bogus'})).toMatchObject({
      sort: 'id',
      order: 'asc',
    });
    expect(
      parseFilterSearchParams({sort: ['price_asc', 'price_desc']}),
    ).toMatchObject({sort: 'id', order: 'asc', hasFilterParams: false});
  });
});
