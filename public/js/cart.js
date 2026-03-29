// Cart management module
const Cart = {
  KEY: 'sea2door_cart',

  getItems() {
    return JSON.parse(localStorage.getItem(this.KEY) || '[]');
  },

  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.updateBadge();
  },

  addItem(product, quantity = 1) {
    const items = this.getItems();
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image: product.image,
        quantity
      });
    }
    this.save(items);
    this.showToast(`${product.name} נוסף לסל`);
  },

  removeItem(productId) {
    const items = this.getItems().filter(i => i.id !== productId);
    this.save(items);
  },

  updateQuantity(productId, quantity) {
    const items = this.getItems();
    const item = items.find(i => i.id === productId);
    if (item) {
      item.quantity = Math.max(0.5, quantity);
    }
    this.save(items);
  },

  getTotal() {
    return this.getItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getCount() {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  },

  clear() {
    localStorage.removeItem(this.KEY);
    this.updateBadge();
  },

  updateBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = this.getCount();
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
};

document.addEventListener('DOMContentLoaded', () => Cart.updateBadge());
