const store = require('../lib/store');
const { DEFAULT_METADATA } = require('../lib/validate');

const PAYSTACK_BASE = 'https://api.paystack.co';

// Fetch plans from Paystack API "/plan" and shape as { name, id, duration, price }
async function fetchPlans(secret) {
  const response = await fetch(`${PAYSTACK_BASE}/plan`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.status) {
    const err = new Error(result.message || 'Failed to fetch Paystack plans.');
    err.status = response.status >= 400 ? response.status : 400;
    throw err;
  }
  return (result.data || []).map((p) => ({
    name: p.name,
    id: p.plan_code || String(p.id),
    duration: p.interval || '',
    price: Number(p.amount || 0) / 100,
  }));
}

// POST /payments/paystack — fetches plans (when action='plans') or initializes a transaction
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Handle plan fetching from the dashboard product form
  if (req.body?.action === 'plans') {
    const secret = String(req.body.secret || '').trim();
    if (!secret) return res.status(400).json({ error: 'Secret key is required to fetch plans.' });
    try {
      const plans = await fetchPlans(secret);
      return res.json({ plans });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }

  const { productId, plan, metadata = {}, ...rest } = req.body || {};
  const product = store.find(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const paystackCfg = product.payments?.paystack;
  const secret = paystackCfg?.secret;
  if (!secret) return res.status(400).json({ error: 'Paystack is not enabled for this product.' });

  // Merge flat form fields (`metadata[email]` or top-level `email`) and validate required product metadata
  const fields = { ...rest, ...metadata };
  const schema = Array.isArray(product.metadata) ? product.metadata : DEFAULT_METADATA;
  for (const f of schema) {
    if (f.required && !String(fields[f.name] || '').trim()) {
      return res.status(400).json({ error: `${f.name} is required.` });
    }
  }

  const email = String(fields.email || '').trim();
  if (!email) return res.status(400).json({ error: 'Email is required by Paystack.' });

  const allowedPlans = Array.isArray(paystackCfg.plans) ? paystackCfg.plans : [];
  let selectedPlan = null;
  if (plan) {
    selectedPlan = allowedPlans.find((p) => (p.id || p) === plan);
    if (!selectedPlan) return res.status(400).json({ error: 'Invalid subscription plan.' });
  }

  const planId = selectedPlan ? (selectedPlan.id || selectedPlan) : null;
  const chargePrice = selectedPlan && selectedPlan.price ? Number(selectedPlan.price) : Number(product.price);

  const payload = {
    email,
    amount: Math.round(chargePrice * 100), // subunits (kobo/cents)
    currency: (product.currency || 'USD').toUpperCase(),
    ...(planId ? { plan: planId } : {}),
    ...(product.returnUrl ? { callback_url: product.returnUrl } : {}),
    metadata: {
      product_id: product.id,
      product_name: product.name,
      ...(planId ? { plan: planId } : {}),
      ...(product.webhookUrl ? { webhook_url: product.webhookUrl } : {}),
      ...fields,
      custom_fields: Object.entries(fields).map(([key, value]) => ({
        display_name: key,
        variable_name: key.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
        value: String(value ?? ''),
      })),
    },
  };

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    return res.status(response.status >= 400 ? response.status : 400).json({
      error: result.message || 'Failed to initialize Paystack transaction.',
      details: result,
    });
  }

  if (req.is('application/x-www-form-urlencoded')) {
    return res.redirect(result.data.authorization_url);
  }
  return res.json({ url: result.data.authorization_url, data: result.data });
};

handler.label = 'Paystack';
handler.supportsPlans = true;
handler.fields = [
  { name: 'secret', label: 'Secret key', type: 'password', required: true, placeholder: 'sk_live_…' },
];

module.exports = handler;
