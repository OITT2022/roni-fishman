const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'sea2door-admin-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== AUTH MIDDLEWARE ==========
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ========== AUTH API ==========
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = await db.getAdminByUsername(username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const validPassword = await bcrypt.compare(password, admin.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  await db.updateAdminLastLogin(admin.id);

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  res.json({
    token,
    user: {
      id: admin.id,
      username: admin.username,
      display_name: admin.display_name,
      role: admin.role,
    }
  });
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  const admin = await db.getAdminById(req.user.id);
  if (!admin) return res.status(401).json({ error: 'User not found' });
  res.json({ user: admin });
});

app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const admin = await db.getAdminByUsername(req.user.username);
  const validPassword = await bcrypt.compare(current_password, admin.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = await bcrypt.hash(new_password, 12);
  await db.updateAdminPassword(req.user.id, hash);
  res.json({ success: true });
});

// --- Admin Users Management (protected) ---
app.get('/api/admin-users', authenticateToken, async (req, res) => {
  const users = await db.getAdminUsers();
  res.json(users);
});

app.post('/api/admin-users', authenticateToken, async (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await db.getAdminByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const result = await db.createAdminUser({ username, password_hash, display_name, role });
  res.json(result);
});

app.put('/api/admin-users/:id', authenticateToken, async (req, res) => {
  const result = await db.updateAdminUser(req.params.id, req.body);
  res.json(result);
});

app.delete('/api/admin-users/:id', authenticateToken, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    await db.deleteAdminUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== PROTECTED API ROUTES ==========

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

app.post('/api/categories', authenticateToken, async (req, res) => {
  const result = await db.createCategory(req.body);
  res.json(result);
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  const result = await db.updateCategory(req.params.id, req.body);
  res.json(result);
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
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

app.post('/api/products', authenticateToken, async (req, res) => {
  const data = req.body;
  data.in_stock = data.in_stock !== '0' && data.in_stock !== false;
  data.is_featured = data.is_featured === '1' || data.is_featured === true;
  if (typeof data.tags === 'string') {
    try { data.tags = JSON.parse(data.tags); } catch { data.tags = []; }
  }
  const result = await db.createProduct(data);
  res.json(result);
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  await db.deleteProduct(req.params.id);
  res.json({ success: true });
});

// --- Orders ---
app.get('/api/orders', authenticateToken, async (req, res) => {
  const allOrders = await db.getOrders();
  res.json(allOrders);
});

app.post('/api/orders', async (req, res) => {
  const result = await db.createOrder(req.body);
  res.json(result);
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const result = await db.updateOrderStatus(req.params.id, req.body.status);
  res.json(result);
});

// --- Stats ---
app.get('/api/stats', authenticateToken, async (req, res) => {
  const stats = await db.getStats();
  res.json(stats);
});

// ========== PAGE ROUTES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'store.html')));
app.get('/product/:slug', (req, res) => res.sendFile(path.join(__dirname, 'views', 'product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'views', 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'views', 'checkout.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
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
