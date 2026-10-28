const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'payments');
const VALID = /^[a-z0-9_-]+$/i;

// --- Currencies (162 ISO fiat + 20 crypto) ---
const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
const FIAT = Intl.supportedValuesOf('currency').map((code) => ({
  code,
  name: displayNames.of(code) || code,
  type: 'fiat',
}));
const CRYPTO = [
  { code: 'BTC', name: 'Bitcoin' },
  { code: 'ETH', name: 'Ethereum' },
  { code: 'USDT', name: 'Tether USD' },
  { code: 'USDC', name: 'USD Coin' },
  { code: 'SOL', name: 'Solana' },
  { code: 'BNB', name: 'BNB' },
  { code: 'XRP', name: 'XRP' },
  { code: 'DOGE', name: 'Dogecoin' },
  { code: 'TON', name: 'Toncoin' },
  { code: 'ADA', name: 'Cardano' },
  { code: 'TRX', name: 'TRON' },
  { code: 'AVAX', name: 'Avalanche' },
  { code: 'LINK', name: 'Chainlink' },
  { code: 'DOT', name: 'Polkadot' },
  { code: 'MATIC', name: 'Polygon' },
  { code: 'LTC', name: 'Litecoin' },
  { code: 'BCH', name: 'Bitcoin Cash' },
  { code: 'XLM', name: 'Stellar' },
  { code: 'DAI', name: 'Dai' },
  { code: 'SUI', name: 'Sui' },
].map((c) => ({ ...c, type: 'crypto' }));

const CURRENCIES = [...FIAT, ...CRYPTO];
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

const getCurrencies = () => CURRENCIES;
const isValidCurrency = (code) => BY_CODE.has(String(code || '').toUpperCase());
const isCrypto = (code) => BY_CODE.get(String(code || '').toUpperCase())?.type === 'crypto';

function formatMoney(amount, currency = 'USD') {
  const code = isValidCurrency(currency) ? currency.toUpperCase() : 'USD';
  const num = Number(amount) || 0;
  if (isCrypto(code)) {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(num);
    return `${formatted} ${code}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(num);
}

// --- Payment Providers ---
function load(method) {
  if (!VALID.test(method)) return null;
  const file = path.join(DIR, `${method}.js`);
  if (!fs.existsSync(file)) return null;
  const provider = require(file);
  const hasCheckout = typeof provider === 'function' || typeof provider?.checkout === 'function';
  if (!provider || !hasCheckout) {
    throw new Error(`Payment method "${method}" is invalid: must export a checkout handler.`);
  }
  return provider;
}

function supportsCurrency(provider, currency) {
  const code = String(currency || 'USD').toUpperCase();
  if (Array.isArray(provider.currencies) && provider.currencies.length) {
    return provider.currencies.map((c) => c.toUpperCase()).includes(code);
  }
  if (Array.isArray(provider.currencyTypes) && provider.currencyTypes.length) {
    return provider.currencyTypes.includes(isCrypto(code) ? 'crypto' : 'fiat');
  }
  return true;
}

function createProviderClass(id, def) {
  const checkoutFn = typeof def.checkout === 'function' ? def.checkout.bind(def) : def;
  const label = def.label || id;

  return class PaymentProvider {
    static id = id;
    static label = label;
    static fields = def.fields || [];
    static currencies = def.currencies || null;
    static currencyTypes = def.currencyTypes || null;
    static supportsPlans = !!(def.supportsPlans || typeof def.fetchPlans === 'function');

    constructor(config = {}) {
      if (!config || typeof config !== 'object') {
        const err = new Error(`${label} configuration object is required.`);
        err.status = 400;
        throw err;
      }
      this.id = id;
      this.label = label;
      this.config = {};
      for (const f of def.fields || []) {
        const val = String(config[f.name] ?? '').trim();
        if (f.required && !val) {
          const err = new Error(`${f.label} is required.`);
          err.status = 400;
          throw err;
        }
        this.config[f.name] = val;
      }
      if (Array.isArray(config.plans)) this.config.plans = config.plans;
    }

    async fetchPlans() {
      if (typeof def.fetchPlans !== 'function') {
        const err = new Error(`${label} does not support subscription plans.`);
        err.status = 400;
        throw err;
      }
      return def.fetchPlans(this.config);
    }

    async checkout(data = {}) {
      const product = data.product || {
        id: data.id || data.orderId || 'custom',
        name: data.name || data.description || 'Checkout',
        price: Number(data.amount ?? data.price),
        currency: String(data.currency || 'USD').toUpperCase(),
        returnUrl: data.returnUrl || '',
        webhookUrl: data.webhookUrl || '',
      };

      const currency = String(data.currency || product.currency || 'USD').toUpperCase();
      if (!supportsCurrency(def, currency)) {
        const err = new Error(`${label} does not support ${currency}.`);
        err.status = 400;
        throw err;
      }

      const amount = Number(data.amount ?? product.price);
      if (!Number.isFinite(amount) || amount <= 0) {
        const err = new Error('Amount must be greater than 0.');
        err.status = 400;
        throw err;
      }

      const {
        product: _p, amount: _a, price: _pr, currency: _c,
        plan, planId: rawPlanId, returnUrl, webhookUrl, callbackUrl, req,
        metadata: nestedMeta = {}, ...topLevelFields
      } = data;

      const metadata = { ...topLevelFields, ...nestedMeta };
      const resolvedPlan = typeof plan === 'object' && plan ? plan : null;
      const planId = rawPlanId || (resolvedPlan ? resolvedPlan.id : (typeof plan === 'string' ? plan : null));

      const result = await checkoutFn({
        product,
        config: this.config,
        metadata,
        plan: resolvedPlan,
        planId,
        amount,
        currency,
        returnUrl: returnUrl ?? product.returnUrl ?? '',
        webhookUrl: webhookUrl ?? product.webhookUrl ?? '',
        callbackUrl: callbackUrl || '',
        req,
      });

      if (!result?.url) {
        const err = new Error(result?.error || 'Failed to initialize payment.');
        err.status = 400;
        throw err;
      }
      return result;
    }

    async verify(params = {}) {
      if (typeof def.verify !== 'function') {
        const err = new Error(`${label} does not define a verify handler.`);
        err.status = 400;
        throw err;
      }
      const req = params.req || { query: params, body: params };
      return def.verify({ req, product: params.product || null, config: this.config });
    }
  };
}

function getProviderClass(method) {
  const def = load(method);
  if (!def) {
    const err = new Error(`Payment method "${method}" not found.`);
    err.status = 404;
    throw err;
  }
  return createProviderClass(method, def);
}

function list() {
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => {
      const id = path.basename(f, '.js');
      const p = load(id);
      if (!p) throw new Error(`Payment method "${id}" could not be loaded.`);
      return {
        id,
        label: p.label || id,
        fields: p.fields || [],
        supportsPlans: !!(p.supportsPlans || typeof p.fetchPlans === 'function'),
        currencies: p.currencies || null,
        currencyTypes: p.currencyTypes || null,
      };
    });
}

const base = {
  load,
  list,
  supportsCurrency,
  createProviderClass,
  getProviderClass,
  getCurrencies,
  isValidCurrency,
  isCrypto,
  formatMoney,
  get methods() {
    return list().map((m) => m.id);
  },
};

module.exports = new Proxy(base, {
  get(target, prop, receiver) {
    if (typeof prop === 'symbol' || prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    if (prop === 'then' || prop === 'inspect' || prop === 'default') {
      return undefined;
    }
    return getProviderClass(String(prop));
  },
});
