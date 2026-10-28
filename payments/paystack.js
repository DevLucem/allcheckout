const PAYSTACK_BASE = 'https://api.paystack.co';

module.exports = {
  label: 'Paystack',
  currencies: ['NGN', 'USD', 'GHS', 'ZAR', 'KES', 'XOF', 'EGP'],
  fields: [
    { name: 'secret', label: 'Secret key', type: 'password', required: true, placeholder: 'sk_live_…' },
  ],

  // Fetch subscription plans from Paystack "/plan" -> [{ name, id, duration, price }]
  async fetchPlans({ secret }) {
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
  },

  // Initialize a Paystack transaction ("/transaction/initialize") and return { url, data }
  async checkout({ product, config, metadata, planId, amount, currency, returnUrl, webhookUrl }) {
    const email = String(metadata.email || '').trim();
    if (!email) {
      const err = new Error('Email is required by Paystack.');
      err.status = 400;
      throw err;
    }

    const payload = {
      email,
      amount: Math.round(amount * 100), // subunits (kobo/cents)
      currency,
      ...(planId ? { plan: planId } : {}),
      ...(returnUrl ? { callback_url: returnUrl } : {}),
      metadata: {
        product_id: product.id,
        product_name: product.name,
        ...(planId ? { plan: planId } : {}),
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
        ...metadata,
        custom_fields: Object.entries(metadata).map(([key, value]) => ({
          display_name: key,
          variable_name: key.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
          value: String(value ?? ''),
        })),
      },
    };

    const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      const err = new Error(result.message || 'Failed to initialize Paystack transaction.');
      err.status = response.status >= 400 ? response.status : 400;
      err.details = result;
      throw err;
    }

    return { url: result.data.authorization_url, data: result.data };
  },

  // Optional callback/webhook verification: GET /payments/paystack?action=callback&productId=...&reference=...
  async verify({ req, config }) {
    const reference = req.query?.reference || req.body?.data?.reference;
    if (!reference || !config.secret) return { paid: false };
    const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${config.secret}` },
    });
    const result = await response.json().catch(() => ({}));
    const paid = !!(response.ok && result.status && result.data?.status === 'success');
    return {
      paid,
      reference,
      amount: result.data?.amount ? result.data.amount / 100 : undefined,
      currency: result.data?.currency,
      metadata: result.data?.metadata,
    };
  },
};
