#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const galleryJsonPath = path.join(__dirname, '..', 'gallery', 'gallery.json');
const outPath = path.join(__dirname, '..', 'gallery', 'GALLERY.md');

function safeLink(href, title) {
  if (!href) return '';
  return `[${title || href}](${href})`;
}

function formatItem(item) {
  const parts = [];
  if (item.image) parts.push(`![${item.title || ''}](${item.image})`);
  parts.push(`**${item.title || 'Untitled'}**`);
  if (item.shortDescription) parts.push(`*${item.shortDescription}*`);
  const metaParts = [];
  if (item.author) {
    if (item.page) metaParts.push(`Author: ${safeLink(item.page, item.author)}`);
    else metaParts.push(`Author: ${item.author}`);
  }
  if (item.setup) metaParts.push(`Setup: ${safeLink(item.setup, path.basename(item.setup))}`);
  if (item.project) metaParts.push(`Project: ${safeLink(item.project, path.basename(item.project))}`);
  return `${parts.join('\n\n')}\n\n${metaParts.join(' • ')}\n`;
}

function main() {
  if (!fs.existsSync(galleryJsonPath)) {
    console.error('gallery.json not found', galleryJsonPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(galleryJsonPath, 'utf8');
  let items = [];
  try { items = JSON.parse(raw); } catch (e) { console.error('Failed to parse gallery.json', e); process.exit(1); }

  const projects = items.filter(i => i.project);
  const presets = items.filter(i => !i.project);

  const md = [];
  md.push('# Community Gallery');
  md.push('');
  md.push('This file is auto-generated from the `gallery/gallery.json` file.');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  if (presets.length) {
    md.push('## Presets');
    md.push('');
    presets.forEach(item => {
      md.push(formatItem(item));
      md.push('---');
    });
    md.push('');
  }
  if (projects.length) {
    md.push('## Projects');
    md.push('');
    projects.forEach(item => {
      md.push(formatItem(item));
      md.push('---');
    });
    md.push('');
  }
  md.push('## Contributing');
  md.push('See `../CONTRIBUTING.md` for instructions on how to add items to the gallery.');
  md.push('');

  fs.writeFileSync(outPath, md.join('\n'), 'utf8');
  console.log('Updated', outPath);
}

main();
