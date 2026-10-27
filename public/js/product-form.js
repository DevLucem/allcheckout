// Markdown preview toggle (server renders via /api/markdown so preview matches checkout)
const btn = document.getElementById('toggle-preview');
const textarea = document.getElementById('product-description');
const preview = document.getElementById('description-preview');

btn?.addEventListener('click', async () => {
  const showing = !preview.classList.contains('hidden');
  if (!showing) {
    const res = await fetch('/api/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textarea.value }),
    });
    preview.innerHTML = (await res.text()) || '<p class="text-slate-500">Nothing to preview.</p>';
  }
  preview.classList.toggle('hidden', showing);
  textarea.classList.toggle('hidden', !showing);
  btn.textContent = showing ? 'Preview' : 'Edit';
});

// Show/hide the create/edit form
const toggleForm = document.getElementById('toggle-form');
const formWrap = document.getElementById('form-wrap');
toggleForm?.addEventListener('click', () => {
  if (location.search.includes('edit=')) {
    location.href = '/dashboard';
    return;
  }
  const open = formWrap.classList.toggle('hidden') === false;
  toggleForm.textContent = open ? 'Close' : '+ Add product';
  toggleForm.setAttribute('aria-expanded', open);
  if (open) document.getElementById('product-name').focus();
});

// Payment method toggles: reveal fields and make them required only when enabled
document.querySelectorAll('.payment-toggle').forEach((t) =>
  t.addEventListener('change', () => {
    const fields = t.closest('.payment-method').querySelector('.payment-fields');
    fields.classList.toggle('hidden', !t.checked);
    fields.querySelectorAll('input[data-required]').forEach((i) => (i.required = t.checked && i.dataset.required === 'true'));
  })
);

// Fetch and render subscription plans when secret key is set
async function loadMethodPlans(methodCard) {
  const method = methodCard.dataset.method;
  const secretInput = methodCard.querySelector(`#pay-${method}-secret`);
  const wrap = methodCard.querySelector('.plans-wrap');
  if (!secretInput || !wrap) return;

  const secret = secretInput.value.trim();
  const statusEl = wrap.querySelector('.plans-status');
  const listEl = wrap.querySelector('.plans-list');
  if (!secret) {
    statusEl.textContent = 'Enter your secret key first.';
    statusEl.className = 'plans-status mt-1 text-xs text-rose-400';
    return;
  }

  // Keep currently checked plan IDs so selection persists
  const selected = new Set(
    Array.from(listEl.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.dataset.planId || c.value)
  );
  try {
    JSON.parse(wrap.dataset.savedPlans || '[]').forEach((p) => selected.add(p.id || p));
  } catch {}

  statusEl.textContent = 'Loading plans…';
  statusEl.className = 'plans-status mt-1 text-xs text-slate-400';

  try {
    const res = await fetch(`/payments/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'plans', secret }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not fetch plans.');

    const plans = data.plans || [];
    if (!plans.length) {
      statusEl.textContent = 'No subscription plans found on this account.';
      listEl.innerHTML = '';
      return;
    }

    statusEl.textContent = 'Select the subscription plans to enable:';
    listEl.innerHTML = '';
    plans.forEach((p) => {
      const planObj = { name: p.name, id: p.id, duration: p.duration || '', price: Number(p.price) || 0 };
      const label = document.createElement('label');
      label.className = 'flex items-center justify-between gap-2 text-xs text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 cursor-pointer';

      const left = document.createElement('span');
      left.className = 'flex items-center gap-2';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = `payments[${method}][plans][]`;
      cb.value = JSON.stringify(planObj);
      cb.dataset.planId = planObj.id;
      cb.checked = selected.has(planObj.id);
      cb.className = 'rounded border-white/20';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'font-medium';
      nameSpan.textContent = planObj.name;

      const idSpan = document.createElement('span');
      idSpan.className = 'text-slate-500 font-mono';
      idSpan.textContent = `(${planObj.id})`;

      left.append(cb, nameSpan, idSpan);

      const right = document.createElement('span');
      right.className = 'text-indigo-300';
      right.textContent = [planObj.price ? planObj.price.toFixed(2) : '', planObj.duration].filter(Boolean).join(' / ');

      label.append(left, right);
      listEl.appendChild(label);
    });
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'plans-status mt-1 text-xs text-rose-400';
  }
}

document.querySelectorAll('.payment-method').forEach((card) => {
  const method = card.dataset.method;
  const secretInput = card.querySelector(`#pay-${method}-secret`);
  const fetchBtn = card.querySelector('.fetch-plans-btn');
  fetchBtn?.addEventListener('click', () => loadMethodPlans(card));
  secretInput?.addEventListener('change', () => {
    if (secretInput.value.trim()) loadMethodPlans(card);
  });
  // Auto-load plans when editing a product that already has a secret key
  if (secretInput?.value.trim()) loadMethodPlans(card);
});

// Metadata fields: toggle Required/Optional, remove row, and add new custom row
const metaList = document.getElementById('metadata-list');
const reqCls = ['bg-indigo-500/20', 'border-indigo-400/40', 'text-indigo-300'];
const optCls = ['bg-white/5', 'border-white/10', 'text-slate-400'];

metaList?.addEventListener('click', (e) => {
  const toggle = e.target.closest('.metadata-req-toggle');
  if (toggle) {
    const input = toggle.parentElement.querySelector('.metadata-req-input');
    const nextReq = input.value !== '1';
    input.value = nextReq ? '1' : '0';
    toggle.textContent = nextReq ? 'Required' : 'Optional';
    toggle.classList.remove(...(nextReq ? optCls : reqCls));
    toggle.classList.add(...(nextReq ? reqCls : optCls));
  }
  const remove = e.target.closest('.metadata-remove');
  if (remove) remove.closest('.metadata-row').remove();
});

document.getElementById('add-metadata-field')?.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'metadata-row flex items-center gap-2';
  row.innerHTML = `
    <input name="metadata[name][]" placeholder="Field name (e.g. phone)"
      class="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
    <input type="hidden" name="metadata[required][]" value="0" class="metadata-req-input">
    <button type="button" class="metadata-req-toggle text-xs px-3 py-2 rounded-xl border transition font-medium bg-white/5 border-white/10 text-slate-400">Optional</button>
    <button type="button" class="metadata-remove text-slate-400 hover:text-rose-400 px-2 py-1 text-lg leading-none" title="Remove field">&times;</button>
  `;
  metaList.appendChild(row);
  row.querySelector('input').focus();
});

// Copy share URLs
document.querySelectorAll('.copy-url').forEach((b) =>
  b.addEventListener('click', async () => {
    const input = b.parentElement.querySelector('.share-url');
    await navigator.clipboard.writeText(location.origin + input.value);
    b.textContent = 'Copied!';
    setTimeout(() => (b.textContent = 'Copy'), 1500);
  })
);
