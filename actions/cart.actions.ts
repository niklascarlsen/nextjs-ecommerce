'use server';

import {auth} from '@/lib/auth';
import {getOrCreateSessionId, getSessionId} from '@/utils/cookies';
import type {
  NewCart,
  NewCartItem,
  AddToCartItem,
  CartItemWithProduct,
} from '@/lib/types/db-types';

import {db} from '@/drizzle/index';
import {cartsTable, cartItemsTable, productsTable} from '@/drizzle/db/schema';
import {eq, and, isNull, asc} from 'drizzle-orm';
import Decimal from 'decimal.js';

// Helpers
async function getCartItemsWithProducts(cartId: string) {
  const cartItems = await db
    .select({
      id: cartItemsTable.id,
      cart_id: cartItemsTable.cart_id,
      product_id: cartItemsTable.product_id,
      quantity: cartItemsTable.quantity,
      size: cartItemsTable.size,
      created_at: cartItemsTable.created_at,
      updated_at: cartItemsTable.updated_at,

      name: productsTable.name,
      price: productsTable.price,
      brand: productsTable.brand,
      color: productsTable.color,
      slug: productsTable.slug,
      images: productsTable.images,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
    .where(eq(cartItemsTable.cart_id, cartId))
    .orderBy(asc(cartItemsTable.created_at));

  return cartItems;
}

function calculateCartTotal(items: CartItemWithProduct[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  const total = items.reduce((sum, item) => {
    const itemTotal = new Decimal(item.price).times(item.quantity);
    return sum.plus(itemTotal);
  }, new Decimal(0));
  return total.toNumber();
}

function calculateItemCount(items: CartItemWithProduct[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

// Core actions
export async function getCart() {
  try {
    const session = await auth();
    const user = session?.user;

    let cart;

    if (user) {
      const cartData = await db
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.user_id, user.id))
        .limit(1);
      cart = cartData[0] || null;
    } else {
      const sessionId = await getSessionId();
      if (!sessionId) {
        return {cart: null, cartItems: [], totalPrice: 0, itemCount: 0};
      }

      const cartData = await db
        .select()
        .from(cartsTable)
        .where(
          and(eq(cartsTable.session_id, sessionId), isNull(cartsTable.user_id)),
        )
        .limit(1);
      cart = cartData[0] || null;
    }

    if (!cart) {
      return {cart: null, cartItems: [], totalPrice: 0, itemCount: 0};
    }

    const cartItems = await getCartItemsWithProducts(cart.id);
    const totalPrice = calculateCartTotal(cartItems);
    const itemCount = calculateItemCount(cartItems);

    return {cart, cartItems, totalPrice, itemCount};
  } catch (error) {
    console.error('Error fetching cart:', error);
    return {cart: null, cartItems: [], totalPrice: 0, itemCount: 0};
  }
}

export async function addToCart(newItem: AddToCartItem) {
  try {
    const session = await auth();
    const user = session?.user;
    const sessionId = user ? null : await getOrCreateSessionId();
    let {cart} = await getCart();

    if (!cart) {
      const newCart: NewCart = {
        session_id: user ? null : sessionId,
        user_id: user?.id || null,
      };
      const now = new Date();
      const createdCart = await db
        .insert(cartsTable)
        .values({
          ...newCart,
          created_at: now,
          updated_at: now,
        })
        .returning();
      if (!createdCart[0]) throw new Error('Failed to create cart');
      cart = createdCart[0];
    }
    // Same product + size already in cart?
    const existingItem = await db
      .select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cart_id, cart.id),
          eq(cartItemsTable.product_id, newItem.product_id),
          eq(cartItemsTable.size, newItem.size),
        ),
      )
      .limit(1);

    if (existingItem[0]) {
      // Merge quantities
      await db
        .update(cartItemsTable)
        .set({
          quantity: existingItem[0].quantity + newItem.quantity,
          updated_at: new Date(),
        })
        .where(eq(cartItemsTable.id, existingItem[0].id));
    } else {
      // New line item
      const newCartItem: NewCartItem = {
        cart_id: cart.id,
        product_id: newItem.product_id,
        quantity: newItem.quantity,
        size: newItem.size,
      };
      const now = new Date();
      await db.insert(cartItemsTable).values({
        ...newCartItem,
        created_at: now,
        updated_at: now,
      });
    }

    const cartItems = await getCartItemsWithProducts(cart.id);
    const totalPrice = calculateCartTotal(cartItems);
    const itemCount = calculateItemCount(cartItems);

    return {success: true, cartItems, totalPrice, itemCount};
  } catch (error) {
    console.error('Error adding to cart:', error);
    return {success: false, error: 'Failed to add item to cart'};
  }
}

export async function removeFromCart(itemId: string) {
  try {
    const {cart} = await getCart();
    if (!cart) {
      return {success: true, cartItems: [], totalPrice: 0, itemCount: 0};
    }

    await db.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));

    const remainingItems = await db
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart.id));

    if (remainingItems.length === 0) {
      // Delete the empty cart but keep the session cookie: it's shared with
      // favorites, so dropping it would orphan a guest's saved favorites.
      // addToCart recreates a cart from the same session on the next add.
      await db.delete(cartsTable).where(eq(cartsTable.id, cart.id));
      return {success: true, cartItems: [], totalPrice: 0, itemCount: 0};
    }

    const cartItems = await getCartItemsWithProducts(cart.id);
    const totalPrice = calculateCartTotal(cartItems);
    const itemCount = calculateItemCount(cartItems);

    return {success: true, cartItems, totalPrice, itemCount};
  } catch (error) {
    console.error('Error removing from cart:', error);
    return {success: false, error: 'Failed to remove item from cart'};
  }
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  try {
    if (quantity <= 0) {
      return removeFromCart(itemId);
    }

    const {cart} = await getCart();
    if (!cart) return {success: false, error: 'Cart not found'};

    await db
      .update(cartItemsTable)
      .set({quantity, updated_at: new Date()})
      .where(eq(cartItemsTable.id, itemId));

    const cartItems = await getCartItemsWithProducts(cart.id);
    const totalPrice = calculateCartTotal(cartItems);
    const itemCount = calculateItemCount(cartItems);

    return {success: true, cartItems, totalPrice, itemCount};
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    return {success: false, error: 'Failed to update item quantity'};
  }
}

export async function clearCart() {
  try {
    const {cart} = await getCart();
    if (!cart) {
      return {success: true, cartItems: [], totalPrice: 0, itemCount: 0};
    }

    // Keep the session cookie (shared with favorites); just drop the cart row.
    await db.delete(cartsTable).where(eq(cartsTable.id, cart.id));

    return {success: true, cartItems: [], totalPrice: 0, itemCount: 0};
  } catch (error) {
    console.error('Error clearing cart:', error);
    return {success: false, error: 'Failed to clear cart'};
  }
}
