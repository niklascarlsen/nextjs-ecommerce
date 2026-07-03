import {describe, it, expect} from 'vitest';
import {planFavoritesMerge} from '@/actions/lib/favorites-merge';

const fav = (id: string, product_id: string) => ({id, product_id});

describe('planFavoritesMerge', () => {
  it('reassigns all session favorites when the user has none', () => {
    const session = [fav('s1', 'p1'), fav('s2', 'p2')];

    const plan = planFavoritesMerge(session, []);

    expect(plan.idsToUpdate).toEqual(['s1', 's2']);
    expect(plan.idsToDelete).toEqual([]);
  });

  it('drops a session favorite the user already has', () => {
    const session = [fav('s1', 'p1')];

    const plan = planFavoritesMerge(session, ['p1']);

    expect(plan.idsToDelete).toEqual(['s1']);
    expect(plan.idsToUpdate).toEqual([]);
  });

  it('splits a mixed session into reassign and delete', () => {
    const session = [
      fav('s1', 'p1'), // user already has -> delete
      fav('s2', 'p2'), // unique -> reassign
    ];

    const plan = planFavoritesMerge(session, ['p1']);

    expect(plan.idsToUpdate).toEqual(['s2']);
    expect(plan.idsToDelete).toEqual(['s1']);
  });

  it('returns empty plans for an empty session', () => {
    const plan = planFavoritesMerge([], ['p1']);

    expect(plan.idsToUpdate).toEqual([]);
    expect(plan.idsToDelete).toEqual([]);
  });
});
