const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== API ROUTES ==========

// --- Categories ---
app.get('/api/categories', async (req, res) => {
  const cats = await db.getCategories();
  res.json(cats);
});

app.get('/api/categories/:id', async (req, res) => {
  const cat = await db.getCategoryById(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  res.json(cat);
});

app.post('/api/categories', async (req, res) => {
  const result = await db.createCategory(req.body);
  res.json(result);
});

app.put('/api/categories/:id', async (req, res) => {
  const result = await db.updateCategory(req.params.id, req.body);
  res.json(result);
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await db.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Products ---
app.get('/api/products', async (req, res) => {
  const { category, featured, search, instock } = req.query;
  const result = await db.getProducts({ category, featured: featured === '1', search, instock: instock === '1' });
  res.json(result);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', async (req, res) => {
  const data = req.body;
  data.in_stock = data.in_stock !== '0' && data.in_stock !== false;
  data.is_featured = data.is_featured === '1' || data.is_featured === true;
  if (typeof data.tags === 'string') {
    try { data.tags = JSON.parse(data.tags); } catch { data.tags = []; }
  }
  const result = await db.createProduct(data);
  res.json(result);
});

app.put('/api/products/:id', async (req, res) => {
  const existing = await db.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const data = req.body;
  data.in_stock = data.in_stock !== '0' && data.in_stock !== false;
  data.is_featured = data.is_featured === '1' || data.is_featured === true;
  data.image = data.image || existing.image || '';
  if (typeof data.tags === 'string') {
    try { data.tags = JSON.parse(data.tags); } catch { data.tags = []; }
  }
  const result = await db.updateProduct(req.params.id, data);
  res.json(result);
});

app.delete('/api/products/:id', async (req, res) => {
  await db.deleteProduct(req.params.id);
  res.json({ success: true });
});

// --- Orders ---
app.get('/api/orders', async (req, res) => {
  const allOrders = await db.getOrders();
  res.json(allOrders);
});

app.post('/api/orders', async (req, res) => {
  const result = await db.createOrder(req.body);
  res.json(result);
});

app.put('/api/orders/:id/status', async (req, res) => {
  const result = await db.updateOrderStatus(req.params.id, req.body.status);
  res.json(result);
});

// --- Stats ---
app.get('/api/stats', async (req, res) => {
  const stats = await db.getStats();
  res.json(stats);
});

// ========== PAGE ROUTES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'store.html')));
app.get('/product/:slug', (req, res) => res.sendFile(path.join(__dirname, 'views', 'product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'views', 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'views', 'checkout.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));

// Local dev server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  db.initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`החנות של רוני running at http://localhost:${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
    });
  });
}

module.exports = app;
