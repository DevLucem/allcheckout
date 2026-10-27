const { isValidCurrency, isCrypto } = require('./currencies');

const isUrl = (v) => {
  try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
};

const DEFAULT_METADATA = [
  { name: 'name', required: false },
  { name: 'email', required: true },
];

// Normalize incoming metadata from form body or stored product
function parseMetadata(raw) {
  if (!raw) return DEFAULT_METADATA;
  if (Array.isArray(raw)) {
    return raw
      .map((f) => ({ name: String(f?.name || '').trim(), required: f?.required === true || f?.required === '1' }))
      .filter((f) => f.name);
  }
  const names = [].concat(raw.name || []);
  const reqs = [].concat(raw.required || []);
  return names
    .map((n, i) => ({ name: String(n || '').trim(), required: reqs[i] === '1' || reqs[i] === true }))
    .filter((f) => f.name);
}

// Normalize incoming subscription plans into [{ name, id, duration, price }]
function parsePlans(raw) {
  return [].concat(raw || [])
    .map((item) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('{')) {
          try { item = JSON.parse(trimmed); } catch { return null; }
        } else {
          return { name: trimmed, id: trimmed, duration: '', price: 0 };
        }
      }
      if (!item || typeof item !== 'object') return null;
      const id = String(item.id || '').trim();
      if (!id) return null;
      return {
        name: String(item.name || id).trim(),
        id,
        duration: String(item.duration || item.interval || '').trim(),
        price: Number(item.price) || 0,
      };
    })
    .filter(Boolean);
}

function validateProduct(body, methods = []) {
  const errors = {};
  const data = {
    name: (body.name || '').trim(),
    price: Number(body.price),
    currency: (body.currency || 'USD').trim().toUpperCase(),
    description: (body.description || '').trim(),
    imageUrl: (body.imageUrl || '').trim(),
    webhookUrl: (body.webhookUrl || '').trim(),
    returnUrl: (body.returnUrl || '').trim(),
    metadata: parseMetadata(body.metadata),
  };

  if (!data.name) errors.name = 'Name is required.';
  if (!Number.isFinite(data.price) || data.price <= 0) errors.price = 'Price must be greater than 0.';
  if (!isValidCurrency(data.currency)) errors.currency = 'Select a valid currency.';
  if (!data.description) errors.description = 'Description is required.';
  for (const key of ['imageUrl', 'webhookUrl', 'returnUrl']) {
    if (data[key] && !isUrl(data[key])) errors[key] = 'Must be a valid http(s) URL.';
  }

  // Only enabled methods are saved: payments.<method>.<field>
  data.payments = {};
  for (const method of methods) {
    const input = (body.payments || {})[method.id] || {};
    if (!input.enabled) continue;
    const config = {};
    for (const f of method.fields) {
      config[f.name] = (input[f.name] || '').trim();
      if (f.required && !config[f.name]) errors[`payments.${method.id}.${f.name}`] = `${f.label} is required.`;
    }
    if (method.supportsPlans || input.plans) {
      config.plans = parsePlans(input.plans);
    }
    data.payments[method.id] = config;
  }

  const factor = isCrypto(data.currency) ? 1e8 : 100;
  data.price = Math.round(data.price * factor) / factor;
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

module.exports = { validateProduct, DEFAULT_METADATA, parseMetadata, parsePlans };
