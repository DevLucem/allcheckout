const express = require('express');
const path = require('path');
const store = require('./lib/store');
const markdown = require('./lib/markdown');
const payments = require('./lib/payments');
const { getCurrencies, formatMoney } = require('./lib/currencies');
const { validateProduct, DEFAULT_METADATA } = require('./lib/validate');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.locals.md = markdown.render;
app.locals.currencies = getCurrencies();
app.locals.formatMoney = formatMoney;

// Convert stored product into form-friendly values
function toFormValues(product) {
  if (!product) return { metadata: DEFAULT_METADATA };
  const payValues = {};
  for (const [k, v] of Object.entries(product.payments || {})) {
    payValues[k] = { enabled: '1', ...v };
  }
  return { ...product, payments: payValues, metadata: product.metadata || DEFAULT_METADATA };
}

const renderDashboard = (res, extra = {}) =>
  res.render('pages/dashboard', {
    title: 'Dashboard',
    products: store.all(),
    methods: payments.list(),
    values: { metadata: DEFAULT_METADATA },
    errors: {},
    editing: null,
    ...extra,
  });

app.get('/dashboard', (req, res) => {
  const editingProduct = req.query.edit ? store.find(req.query.edit) : null;
  renderDashboard(res, {
    created: req.query.created,
    editing: editingProduct ? editingProduct.id : null,
    values: toFormValues(editingProduct),
  });
});

app.post('/dashboard/products', (req, res) => {
  const { data, errors, ok } = validateProduct({ metadata: [], ...req.body }, payments.list());
  if (!ok) return renderDashboard(res.status(400), { values: { ...req.body, metadata: data.metadata }, errors });
  const product = store.create(data);
  res.redirect(`/dashboard?created=${product.id}`);
});

app.post('/dashboard/products/:id', (req, res) => {
  const existing = store.find(req.params.id);
  if (!existing) return res.redirect('/dashboard');
  const { data, errors, ok } = validateProduct({ metadata: [], ...req.body }, payments.list());
  if (!ok) {
    return renderDashboard(res.status(400), {
      editing: existing.id,
      values: { ...req.body, metadata: data.metadata },
      errors,
    });
  }
  store.update(existing.id, data);
  res.redirect(`/dashboard?created=${existing.id}`);
});

app.post('/api/markdown', (req, res) => res.send(markdown.render(String(req.body.text || ''))));

app.all('/payments/:method', payments.route);

app.get('/checkout/:product', (req, res) => {
  const product = store.find(req.params.product);
  if (!product) return res.status(404).render('pages/home', { title: 'Not found' });
  res.render('pages/checkout', { title: product.name, product, methods: payments.list(), DefaultMeta: DEFAULT_METADATA });
});

app.get('*', (req, res) => {
  res.render('pages/home', { title: 'Home' });
});

app.listen(PORT, () => console.log(`AllCheckout running on http://localhost:${PORT}`));
