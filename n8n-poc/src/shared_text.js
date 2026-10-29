function htmlToText(html) {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text, size, overlap) {
  const out = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const brk = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end));
      if (brk > start + size * 0.5) end = brk + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}

// Tika returns XHTML; PDFs come back with one <div class="page"> per page.
function splitPages(html) {
  const parts = String(html).split(/<div class="page">/i);
  if (parts.length > 1) return parts.slice(1).map((p, i) => ({ page: i + 1, text: htmlToText(p) }));
  return [{ page: null, text: htmlToText(html) }];
}
