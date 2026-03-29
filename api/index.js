try {
  const app = require('../server');
  module.exports = app;
} catch (err) {
  module.exports = (req, res) => {
    res.status(500).json({ error: err.message, stack: err.stack });
  };
}
