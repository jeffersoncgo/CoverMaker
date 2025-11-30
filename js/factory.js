function createDropdownMenu({
  id,
  label,
  content = [],
  save = false,
  expanded = false
}) {
  // Root
  const wrapper = document.createElement("div");

  // Expand checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.className = "expand-checkbox";
  if (save) checkbox.setAttribute("save", "");
  if (expanded) checkbox.checked = true;

  // Label that triggers dropdown
  const lbl = document.createElement("label");
  lbl.htmlFor = id;
  lbl.className = "expand-label expand-btn relative";
  lbl.textContent = label;

  // Expandable container
  const contentBox = document.createElement("div");
  contentBox.className = "expand-content";

  // Insert children items
  for (const child of content) {
    contentBox.appendChild(renderDropdownContent(child));
  }

  wrapper.appendChild(checkbox);
  wrapper.appendChild(lbl);
  wrapper.appendChild(contentBox);
  return wrapper;
}

function renderDropdownContent(node) {
  // If nested dropdown
  if (node.type === "dropdown") {
    return createDropdownMenu(node);
  }

  const div = document.createElement("div");
  div.className = node.class || "";

  if (node.html) {
    div.innerHTML = node.html;
    return div;
  }

  if (node.label && node.input) {
    const lbl = document.createElement("label");
    lbl.textContent = node.label;
    lbl.htmlFor = node.input.id;

    const input = document.createElement("input");
    Object.assign(input, node.input);
    if (node.input.save) input.setAttribute("save", "");

    div.appendChild(lbl);
    div.appendChild(input);
    return div;
  }

  if (node.label && node.select) {
    const lbl = document.createElement("label");
    lbl.textContent = node.label;
    lbl.htmlFor = node.select.id;

    const select = document.createElement("select");
    Object.assign(select, node.select);
    if (node.select.save) select.setAttribute("save", "");

    for (const opt of node.select.options) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    }

    div.appendChild(lbl);
    div.appendChild(select);
    return div;
  }

  return div;
}
