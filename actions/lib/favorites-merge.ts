import {favoritesTable} from '@/drizzle/db/schema';

type SessionFavorite = Pick<
  typeof favoritesTable.$inferSelect,
  'id' | 'product_id'
>;

export interface FavoritesMergePlan {
  idsToUpdate: string[];
  idsToDelete: string[];
}

// Decide how to fold guest favorites into the user's: a product the user
// doesn't have yet gets reassigned; a duplicate session row is dropped.
export function planFavoritesMerge(
  sessionFavorites: SessionFavorite[],
  userProductIds: Iterable<string>
): FavoritesMergePlan {
  const existingProductIds = new Set(userProductIds);

  const idsToUpdate: string[] = [];
  const idsToDelete: string[] = [];

  for (const sessionFav of sessionFavorites) {
    if (!existingProductIds.has(sessionFav.product_id)) {
      idsToUpdate.push(sessionFav.id);
    } else {
      idsToDelete.push(sessionFav.id);
    }
  }

  return {idsToUpdate, idsToDelete};
}
