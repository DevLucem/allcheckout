# AllCheckout

A zero-dependency, pluggable multi-provider payment checkout SDK for Node.js — plus a ready-to-run dashboard and hosted checkout server.

## Installation

```bash
npm install allcheckout
```

## Quick Start (Library Usage)

Instantiate any supported provider on `allcheckout` with your credentials and call `.checkout()`:

```js
const allcheckout = require('allcheckout');

const payment = new allcheckout.nowpayments({ secret: process.env.NOWPAYMENTS_KEY });

const { url, data } = await payment.checkout({
  amount: 49.99,
  currency: 'USDT',
  name: 'Pro License',
  returnUrl: 'https://example.com/thanks',
  webhookUrl: 'https://example.com/ipn',
});

// Redirect the customer to `url`
```

### Paystack Example (One-Time Charge, Subscriptions & Verification)

```js
const allcheckout = require('allcheckout');

const paystack = new allcheckout.paystack({ secret: process.env.PAYSTACK_SECRET });

// 1. Fetch subscription plans from Paystack ("/plan")
const plans = await paystack.fetchPlans();
// -> [{ name: 'Pro Monthly', id: 'PLN_xxx', duration: 'monthly', price: 25 }, ...]

// 2. Initialize a transaction ("/transaction/initialize")
const session = await paystack.checkout({
  amount: 25,
  currency: 'USD',
  email: 'buyer@example.com',
  plan: plans[0]?.id, // omit for a one-time payment
  metadata: { name: 'Ada Lovelace', company: 'Analytical Engines' },
  returnUrl: 'https://example.com/thanks',
});
console.log(session.url);

// 3. Verify a transaction reference
const verified = await paystack.verify({ reference: 'ref_123' });
// -> { paid: true, reference: 'ref_123', amount: 25, currency: 'USD', metadata: {...} }
```

### Library API Reference

| Method / Property | Description |
| --- | --- |
| `new allcheckout.<method>(config)` | Creates a provider instance (`paystack`, `nowpayments`, etc.) and validates required credentials. Throws immediately if the method is not supported. |
| `await payment.checkout(options)` | Initializes a payment session and returns `{ url, data }`. Accepts `amount`, `currency`, `name`, `email`, `plan`, `metadata`, `returnUrl`, and `webhookUrl`. |
| `await payment.fetchPlans()` | Fetches available subscription plans for providers that support subscriptions (`[{ name, id, duration, price }]`). |
| `await payment.verify(params)` | Verifies a completed transaction or callback payload. |
| `allcheckout.methods` | Array of available payment provider IDs (e.g. `['nowpayments', 'paystack']`). |
| `allcheckout.getCurrencies()` | Returns all 182 supported currencies (162 ISO fiat currencies + 20 cryptocurrencies). |
| `allcheckout.formatMoney(amount, currency)` | Formats an amount in any supported fiat or crypto currency (e.g. `$25.00`, `0.00125 BTC`). |

---

## Self-Hosted Dashboard & Checkout App

When cloned from the repository, AllCheckout also includes an Express + Tailwind web app where you can create products, configure payment methods and custom customer metadata fields, and share `/checkout/:product` links.

```bash
git clone <repo-url>
cd allcheckout
npm install
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to create and manage products.

---

## Contributing a Payment Method

To add a new payment provider (e.g. `stripe`, `paypal`, `flutterwave`), create a single file at `payments/<method>.js`. Library class instantiation (`new allcheckout.<method>(config)`), Express routing (`/payments/<method>`), dashboard form toggles, credential validation, metadata validation, and subscription plan selection work automatically.

```js
// payments/example.js
module.exports = {
  label: 'ExamplePay',
  // Optional: restrict supported currencies (or use currencyTypes: ['fiat'] / ['crypto'])
  currencies: ['USD', 'EUR', 'GBP'],
  // Fields required by `new allcheckout.example(config)` and rendered in the dashboard form
  fields: [
    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
    { name: 'secret', label: 'Secret key', type: 'password', required: true },
  ],

  // Optional: enables `payment.fetchPlans()` and the dashboard plan selector
  async fetchPlans(config) {
    return [{ name: 'Pro Monthly', id: 'plan_123', duration: 'monthly', price: 19.99 }];
  },

  // Required: initialize checkout and return { url, data }
  async checkout({ product, config, metadata, plan, planId, amount, currency, returnUrl, webhookUrl, callbackUrl }) {
    return { url: 'https://checkout.example.com/session_123', data: {} };
  },

  // Optional: enables `payment.verify(params)` and callback verification
  async verify({ req, product, config }) {
    return { paid: true, reference: req.query.ref, amount: product?.price, currency: product?.currency };
  },
};
```
