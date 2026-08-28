(function () {
  'use strict';

  const root = document.querySelector('[data-icon-studio]');
  if (!root) return;

  const allowedElements = new Set([
    'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title'
  ]);
  const allowedAttributes = new Set([
    'viewBox', 'preserveAspectRatio', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-opacity', 'fill-opacity', 'fill-rule', 'clip-rule', 'opacity', 'transform', 'vector-effect',
    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width',
    'height', 'points', 'd', 'pathLength', 'xmlns'
  ]);
  const removableAttributes = new Set([
    'class', 'id', 'role', 'tabindex', 'focusable', 'aria-hidden', 'aria-label', 'aria-labelledby'
  ]);

  const unsafeValue = (value) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|url\s*\(|javascript\s*:|data\s*:|https?\s*:/i.test(value);
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function sanitizeForPreview(source) {
    const raw = String(source || '').trim();
    if (!raw) throw new Error('SVGコードを入力してください。');
    if (raw.length > 200000) throw new Error('SVGは200KB以下にしてください。');
    if (/\bxmlns\s*:/i.test(raw)) throw new Error('xmlns:xlinkなどの追加名前空間は使用できません。');
    if (/<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed|image|style|a|use)\b|\bon[a-z0-9_-]+\s*=|\b(?:href|xlink:href)\s*=/i.test(raw)) {
      throw new Error('外部参照、スクリプト、イベント属性を含むSVGは表示できません。');
    }

    const documentNode = new DOMParser().parseFromString(raw, 'image/svg+xml');
    if (documentNode.querySelector('parsererror')) throw new Error('SVGの構文を確認してください。');
    const svg = documentNode.documentElement;
    if (!svg || svg.localName.toLowerCase() !== 'svg') throw new Error('正しい<svg>要素を入力してください。');
    const rootNamespace = String(svg.namespaceURI || '');
    const hasNamespace = svg.hasAttribute('xmlns') || Boolean(rootNamespace);
    if (hasNamespace && (svg.getAttribute('xmlns') !== svgNamespace || rootNamespace !== svgNamespace)) {
      throw new Error('SVG名前空間が正しくありません。');
    }
    const viewBox = String(svg.getAttribute('viewBox') || '').trim();
    const number = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
    if (!new RegExp(`^\\s*${number}[,\\s]+${number}[,\\s]+${number}[,\\s]+${number}\\s*$`).test(viewBox)) {
      throw new Error('SVGにviewBoxがありません。例: viewBox="0 0 24 24"');
    }

    const elements = [svg, ...svg.querySelectorAll('*')];
    elements.forEach((element) => {
      const tag = element.localName.toLowerCase();
      if (element !== svg && element.hasAttribute('xmlns')) {
        throw new Error('SVG名前空間はroot <svg>でのみ宣言できます。');
      }
      const elementNamespace = String(element.namespaceURI || '');
      if (elementNamespace && elementNamespace !== svgNamespace) {
        throw new Error('SVG名前空間が正しくありません。');
      }
      if (!allowedElements.has(tag) || (tag === 'svg' && element !== svg)) {
        throw new Error(`このSVGは <${element.localName}> を使用しています。現在のIcon Studioでは未対応です。`);
      }
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name;
        if (name === 'xmlns') {
          if (element !== svg || attribute.value !== svgNamespace) {
            throw new Error('SVG名前空間が正しくありません。');
          }
          element.removeAttribute('xmlns');
          return;
        }
        if (name.includes(':') && name !== 'xmlns') throw new Error(`名前空間付き属性は使用できません: ${name}`);
        if (removableAttributes.has(name)) {
          element.removeAttribute(name);
          return;
        }
        if (!allowedAttributes.has(name)) {
          throw new Error(`このSVGは "${name}" 属性を使用しています。現在のIcon Studioでは未対応です。`);
        }
        if (unsafeValue(attribute.value)) throw new Error('外部参照を含むSVG属性は使用できません。');
      });
      if (element === svg) {
        element.removeAttribute('width');
        element.removeAttribute('height');
      }
      [...element.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && tag !== 'title' && child.textContent.trim()) {
          throw new Error('title以外のSVGテキストは使用できません。');
        }
        if (child.nodeType === Node.COMMENT_NODE) child.remove();
      });
    });

    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return new XMLSerializer()
      .serializeToString(svg)
      .replace(/\sxmlns=(["'])http:\/\/www\.w3\.org\/2000\/svg\1/i, '');
  }

  function renderEditor(editor) {
    const textarea = editor.querySelector('[data-icon-svg]');
    const validation = editor.querySelector('[data-icon-validation]');
    const targets = [...editor.querySelectorAll('[data-icon-preview-target]')];
    if (!textarea || !validation) return false;
    try {
      const svg = sanitizeForPreview(textarea.value);
      targets.forEach((target) => {
        const sizes = String(target.dataset.sizes || '')
          .split(',')
          .map(Number)
          .filter(Boolean);
        if (sizes.length) {
          target.innerHTML = sizes.map((size) => `<span title="${size}px" style="width:${size}px;height:${size}px">${svg}</span>`).join('');
          target.querySelectorAll('svg').forEach((icon, index) => {
            const size = sizes[index];
            icon.style.width = `${size}px`;
            icon.style.height = `${size}px`;
          });
        } else {
          target.innerHTML = svg;
        }
      });
      validation.textContent = '保存可能なSVGです。';
      validation.classList.add('is-valid');
      return true;
    } catch (error) {
      targets.forEach((target) => { target.replaceChildren(); });
      validation.textContent = error instanceof Error ? error.message : 'SVGを確認してください。';
      validation.classList.remove('is-valid');
      return false;
    }
  }

  root.querySelectorAll('[data-icon-editor]').forEach((editor) => {
    const textarea = editor.querySelector('[data-icon-svg]');
    const fileInput = editor.querySelector('[data-icon-file]');
    const fileName = editor.querySelector('[data-icon-file-name]');
    const form = editor.querySelector('[data-icon-form]');
    let renderTimer = 0;

    const scheduleRender = () => {
      window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => renderEditor(editor), 80);
    };
    textarea?.addEventListener('input', scheduleRender);
    editor.addEventListener('toggle', () => {
      if (editor.open) renderEditor(editor);
    });
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.svg') || file.size > 200000) {
        const validation = editor.querySelector('[data-icon-validation]');
        validation.textContent = '200KB以下の.svgファイルを選択してください。';
        validation.classList.remove('is-valid');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        textarea.value = String(reader.result || '');
        fileName.textContent = file.name;
        renderEditor(editor);
      });
      reader.readAsText(file);
    });
    form?.addEventListener('submit', (event) => {
      if (!renderEditor(editor)) event.preventDefault();
    });
    if (editor.open) renderEditor(editor);
  });

  const search = root.querySelector('[data-icon-search]');
  const cards = [...root.querySelectorAll('[data-icon-card]')];
  const categoryButtons = [...root.querySelectorAll('[data-icon-category]')];
  const resultCount = root.querySelector('[data-icon-result-count]');
  const empty = root.querySelector('[data-icon-empty]');
  let activeCategory = 'all';

  function filterCards() {
    const term = String(search?.value || '').trim().toLocaleLowerCase('ja');
    let visible = 0;
    cards.forEach((card) => {
      const categoryMatch = activeCategory === 'all' || card.dataset.category === activeCategory;
      const searchMatch = !term || String(card.dataset.search || '').toLocaleLowerCase('ja').includes(term);
      const show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) resultCount.textContent = `${visible}件`;
    if (empty) empty.hidden = visible !== 0;
  }

  search?.addEventListener('input', filterCards);
  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.iconCategory || 'all';
      categoryButtons.forEach((candidate) => {
        const selected = candidate === button;
        candidate.classList.toggle('is-active', selected);
        candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      filterCards();
    });
  });

  root.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm(form.dataset.confirm || '実行しますか？')) event.preventDefault();
    });
  });

  const importFile = root.querySelector('[data-icon-import-file]');
  const importTextarea = root.querySelector('[data-icon-import-textarea]');
  importFile?.addEventListener('change', () => {
    const file = importFile.files?.[0];
    if (!file || !importTextarea) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      importTextarea.value = String(reader.result || '');
    });
    reader.readAsText(file);
  });
}());
