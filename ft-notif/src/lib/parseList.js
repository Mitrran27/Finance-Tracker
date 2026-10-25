// Parse one pasted line like "Car loan - 850", "PS5 RM 2,399" or "Phone bill 98.50 2026-11-05"
// into { name, amount, due_date }. The last number on the line is taken as the amount.
export function parseLine(line) {
  const date = line.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || null;
  let rest = date ? line.replace(date, '') : line;
  const amt = [...rest.matchAll(/(?:RM\s*)?(\d[\d,]*(?:\.\d{1,2})?)/gi)].pop();
  if (!amt) return null;
  const name = (rest.slice(0, amt.index) + rest.slice(amt.index + amt[0].length))
    .replace(/\s+/g, ' ').replace(/^[\s\-–:,|=]+|[\s\-–:,|=]+$/g, '');
  if (!name) return null;
  return { name, amount: parseFloat(amt[1].replace(/,/g, '')), due_date: date };
}

export function parseList(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => ({ line, item: parseLine(line) }));
}
