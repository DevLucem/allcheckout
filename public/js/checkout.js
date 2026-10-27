const form = document.getElementById('checkout-form');
const errEl = document.getElementById('checkout-error');
const planInput = document.getElementById('selected-plan');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.classList.add('hidden');

  const btn = e.submitter || form.querySelector('.pay-btn');
  const method = btn?.dataset.method || 'paystack';
  const plan = btn?.dataset.plan || '';
  if (planInput) planInput.value = plan;

  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing…';

  const fd = new FormData(form);
  const metadata = {};
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^metadata\[(.+)\]$/);
    if (m) metadata[m[1]] = v;
  }

  try {
    const res = await fetch(`/payments/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: fd.get('productId'),
        ...(plan ? { plan } : {}),
        metadata,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'Payment initialization failed.');
    window.location.href = data.url;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = prevText;
  }
});
