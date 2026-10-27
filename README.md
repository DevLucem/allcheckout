# AllCheckout

Create products, configure payment providers and custom customer fields, and share a single checkout link.

## Features

- **Product Management (`/dashboard`)**: Create and edit products with name, price, currency (162 ISO fiat currencies + 20 cryptocurrencies), and live-preview custom Markdown descriptions.
- **Optional Product Settings**: Attach a product image URL, webhook URL, and post-purchase return URL.
- **Custom Customer Metadata**: Collect customer details at checkout (`name` optional and `email` required by default, with one-click Required/Optional toggles and custom fields).
- **Pluggable Payment Providers (`/payments/:method`)**:
  - **Paystack** (`payments/paystack.js`): One-time charges (`/transaction/initialize`) and subscription plans fetched from `/plan` and saved as `plans[{ name, id, duration, price }]`.
  - **NOWPayments** (`payments/nowpayments.js`): Crypto & fiat invoice creation (`/v1/invoice`).
  - Adding a new provider is as simple as dropping a `<method>.js` file into `payments/`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and visit `/dashboard` to create your first product.

## Project Structure

```text
├── server.js                  # Express app & routes
├── lib/
│   ├── currencies.js          # World fiat (Intl) + crypto currency helpers
│   ├── markdown.js            # Safe custom Markdown renderer
│   ├── payments.js            # Dynamic /payments/:method loader
│   ├── store.js               # JSON file product store (data/products.json)
│   └── validate.js            # Form, metadata, and payment config validation
├── payments/
│   ├── nowpayments.js         # NOWPayments invoice integration
│   └── paystack.js            # Paystack charge & subscription plans integration
├── public/js/
│   ├── checkout.js            # Checkout form submission & redirect handler
│   └── product-form.js        # Dashboard UI (form toggle, markdown preview, plans loader)
└── views/
    ├── pages/                 # home.ejs, dashboard.ejs, checkout.ejs
    └── partials/              # head, nav, foot, product-form, product-card, etc.
```
