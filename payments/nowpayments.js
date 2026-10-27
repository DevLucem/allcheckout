const store = require('../lib/store');
const { DEFAULT_METADATA } = require('../lib/validate');

const NOWPAYMENTS_INVOICE_URL = 'https://api.nowpayments.io/v1/invoice';

// POST /payments/nowpayments — creates a NOWPayments invoice and returns its checkout URL
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { productId, metadata = {}, ...rest } = req.body || {};
  const product = store.find(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const secret = product.payments?.nowpayments?.secret;
  if (!secret) return res.status(400).json({ error: 'NOWPayments is not enabled for this product.' });

  // Validate required product metadata fields
  const fields = { ...rest, ...metadata };
  const schema = Array.isArray(product.metadata) ? product.metadata : DEFAULT_METADATA;
  for (const f of schema) {
    if (f.required && !String(fields[f.name] || '').trim()) {
      return res.status(400).json({ error: `${f.name} is required.` });
    }
  }

  const payload = {
    price_amount: Number(product.price),
    price_currency: (product.currency || 'USD').toLowerCase(),
    order_id: `${product.id}-${Date.now()}`,
    order_description: product.name,
    ...(product.webhookUrl ? { ipn_callback_url: product.webhookUrl } : {}),
    ...(product.returnUrl ? { success_url: product.returnUrl } : {}),
  };

  const response = await fetch(NOWPAYMENTS_INVOICE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': secret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  const invoiceUrl = result.invoice_url;

  if (!response.ok || !invoiceUrl) {
    return res.status(response.status >= 400 ? response.status : 400).json({
      error: result.message || 'Failed to create NOWPayments invoice.',
      details: result,
    });
  }

  if (req.is('application/x-www-form-urlencoded')) {
    return res.redirect(invoiceUrl);
  }
  return res.json({ url: invoiceUrl, data: result });
};

handler.label = 'NOWPayments';
handler.fields = [
  { name: 'secret', label: 'API key', type: 'password', required: true, placeholder: 'NOWPayments API key…' },
];

module.exports = handler;
