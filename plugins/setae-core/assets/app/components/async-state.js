const pendingForms = new WeakMap();
const pendingDialogs = new WeakMap();

const controlsIn = (root) => [...root.querySelectorAll('input, select, textarea, button')];
const isSubmitter = (control) => (
  (control instanceof HTMLButtonElement && control.type === 'submit')
  || (control instanceof HTMLInputElement && control.type === 'submit')
);

export function captureFormState(form) {
  if (!(form instanceof HTMLFormElement)) return [];
  return [...form.querySelectorAll('input, select, textarea')].map((control) => ({
    name: control.name,
    type: control.type,
    value: control.type === 'file' ? '' : control.value,
    checked: 'checked' in control ? control.checked : false,
    selected: control instanceof HTMLSelectElement
      ? [...control.options].map((option) => option.selected)
      : []
  }));
}

export function restoreFormState(form, snapshot = []) {
  if (!(form instanceof HTMLFormElement) || !Array.isArray(snapshot)) return;
  const controls = [...form.querySelectorAll('input, select, textarea')];
  snapshot.forEach((saved, index) => {
    const control = controls[index];
    if (!control || control.name !== saved.name || control.type !== saved.type || control.type === 'file') return;
    if (control instanceof HTMLSelectElement) {
      [...control.options].forEach((option, optionIndex) => {
        option.selected = Boolean(saved.selected[optionIndex]);
      });
      return;
    }
    if ('checked' in control && ['checkbox', 'radio'].includes(control.type)) control.checked = Boolean(saved.checked);
    else control.value = saved.value;
  });
}

export function setFormPending(form, pending, { label = '保存中…' } = {}) {
  if (!(form instanceof HTMLFormElement)) return;
  const controls = controlsIn(form);

  if (pending) {
    if (form.dataset.pending === 'true') return;
    pendingForms.set(form, controls.map((control) => ({
      control,
      html: isSubmitter(control) && control instanceof HTMLButtonElement ? control.innerHTML : '',
      value: isSubmitter(control) && control instanceof HTMLInputElement ? control.value : '',
      busyInlineSize: control.style.getPropertyValue('--button-busy-inline-size'),
      disabled: control.disabled
    })));
    form.dataset.pending = 'true';
    form.setAttribute('aria-busy', 'true');
    controls.forEach((control) => {
      control.disabled = true;
      if (isSubmitter(control)) {
        control.style.setProperty('--button-busy-inline-size', `${Math.ceil(control.getBoundingClientRect().width)}px`);
        control.classList.add('is-pending');
        if (control instanceof HTMLButtonElement) {
          control.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${label}</span>`;
        } else {
          control.value = label;
        }
      }
    });
    return;
  }

  form.dataset.pending = 'false';
  form.removeAttribute('aria-busy');
  (pendingForms.get(form) || []).forEach(({ control, html, value, busyInlineSize, disabled }) => {
    if (!control.isConnected) return;
    control.disabled = disabled;
    if (!isSubmitter(control)) return;
    control.classList.remove('is-pending');
    if (busyInlineSize) control.style.setProperty('--button-busy-inline-size', busyInlineSize);
    else control.style.removeProperty('--button-busy-inline-size');
    if (control instanceof HTMLButtonElement) control.innerHTML = html;
    else control.value = value;
  });
  pendingForms.delete(form);
}

export function setDialogPending(panel, pending, { label = '保存しています…' } = {}) {
  if (!(panel instanceof HTMLElement) || !panel.matches('.modal, .sheet')) return;
  if (pending) {
    if (!pendingDialogs.has(panel)) {
      pendingDialogs.set(panel, controlsIn(panel).map((control) => ({ control, disabled: control.disabled })));
    }
    panel.classList.add('is-busy');
    panel.setAttribute('aria-busy', 'true');
    controlsIn(panel).forEach((control) => { control.disabled = true; });
    if (![...panel.children].some((child) => child.classList?.contains('dialog-busy-shield'))) {
      const shield = document.createElement('div');
      shield.className = 'dialog-busy-shield';
      shield.setAttribute('role', 'status');
      shield.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.textContent = panel.dataset.busyLabel || label;
      shield.append(spinner, copy);
      panel.append(shield);
    }
    return;
  }

  panel.classList.remove('is-busy');
  panel.removeAttribute('aria-busy');
  [...panel.children].find((child) => child.classList?.contains('dialog-busy-shield'))?.remove();
  (pendingDialogs.get(panel) || []).forEach(({ control, disabled }) => {
    if (control.isConnected) control.disabled = disabled;
  });
  pendingDialogs.delete(panel);
}

export function syncBusyDialogControls(root) {
  if (!(root instanceof HTMLElement)) return;
  root.querySelectorAll('.modal.is-busy[aria-busy="true"], .sheet.is-busy[aria-busy="true"]')
    .forEach((panel) => setDialogPending(panel, true, { label: panel.dataset.busyLabel || '保存しています…' }));
}
