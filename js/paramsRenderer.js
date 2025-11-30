/* Shared parameter rendering helper

   - Exposes `renderParamsOptions(container, options)`
   - Exposes `createParamControl(param, paramsObj)`
   - Re-usable between composite and effect param UIs
*/

// (function(global) {
//   'use strict';

  function createParamControl(param, paramsObj) {
    const val = paramsObj ? (paramsObj[param.key] ?? param.default) : (param.default ?? null);

    switch (param.type) {
      case 'color': {
        const el = document.createElement('input');
        el.type = 'color';
        el.value = val ?? '#000000';
        return el;
      }
      case 'select': {
        const el = document.createElement('select');
        // Normalize options: allow array of primitives, array of objects, or map-like object
        const normalizedOptions = [];
        if (Array.isArray(param.options)) {
          param.options.forEach(opt => {
            if (opt && typeof opt === 'object') {
              // object form: accept several shapes: {value,label}, {id,label}, {key,label}, {name,label}
              const value = opt.value ?? opt.id ?? opt.key ?? opt.name ?? String(Object.values(opt)[0] ?? '');
              const label = opt.label ?? opt.name ?? opt.text ?? opt.title ?? opt.value ?? opt.id ?? String(Object.values(opt)[1] ?? value);
              normalizedOptions.push({ value: String(value), label: String(label) });
            } else {
              // primitive form: ['a', 'b']
              const v = String(opt);
              normalizedOptions.push({ value: v, label: v });
            }
          });
        } else if (param.options && typeof param.options === 'object') {
          // map-like: { key: 'Label' }
          Object.keys(param.options).forEach(k => {
            normalizedOptions.push({ value: String(k), label: String(param.options[k]) });
          });
        }
        const desiredValue = (val !== undefined && val !== null && val !== '') ? String(val) : (param.default !== undefined && param.default !== null ? String(param.default) : (normalizedOptions.length ? String(normalizedOptions[0].value) : ''));
        normalizedOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label ?? opt.value;
          if (String(opt.value) === desiredValue) option.selected = true;
          el.appendChild(option);
        });
        // determine the explicit value for the select (prefer explicit param value, else param.default, else first option)
        const firstOptVal = normalizedOptions.length ? String(normalizedOptions[0].value) : '';
        el.value = desiredValue ?? (param.default ?? firstOptVal);
        return el;
      }
      case 'text': {
        const el = document.createElement('input');
        el.type = 'text';
        el.value = val ?? '';
        return el;
      }
      case 'number': {
        const el = document.createElement('input');
        el.type = 'number';
        el.min = param.min ?? '';
        el.max = param.max ?? '';
        el.step = param.step ?? 'any';
        el.value = (val !== undefined && val !== null) ? val : 0;
        return el;
      }
      case 'checkbox': {
        const el = document.createElement('input');
        el.type = 'checkbox';
        el.checked = Boolean(val ?? param.default ?? false);
        return el;
      }
      case 'span': {
        const el = document.createElement('span');
        el.textContent = val ?? '';
        return el;
      }
      default: {
        // Default to range input for numeric sliders
        const el = document.createElement('input');
        el.type = 'range';
        el.min = param.min ?? 0;
        el.max = param.max ?? 1;
        el.step = param.step ?? ((param.max - param.min) / 100 || 0.01);
        el.value = (val !== undefined && val !== null) ? val : 0;
        return el;
      }
    }
  }

  function renderParamsOptions(paramsContainer, schemaParams, paramsObj, opts = {}) {
    // opts: { paramTemplate, groupTemplate, onChange, extraDataset }
    if (!paramsContainer || !schemaParams) return;
    const paramTemplate = opts.paramTemplate || document.getElementById('effect-param-template');
    const groupTemplate = opts.groupTemplate || document.getElementById('options-param-group-template');

    // Accept both schema array or registry-def object
    const schemaList = Array.isArray(schemaParams) ? schemaParams : (schemaParams.params || []);

    // build param keys union with paramsObj keys (preserve any custom keys in paramsObject)
    const allKeys = new Set((schemaList || []).map(p => p.key));
    if (paramsObj) Object.keys(paramsObj).forEach(k => allKeys.add(k));

    Array.from(allKeys).forEach(paramKey => {
      let param = schemaList.find(p => p.key === paramKey);
      if (!param) {
        // Optionally skip unknown params (if the caller wants strict schema rendering)
        if (opts.skipUnknown) return;
        // fallback unknown param to a sensible default control
        param = { key: paramKey, label: paramKey, type: 'range', min: 0, max: 1, step: 0.01, default: paramsObj[paramKey] ?? 0 };
      }

      const cloned = paramTemplate.content.cloneNode(true);
      const labelEl = cloned.querySelector('.effect-param-label');
      const placeholder = cloned.querySelector('.effect-param-slider');
      if (labelEl) labelEl.textContent = param.label || param.key;

      // create real control
      const control = createParamControl(param, paramsObj || {});
      control.className = control.className ? control.className + ' effect-param-slider' : 'effect-param-slider';
      // apply style/class overrides to elements
      if (param.style) {
        if (/[;:]/.test(param.style)) control.style.cssText += (control.style.cssText ? ' ' : '') + param.style;
        else control.classList.add(...param.style.split(/\s+/).filter(Boolean));
      }
      // some sensible defaults for layout
      if (param.type === 'color' && !param.style) control.style.cssText = 'flex: 0 0 2rem; padding: 0;';
      else if (param.type === 'checkbox' && !param.style) control.style.cssText = 'flex: 0 0 auto; margin-left: 0.5rem;';
      else if (!param.style) control.style.cssText = control.style.cssText || 'flex: 1 1 auto; padding: 0.2rem;';

      // replace placeholder with control
      if (placeholder && placeholder.parentElement) placeholder.parentElement.replaceChild(control, placeholder);

      // attach dataset info
      control.dataset.paramKey = param.key;
      (opts.extraDataset || []).forEach(([k, v]) => { control.dataset[k] = v; });

      // attach events
      const onChange = opts.onChange;
      if (typeof onChange === 'function') {
        control.addEventListener('input', onChange);
        if (control.tagName === 'SELECT' || control.type === 'checkbox' || control.type === 'radio') {
          control.addEventListener('change', onChange);
        }
      }

      // double-click toggles numeric controls between number and range types
      // preserve min/max/step/value and keep attached listeners
      const isNumericLike = (control.type === 'range' || control.type === 'number');
      if (isNumericLike) {
        const invertControlType = () => (ev) => {
          try {
            const prevType = control.type;
            if (prevType === 'number') {
              // switch to range; ensure min/max/step are properly set
              control.type = 'range';
              control.min = param.min ?? 0;
              control.max = param.max ?? 1;
              control.step = param.step ?? ((Number(control.max) - Number(control.min)) / 100 || 0.01);
              // clamp value into new range
              const num = Number(control.value ?? 0);
              control.value = Math.min(Math.max(num, Number(control.min)), Number(control.max));
            } else if (prevType === 'range') {
              // switch to number; allow any step if not provided
              control.type = 'number';
              control.min = param.min ?? '';
              control.max = param.max ?? '';
              control.step = param.step ?? 'any';
            }
            // update title and re-dispatch an input event so listeners can re-evaluate
            control.title = String(control.value ?? control.textContent);
            const ev2 = new Event('input', { bubbles: true });
            control.dispatchEvent(ev2);
          } catch (e) {
            // conservative: if changing type fails (old browsers), replace element instead
            // fallback: create new control and swap preserving attributes
            try {
              const newControl = document.createElement('input');
              newControl.type = (control.type === 'number') ? 'range' : 'number';
              newControl.min = control.min; newControl.max = control.max; newControl.step = control.step;
              newControl.value = control.value;
              newControl.className = control.className;
              newControl.dataset.paramKey = control.dataset.paramKey;
              // move dataset entries
              Object.keys(control.dataset || {}).forEach(k => newControl.dataset[k] = control.dataset[k]);
              // copy styles
              newControl.style.cssText = control.style.cssText;
              // copy any bound events (best-effort: reattach onChange handler from opts)
              if (typeof onChange === 'function') {
                newControl.addEventListener('input', onChange);
                if (newControl.tagName === 'SELECT' || newControl.type === 'checkbox' || newControl.type === 'radio') {
                  newControl.addEventListener('change', onChange);
                }
              }
              // replace
              control.parentElement.replaceChild(newControl, control);
            } catch (e2) { /* ignore fallback errors */ }
          }
        };
        control.addEventListener('dblclick', invertControlType());
        labelEl.addEventListener('dblclick', invertControlType());
      }

      // title - include hint for numeric controls
      try {
        const baseTitle = String(control.value ?? control.textContent);
        if (isNumericLike) {
          control.title = baseTitle + ' — duplo clique alterna número/slider';
        } else {
          control.title = baseTitle;
        }
      } catch (e) { /* ignore */ }

      // group handling
      if (param.group) {
        const className = 'param-group-' + param.group.toLowerCase();
        let groupContent = paramsContainer.querySelector('.container.' + className + ' .content');
        if (!groupContent) {
          const groupClone = groupTemplate.content.cloneNode(true);
          const container = groupClone.querySelector('.container');
          const span = container.querySelector('.param-group-label');
          container.classList.add(className);
          span.textContent = param.group;
          paramsContainer.appendChild(container);
          groupContent = container.querySelector('.content');
        }

        // apply container-level classes (if any)
        if (param.className) { const classes = (param.className || '').split(/\s+/).filter(Boolean); const containerEl = groupContent.closest('.container'); classes.forEach(c => containerEl.classList.add(c)); }
        // apply styles on group container
        if (param.style && !(/[;:]/.test(param.style))) {
          const containerEl = groupContent.closest('.container'); containerEl.classList.add(...param.style.split(/\s+/).filter(Boolean));
        }

        groupContent.appendChild(cloned);
      } else {
        paramsContainer.appendChild(cloned);
        const paramWrapper = paramsContainer.querySelector('.effect-param-field:last-child');
        if (param.className) paramWrapper.classList.add(...(param.className || '').split(/\s+/).filter(Boolean));
        if (param.style && /[;:]/.test(param.style)) paramWrapper.style.cssText += (paramWrapper.style.cssText ? ' ' : '') + param.style;
        else if (param.style) paramWrapper.classList.add(...param.style.split(/\s+/).filter(Boolean));
      }
    });
  }
  const ParamsRenderer = {
    createParamControl,
    renderParamsOptions
  };
// })(window);
