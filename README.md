# AllCheckout

Create products, configure payment providers and custom customer fields, and share a single checkout link — or use AllCheckout directly as a Node.js payment library.

## Features

- **Product Management (`/dashboard`)**: Create and edit products with name, price, currency (162 ISO fiat currencies + 20 cryptocurrencies), and live-preview custom Markdown descriptions.
- **Optional Product Settings**: Attach a product image URL, webhook URL, and post-purchase return URL.
- **Custom Customer Metadata**: Collect customer details at checkout (`name` optional and `email` required by default, with one-click Required/Optional toggles and custom fields).
- **Pluggable Payment Providers (`/payments/:method`)**:
  - **Paystack** (`payments/paystack.js`): One-time charges (`/transaction/initialize`), subscription plans (`/plan`), and payment verification (`/transaction/verify/:reference`).
  - **NOWPayments** (`payments/nowpayments.js`): Crypto & fiat invoice creation (`/v1/invoice`).
  - Adding a new provider requires only adding a single `<method>.js` file in `payments/`.

## Getting Started (Web App)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and visit `/dashboard` to create your first product.

## Using as a Library

```bash
npm install allcheckout
```

Every file in `payments/` is automatically exposed as an instantiable class on `allcheckout`:

```js
const allcheckout = require('allcheckout'); // or require('./index')

// 1. NOWPayments
const now = new allcheckout.nowpayments({ secret: process.env.NOWPAYMENTS_KEY });
const invoice = await now.checkout({
  amount: 49.99,
  currency: 'USDT',
  name: 'Pro License',
  returnUrl: 'https://example.com/thanks',
  webhookUrl: 'https://example.com/ipn',
});
console.log(invoice.url); // Redirect user to hosted invoice

// 2. Paystack (one-time charge, plans, and verification)
const paystack = new allcheckout.paystack({ secret: process.env.PAYSTACK_SECRET });

const plans = await paystack.fetchPlans(); // [{ name, id, duration, price }, ...]

const session = await paystack.checkout({
  amount: 25,
  currency: 'USD',
  email: 'buyer@example.com',
  plan: plans[0]?.id, // optional subscription plan ID
  metadata: { name: 'Ada Lovelace', company: 'Analytical Engines' },
  returnUrl: 'https://example.com/thanks',
});
console.log(session.url);

// Verify a transaction reference
const verified = await paystack.verify({ reference: 'ref_123' });
```

 Attempting to instantiate an unsupported provider (e.g. `new allcheckout.unknown({})`) or passing an unsupported currency throws an explicit error immediately.

## Contributing a Payment Method

To add a new payment provider (e.g. `stripe`, `paypal`, `flutterwave`), create `payments/<method>.js`. All library class instantiation (`new allcheckout.<method>(config)`), routing (`/payments/<method>`), dashboard form toggles, credential validation, metadata validation, subscription plan selection, and webhook forwarding are handled automatically by `index.js` and `lib/payments.js`.

```js
// payments/example.js
module.exports = {
  label: 'ExamplePay',
  // Optional: restrict supported currencies (or use currencyTypes: ['fiat'] / ['crypto'])
  currencies: ['USD', 'EUR', 'GBP'],
  // Fields rendered in the dashboard product form & required by `new allcheckout.example(config)`
  fields: [
    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
    { name: 'secret', label: 'Secret key', type: 'password', required: true },
  ],

  // Optional: enables `payment.fetchPlans()` and the "Subscription plans" selector in the dashboard form
  async fetchPlans(config) {
    // Use config.client_id / config.secret to fetch plans from provider API
    return [{ name: 'Pro Monthly', id: 'plan_123', duration: 'monthly', price: 19.99 }];
  },

  // Required: initialize checkout and return { url, data }
  async checkout({ product, config, metadata, plan, planId, amount, currency, returnUrl, webhookUrl, callbackUrl }) {
    // Call provider API and return the hosted checkout redirect URL
    return { url: 'https://checkout.example.com/session_123', data: {} };
  },

  // Optional: verify payment via `payment.verify(params)` or GET/POST /payments/example?action=callback&productId=...
  async verify({ req, product, config }) {
    return { paid: true, reference: req.query.ref, amount: product?.price, currency: product?.currency };
  },
};
```
