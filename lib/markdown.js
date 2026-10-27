// Minimal custom markdown renderer. HTML is escaped first, so output is safe.
// Supports: # headings, **bold**, *italic*, `code`, [links](https://..), - lists, paragraphs.

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-white/10">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-indigo-400 underline">$1</a>');
}

function render(md = '') {
  const out = [];
  let list = null;
  let para = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul class="list-disc pl-5">${list.join('')}</ul>`); list = null; } };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);

    if (!line) { flushPara(); flushList(); }
    else if (h) {
      flushPara(); flushList();
      const size = ['text-2xl', 'text-xl', 'text-lg'][h[1].length - 1];
      out.push(`<h${h[1].length + 1} class="${size} font-bold">${inline(h[2])}</h${h[1].length + 1}>`);
    } else if (li) { flushPara(); (list ||= []).push(`<li>${inline(li[1])}</li>`); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return out.join('\n');
}

module.exports = { render };
