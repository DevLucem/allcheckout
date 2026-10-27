const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'products.json');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(products) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(products, null, 2));
}

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

function create(data) {
  const products = readAll();
  const product = { id: slugify(data.name), ...data, createdAt: new Date().toISOString() };
  products.unshift(product);
  writeAll(products);
  return product;
}

function update(id, data) {
  const products = readAll();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...data, id, updatedAt: new Date().toISOString() };
  writeAll(products);
  return products[idx];
}

function find(id) {
  return readAll().find((p) => p.id === id);
}

module.exports = { all: readAll, create, update, find };
