'use server';

import {auth} from '@/lib/auth';
import {getSessionId} from '@/utils/cookies';
import {getCart, clearCart} from '@/actions/cart.actions';
import {
  DeliveryFormData,
  deliverySchema,
} from '@/lib/validators/checkout-validation';
import {db} from '@/drizzle/index';
import {ordersTable, orderItemsTable} from '@/drizzle/db/schema';
import {eq, desc} from 'drizzle-orm';
import {PaymentInfo} from '@/lib/types/query-types';
import {CreateOrderResult} from '@/lib/types/db-types';

const ALLOWED_PAYMENT_METHODS: PaymentInfo['method'][] = [
  'card',
  'swish',
  'klarna',
];

export async function createOrder(
  deliveryInfo: DeliveryFormData,
  paymentInfo: PaymentInfo,
): Promise<CreateOrderResult> {
  const deliveryValidation = deliverySchema.safeParse(deliveryInfo);

  if (!deliveryValidation.success) {
    console.error(
      'Delivery validation failed:',
      deliveryValidation.error.flatten(),
    );
    return {
      success: false,
      error: 'Delivery information is invalid. Please check all fields.',
    };
  }

  if (!paymentInfo || !ALLOWED_PAYMENT_METHODS.includes(paymentInfo.method)) {
    return {success: false, error: 'Invalid payment method.'};
  }

  try {
    const session = await auth();
    const user = session?.user;

    const {cart, cartItems, totalPrice} = await getCart();
    if (!cart || cartItems.length === 0) {
      return {success: false, error: 'Your cart is empty.'};
    }

    // neon-http: doesn't support transaction - using sequential inserts.
    const now = new Date();
    const newOrder = {
      user_id: user?.id,
      session_id: user ? null : await getSessionId(),
      status: 'betald',
      total_amount: totalPrice,
      delivery_info: deliveryInfo,
      payment_info: paymentInfo.method,
      created_at: now,
      updated_at: now,
    };

    const [newlyCreatedOrder] = await db
      .insert(ordersTable)
      .values(newOrder)
      .returning();

    if (!newlyCreatedOrder) throw new Error('Failed to create order');

    const orderItems = cartItems.map((item) => ({
      order_id: newlyCreatedOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      name: item.name,
      size: item.size,
      color: item.color,
      slug: item.slug,
      image: item.images?.[0] ?? '',
      created_at: now,
    }));

    await db.insert(orderItemsTable).values(orderItems);

    // Drop the cart so a replayed request can't create a duplicate paid order
    await clearCart();

    return {success: true, orderId: newlyCreatedOrder.id};
  } catch (error) {
    console.error('Error creating order:', error);
    return {success: false, error: 'Failed to create order'};
  }
}

export async function getUserOrderById(orderId: string) {
  try {
    const session = await auth();
    const user = session?.user;
    const sessionId = user ? null : await getSessionId();

    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
      with: {
        order_items: true,
      },
    });

    if (!order) {
      return {success: false, error: 'Order not found'};
    }

    // Check if the current user (logged in or guest) owns the order
    const isOwner = user
      ? order.user_id === user.id
      : // : !!sessionId && order.session_id === sessionId;
        sessionId
        ? order.session_id === sessionId
        : false;

    if (!isOwner) {
      return {success: false, error: 'Order not found'};
    }

    return {success: true, order};
  } catch (error) {
    console.error('Error fetching order:', error);
    return {success: false, error: 'Failed to fetch order'};
  }
}

export async function getUserOrdersOverview() {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      console.error(
        'Authentication error fetching user orders: User not authenticated',
      );
      return {success: false, error: 'User not authenticated', orders: []};
    }

    const orders = await db.query.ordersTable.findMany({
      where: eq(ordersTable.user_id, user.id),
      orderBy: desc(ordersTable.created_at),
      columns: {
        id: true,
        created_at: true,
      },
      with: {
        order_items: {
          columns: {
            order_id: true,
            image: true,
            name: true,
          },
        },
      },
    });

    return {success: true, orders};
  } catch (error) {
    console.error('Unexpected error in getUserOrdersOverview:', error);
    return {success: false, error: 'Unexpected error', orders: []};
  }
}
