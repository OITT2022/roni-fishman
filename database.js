const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

function getSQL() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\u0590-\u05FFa-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || uuidv4().slice(0, 8);
}

// Initialize tables
async function initDB() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      short_description TEXT DEFAULT '',
      price NUMERIC(10,2) NOT NULL,
      unit TEXT DEFAULT 'kg',
      price_label TEXT DEFAULT '',
      image TEXT DEFAULT '',
      gallery JSONB DEFAULT '[]',
      in_stock BOOLEAN DEFAULT true,
      is_featured BOOLEAN DEFAULT false,
      weight_options JSONB DEFAULT '[]',
      tags JSONB DEFAULT '[]',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'admin',
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      delivery_address TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_notes TEXT DEFAULT '',
      items JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      delivery_fee NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`;
  return true;
}

// ===== Categories =====
async function getCategories() {
  const sql = getSQL();
  return sql`SELECT * FROM categories ORDER BY sort_order, name`;
}

async function getCategoryById(id) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM categories WHERE id = ${id}`;
  return rows[0];
}

async function createCategory({ name, description, icon, sort_order }) {
  const sql = getSQL();
  const id = uuidv4();
  const slug = slugify(name);
  await sql`INSERT INTO categories (id, name, slug, description, icon, sort_order) VALUES (${id}, ${name}, ${slug}, ${description || ''}, ${icon || ''}, ${sort_order || 0})`;
  return getCategoryById(id);
}

async function updateCategory(id, { name, description, icon, sort_order }) {
  const sql = getSQL();
  const slug = slugify(name);
  await sql`UPDATE categories SET name=${name}, slug=${slug}, description=${description || ''}, icon=${icon || ''}, sort_order=${sort_order || 0} WHERE id=${id}`;
  return getCategoryById(id);
}

async function deleteCategory(id) {
  const sql = getSQL();
  const products = await sql`SELECT COUNT(*) as count FROM products WHERE category_id=${id}`;
  if (parseInt(products[0].count) > 0) {
    throw new Error('Cannot delete category with products');
  }
  await sql`DELETE FROM categories WHERE id=${id}`;
}

// ===== Products =====
async function getProducts({ category, featured, search, instock } = {}) {
  const sql = getSQL();
  let rows;
  if (search) {
    const term = `%${search}%`;
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.name ILIKE ${term} OR p.description ILIKE ${term} ORDER BY p.sort_order, p.name`;
  } else if (category) {
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id=${category} ORDER BY p.sort_order, p.name`;
  } else if (featured) {
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_featured=true ORDER BY p.sort_order`;
  } else if (instock) {
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.in_stock=true ORDER BY p.sort_order, p.name`;
  } else {
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.sort_order, p.name`;
  }
  return rows.map(p => ({
    ...p,
    price: parseFloat(p.price),
    subtotal: p.subtotal ? parseFloat(p.subtotal) : undefined,
    delivery_fee: p.delivery_fee ? parseFloat(p.delivery_fee) : undefined,
    total: p.total ? parseFloat(p.total) : undefined,
  }));
}

async function getProductById(id) {
  const sql = getSQL();
  let rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id=${id}`;
  if (rows.length === 0) {
    rows = await sql`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug=${id}`;
  }
  if (rows.length === 0) return null;
  const p = rows[0];
  return { ...p, price: parseFloat(p.price) };
}

async function createProduct({ category_id, name, description, short_description, price, unit, price_label, image, in_stock, is_featured, tags, sort_order }) {
  const sql = getSQL();
  const id = uuidv4();
  const slug = slugify(name);
  await sql`INSERT INTO products (id, category_id, name, slug, description, short_description, price, unit, price_label, image, in_stock, is_featured, tags, sort_order)
    VALUES (${id}, ${category_id}, ${name}, ${slug}, ${description || ''}, ${short_description || ''}, ${parseFloat(price)}, ${unit || 'kg'}, ${price_label || ''}, ${image || ''}, ${in_stock !== false}, ${is_featured === true}, ${JSON.stringify(tags || [])}, ${parseInt(sort_order) || 0})`;
  return getProductById(id);
}

async function updateProduct(id, { category_id, name, description, short_description, price, unit, price_label, image, in_stock, is_featured, tags, sort_order }) {
  const sql = getSQL();
  const slug = slugify(name);
  await sql`UPDATE products SET category_id=${category_id}, name=${name}, slug=${slug}, description=${description || ''}, short_description=${short_description || ''}, price=${parseFloat(price)}, unit=${unit || 'kg'}, price_label=${price_label || ''}, image=${image || ''}, in_stock=${in_stock !== false}, is_featured=${is_featured === true}, tags=${JSON.stringify(tags || [])}, sort_order=${parseInt(sort_order) || 0}, updated_at=NOW() WHERE id=${id}`;
  return getProductById(id);
}

async function deleteProduct(id) {
  const sql = getSQL();
  await sql`DELETE FROM products WHERE id=${id}`;
}

// ===== Orders =====
async function getOrders() {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows.map(o => ({
    ...o,
    subtotal: parseFloat(o.subtotal),
    delivery_fee: parseFloat(o.delivery_fee),
    total: parseFloat(o.total),
  }));
}

async function createOrder({ customer_name, customer_phone, customer_email, delivery_address, delivery_city, delivery_notes, items, subtotal, delivery_fee }) {
  const sql = getSQL();
  const id = uuidv4();
  const total = (parseFloat(subtotal) || 0) + (parseFloat(delivery_fee) || 0);
  await sql`INSERT INTO orders (id, customer_name, customer_phone, customer_email, delivery_address, delivery_city, delivery_notes, items, subtotal, delivery_fee, total)
    VALUES (${id}, ${customer_name}, ${customer_phone}, ${customer_email || ''}, ${delivery_address}, ${delivery_city}, ${delivery_notes || ''}, ${JSON.stringify(items)}, ${parseFloat(subtotal)}, ${parseFloat(delivery_fee) || 0}, ${total})`;
  const rows = await sql`SELECT * FROM orders WHERE id=${id}`;
  return rows[0];
}

async function updateOrderStatus(id, status) {
  const sql = getSQL();
  await sql`UPDATE orders SET status=${status} WHERE id=${id}`;
  const rows = await sql`SELECT * FROM orders WHERE id=${id}`;
  return rows[0];
}

// ===== Admin Users =====
async function getAdminByUsername(username) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM admin_users WHERE username = ${username} AND is_active = true`;
  return rows[0] || null;
}

async function getAdminById(id) {
  const sql = getSQL();
  const rows = await sql`SELECT id, username, display_name, role, is_active, last_login, created_at FROM admin_users WHERE id = ${id}`;
  return rows[0] || null;
}

async function getAdminUsers() {
  const sql = getSQL();
  return sql`SELECT id, username, display_name, role, is_active, last_login, created_at FROM admin_users ORDER BY created_at`;
}

async function createAdminUser({ username, password_hash, display_name, role }) {
  const sql = getSQL();
  const id = uuidv4();
  await sql`INSERT INTO admin_users (id, username, password_hash, display_name, role) VALUES (${id}, ${username}, ${password_hash}, ${display_name || ''}, ${role || 'admin'})`;
  return getAdminById(id);
}

async function updateAdminUser(id, { display_name, role, is_active }) {
  const sql = getSQL();
  await sql`UPDATE admin_users SET display_name = ${display_name || ''}, role = ${role || 'admin'}, is_active = ${is_active !== false} WHERE id = ${id}`;
  return getAdminById(id);
}

async function updateAdminPassword(id, password_hash) {
  const sql = getSQL();
  await sql`UPDATE admin_users SET password_hash = ${password_hash} WHERE id = ${id}`;
}

async function updateAdminLastLogin(id) {
  const sql = getSQL();
  await sql`UPDATE admin_users SET last_login = NOW() WHERE id = ${id}`;
}

async function deleteAdminUser(id) {
  const sql = getSQL();
  const [count] = await sql`SELECT COUNT(*) as count FROM admin_users WHERE is_active = true`;
  if (parseInt(count.count) <= 1) {
    throw new Error('Cannot delete the last admin user');
  }
  await sql`DELETE FROM admin_users WHERE id = ${id}`;
}

// ===== Stats =====
async function getStats() {
  const sql = getSQL();
  const [prodCount] = await sql`SELECT COUNT(*) as count FROM products`;
  const [catCount] = await sql`SELECT COUNT(*) as count FROM categories`;
  const [orderCount] = await sql`SELECT COUNT(*) as count FROM orders`;
  const statusCounts = await sql`SELECT status, COUNT(*) as count FROM orders GROUP BY status`;
  return {
    productCount: parseInt(prodCount.count),
    categoryCount: parseInt(catCount.count),
    orderCount: parseInt(orderCount.count),
    statusCounts,
  };
}

module.exports = {
  uuidv4,
  slugify,
  initDB,
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  getOrders, createOrder, updateOrderStatus,
  getAdminByUsername, getAdminById, getAdminUsers, createAdminUser, updateAdminUser, updateAdminPassword, updateAdminLastLogin, deleteAdminUser,
  getStats,
};
