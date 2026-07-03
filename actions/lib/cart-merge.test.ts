import {describe, it, expect} from 'vitest';
import {planCartMerge} from '@/actions/lib/cart-merge';

const item = (
  id: string,
  product_id: string,
  size: string,
  quantity: number
) => ({id, product_id, size, quantity});

describe('planCartMerge', () => {
  it('moves all session items when the user cart is empty', () => {
    const session = [item('s1', 'p1', 'M', 2), item('s2', 'p2', 'L', 1)];

    const plan = planCartMerge(session, []);

    expect(plan.idsToMove).toEqual(['s1', 's2']);
    expect(plan.itemsToUpdateQuantity).toEqual([]);
  });

  it('merges quantities when product and size match a user item', () => {
    const session = [item('s1', 'p1', 'M', 2)];
    const user = [item('u1', 'p1', 'M', 3)];

    const plan = planCartMerge(session, user);

    expect(plan.itemsToUpdateQuantity).toEqual([{id: 'u1', newQuantity: 5}]);
    expect(plan.idsToMove).toEqual([]);
  });

  it('treats the same product in a different size as a separate item', () => {
    const session = [item('s1', 'p1', 'L', 1)];
    const user = [item('u1', 'p1', 'M', 3)];

    const plan = planCartMerge(session, user);

    expect(plan.idsToMove).toEqual(['s1']);
    expect(plan.itemsToUpdateQuantity).toEqual([]);
  });

  it('splits a mixed session into merges and moves', () => {
    const session = [
      item('s1', 'p1', 'M', 2), // matches user -> merge
      item('s2', 'p2', 'L', 1), // no match -> move
    ];
    const user = [item('u1', 'p1', 'M', 3)];

    const plan = planCartMerge(session, user);

    expect(plan.itemsToUpdateQuantity).toEqual([{id: 'u1', newQuantity: 5}]);
    expect(plan.idsToMove).toEqual(['s2']);
  });

  it('returns empty plans for an empty session cart', () => {
    const plan = planCartMerge([], [item('u1', 'p1', 'M', 3)]);

    expect(plan.itemsToUpdateQuantity).toEqual([]);
    expect(plan.idsToMove).toEqual([]);
  });
});
