import { icon } from './icons.js';
import { formatDateFieldValue } from './date-field.js';
import { escapeHtml, safeHttpUrl } from './ui.js';

const strictDataAttributeContract = () => typeof window === 'undefined'
  || window.SETAE_CONFIG?.debugDataAttributes === true;

const reportDataAttributeError = (message) => {
  if (strictDataAttributeContract()) throw new Error(message);
  console.error(message);
};

export function canonicalDataAttributeName(key) {
  const raw = String(key || '').trim().replace(/^data-/, '');
  if (!raw || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(raw) || /^on[a-z]/i.test(raw)) return '';
  const normalized = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return /^[a-z][a-z0-9-]*$/.test(normalized) ? normalized : '';
}

export function dataAttributes(data = {}) {
  const attributes = new Map();
  const collisions = new Set();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const name = canonicalDataAttributeName(key);
    if (!name) {
      reportDataAttributeError(`SETAE data attribute key is unsafe: ${String(key)}`);
      return;
    }
    if (attributes.has(name) || collisions.has(name)) {
      attributes.delete(name);
      collisions.add(name);
      reportDataAttributeError(`SETAE data attribute collision: ${String(key)} -> data-${name}`);
      return;
    }
    attributes.set(name, value);
  });
  return [...attributes.entries()]
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(' ');
}

const ariaAttributes = (attributes = {}) => Object.entries(attributes)
  .filter(([key, value]) => /^aria-[a-z-]+$/.test(key) && value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
  .join(' ');

const controlStateAttributes = ({ disabled = false, loading = false, invalid = false } = {}) => [
  disabled ? 'disabled aria-disabled="true"' : '',
  loading ? 'aria-busy="true"' : '',
  invalid ? 'aria-invalid="true"' : ''
].filter(Boolean).join(' ');

const inputTypes = new Set(['date', 'datetime-local', 'email', 'month', 'number', 'password', 'search', 'tel', 'text', 'time', 'url']);
const dateInputTypes = new Set(['date', 'datetime-local', 'month', 'time']);
const emptyStateReasons = new Set(['initial', 'filtered', 'offline', 'error', 'permission', 'completed']);
let generatedFieldId = 0;
let generatedEmptyStateId = 0;

const domIdPart = (value, fallback = 'setae') => {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const formControlAttributes = ({
  id = '',
  role = '',
  data = {},
  autocomplete = '',
  inputMode = '',
  min = '',
  max = '',
  step = '',
  minLength = '',
  maxLength = '',
  accept = '',
  capture = '',
  size = '',
  multiple = false,
  readOnly = false
} = {}) => [
  id ? `id="${escapeHtml(id)}"` : '',
  role ? `data-role="${escapeHtml(role)}"` : '',
  dataAttributes(data),
  autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : '',
  inputMode ? `inputmode="${escapeHtml(inputMode)}"` : '',
  min !== '' ? `min="${escapeHtml(min)}"` : '',
  max !== '' ? `max="${escapeHtml(max)}"` : '',
  step !== '' ? `step="${escapeHtml(step)}"` : '',
  minLength !== '' ? `minlength="${escapeHtml(minLength)}"` : '',
  maxLength !== '' ? `maxlength="${escapeHtml(maxLength)}"` : '',
  accept ? `accept="${escapeHtml(accept)}"` : '',
  capture ? `capture="${escapeHtml(capture)}"` : '',
  size !== '' ? `size="${escapeHtml(size)}"` : '',
  multiple ? 'multiple' : '',
  readOnly ? 'readonly' : ''
].filter(Boolean).join(' ');

const safeTag = (tag, fallback = 'div') => /^(?:aside|div|fieldset|form|main|nav|section)$/.test(tag)
  ? tag
  : fallback;

const fieldLabel = (label, name, required) => `<span>${escapeHtml(label || name)}${required ? '<span class="field-required" aria-hidden="true">必須</span>' : ''}</span>`;
const fieldMessage = (hint, invalid, id = '') => {
  const message = hint || (invalid ? '入力内容を確認してください。' : '');
  return message ? `<small ${id ? `id="${escapeHtml(id)}"` : ''} class="${invalid ? 'field-error' : ''}">${escapeHtml(message)}</small>` : '';
};

const fieldIdentity = (name, explicitId, hasMessage) => {
  const id = explicitId || `setae-field-${String(name || 'control').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-${++generatedFieldId}`;
  return { id, messageId: hasMessage ? `${id}-message` : '' };
};

export function button(label, {
  type = 'button',
  action = '',
  iconName = '',
  className = '',
  primary = false,
  disabled = false,
  loading = false,
  data = {},
  nav = '',
  title = '',
  aria = {}
} = {}) {
  const classes = ['button', primary ? 'primary' : '', loading ? 'is-loading' : '', className]
    .filter(Boolean)
    .join(' ');
  return `<button type="${type === 'submit' ? 'submit' : 'button'}" class="${escapeHtml(classes)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${nav ? `data-nav="${escapeHtml(nav)}"` : ''} ${dataAttributes(data)} ${title ? `title="${escapeHtml(title)}"` : ''} ${ariaAttributes(aria)} ${controlStateAttributes({ disabled, loading })}>${loading ? '<span class="button-spinner" aria-hidden="true"></span>' : iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export function linkButton(label, {
  href = '',
  iconName = '',
  className = '',
  primary = false,
  external = false,
  title = ''
} = {}) {
  const url = safeHttpUrl(href, '#');
  const classes = ['button', primary ? 'primary' : '', className].filter(Boolean).join(' ');
  return `<a class="${escapeHtml(classes)}" href="${escapeHtml(url)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''} ${title ? `title="${escapeHtml(title)}"` : ''}>${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></a>`;
}

export function iconButton(name, {
  action = '',
  label,
  title = label,
  className = '',
  data = {},
  disabled = false,
  hidden = false,
  pressed,
  expanded
} = {}) {
  const actionAttribute = action ? `data-action="${escapeHtml(action)}"` : '';
  const pressedAttribute = typeof pressed === 'boolean' ? `aria-pressed="${pressed ? 'true' : 'false'}"` : '';
  const expandedAttribute = typeof expanded === 'boolean' ? `aria-expanded="${expanded ? 'true' : 'false'}"` : '';
  return `<button type="button" class="icon-button ${escapeHtml(className)}" ${actionAttribute} ${dataAttributes(data)} aria-label="${escapeHtml(label || title || name)}" title="${escapeHtml(title || label || name)}" ${pressedAttribute} ${expandedAttribute} ${disabled ? 'disabled' : ''} ${hidden ? 'hidden' : ''}>${icon(name)}</button>`;
}

export function actionRow({
  label,
  description = '',
  meta = '',
  iconName = '',
  action = '',
  data = {},
  trailingLabel = '',
  trailingIcon = 'chevronRight',
  className = '',
  disabled = false
} = {}) {
  const classes = ['action-row', className].filter(Boolean).join(' ');
  const trailing = trailingLabel || trailingIcon
    ? `<span class="action-row-trailing">${trailingLabel ? `<span>${escapeHtml(trailingLabel)}</span>` : ''}${trailingIcon ? icon(trailingIcon) : ''}</span>`
    : '';
  return `<button type="button" class="${escapeHtml(classes)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} ${controlStateAttributes({ disabled })}>${iconName ? `<span class="action-row-icon" aria-hidden="true">${icon(iconName)}</span>` : ''}<span class="action-row-copy"><strong>${escapeHtml(label || '')}</strong>${description ? `<small class="action-row-description">${escapeHtml(description)}</small>` : ''}${meta ? `<span class="action-row-meta">${escapeHtml(meta)}</span>` : ''}</span>${trailing}</button>`;
}

export function textIconButton(name, label, {
  action = '',
  className = '',
  data = {},
  primary = false,
  disabled = false
} = {}) {
  return `<button type="button" class="button ${primary ? 'primary' : ''} ${escapeHtml(className)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} ${disabled ? 'disabled' : ''}>${icon(name)}<span>${escapeHtml(label)}</span></button>`;
}

export function textButton(label, {
  action = '',
  className = '',
  data = {},
  danger = false,
  disabled = false,
  title = '',
  aria = {}
} = {}) {
  const classes = ['text-button', danger ? 'danger' : '', className].filter(Boolean).join(' ');
  return `<button type="button" class="${escapeHtml(classes)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} ${title ? `title="${escapeHtml(title)}"` : ''} ${ariaAttributes(aria)} ${controlStateAttributes({ disabled })}>${escapeHtml(label)}</button>`;
}

export function searchControl({
  value = '',
  placeholder = '検索',
  label = placeholder,
  name = '',
  role = '',
  className = '',
  data = {},
  disabled = false,
  required = false,
  autocomplete = '',
  clearAction = '',
  clearLabel = '検索をクリア',
  persistentClear = false
} = {}) {
  return `<div class="search-control ${escapeHtml(className)}">${icon('search')}<input class="search" type="search" ${name ? `name="${escapeHtml(name)}"` : ''} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" ${role ? `data-role="${escapeHtml(role)}"` : ''} ${dataAttributes(data)} ${autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : ''} aria-label="${escapeHtml(label)}" ${required ? 'required' : ''} ${controlStateAttributes({ disabled })}>${clearAction && (String(value) || persistentClear) ? iconButton('close', { action: clearAction, label: clearLabel, className: 'search-control-clear', disabled, hidden: !String(value) }) : ''}</div>`;
}

export function selectControl({
  value = '',
  options = [],
  label = '選択',
  name = '',
  role = '',
  className = '',
  data = {},
  disabled = false,
  required = false,
  multiple = false,
  size = ''
} = {}) {
  const selectedValues = new Set((Array.isArray(value) ? value : [value]).map((item) => String(item)));
  const choices = options.map((option) => {
    const item = typeof option === 'object' ? option : { value: option, label: option };
    return `<option value="${escapeHtml(item.value)}" ${selectedValues.has(String(item.value)) ? 'selected' : ''}>${escapeHtml(item.label ?? item.value)}</option>`;
  }).join('');
  return `<label class="select-control ${escapeHtml(className)}"><span class="visually-hidden">${escapeHtml(label)}</span><select class="select" ${name ? `name="${escapeHtml(name)}"` : ''} ${role ? `data-role="${escapeHtml(role)}"` : ''} ${dataAttributes(data)} aria-label="${escapeHtml(label)}" ${required ? 'required' : ''} ${multiple ? 'multiple' : ''} ${size !== '' ? `size="${escapeHtml(size)}"` : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}>${choices}</select>${multiple ? '' : icon('chevronDown')}</label>`;
}

export function checkboxControl({
  checked = false,
  label = '選択',
  labelHtml = '',
  description = '',
  name = '',
  value = '1',
  action = '',
  role = '',
  className = '',
  data = {},
  disabled = false,
  required = false,
  compact = false,
  labelMode = 'visible'
} = {}) {
  const resolvedLabelMode = labelMode === 'sr-only' ? 'sr-only' : 'visible';
  const classes = [
    'checkbox-control',
    compact ? 'is-compact' : '',
    resolvedLabelMode === 'sr-only' ? 'has-sr-only-label' : 'has-visible-label',
    disabled ? 'is-disabled' : '',
    description ? 'has-description' : '',
    className
  ].filter(Boolean).join(' ');
  const labelClasses = ['checkbox-control-label', resolvedLabelMode === 'sr-only' ? 'visually-hidden' : ''].filter(Boolean).join(' ');
  return `<label class="${escapeHtml(classes)}"><input type="checkbox" ${name ? `name="${escapeHtml(name)}" value="${escapeHtml(value)}"` : ''} ${action ? `data-action="${escapeHtml(action)}"` : ''} ${role ? `data-role="${escapeHtml(role)}"` : ''} ${dataAttributes(data)} ${checked ? 'checked' : ''} ${required ? 'required' : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}><span class="checkbox-control-mark" aria-hidden="true">${icon('check')}</span><span class="checkbox-control-copy"><span class="${labelClasses}">${labelHtml || escapeHtml(label)}</span>${description ? `<small class="checkbox-control-description">${escapeHtml(description)}</small>` : ''}</span></label>`;
}

export function choiceControl({
  type = 'radio',
  name = '',
  value = '',
  checked = false,
  label = '',
  description = '',
  meta = '',
  role = '',
  data = {},
  className = '',
  disabled = false,
  required = false,
  hidden = false
} = {}) {
  const safeType = type === 'checkbox' ? 'checkbox' : 'radio';
  const classes = ['choice-control', className].filter(Boolean).join(' ');
  return `<label class="${escapeHtml(classes)}" ${dataAttributes(data)} ${hidden ? 'hidden' : ''}><input type="${safeType}" ${name ? `name="${escapeHtml(name)}"` : ''} value="${escapeHtml(value)}" ${role ? `data-role="${escapeHtml(role)}"` : ''} ${checked ? 'checked' : ''} ${required ? 'required' : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}><span class="choice-control-mark" aria-hidden="true"></span><span class="choice-control-copy"><strong>${escapeHtml(label)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ''}</span>${meta ? `<span class="choice-control-meta">${escapeHtml(meta)}</span>` : ''}</label>`;
}

export function selectionRow({
  type = 'checkbox',
  name = '',
  value = '',
  checked = false,
  label = '',
  description = '',
  meta = '',
  role = '',
  data = {},
  disabled = false,
  required = false,
  className = ''
} = {}) {
  const safeType = type === 'radio' ? 'radio' : 'checkbox';
  const classes = ['selection-row', className].filter(Boolean).join(' ');
  return `<label class="${escapeHtml(classes)}"><input type="${safeType}" ${name ? `name="${escapeHtml(name)}"` : ''} value="${escapeHtml(value)}" ${role ? `data-role="${escapeHtml(role)}"` : ''} ${dataAttributes(data)} ${checked ? 'checked' : ''} ${required ? 'required' : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}><span class="selection-row-mark" aria-hidden="true">${safeType === 'checkbox' ? icon('check') : ''}</span><span class="selection-row-copy"><strong>${escapeHtml(label)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ''}</span>${meta ? `<span class="selection-row-meta">${escapeHtml(meta)}</span>` : ''}</label>`;
}

export function contentAction({
  contentHtml = '',
  action = '',
  data = {},
  className = '',
  ariaLabel = '',
  disabled = false,
  pressed,
  expanded
} = {}) {
  const pressedAttribute = typeof pressed === 'boolean' ? `aria-pressed="${pressed ? 'true' : 'false'}"` : '';
  const expandedAttribute = typeof expanded === 'boolean' ? `aria-expanded="${expanded ? 'true' : 'false'}"` : '';
  return `<button type="button" class="content-action ${escapeHtml(className)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ''} ${pressedAttribute} ${expandedAttribute} ${controlStateAttributes({ disabled })}>${contentHtml}</button>`;
}

export function fileAction({
  label = 'ファイルを選ぶ',
  name = '',
  accept = '',
  capture = '',
  role = '',
  data = {},
  className = '',
  iconName = '',
  disabled = false,
  multiple = false
} = {}) {
  const classes = ['button', 'file-action', className].filter(Boolean).join(' ');
  return `<label class="${escapeHtml(classes)} ${disabled ? 'is-disabled' : ''}">${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span><input type="file" ${name ? `name="${escapeHtml(name)}"` : ''} ${formControlAttributes({ role, data, accept, capture, multiple })} ${disabled ? 'disabled aria-disabled="true"' : ''}></label>`;
}

export function quantityStepper({
  label = '数量',
  name = 'quantity',
  value = 1,
  min = 1,
  max = 100,
  action = 'record-quantity',
  className = '',
  disabled = false
} = {}) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 1;
  const safeMax = Math.max(safeMin, Number.isFinite(Number(max)) ? Number(max) : 100);
  const safeValue = Math.min(safeMax, Math.max(safeMin, Number(value) || safeMin));
  return `<div class="field quantity-stepper-field ${escapeHtml(className)}"><span class="field-caption">${escapeHtml(label)}</span><div class="quantity-stepper" role="group" aria-label="${escapeHtml(label)}">${iconButton('minus', { action, label: '数量を減らす', data: { delta: -1 }, disabled })}<input class="text-field quantity-stepper-input" name="${escapeHtml(name)}" type="number" min="${safeMin}" max="${safeMax}" value="${safeValue}" inputmode="numeric" aria-label="${escapeHtml(label)}" ${controlStateAttributes({ disabled })}>${iconButton('plus', { action, label: '数量を増やす', data: { delta: 1 }, disabled })}</div></div>`;
}

export function navigationItem(label, iconName, {
  nav = '',
  action = '',
  active = false,
  className = '',
  data = {},
  current = active ? 'page' : '',
  ariaLabel = label
} = {}) {
  const classes = ['navigation-item', active ? 'is-active' : '', className].filter(Boolean).join(' ');
  return `<button type="button" class="${escapeHtml(classes)}" ${nav ? `data-nav="${escapeHtml(nav)}"` : ''} ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} aria-label="${escapeHtml(ariaLabel)}" ${current ? `aria-current="${escapeHtml(current)}"` : ''}>${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export function menuItem(label, {
  action = '',
  iconName = '',
  data = {},
  disabled = false,
  className = ''
} = {}) {
  return `<button type="button" class="menu-item ${escapeHtml(className)}" role="menuitem" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${dataAttributes(data)} ${disabled ? 'disabled aria-disabled="true"' : ''}>${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export function actionMenu(label, items = [], {
  iconName = 'chevronDown',
  iconOnly = false,
  className = '',
  align = 'end'
} = {}) {
  const safeAlign = align === 'start' ? 'start' : 'end';
  const triggerClass = iconOnly ? 'icon-button action-menu-trigger is-icon-only' : 'button action-menu-trigger';
  const content = items.map((item) => item?.separator
    ? '<div class="action-menu-separator" role="separator"></div>'
    : menuItem(item.label, item)).join('');
  return `<details class="action-menu is-${safeAlign} ${escapeHtml(className)}"><summary class="${triggerClass}" aria-label="${escapeHtml(label)}" aria-haspopup="menu" title="${escapeHtml(label)}">${iconName ? icon(iconName) : ''}<span class="${iconOnly ? 'visually-hidden' : ''}">${escapeHtml(label)}</span>${iconOnly ? '' : icon('chevronDown')}</summary><div class="action-menu-popover" role="menu" aria-label="${escapeHtml(label)}">${content}</div></details>`;
}

export function statusIndicator(label, { tone = 'neutral', className = '' } = {}) {
  const safeTone = ['neutral', 'success', 'warning', 'danger'].includes(tone) ? tone : 'neutral';
  return `<span class="status-indicator is-${safeTone} ${escapeHtml(className)}"><span aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

export function textField({ label, name = '', value = '', type = 'text', placeholder = '', className = '', disabled = false, required = false, invalid = false, hint = '', suffix = '', ...attributes } = {}) {
  const safeType = inputTypes.has(type) ? type : 'text';
  const identity = fieldIdentity(name, attributes.id, Boolean(hint || invalid));
  const control = `<input class="text-field" type="${safeType}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${formControlAttributes({ ...attributes, id: identity.id })} ${identity.messageId ? `aria-describedby="${escapeHtml(identity.messageId)}"` : ''} ${required ? 'required' : ''} ${controlStateAttributes({ disabled, invalid })}>`;
  return `<label class="field ${invalid ? 'is-error' : ''} ${escapeHtml(className)}">${fieldLabel(label, name, required)}${suffix ? `<span class="field-control-with-suffix">${control}<span aria-hidden="true">${escapeHtml(suffix)}</span></span>` : control}${fieldMessage(hint, invalid, identity.messageId)}</label>`;
}

export function dateField({ label, name = '', value = '', type = 'date', className = '', disabled = false, required = false, invalid = false, hint = '', ...attributes } = {}) {
  const safeType = dateInputTypes.has(type) ? type : 'date';
  const classes = ['field', 'date-field', invalid ? 'is-error' : '', className].filter(Boolean).join(' ');
  const displayValue = formatDateFieldValue(value, safeType);
  const identity = fieldIdentity(name, attributes.id, Boolean(hint || invalid));
  return `<label class="${escapeHtml(classes)}">${fieldLabel(label, name, required)}<span class="date-field-frame"><span class="date-field-display" data-date-field-display aria-hidden="true">${escapeHtml(displayValue)}</span><span class="date-field-display-icon" aria-hidden="true">${icon('calendar')}</span><input class="text-field date-field-control" type="${safeType}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${formControlAttributes({ ...attributes, id: identity.id })} ${identity.messageId ? `aria-describedby="${escapeHtml(identity.messageId)}"` : ''} ${required ? 'required' : ''} ${controlStateAttributes({ disabled, invalid })}></span>${fieldMessage(hint, invalid, identity.messageId)}</label>`;
}

export function textareaField({ label, name = '', value = '', placeholder = '', rows = 3, className = '', disabled = false, required = false, invalid = false, hint = '', ...attributes } = {}) {
  const identity = fieldIdentity(name, attributes.id, Boolean(hint || invalid));
  return `<label class="field ${invalid ? 'is-error' : ''} ${escapeHtml(className)}">${fieldLabel(label, name, required)}<textarea class="textarea" name="${escapeHtml(name)}" rows="${Math.max(2, Number(rows) || 3)}" placeholder="${escapeHtml(placeholder)}" ${formControlAttributes({ ...attributes, id: identity.id })} ${identity.messageId ? `aria-describedby="${escapeHtml(identity.messageId)}"` : ''} ${required ? 'required' : ''} ${controlStateAttributes({ disabled, invalid })}>${escapeHtml(value)}</textarea>${fieldMessage(hint, invalid, identity.messageId)}</label>`;
}

export function selectField({ label, name = '', value = '', options = [], className = '', disabled = false, required = false, invalid = false, hint = '', ...attributes } = {}) {
  const selectedValues = new Set((Array.isArray(value) ? value : [value]).map((item) => String(item)));
  const choices = options.map((option) => {
    const item = typeof option === 'object' ? option : { value: option, label: option };
    return `<option value="${escapeHtml(item.value)}" ${selectedValues.has(String(item.value)) ? 'selected' : ''}>${escapeHtml(item.label ?? item.value)}</option>`;
  }).join('');
  const identity = fieldIdentity(name, attributes.id, Boolean(hint || invalid));
  return `<label class="field ${invalid ? 'is-error' : ''} ${escapeHtml(className)}">${fieldLabel(label, name, required)}<select class="select" name="${escapeHtml(name)}" ${formControlAttributes({ ...attributes, id: identity.id })} ${identity.messageId ? `aria-describedby="${escapeHtml(identity.messageId)}"` : ''} ${required ? 'required' : ''} ${controlStateAttributes({ disabled, invalid })}>${choices}</select>${fieldMessage(hint, invalid, identity.messageId)}</label>`;
}

export function hiddenField(name, value = '', { data = {} } = {}) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${dataAttributes(data)}>`;
}

export function fileField({ label = 'ファイル', name = '', accept = '', capture = '', role = '', data = {}, className = '', hint = '', fileName = '', buttonLabel = 'ファイルを選ぶ', disabled = false, multiple = false } = {}) {
  const identity = fieldIdentity(name, '', Boolean(hint));
  return `<label class="field file-field ${escapeHtml(className)}"><span>${escapeHtml(label)}</span><span class="file-picker"><input type="file" name="${escapeHtml(name)}" ${formControlAttributes({ id: identity.id, role, data, accept, capture, multiple })} ${identity.messageId ? `aria-describedby="${escapeHtml(identity.messageId)}"` : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}><span class="button" aria-hidden="true">${escapeHtml(buttonLabel)}</span><span data-file-name>${escapeHtml(fileName || '選択されていません')}</span></span>${hint ? `<small id="${escapeHtml(identity.messageId)}">${escapeHtml(hint)}</small>` : ''}</label>`;
}

export function comboboxField({
  label = '検索',
  name = '',
  value = '',
  placeholder = '',
  inputId = 'setae-combobox-input',
  listId = 'setae-combobox-listbox',
  role = '',
  className = '',
  hint = '',
  required = false,
  expanded = false,
  activeId = ''
} = {}) {
  const messageId = hint ? `${inputId}-message` : '';
  // Selection is validated by the owning controller, not by search-text length.
  return `<div class="field combobox-field ${escapeHtml(className)}"><label for="${escapeHtml(inputId)}">${required ? fieldLabel(label, name, true) : escapeHtml(label)}</label><div class="combobox-control">${icon('search')}<input id="${escapeHtml(inputId)}" class="text-field" type="search" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${role ? `data-role="${escapeHtml(role)}"` : ''} role="combobox" aria-autocomplete="list" aria-controls="${escapeHtml(listId)}" aria-expanded="${expanded ? 'true' : 'false'}" ${required ? 'aria-required="true"' : ''} ${activeId ? `aria-activedescendant="${escapeHtml(activeId)}"` : ''} ${messageId ? `aria-describedby="${escapeHtml(messageId)}"` : ''} autocomplete="off"></div><div id="${escapeHtml(listId)}" class="combobox-listbox" data-role="species-combobox-listbox" role="listbox" ${expanded ? '' : 'hidden'}></div>${hint ? `<small id="${escapeHtml(messageId)}">${escapeHtml(hint)}</small>` : ''}</div>`;
}

export function comboboxOptions(items = [], { activeIndex = -1, optionIdPrefix = 'setae-combobox-option', emptyMessage = '一致する候補はありません。' } = {}) {
  if (!items.length) return `<div class="combobox-empty" role="status">${escapeHtml(emptyMessage)}</div>`;
  return items.map((item, index) => {
    const id = `${optionIdPrefix}-${index}`;
    return `<div id="${escapeHtml(id)}" class="combobox-option ${index === activeIndex ? 'is-active' : ''}" role="option" aria-selected="${index === activeIndex ? 'true' : 'false'}" data-action="select-species-suggestion" data-species-index="${index}"><strong>${escapeHtml(item.ja_name || item.scientific_name)}</strong><em>${escapeHtml(item.scientific_name || '')}</em>${item.genus ? `<span>${escapeHtml(item.genus)}</span>` : ''}</div>`;
  }).join('');
}

export function nextTabIndex(currentIndex, count, key) {
  if (!count || !['ArrowLeft', 'ArrowRight'].includes(key)) return currentIndex;
  const offset = key === 'ArrowRight' ? 1 : -1;
  return (currentIndex + offset + count) % count;
}

export function tabId(idPrefix, itemId) {
  return `${domIdPart(idPrefix, 'setae-tabs')}-tab-${domIdPart(itemId, 'item')}`;
}

export function tabs(items = [], {
  activeId = '',
  action = 'select-tab',
  dataKey = 'tab',
  label = '表示切替',
  className = '',
  idPrefix = '',
  panelId = ''
} = {}) {
  const resolvedActiveId = items.some((item) => String(item.id) === String(activeId))
    ? activeId
    : items[0]?.id;
  const resolvedPrefix = domIdPart(idPrefix || action, 'setae-tabs');
  const resolvedPanelId = domIdPart(panelId || `${resolvedPrefix}-panel`, 'setae-tabpanel');
  return `<div class="tabs ${escapeHtml(className)}" role="tablist" aria-label="${escapeHtml(label)}">${items.map((item) => {
    const active = String(item.id) === String(resolvedActiveId);
    return `<button type="button" id="${escapeHtml(tabId(resolvedPrefix, item.id))}" role="tab" class="${active ? 'is-active' : ''}" data-action="${escapeHtml(action)}" data-${escapeHtml(dataKey)}="${escapeHtml(item.id)}" aria-controls="${escapeHtml(resolvedPanelId)}" aria-selected="${active ? 'true' : 'false'}" tabindex="${active ? '0' : '-1'}">${escapeHtml(item.label)}</button>`;
  }).join('')}</div>`;
}

export function tabPanel(contentHtml = '', {
  id,
  idPrefix = '',
  activeId = '',
  className = '',
  tag = 'section'
} = {}) {
  const safePanelTag = tag === 'div' ? 'div' : 'section';
  const resolvedPrefix = domIdPart(idPrefix, 'setae-tabs');
  const panelId = domIdPart(id || `${resolvedPrefix}-panel`, 'setae-tabpanel');
  return `<${safePanelTag} id="${escapeHtml(panelId)}" class="${escapeHtml(className)}" role="tabpanel" aria-labelledby="${escapeHtml(tabId(resolvedPrefix, activeId))}" tabindex="0">${contentHtml}</${safePanelTag}>`;
}

export function segmentedControl(items = [], { activeId = '', action = 'select-segment', dataKey = 'value', data = {}, label = '表示切替', className = '', disabled = false } = {}) {
  return `<div class="segmented ${escapeHtml(className)}" role="group" aria-label="${escapeHtml(label)}">${items.map((item) => `<button type="button" data-action="${escapeHtml(action)}" ${dataAttributes({ ...data, ...(item.data || {}), [dataKey]: item.id })} aria-pressed="${String(item.id) === String(activeId) ? 'true' : 'false'}" ${controlStateAttributes({ disabled: disabled || item.disabled })}>${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

export function menu(contentHtml, { className = '', label = 'メニュー' } = {}) {
  return `<div class="menu-popover ${escapeHtml(className)}" role="menu" aria-label="${escapeHtml(label)}">${contentHtml}</div>`;
}

export function popover(contentHtml, { className = '', label = '' } = {}) {
  return `<aside class="popover ${escapeHtml(className)}" ${label ? `aria-label="${escapeHtml(label)}"` : ''}>${contentHtml}</aside>`;
}

export function busyShield(label = '保存しています…') {
  return `<div class="dialog-busy-shield" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div>`;
}

export function modal(contentHtml, { className = '', backdropClassName = '', label = '', labelledBy = '', busy = false, busyLabel = '保存しています…', backdropAction = '', panelData = false, role = 'dialog' } = {}) {
  const dialogRole = role === 'alertdialog' ? 'alertdialog' : 'dialog';
  const resolvedBackdropAction = busy ? '' : backdropAction;
  const panelClasses = ['modal', busy ? 'is-busy' : '', className].filter(Boolean).join(' ');
  const accessibleName = labelledBy
    ? `aria-labelledby="${escapeHtml(labelledBy)}"`
    : label ? `aria-label="${escapeHtml(label)}"` : '';
  return `<div class="modal-backdrop ${escapeHtml(backdropClassName)}" data-overlay-backdrop ${resolvedBackdropAction ? `data-backdrop-action="${escapeHtml(resolvedBackdropAction)}"` : ''}><section class="${escapeHtml(panelClasses)}" role="${dialogRole}" aria-modal="true" tabindex="-1" data-modal ${accessibleName} data-busy-label="${escapeHtml(busyLabel)}" ${busy ? 'aria-busy="true"' : ''} ${panelData ? 'data-sheet' : ''}>${contentHtml}${busy ? busyShield(busyLabel) : ''}</section></div>`;
}

export function alertDialog(contentHtml, options = {}) {
  return modal(contentHtml, {
    ...options,
    className: ['alert-dialog', options.className || ''].filter(Boolean).join(' '),
    role: 'alertdialog'
  });
}

export function fullScreenDialog(contentHtml, options = {}) {
  return modal(contentHtml, {
    ...options,
    className: ['full-screen-dialog', options.className || ''].filter(Boolean).join(' '),
    backdropClassName: ['full-screen-dialog-backdrop', options.backdropClassName || ''].filter(Boolean).join(' ')
  });
}

export function sheet(contentHtml, { className = '', backdropClassName = '', label = '', labelledBy = '', busy = false, busyLabel = '保存しています…', backdropAction = '', panelData = false, presentation = 'sheet' } = {}) {
  const fullScreenMobile = presentation === 'full-screen-mobile';
  const panelClasses = ['sheet', fullScreenMobile ? 'full-screen-dialog' : '', busy ? 'is-busy' : '', className].filter(Boolean).join(' ');
  const backdropClasses = ['sheet-backdrop', fullScreenMobile ? 'full-screen-dialog-backdrop' : '', backdropClassName].filter(Boolean).join(' ');
  const resolvedBackdropAction = busy ? '' : backdropAction;
  const accessibleName = labelledBy
    ? `aria-labelledby="${escapeHtml(labelledBy)}"`
    : label ? `aria-label="${escapeHtml(label)}"` : '';
  return `<div class="${escapeHtml(backdropClasses)}" data-overlay-backdrop ${resolvedBackdropAction ? `data-backdrop-action="${escapeHtml(resolvedBackdropAction)}"` : ''}><section class="${escapeHtml(panelClasses)}" role="dialog" aria-modal="true" tabindex="-1" ${accessibleName} data-busy-label="${escapeHtml(busyLabel)}" ${busy ? 'aria-busy="true"' : ''} ${panelData ? 'data-sheet' : ''}>${contentHtml}${busy ? busyShield(busyLabel) : ''}</section></div>`;
}

export function badge(label, { className = '' } = {}) {
  return `<span class="badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

export function surface(contentHtml, { tag = 'section', className = '' } = {}) {
  const element = safeTag(tag, 'section');
  return `<${element} class="surface ${escapeHtml(className)}">${contentHtml}</${element}>`;
}

export function emptyState(message, {
  title = '',
  description = '',
  iconName = '',
  reason = 'initial',
  className = '',
  compact = false,
  action = '',
  actionLabel = '',
  secondaryAction = '',
  secondaryActionLabel = '',
  primary = false
} = {}) {
  const safeReason = emptyStateReasons.has(reason) ? reason : 'initial';
  const id = `setae-empty-state-${++generatedEmptyStateId}`;
  const resolvedTitle = title || (description ? message : '');
  const resolvedDescription = description || (!resolvedTitle ? message : '');
  const actions = [
    action && actionLabel ? button(actionLabel, { action, primary }) : '',
    secondaryAction && secondaryActionLabel ? button(secondaryActionLabel, { action: secondaryAction }) : ''
  ].filter(Boolean).join('');
  return `<div class="empty-state ${compact ? 'compact' : ''} is-${safeReason} ${escapeHtml(className)}" role="status" ${resolvedTitle ? `aria-labelledby="${id}-title"` : ''} ${resolvedDescription ? `aria-describedby="${id}-description"` : ''}>${iconName ? `<span class="empty-state-icon" aria-hidden="true">${icon(iconName)}</span>` : ''}${resolvedTitle ? `<strong id="${id}-title">${escapeHtml(resolvedTitle)}</strong>` : ''}${resolvedDescription ? `<p id="${id}-description">${escapeHtml(resolvedDescription)}</p>` : ''}${actions ? `<div class="empty-state-actions">${actions}</div>` : ''}</div>`;
}

export function skeleton({ className = '', label = '読み込み中' } = {}) {
  return `<span class="loading-skeleton ${escapeHtml(className)}" role="status" aria-label="${escapeHtml(label)}"></span>`;
}

export function toast(message, { type = 'default', actionLabel = '', action = '', data = {}, dismissAction = 'dismiss-toast' } = {}) {
  const safeType = ['default', 'success', 'warning', 'error'].includes(type) ? type : 'default';
  return `<div class="toast is-${safeType}" role="${safeType === 'error' ? 'alert' : 'status'}" aria-live="${safeType === 'error' ? 'assertive' : 'polite'}" data-toast>${escapeHtml(message)}<div class="toast-actions">${actionLabel && action ? button(actionLabel, { action: 'run-toast-action', className: 'toast-action', data: { ...data, 'toast-action': action } }) : ''}${iconButton('close', { action: dismissAction, label: '通知を閉じる', className: 'toast-dismiss' })}</div></div>`;
}

export function progress(value, { max = 100, label = '進捗' } = {}) {
  const safeMax = Math.max(1, Number(max) || 100);
  const safeValue = Math.min(safeMax, Math.max(0, Number(value) || 0));
  const percent = Math.round((safeValue / safeMax) * 100);
  return `<div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="${safeMax}" aria-valuenow="${safeValue}"><span style="width:${percent}%"></span></div>`;
}

export function dataRow(label, value, { className = '', metric = false } = {}) {
  return `<div class="data-row ${escapeHtml(className)}"><span>${escapeHtml(label)}</span><strong ${metric ? 'data-metric' : ''}>${escapeHtml(value)}</strong></div>`;
}
