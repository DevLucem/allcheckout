const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
const FIAT_CODES = Intl.supportedValuesOf('currency');

const CRYPTO_LIST = [
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
];

const FIAT = FIAT_CODES.map((code) => ({
  code,
  name: displayNames.of(code) || code,
  type: 'fiat',
}));

const CRYPTO = CRYPTO_LIST.map((c) => ({ ...c, type: 'crypto' }));
const CURRENCIES = [...FIAT, ...CRYPTO];
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

function getCurrencies() {
  return CURRENCIES;
}

function isValidCurrency(code) {
  return BY_CODE.has(String(code || '').toUpperCase());
}

function isCrypto(code) {
  return BY_CODE.get(String(code || '').toUpperCase())?.type === 'crypto';
}

function formatMoney(amount, currency = 'USD') {
  const code = isValidCurrency(currency) ? currency.toUpperCase() : 'USD';
  const num = Number(amount) || 0;
  if (isCrypto(code)) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(num);
    return `${formatted} ${code}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(num);
}

module.exports = { getCurrencies, isValidCurrency, isCrypto, formatMoney };
