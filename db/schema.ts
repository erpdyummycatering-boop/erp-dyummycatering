import { pgTable, bigserial, varchar, timestamp, text, date, time, decimal, integer, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('Aktif'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).unique(),
  email: varchar('email', { length: 255 }),
  type: varchar('type', { length: 100 }),
  address: text('address'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const leads = pgTable('leads', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  customer_id: bigint('customer_id', { mode: 'number' }).references(() => customers.id, { onDelete: 'cascade' }),
  pic_id: bigint('pic_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  lead_date: date('lead_date').notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  tags: varchar('tags', { length: 255 }),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const products = pgTable('products', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  price: decimal('price', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('Aktif'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const recipes = pgTable('recipes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  product_id: bigint('product_id', { mode: 'number' }).references(() => products.id, { onDelete: 'cascade' }),
  ingredients: text('ingredients').notNull(),
  standard_cost: decimal('standard_cost', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  customer_id: bigint('customer_id', { mode: 'number' }).references(() => customers.id, { onDelete: 'restrict' }),
  lead_id: bigint('lead_id', { mode: 'number' }).references(() => leads.id, { onDelete: 'set null' }),
  pic_id: bigint('pic_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  order_date: date('order_date').notNull(),
  delivery_date: date('delivery_date').notNull(),
  departure_time: time('departure_time'),
  arrival_time: time('arrival_time'),
  venue: text('venue'),
  order_notes: text('order_notes'),
  status_order: varchar('status_order', { length: 50 }).default('Baru'),
  status_payment: varchar('status_payment', { length: 50 }).default('Belum Lunas'),
  grand_total: decimal('grand_total', { precision: 15, scale: 2 }).default('0'),
  estimated_budget: decimal('estimated_budget', { precision: 15, scale: 2 }).default('0'),
  actual_cost: decimal('actual_cost', { precision: 15, scale: 2 }).default('0'),
  status_cost: varchar('status_cost', { length: 50 }).default('Pending Input'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const order_items = pgTable('order_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  order_id: bigint('order_id', { mode: 'number' }).references(() => orders.id, { onDelete: 'cascade' }),
  product_id: bigint('product_id', { mode: 'number' }).references(() => products.id, { onDelete: 'restrict' }),
  custom_menu: text('custom_menu'),
  price: decimal('price', { precision: 15, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  discount: decimal('discount', { precision: 15, scale: 2 }).default('0'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});
