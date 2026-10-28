const sdk = require('../index');
const store = require('./store');
const { DEFAULT_METADATA } = require('./validate');

// Fire-and-forget (or awaitable) POST notification to product.webhookUrl
async function notifyWebhook(product, payload) {
  if (!product?.webhookUrl) return null;
  try {
    const res = await fetch(product.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'payment.succeeded',
        productId: product.id,
        productName: product.name,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Express handler for /payments/:method (used by the web dashboard/checkout app)
async function route(req, res, next) {
  const methodId = req.params.method;
  let Provider;
  try {
    Provider = sdk.getProviderClass(methodId);
  } catch (err) {
    return res.status(err.status || 404).json({ error: err.message });
  }

  try {
    const action = req.body?.action || req.query?.action;

    if (action === 'plans') {
      const instance = new Provider(req.body || {});
      const plans = await instance.fetchPlans();
      return res.json({ plans });
    }

    if (action === 'callback' || action === 'webhook') {
      const productId = req.query?.productId || req.body?.productId;
      const product = productId ? store.find(productId) : null;
      const config = product?.payments?.[methodId] || {};
      const instance = new Provider(config);
      const verified = await instance.verify({ req, product });
      if (verified?.paid && product) {
        await notifyWebhook(product, { method: methodId, ...verified });
      }
      if (req.method === 'GET' && product?.returnUrl) {
        return res.redirect(product.returnUrl);
      }
      return res.json({ ok: true, ...verified });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const { productId, plan, metadata = {}, ...rest } = req.body || {};
    const product = store.find(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const config = product.payments?.[methodId];
    if (!config) {
      return res.status(400).json({ error: `${Provider.label} is not enabled for this product.` });
    }

    const fields = { ...rest, ...metadata };
    delete fields.action;
    const schema = Array.isArray(product.metadata) ? product.metadata : DEFAULT_METADATA;
    for (const f of schema) {
      if (f.required && !String(fields[f.name] || '').trim()) {
        return res.status(400).json({ error: `${f.name} is required.` });
      }
    }

    const allowedPlans = Array.isArray(config.plans) ? config.plans : [];
    let selectedPlan = null;
    if (plan) {
      selectedPlan = allowedPlans.find((p) => (p.id || p) === plan);
      if (!selectedPlan) return res.status(400).json({ error: 'Invalid subscription plan.' });
    }

    const planId = selectedPlan ? (selectedPlan.id || selectedPlan) : null;
    const amount = selectedPlan && selectedPlan.price ? Number(selectedPlan.price) : Number(product.price);
    const hostUrl = typeof req.get === 'function' ? `${req.protocol || 'http'}://${req.get('host')}` : '';
    const callbackUrl = hostUrl
      ? `${hostUrl}/payments/${methodId}?action=callback&productId=${encodeURIComponent(product.id)}`
      : product.returnUrl || '';

    const instance = new Provider(config);
    const result = await instance.checkout({
      product,
      metadata: fields,
      plan: selectedPlan,
      planId,
      amount,
      currency: (product.currency || 'USD').toUpperCase(),
      returnUrl: product.returnUrl || '',
      webhookUrl: product.webhookUrl || '',
      callbackUrl,
      req,
    });

    if (req.is && req.is('application/x-www-form-urlencoded')) {
      return res.redirect(result.url);
    }
    return res.json({ url: result.url, data: result.data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    next(err);
  }
}

module.exports = {
  ...sdk,
  route,
  notifyWebhook,
};
