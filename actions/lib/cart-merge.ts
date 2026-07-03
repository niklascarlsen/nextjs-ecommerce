import {cartItemsTable} from '@/drizzle/db/schema';

type CartMergeItem = Pick<
  typeof cartItemsTable.$inferSelect,
  'id' | 'product_id' | 'size' | 'quantity'
>;

export interface CartMergePlan {
  itemsToUpdateQuantity: {id: string; newQuantity: number}[];
  idsToMove: string[];
}

// Decide how to fold a guest cart into the user's cart: matching product+size
// merges quantities onto the user's row; everything else moves over as-is.
export function planCartMerge(
  sessionItems: CartMergeItem[],
  userItems: CartMergeItem[]
): CartMergePlan {
  const userItemsMap = new Map(
    userItems.map((item) => [`${item.product_id}_${item.size}`, item])
  );

  const itemsToUpdateQuantity: {id: string; newQuantity: number}[] = [];
  const idsToMove: string[] = [];

  for (const sessionItem of sessionItems) {
    const key = `${sessionItem.product_id}_${sessionItem.size}`;
    const existingUserItem = userItemsMap.get(key);
    if (existingUserItem) {
      itemsToUpdateQuantity.push({
        id: existingUserItem.id,
        newQuantity: existingUserItem.quantity + sessionItem.quantity,
      });
    } else {
      idsToMove.push(sessionItem.id);
    }
  }

  return {itemsToUpdateQuantity, idsToMove};
}



