const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'payments');
const VALID = /^[a-z0-9_-]+$/i; // blocks path traversal like "../server"

// Resolve a payment method name to its handler in /payments/<method>.js
function load(method) {
  if (!VALID.test(method)) return null;
  const file = path.join(DIR, `${method}.js`);
  if (!fs.existsSync(file)) return null;
  return require(file);
}

// All available methods with their config metadata: [{ id, label, fields }]
function list() {
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => {
      const id = path.basename(f, '.js');
      const h = load(id);
      return { id, label: h.label || id, fields: h.fields || [], supportsPlans: !!h.supportsPlans };
    });
}

// Express handler for /payments/:method
async function route(req, res, next) {
  const handler = load(req.params.method);
  if (typeof handler !== 'function') {
    return res.status(404).json({ error: `Payment method "${req.params.method}" not found.` });
  }
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
}

module.exports = { load, list, route };
