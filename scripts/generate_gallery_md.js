#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const galleryJsonPath = path.join(__dirname, '..', 'gallery', 'gallery.json');
const outPath = path.join(__dirname, '..', 'GALLERY.md');

function safeLink(href, title) {
  if (!href) return '';
  return `[${title || href}](${href})`;
}

function formatItem(item) {
  return `
<div style="
  width:260px;
  border:1px solid #ddd;
  border-radius:8px;
  padding:12px;
  margin:6px;
  box-shadow:0 2px 4px rgba(0,0,0,0.08);
  display:flex;
  flex-direction:column;
  gap:8px;
">

  <img src="${item.image}" alt="${item.title}" loading="lazy"
       style="width:100%; height:auto; border-radius:6px;" />

  <div style="font-weight:600; font-size:16px;">
    ${item.title}
  </div>

  <div style="font-size:13px; opacity:0.8;">
    ${item.shortDescription || ''}
  </div>

  <div style="font-size:12px;">
    Author:
    ${item.page ? `<a href="${item.page}" target="_blank">${item.author}</a>` : item.author}
  </div>

  <div style="display:flex; gap:8px; font-size:12px;">
    ${item.setup ? `<a href="${item.setup}">Setup</a>` : ''}
    ${item.project ? `<a href="${item.project}">Project</a>` : ''}
  </div>

</div>
  `.trim();
}

// FIRST LETTER UPPERCASE GROUPING
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function groupByType(list) {
  const map = {};
  for (const item of list) {
    const t = capitalizeFirstLetter(item.type || 'Other');
    if (!map[t]) map[t] = [];
    map[t].push(item);
  }
  return map;
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
  const presets  = items.filter(i => !i.project);

  const projectGroups = groupByType(projects);
  const presetGroups  = groupByType(presets);

  const md = [];

  md.push('# Community Gallery');
  md.push('');
  md.push('This file is auto-generated from the `gallery/gallery.json` file.');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');

  // PRESETS
  if (presets.length) {
    md.push(`## Presets (${presets.length})`);
    md.push('');

    const presetTypes = Object.keys(presetGroups).sort();
    for (const type of presetTypes) {
      const list = presetGroups[type];

      md.push(`<details>`);
      md.push(`<summary>${type} (${list.length})</summary>`);
      md.push('');

      md.push('<div style="display:flex; flex-wrap:wrap; gap:16px;">');
      list.forEach(item => md.push(formatItem(item)));
      md.push('</div>');
      md.push('');

      md.push(`</details>`);
      md.push('');
    }

    md.push('');
  }

  // PROJECTS
  if (projects.length) {
    md.push(`## Projects (${projects.length})`);
    md.push('');

    const projectTypes = Object.keys(projectGroups).sort();
    for (const type of projectTypes) {
      const list = projectGroups[type];

      md.push(`<details>`);
      md.push(`<summary>${type} (${list.length})</summary>`);
      md.push('');

      md.push('<div style="display:flex; flex-wrap:wrap; gap:16px;">');
      list.forEach(item => md.push(formatItem(item)));
      md.push('</div>');
      md.push('');

      md.push(`</details>`);
      md.push('');
    }

    md.push('');
  }

  md.push('## Contributing');
  md.push(`<p align="left">`);
  md.push(`<a href="https://github.com/jeffersoncgo/CoverMaker/blob/main/CONTRIBUTING.md">`);
  md.push(`<img src="https://img.shields.io/badge/Contribute%20to%20CoverMaker-❤️-red?style=for-the-badge" />`);
  md.push(`</a>`);
  md.push(`</p>`);
  md.push('');
  fs.writeFileSync(outPath, md.join('\n'), 'utf8');
  console.log('Updated', outPath);
}

main();
