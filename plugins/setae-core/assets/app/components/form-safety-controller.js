import { discardConfirmation } from '../content/messages.js';
import { button } from './primitives.js';
import { revealFormControl } from './form-disclosure.js';

export const FORM_DRAFT_STORAGE_PREFIX = 'setae.gui.v2.formDraft';
export const FORM_DRAFT_TTL_MS = 72 * 60 * 60 * 1000;
export const FORM_DRAFT_DEBOUNCE_MS = 300;
export const FORM_DRAFT_VERSION = 1;

const draftPolicies = new Set(['persist', 'guard', 'none']);
const forbiddenName = /(?:password|passcode|token|secret|nonce|authorization|credential)/i;
const formSelector = 'form[data-draft-policy]';

const normalizePolicy = (value) => draftPolicies.has(value) ? value : 'none';
const escapeSelector = (value) => globalThis.CSS?.escape ? globalThis.CSS.escape(String(value)) : String(value).replace(/[^a-z0-9_-]/gi, '\\$&');
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const stable = (value) => JSON.stringify(canonicalize(value));
const isMultipleSelect = (control) => control?.tagName === 'SELECT' && Boolean(control.multiple);

function formType(form) {
  return String(form?.dataset?.draftType || form?.dataset?.role || 'form')
    .replace(/-form$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .toLowerCase();
}

function entityId(form) {
  if (form?.dataset?.draftEntity) return String(form.dataset.draftEntity);
  const keys = ['animalId', 'groupId', 'enclosureId', 'topicId', 'speciesId', 'viewId', 'widgetId', 'sectionId', 'taskId', 'feedId'];
  for (const key of keys) {
    if (form?.dataset?.[key]) return String(form.dataset[key]);
  }
  return 'new';
}

export function formDraftKey(ownerId, form) {
  const owner = String(ownerId || 'guest').replace(/[^a-z0-9_-]+/gi, '-');
  return `${FORM_DRAFT_STORAGE_PREFIX}.${owner}.${formType(form)}.${entityId(form)}`;
}

function controlName(control) {
  if (control?.name) return String(control.name);
  const field = control?.dataset?.historyField || control?.dataset?.batchField || '';
  if (!field) return '';
  const row = control.closest?.('[data-history-row-id], [data-qr-code]');
  return `${row?.dataset?.historyRowId || row?.dataset?.qrCode || 'row'}.${field}`;
}

function isForbiddenControl(control) {
  const type = String(control?.type || '').toLowerCase();
  const name = controlName(control);
  return !name || ['file', 'password', 'submit', 'button', 'reset', 'image'].includes(type) || forbiddenName.test(name);
}

export function serializeFormDraft(form) {
  const draft = {
    version: FORM_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    values: {},
    checks: {},
    selections: {}
  };
  let hadFiles = form?.dataset?.draftHadFile === 'true'
    || [...(form?.querySelectorAll?.('[data-file-name]') || [])]
      .some((item) => String(item.textContent || '').trim() && String(item.textContent || '').trim() !== '選択されていません');
  [...(form?.elements || [])].forEach((control) => {
    if (String(control?.type || '').toLowerCase() === 'file') {
      if (control.files?.length) hadFiles = true;
      return;
    }
    if (isForbiddenControl(control)) return;
    const name = controlName(control);
    if (isMultipleSelect(control)) {
      draft.selections[name] = [...control.selectedOptions].map((option) => option.value);
    } else if (['checkbox', 'radio'].includes(String(control.type).toLowerCase())) {
      if (!Array.isArray(draft.checks[name])) draft.checks[name] = [];
      if (control.checked) draft.checks[name].push(control.value || '1');
    } else {
      draft.values[name] = control.value;
    }
  });
  if (hadFiles) draft.hadFiles = true;
  return draft;
}

const comparableDraft = (draft) => ({
  values: draft?.values || {},
  checks: draft?.checks || {},
  selections: draft?.selections || {},
  hadFiles: Boolean(draft?.hadFiles)
});

export function formDraftHasRestorableChanges(form, draft) {
  if (!form || !draft) return false;
  return [...(form.elements || [])].some((control) => {
    if (isForbiddenControl(control)) return false;
    const name = controlName(control);
    if (isMultipleSelect(control)) {
      if (!Array.isArray(draft.selections?.[name])) return false;
      const selected = new Set(draft.selections[name].map(String));
      return [...control.options].some((option) => Boolean(option.selected) !== selected.has(String(option.value)));
    }
    if (['checkbox', 'radio'].includes(String(control.type).toLowerCase())) {
      if (!Array.isArray(draft.checks?.[name])) return false;
      const checked = new Set(draft.checks[name].map(String));
      return Boolean(control.checked) !== checked.has(String(control.value || '1'));
    }
    if (control.tagName === 'SELECT'
      && ![...control.options].some((option) => String(option.value) === String(draft.values?.[name] ?? ''))) return false;
    return Object.hasOwn(draft.values || {}, name)
      && String(control.value ?? '') !== String(draft.values[name] ?? '');
  });
}

export function restoreFormDraft(form, draft, { dispatch = true } = {}) {
  if (!form || !draft) return false;
  if (dispatch) {
    const EventType = form.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
    // Let the form prepare dependent controls before taking the element snapshot.
    form.dispatchEvent?.(new EventType('setae:form-draft-restoring', {
      detail: { values: draft.values || {} }
    }));
  }
  [...form.elements].forEach((control) => {
    if (isForbiddenControl(control)) return;
    const name = controlName(control);
    if (isMultipleSelect(control)) {
      if (!Array.isArray(draft.selections?.[name])) return;
      const selected = new Set((draft.selections?.[name] || []).map(String));
      [...control.options].forEach((option) => { option.selected = selected.has(String(option.value)); });
    } else if (['checkbox', 'radio'].includes(String(control.type).toLowerCase())) {
      if (!Array.isArray(draft.checks?.[name])) return;
      const checked = new Set((draft.checks?.[name] || []).map(String));
      control.checked = checked.has(String(control.value || '1'));
    } else if (Object.hasOwn(draft.values || {}, name)) {
      control.value = String(draft.values[name] ?? '');
    }
    if (dispatch) {
      const EventType = form.ownerDocument?.defaultView?.Event || globalThis.Event;
      control.dispatchEvent(new EventType('input', { bubbles: true }));
      control.dispatchEvent(new EventType('change', { bubbles: true }));
    }
  });
  if (dispatch) {
    const EventType = form.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
    form.dispatchEvent?.(new EventType('setae:form-draft-restored', {
      bubbles: true,
      detail: { hadFiles: Boolean(draft.hadFiles) }
    }));
  }
  return true;
}

export function draftIsExpired(draft, now = Date.now()) {
  const updatedAt = Date.parse(draft?.updatedAt || '');
  return !Number.isFinite(updatedAt) || now - updatedAt > FORM_DRAFT_TTL_MS;
}

export function purgeExpiredDrafts(storage = globalThis.localStorage, ownerId = 'guest', now = Date.now()) {
  const owner = String(ownerId || 'guest').replace(/[^a-z0-9_-]+/gi, '-');
  const prefix = `${FORM_DRAFT_STORAGE_PREFIX}.${owner}.`;
  const removed = [];
  for (let index = (storage?.length || 0) - 1; index >= 0; index -= 1) {
    const key = storage?.key?.(index);
    if (!key?.startsWith(prefix)) continue;
    let draft = null;
    try { draft = JSON.parse(storage.getItem(key) || 'null'); }
    catch {}
    if (!draft || draftIsExpired(draft, now)) {
      storage.removeItem(key);
      removed.push(key);
    }
  }
  return removed;
}

export function validateForm(form) {
  form?.querySelector('[data-form-error-summary]')?.remove();
  if (!form?.checkValidity || form.checkValidity()) return true;
  const invalid = [...form.querySelectorAll(':invalid')];
  if (!invalid.length) return false;
  const documentRef = form.ownerDocument || globalThis.document;
  const summary = documentRef.createElement('div');
  summary.className = 'form-error-summary';
  summary.dataset.formErrorSummary = 'true';
  summary.setAttribute('role', 'alert');
  const items = invalid.map((control, index) => {
    if (!control.id) control.id = `setae-invalid-field-${index + 1}`;
    control.setAttribute('aria-invalid', 'true');
    return button(control.validationMessage || '入力内容を確認してください。', {
      className: 'text-button',
      data: { 'validation-target': control.id }
    });
  }).join('');
  summary.innerHTML = '<strong>入力内容を確認してください</strong><div>' + items + '</div>';
  form.prepend(summary);
  revealFormControl(invalid[0]);
  invalid[0].scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  invalid[0].focus?.({ preventScroll: true });
  return false;
}

export function serverFieldErrors(error) {
  const source = error?.field_errors || error?.errors || error?.validation || error?.data?.field_errors || {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : String(value || '')]));
}

export function applyServerFieldErrors(form, error) {
  const entries = Object.entries(serverFieldErrors(error));
  if (!form || !entries.length) return false;
  form.querySelector('[data-form-error-summary]')?.remove();
  const documentRef = form.ownerDocument || globalThis.document;
  const items = entries.map(([name, message], index) => {
    const control = [...form.elements].find((item) => item.name === name);
    if (!control) return '';
    if (!control.id) control.id = `setae-server-field-${index + 1}`;
    const messageId = `${control.id}-server-error`;
    control.setAttribute('aria-invalid', 'true');
    const describedBy = new Set(String(control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(messageId);
    control.setAttribute('aria-describedby', [...describedBy].join(' '));
    const field = control.closest('.field');
    field?.classList.add('is-error');
    field?.querySelector(`#${escapeSelector(messageId)}`)?.remove();
    const errorElement = documentRef.createElement('small');
    errorElement.id = messageId;
    errorElement.className = 'field-error server-field-error';
    errorElement.textContent = message || '入力内容を確認してください。';
    field?.append(errorElement);
    return button(message || '入力内容を確認してください。', {
      className: 'text-button',
      data: { 'validation-target': control.id }
    });
  }).filter(Boolean);
  if (!items.length) return false;
  const summary = documentRef.createElement('div');
  summary.className = 'form-error-summary';
  summary.dataset.formErrorSummary = 'true';
  summary.setAttribute('role', 'alert');
  summary.innerHTML = '<strong>入力内容を確認してください</strong><div>' + items.join('') + '</div>';
  form.prepend(summary);
  const first = form.querySelector('[aria-invalid="true"]');
  revealFormControl(first);
  first?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  first?.focus?.({ preventScroll: true });
  return true;
}

export function createFormSafetyController(root, {
  storage = globalThis.localStorage,
  ownerId = () => 'guest',
  now = () => Date.now(),
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  onOverlayChange = () => {}
} = {}) {
  const activeForms = new Map();
  const dirtyKeys = new Set();
  const timers = new Map();
  let guardedAction = null;
  let guardedKeys = [];
  let guardDialog = null;
  let guardReturnFocus = null;
  let beforeUnloadAttached = false;

  const currentOwner = () => typeof ownerId === 'function' ? ownerId() : ownerId;
  const keyFor = (form) => formDraftKey(currentOwner(), form);
  const policyFor = (form) => normalizePolicy(form?.dataset?.draftPolicy);

  const readDraft = (key) => {
    try {
      const value = JSON.parse(storage?.getItem(key) || 'null');
      if (!value || draftIsExpired(value, now())) {
        storage?.removeItem(key);
        return null;
      }
      return value;
    } catch {
      storage?.removeItem(key);
      return null;
    }
  };

  const updateBeforeUnload = () => {
    const shouldAttach = dirtyKeys.size > 0;
    if (shouldAttach === beforeUnloadAttached) return;
    if (shouldAttach) windowRef?.addEventListener('beforeunload', onBeforeUnload);
    else windowRef?.removeEventListener('beforeunload', onBeforeUnload);
    beforeUnloadAttached = shouldAttach;
  };

  function onBeforeUnload(event) {
    if (!dirtyKeys.size) return;
    event.preventDefault();
    event.returnValue = '';
  }

  const dismissDraftNotice = (form) => {
    const active = activeForms.get(keyFor(form));
    if (active) active.draftNoticeDismissed = true;
    form.querySelector('[data-form-draft-notice]')?.remove();
  };

  const markDirty = (form) => {
    if (!form || policyFor(form) === 'none') return false;
    const key = keyFor(form);
    const current = comparableDraft(serializeFormDraft(form));
    let active = activeForms.get(key);
    if (!active || active.element !== form) {
      active = { element: form, baseline: current, dirty: false };
      activeForms.set(key, active);
    }
    const dirty = stable(current) !== stable(active.baseline);
    active.dirty = dirty;
    if (dirty) {
      dirtyKeys.add(key);
      dismissDraftNotice(form);
    }
    else dirtyKeys.delete(key);
    form.dataset.formDirty = dirty ? 'true' : 'false';
    updateBeforeUnload();
    return dirty;
  };

  const persistForm = (form) => {
    if (!form || policyFor(form) !== 'persist' || !markDirty(form)) return;
    const key = keyFor(form);
    const draft = serializeFormDraft(form);
    draft.updatedAt = new Date(now()).toISOString();
    storage?.setItem(key, JSON.stringify(draft));
  };

  const schedulePersist = (form) => {
    const key = keyFor(form);
    windowRef?.clearTimeout(timers.get(key));
    if (policyFor(form) !== 'persist') return;
    timers.set(key, windowRef?.setTimeout(() => {
      timers.delete(key);
      persistForm(form);
    }, FORM_DRAFT_DEBOUNCE_MS));
  };

  const addDraftNotice = (form, draft) => {
    if (form.querySelector('[data-form-draft-notice]')) return;
    const notice = documentRef.createElement('div');
    notice.className = 'form-draft-notice';
    notice.dataset.formDraftNotice = 'true';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `<div><strong>前回の入力を復元できます</strong>${draft.hadFiles ? '<span>画像は復元できません。もう一度選択してください。</span>' : ''}</div><div>${button('復元', { action: 'restore-form-draft' })}${button('下書きを破棄', { action: 'discard-form-draft' })}</div>`;
    const host = form.querySelector('[data-form-notice-host]');
    const heading = [...form.children].find((child) => child.tagName === 'HEADER');
    if (host) host.prepend(notice);
    else if (heading) heading.after(notice);
    else form.prepend(notice);
  };

  const syncForm = (form) => {
    const policy = policyFor(form);
    if (policy === 'none') return;
    const key = keyFor(form);
    const current = comparableDraft(serializeFormDraft(form));
    const previous = activeForms.get(key);
    const baseline = previous?.element === form || previous?.dirty
      ? previous.baseline
      : current;
    activeForms.set(key, { ...previous, element: form, baseline, dirty: Boolean(previous?.dirty) });
    form.dataset.formDraftKey = key;
    const dirty = markDirty(form);
    if (policy === 'persist' && !dirty && !activeForms.get(key)?.draftNoticeDismissed) {
      const draft = readDraft(key);
      if (formDraftHasRestorableChanges(form, draft)) addDraftNotice(form, draft);
      else form.querySelector('[data-form-draft-notice]')?.remove();
    } else {
      form.querySelector('[data-form-draft-notice]')?.remove();
    }
  };

  const sync = () => {
    purgeExpiredDrafts(storage, currentOwner(), now());
    root?.querySelectorAll?.('form').forEach((form) => { form.noValidate = true; });
    const mountedForms = [...(root?.querySelectorAll?.(formSelector) || [])];
    const mountedKeys = new Set();
    mountedForms.forEach((form) => {
      mountedKeys.add(keyFor(form));
      syncForm(form);
    });
    [...activeForms.keys()].forEach((key) => {
      if (mountedKeys.has(key)) return;
      activeForms.delete(key);
      dirtyKeys.delete(key);
      windowRef?.clearTimeout(timers.get(key));
      timers.delete(key);
    });
    updateBeforeUnload();
  };

  const dirtyFormsIn = (scope = root) => {
    if (!scope?.querySelectorAll) return [];
    const forms = [
      ...(scope.matches?.(`${formSelector}[data-form-dirty="true"]`) ? [scope] : []),
      ...scope.querySelectorAll(`${formSelector}[data-form-dirty="true"]`)
    ];
    return [...new Set(forms)].filter((form) => form.isConnected !== false);
  };

  const closeGuard = ({ restoreFocus = false } = {}) => {
    const focusTarget = guardReturnFocus;
    guardDialog?.remove();
    guardDialog = null;
    guardedAction = null;
    guardedKeys = [];
    guardReturnFocus = null;
    onOverlayChange();
    if (restoreFocus && focusTarget?.isConnected) {
      windowRef?.requestAnimationFrame?.(() => focusTarget.focus?.({ preventScroll: true }));
    }
  };

  const cancelGuard = () => {
    if (!guardDialog) return false;
    closeGuard({ restoreFocus: true });
    return true;
  };

  const showGuard = (forms, continuation) => {
    if (guardDialog) return true;
    guardedAction = continuation;
    guardedKeys = forms.map(keyFor);
    const activeElement = documentRef.activeElement?.nodeType === 1
      ? documentRef.activeElement
      : null;
    const activeInsideGuardedForm = activeElement
      && forms.some((form) => form.contains(activeElement))
      && activeElement.matches?.('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])');
    guardReturnFocus = activeInsideGuardedForm
      ? activeElement
      : forms[0]?.querySelector?.('input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])') || forms[0];
    guardDialog = documentRef.createElement('div');
    guardDialog.className = 'modal-backdrop form-safety-backdrop';
    guardDialog.dataset.overlayBackdrop = '';
    const description = forms.length > 1
      ? `保存していない入力が${forms.length}件あります。このまま移動すると入力内容は失われます。`
      : discardConfirmation.description;
    guardDialog.innerHTML = `<section class="modal form-safety-dialog" role="alertdialog" aria-modal="true" aria-labelledby="form-safety-title" aria-describedby="form-safety-description" tabindex="-1" data-modal><div class="modal-header"><h2 id="form-safety-title">${discardConfirmation.title}</h2></div><p id="form-safety-description">${description}</p><div class="modal-actions">${button(discardConfirmation.continueLabel, { action: 'continue-form-editing' })}${button(discardConfirmation.discardLabel, { action: 'confirm-discard-form', className: 'danger-button' })}</div></section>`;
    root.append(guardDialog);
    onOverlayChange();
    guardDialog.querySelector('[data-action="continue-form-editing"]')?.focus();
    return true;
  };

  const guard = (continuation, { scope = root, mode = 'navigation' } = {}) => {
    const forms = dirtyFormsIn(scope);
    if (!forms.length) return false;
    if (forms.some((form) => form.closest('[aria-busy="true"], .is-busy'))) return true;
    return showGuard(forms, continuation, mode);
  };

  const discardByKey = (key) => {
    storage?.removeItem(key);
    dirtyKeys.delete(key);
    activeForms.delete(key);
    windowRef?.clearTimeout(timers.get(key));
    timers.delete(key);
    const form = root.querySelector(`[data-form-draft-key="${escapeSelector(key)}"]`);
    if (form) {
      form.dataset.formDirty = 'false';
      form.querySelector('[data-form-draft-notice]')?.remove();
    }
    updateBeforeUnload();
  };

  const markSubmitted = (formOrKey) => {
    const key = typeof formOrKey === 'string' ? formOrKey : keyFor(formOrKey);
    discardByKey(key);
  };

  const flush = () => root?.querySelectorAll?.(`${formSelector}[data-form-dirty="true"]`).forEach((form) => persistForm(form));

  const onInput = (event) => {
    const form = event.target?.closest?.(formSelector);
    if (!form) return;
    if (event.target.matches?.('[aria-invalid="true"]') && event.target.checkValidity?.()) {
      const describedBy = String(event.target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const serverErrorIds = describedBy.filter((id) => id.endsWith('-server-error'));
      serverErrorIds.forEach((id) => documentRef.getElementById(id)?.remove());
      const remaining = describedBy.filter((id) => !serverErrorIds.includes(id));
      if (remaining.length) event.target.setAttribute('aria-describedby', remaining.join(' '));
      else event.target.removeAttribute('aria-describedby');
      event.target.removeAttribute('aria-invalid');
      event.target.closest('.field')?.classList.remove('is-error');
    }
    markDirty(form);
    schedulePersist(form);
  };

  const onClick = (event) => {
    const action = event.target?.closest?.('[data-action]')?.dataset.action;
    if (action === 'restore-form-draft' || action === 'discard-form-draft') {
      const form = event.target.closest(formSelector);
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = keyFor(form);
      if (action === 'restore-form-draft') {
        const draft = readDraft(key);
        dismissDraftNotice(form);
        if (!markDirty(form) && formDraftHasRestorableChanges(form, draft)) {
          restoreFormDraft(form, draft);
          dirtyKeys.add(key);
          const active = activeForms.get(key);
          if (active) active.dirty = true;
          form.dataset.formDirty = 'true';
          updateBeforeUnload();
        }
      } else {
        storage?.removeItem(key);
        windowRef?.clearTimeout(timers.get(key));
        timers.delete(key);
        dismissDraftNotice(form);
        if (markDirty(form)) schedulePersist(form);
      }
      const firstField = form.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      revealFormControl(firstField);
      firstField?.focus({ preventScroll: true });
      return;
    }
    if (action === 'continue-form-editing' || action === 'confirm-discard-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action === 'continue-form-editing') {
        cancelGuard();
        return;
      }
      const continuation = guardedAction;
      guardedKeys.forEach(discardByKey);
      closeGuard();
      continuation?.();
      return;
    }
    const validationTarget = event.target?.closest?.('[data-validation-target]')?.dataset.validationTarget;
    if (validationTarget) {
      event.preventDefault();
      const control = documentRef.getElementById(validationTarget);
      revealFormControl(control);
      control?.focus();
    }
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !guardDialog) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelGuard();
  };

  root?.addEventListener?.('input', onInput, true);
  root?.addEventListener?.('change', onInput, true);
  root?.addEventListener?.('click', onClick, true);
  documentRef?.addEventListener?.('keydown', onKeyDown, true);

  return {
    sync,
    guard,
    cancelGuard,
    flush,
    markSubmitted,
    discardByKey,
    hasDirty: () => dirtyKeys.size > 0,
    dirtyCount: () => dirtyKeys.size,
    readDraftFor: (form) => readDraft(keyFor(form)),
    activeCount: () => activeForms.size,
    destroy() {
      root?.removeEventListener?.('input', onInput, true);
      root?.removeEventListener?.('change', onInput, true);
      root?.removeEventListener?.('click', onClick, true);
      documentRef?.removeEventListener?.('keydown', onKeyDown, true);
      windowRef?.removeEventListener?.('beforeunload', onBeforeUnload);
      timers.forEach((timer) => windowRef?.clearTimeout(timer));
      closeGuard();
    }
  };
}
