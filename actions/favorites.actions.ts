'use server';

import {auth} from '@/lib/auth';
import {getOrCreateSessionId, getSessionId} from '@/utils/cookies';
import type {NewFavorite} from '@/lib/types/db-types';
import {db} from '@/drizzle/index';
import {favoritesTable, productsTable} from '@/drizzle/db/schema';
import {eq, and, isNull} from 'drizzle-orm';
import {isNewSql} from '@/actions/lib/infiniteQuery-builder';

export async function getFavorites() {
  try {
    const session = await auth();
    const user = session?.user;
    const sessionId = await getSessionId();

    const baseQuery = db
      .select({
        id: favoritesTable.id,
        user_id: favoritesTable.user_id,
        session_id: favoritesTable.session_id,
        product_id: favoritesTable.product_id,
        created_at: favoritesTable.created_at,

        product: {
          id: productsTable.id,
          name: productsTable.name,
          price: productsTable.price,
          brand: productsTable.brand,
          color: productsTable.color,
          sizes: productsTable.sizes,
          images: productsTable.images,
          slug: productsTable.slug,
          category: productsTable.category,
          created_at: productsTable.created_at,
          isNew: isNewSql().as('isNew'),
        },
      })
      .from(favoritesTable)
      .innerJoin(
        productsTable,
        eq(favoritesTable.product_id, productsTable.id)
      );

    if (user) {
      const favorites = await baseQuery.where(
        eq(favoritesTable.user_id, user.id)
      );
      return {favorites};
    } else if (sessionId) {
      const favorites = await baseQuery.where(
        and(
          eq(favoritesTable.session_id, sessionId),
          isNull(favoritesTable.user_id)
        )
      );
      return {favorites};
    } else {
      return {favorites: []};
    }
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return {
      favorites: [],
      error: 'Failed to fetch favorites',
    };
  }
}

export async function removeFromFavorites(productId: string) {
  try {
    const session = await auth();
    const user = session?.user;

    if (user) {
      await db
        .delete(favoritesTable)
        .where(
          and(
            eq(favoritesTable.user_id, user.id),
            eq(favoritesTable.product_id, productId)
          )
        );
    } else {
      const sessionId = await getSessionId();
      if (sessionId) {
        await db
          .delete(favoritesTable)
          .where(
            and(
              eq(favoritesTable.session_id, sessionId),
              eq(favoritesTable.product_id, productId),
              isNull(favoritesTable.user_id)
            )
          );
      }
    }

    const {favorites} = await getFavorites();
    return {success: true, favorites};
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return {success: false, error: 'Failed to remove item from favorites'};
  }
}

export async function toggleFavorite(productId: string) {
  try {
    const session = await auth();
    const user = session?.user;

    if (user) {
      const deleteResult = await db
        .delete(favoritesTable)
        .where(
          and(
            eq(favoritesTable.user_id, user.id),
            eq(favoritesTable.product_id, productId)
          )
        );

      if (deleteResult.rowCount === 0) {
        const newFavorite: NewFavorite = {
          user_id: user.id,
          session_id: null,
          product_id: productId,
        };
        await db.insert(favoritesTable).values({
          ...newFavorite,
          created_at: new Date(),
        });
      }
    } else {
      const sessionId = await getSessionId();
      if (!sessionId) {
        const newSessionId = await getOrCreateSessionId();
        const newFavorite: NewFavorite = {
          user_id: null,
          session_id: newSessionId,
          product_id: productId,
        };
        await db.insert(favoritesTable).values({
          ...newFavorite,
          created_at: new Date(),
        });
      } else {
        const deleteResult = await db
          .delete(favoritesTable)
          .where(
            and(
              eq(favoritesTable.session_id, sessionId),
              eq(favoritesTable.product_id, productId),
              isNull(favoritesTable.user_id)
            )
          );

        if (deleteResult.rowCount === 0) {
          const newFavorite: NewFavorite = {
            user_id: null,
            session_id: sessionId,
            product_id: productId,
          };
          await db.insert(favoritesTable).values({
            ...newFavorite,
            created_at: new Date(),
          });
        }
      }
    }

    const {favorites} = await getFavorites();
    return {
      success: true,
      favorites,
    };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return {success: false, error: 'Failed to toggle favorite'};
  }
}
