import {getSessionId} from '@/utils/cookies';
import {db} from '@/drizzle/index';
import {cartsTable, cartItemsTable, favoritesTable} from '@/drizzle/db/schema';
import {eq, and, isNull, inArray} from 'drizzle-orm';
import {planCartMerge} from '@/actions/lib/cart-merge';
import {planFavoritesMerge} from '@/actions/lib/favorites-merge';

// Server-only merge helpers, called from the NextAuth signIn callback. They are
// deliberately NOT server actions: userId comes from the freshly authenticated
// user, not from a client-callable endpoint.

export async function transferCartOnLogin(userId: string) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return {success: true, message: 'No session_id found'};

    const [sessionCartResult, userCartResult] = await Promise.all([
      db
        .select()
        .from(cartsTable)
        .where(
          and(eq(cartsTable.session_id, sessionId), isNull(cartsTable.user_id)),
        )
        .limit(1),
      db
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.user_id, userId))
        .limit(1),
    ]);

    const sessionCart = sessionCartResult[0];
    if (!sessionCart)
      return {success: true, message: 'No session cart to transfer'};

    const userCart = userCartResult[0];

    // No user cart yet — attach the session cart to the user.
    if (!userCart) {
      await db
        .update(cartsTable)
        .set({user_id: userId, session_id: null, updated_at: new Date()})
        .where(eq(cartsTable.id, sessionCart.id));
      return {success: true, message: 'Cart transferred successfully'};
    }

    // Both carts exist - merge the carts (sequential + parallel updates as neon-http has no transaction)
    const [sessionItems, userItems] = await Promise.all([
      db
        .select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cart_id, sessionCart.id)),
      db
        .select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cart_id, userCart.id)),
    ]);

    if (sessionItems.length === 0) {
      await db.delete(cartsTable).where(eq(cartsTable.id, sessionCart.id));
      return {success: true, message: 'Cart merged successfully'};
    }

    const {itemsToUpdateQuantity, idsToMove} = planCartMerge(
      sessionItems,
      userItems,
    );

    const promises: Promise<unknown>[] = [];

    if (itemsToUpdateQuantity.length > 0) {
      for (const item of itemsToUpdateQuantity) {
        promises.push(
          db
            .update(cartItemsTable)
            .set({quantity: item.newQuantity, updated_at: new Date()})
            .where(eq(cartItemsTable.id, item.id)),
        );
      }
    }

    if (idsToMove.length > 0) {
      promises.push(
        db
          .update(cartItemsTable)
          .set({cart_id: userCart.id, updated_at: new Date()})
          .where(inArray(cartItemsTable.id, idsToMove)),
      );
    }

    await Promise.all(promises);

    await db.delete(cartsTable).where(eq(cartsTable.id, sessionCart.id));

    return {success: true, message: 'Cart merged successfully'};
  } catch (error) {
    console.error('Unexpected error transferring cart on login:', error);

    return {success: false, message: 'Failed to merge cart'};
  }
}

export async function transferFavoritesOnLogin(userId: string) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return {success: true, message: 'No session_id found'};

    // Load session and user favorites
    const sessionFavorites = await db
      .select()
      .from(favoritesTable)
      .where(
        and(
          eq(favoritesTable.session_id, sessionId),
          isNull(favoritesTable.user_id),
        ),
      );

    if (!sessionFavorites.length)
      return {success: true, message: 'No session favorites found'};

    const userFavorites = await db
      .select({product_id: favoritesTable.product_id})
      .from(favoritesTable)
      .where(eq(favoritesTable.user_id, userId));

    // Decide updates vs deletes in memory (no extra queries)
    const {idsToUpdate, idsToDelete} = planFavoritesMerge(
      sessionFavorites,
      userFavorites.map((fav) => fav.product_id),
    );

    // Bulk update rows to attach to user
    if (idsToUpdate.length > 0) {
      await db
        .update(favoritesTable)
        .set({user_id: userId, session_id: null})
        .where(inArray(favoritesTable.id, idsToUpdate));
    }

    // Bulk delete duplicate session rows
    if (idsToDelete.length > 0) {
      await db
        .delete(favoritesTable)
        .where(inArray(favoritesTable.id, idsToDelete));
    }

    return {
      success: true,
      message: `Favorites transferred successfully (${sessionFavorites.length} items processed)`,
    };
  } catch (error) {
    console.error('Unexpected error transferring favorites on login:', error);
    return {success: false, error: 'Failed to transfer favorites'};
  }
}
