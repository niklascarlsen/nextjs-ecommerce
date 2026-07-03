import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  primaryKey,
  AnyPgColumn,
  unique,
  serial,
  pgEnum,
} from 'drizzle-orm/pg-core';
import {relations, sql, type SQL} from 'drizzle-orm';
import type {DeliveryFormData} from '@/lib/validators/checkout-validation';
import type {AdapterAccount} from '@/lib/types/auth-types';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', {mode: 'date', withTimezone: true}),
  image: text('image'),
  role: integer('role').notNull().default(0),
});

export const accountsTable = pgTable(
  'accounts',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => usersTable.id, {onDelete: 'cascade'}),
    type: text('type').$type<AdapterAccount['type']>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({columns: [table.provider, table.providerAccountId]})]
);

export const sessionsTable = pgTable('sessions', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => usersTable.id, {onDelete: 'cascade'}),
  expires: timestamp('expires', {mode: 'date', withTimezone: true}).notNull(),
});

const tsvector = customType<{data: string}>({
  dataType() {
    return 'tsvector';
  },
});

export const productsTable = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', {length: 255}).notNull(),
    slug: varchar('slug', {length: 255}).notNull().unique(),
    description: varchar('description', {length: 255}).notNull(),
    price: integer('price').notNull(),
    brand: varchar('brand', {length: 255}).notNull(),
    gender: varchar('gender', {length: 255}).notNull(),
    category: varchar('category', {length: 255}).notNull(),
    color: varchar('color', {length: 255}).notNull(),
    specs: jsonb('specs').$type<string[]>(),
    images: jsonb('images').$type<string[]>().notNull(),
    sizes: jsonb('sizes').$type<string[]>().notNull(),
    created_at: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    published_at: timestamp('published_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    // Weighted FTS document: name (A) ranks above color (B), category (C), gender (D)
    search_vector: tsvector('search_vector').generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', ${productsTable.name}), 'A') || setweight(to_tsvector('english', ${productsTable.color}), 'B') || setweight(to_tsvector('english', ${productsTable.category}), 'C') || setweight(to_tsvector('english', ${productsTable.gender}), 'D')`
    ),
  },
  (table) => [
    index('products_search_vector_idx').using('gin', table.search_vector),
    index('products_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
    index('products_color_trgm_idx').using(
      'gin',
      table.color.op('gin_trgm_ops')
    ),
    index('products_category_trgm_idx').using(
      'gin',
      table.category.op('gin_trgm_ops')
    ),
  ]
);

export const cartsTable = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => usersTable.id, {
    onDelete: 'cascade',
  }),
  session_id: varchar('session_id', {length: 255}),
  created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
  updated_at: timestamp('updated_at', {withTimezone: true}).defaultNow(),
});

export const cartItemsTable = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cart_id: uuid('cart_id')
    .notNull()
    .references(() => cartsTable.id, {onDelete: 'cascade'}),
  product_id: uuid('product_id')
    .notNull()
    .references(() => productsTable.id, {onDelete: 'cascade'}),
  quantity: integer('quantity').notNull(),
  size: varchar('size', {length: 255}).notNull(),
  created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
  updated_at: timestamp('updated_at', {withTimezone: true}).defaultNow(),
});

export const ordersTable = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => usersTable.id, {
    onDelete: 'cascade',
  }),
  session_id: varchar('session_id', {length: 255}),
  total_amount: integer('total_amount').notNull(),
  payment_info: varchar('payment_info', {length: 255}).notNull(),
  status: varchar('status', {length: 255}).notNull(),
  delivery_info: jsonb('delivery_info').$type<DeliveryFormData>().notNull(),
  created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
  updated_at: timestamp('updated_at', {withTimezone: true}).defaultNow(),
});

export const orderItemsTable = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id')
    .notNull()
    .references(() => ordersTable.id, {onDelete: 'cascade'}),
  product_id: uuid('product_id').references(() => productsTable.id, {
    onDelete: 'set null',
  }),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(),
  name: varchar('name', {length: 255}).notNull(),
  size: varchar('size', {length: 255}).notNull(),
  color: varchar('color', {length: 255}).notNull(),
  slug: varchar('slug', {length: 255}).notNull(),
  created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
  image: varchar('image', {length: 255}).notNull(),
});

export const favoritesTable = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => usersTable.id, {
      onDelete: 'cascade',
    }),
    session_id: varchar('session_id', {length: 255}),
    product_id: uuid('product_id')
      .references(() => productsTable.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
  },
  (table) => [
    unique('user_product_unique').on(table.user_id, table.product_id),
    unique('session_product_unique').on(table.session_id, table.product_id),
  ]
);

export const categoryTypeEnum = pgEnum('category_type', [
  'MAIN-CATEGORY',
  'SUB-CATEGORY',
  'CONTAINER',
  'COLLECTION',
]);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: categoryTypeEnum('type').notNull().default('SUB-CATEGORY'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    desktopImage: text('desktop_image'),
    mobileImage: text('mobile_image'),
    created_at: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    parentId: integer('parent_id').references(
      (): AnyPgColumn => categories.id,
      {
        onDelete: 'cascade',
      }
    ),
  },
  (table) => {
    return [
      unique('slug_parent_unique_idx').on(table.slug, table.parentId),
      unique('name_unique_idx').on(table.name, table.parentId),
    ];
  }
);

export const ordersRelations = relations(ordersTable, ({one, many}) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id],
  }),
  order_items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({one}) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id],
  }),
}));
