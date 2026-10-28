const NOWPAYMENTS_INVOICE_URL = 'https://api.nowpayments.io/v1/invoice';

module.exports = {
  label: 'NOWPayments',
  fields: [
    { name: 'secret', label: 'API key', type: 'password', required: true, placeholder: 'NOWPayments API key…' },
  ],

  // Create a NOWPayments invoice ("/v1/invoice") and return { url, data }
  async checkout({ product, config, amount, currency, returnUrl, webhookUrl }) {
    const payload = {
      price_amount: amount,
      price_currency: currency.toLowerCase(),
      order_id: `${product.id}-${Date.now()}`,
      order_description: product.name,
      ...(webhookUrl ? { ipn_callback_url: webhookUrl } : {}),
      ...(returnUrl ? { success_url: returnUrl } : {}),
    };

    const response = await fetch(NOWPAYMENTS_INVOICE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': config.secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.invoice_url) {
      const err = new Error(result.message || 'Failed to create NOWPayments invoice.');
      err.status = response.status >= 400 ? response.status : 400;
      err.details = result;
      throw err;
    }

    return { url: result.invoice_url, data: result };
  },
};
