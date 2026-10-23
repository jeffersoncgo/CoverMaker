// Compares current inventory / render / e2e results with the 2026-10-23 baseline.
const fs = require('fs');
const [,, kind, curFile, baseFile] = process.argv;
const cur = JSON.parse(fs.readFileSync(curFile)), base = JSON.parse(fs.readFileSync(baseFile));
if (kind === 'inventory') {
  const removed = [], added = [];
  const walk = (b, c, p) => {
    if (Array.isArray(b)) { const cs = new Set(Array.isArray(c) ? c : []); b.forEach(x => { if (!cs.has(x)) removed.push(`${p}: ${x}`); }); (c || []).forEach(x => { if (!b.includes(x)) added.push(`${p}: ${x}`); }); return; }
    if (b && typeof b === 'object') { for (const k of Object.keys(b)) { if (c?.[k] === undefined) removed.push(`${p}/${k} (whole entry)`); else walk(b[k], c[k], `${p}/${k}`); } for (const k of Object.keys(c || {})) if (b[k] === undefined) added.push(`${p}/${k} (new entry)`); return; }
    if (b !== c) removed.push(`${p}: ${b} -> ${c}`);
  };
  walk(base, cur, '');
  console.log(`REMOVED (${removed.length}):`); removed.forEach(x => console.log('  - ' + x));
  console.log(`ADDED (${added.length}):`); added.slice(0, 40).forEach(x => console.log('  + ' + x));
} else if (kind === 'render') {
  let same = 0, changed = [], skipped = 0;
  for (const group of Object.keys(base)) for (const [id, b] of Object.entries(base[group])) {
    const c = cur[group]?.[id];
    if (!c) { changed.push(`${group}.${id}: MISSING`); continue; }
    if (!b.deterministic || !c.deterministic) { skipped++; continue; }
    if (b.sig === c.sig) same++; else changed.push(`${group}.${id}: ${b.sig} -> ${c.sig}`);
  }
  console.log(`identical: ${same}, changed: ${changed.length}, skipped (random): ${skipped}`); changed.forEach(x => console.log('  ! ' + x));
} else if (kind === 'e2e') {
  const regressions = [], fixed = [], stillFailing = [];
  for (const [name, b] of Object.entries(base)) {
    const c = cur[name];
    if (!c) { regressions.push(`${name}: MISSING`); continue; }
    if (b.ok && !c.ok) regressions.push(`${name}: ${JSON.stringify(c).slice(0, 200)}`);
    else if (!b.ok && c.ok) fixed.push(name);
    else if (!b.ok) stillFailing.push(name);
  }
  const pass = Object.values(cur).filter(r => r.ok).length;
  console.log(`now ${pass}/${Object.keys(cur).length} | REGRESSIONS (${regressions.length}) | fixed (${fixed.length}) | still failing (${stillFailing.length})`);
  regressions.forEach(x => console.log('  REGRESSION ' + x)); fixed.forEach(x => console.log('  fixed: ' + x)); stillFailing.forEach(x => console.log('  still failing: ' + x));
}
