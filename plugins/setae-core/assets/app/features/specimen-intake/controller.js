import { setDialogPending, setFormPending } from '../../components/async-state.js';
import { revealFormControl } from '../../components/form-disclosure.js';
import { specimenHasPhoto, specimenSectionHasValues } from './model.js';
import { syncSpecimenTransferControl } from '../specimen/public-settings.js';

const asText = (value) => String(value ?? '');

export function createSpecimenIntakeController({
  appRoot,
  getModalState,
  updateModalState,
  renderSpeciesRegion,
  speciesCombobox,
  formSafety
} = {}) {
  let form = null;
  let backdropAction = '';
  let draftImageMissing = false;

  const modalState = () => getModalState?.() || {};

  function commit(updater) {
    const current = modalState();
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) };
    updateModalState?.(next);
    return next;
  }

  function currentForm() {
    return form?.isConnected ? form : null;
  }

  function speciesRegion() {
    return currentForm()?.querySelector('[data-specimen-intake-region="species"]') || null;
  }

  function scrollBody() {
    return currentForm()?.querySelector('.specimen-intake-body') || null;
  }

  function patchSpecies(nextState, { focus = '', preserveFocus = false } = {}) {
    const region = speciesRegion();
    if (!region || typeof renderSpeciesRegion !== 'function') return false;
    const mountedForm = currentForm();
    const body = scrollBody();
    const scrollTop = body?.scrollTop || 0;
    const active = currentForm()?.ownerDocument?.activeElement || null;
    region.innerHTML = renderSpeciesRegion(nextState);
    if (body) body.scrollTop = scrollTop;
    formSafety?.sync?.();
    if (focus) {
      requestAnimationFrame(() => {
        if (currentForm() === mountedForm) mountedForm?.querySelector(focus)?.focus({ preventScroll: true });
      });
    } else if (preserveFocus && active?.isConnected) {
      active.focus({ preventScroll: true });
    }
    return true;
  }

  function customSpeciesValue() {
    return asText(currentForm()?.elements?.custom_species?.value).trim();
  }

  function selectedSpeciesName(state = modalState()) {
    return asText(state.selectedSpecies?.scientific_name || customSpeciesValue() || state.data?.custom_species).trim();
  }

  function mount(root) {
    const nextForm = root?.matches?.('[data-specimen-intake-root]')
      ? root
      : root?.querySelector?.('[data-specimen-intake-root]');
    if (!nextForm || nextForm === form) return form;
    detachForm();
    form = nextForm;
    form.dataset.specimenIntakeMounted = 'true';
    form.addEventListener('invalid', revealInvalidControl, true);
    form.addEventListener('setae:form-draft-restoring', prepareDraftRestore);
    form.addEventListener('setae:form-draft-restored', completeDraftRestore);
    form.addEventListener('change', updateTransferAvailability);
    return form;
  }

  function detachForm() {
    form?.removeEventListener('invalid', revealInvalidControl, true);
    form?.removeEventListener('setae:form-draft-restoring', prepareDraftRestore);
    form?.removeEventListener('setae:form-draft-restored', completeDraftRestore);
    form?.removeEventListener('change', updateTransferAvailability);
    form = null;
    draftImageMissing = false;
    backdropAction = '';
  }

  function destroy() {
    speciesCombobox?.clear?.({ notify: false });
    detachForm();
  }

  function revealInvalidControl(event) {
    revealFormControl(event.target);
  }

  function updateTransferAvailability(event) {
    if (event.target?.name === 'archived') syncSpecimenTransferControl(currentForm(), modalState().data);
  }

  function prepareDraftRestore(event) {
    if (event.target !== currentForm()) return;
    delete currentForm().dataset.publicTransferBeforeArchive;
    const values = event.detail?.values || {};
    const previous = modalState();
    const classification = asText(values.classification || previous.classification || 'tarantula');
    const id = Number((Object.hasOwn(values, 'species_id') ? values.species_id : previous.speciesId || previous.data?.species_id) || 0);
    const speciesId = classification === 'tarantula' && Number.isSafeInteger(id) && id > 0 ? id : '';
    const customSpecies = asText(Object.hasOwn(values, 'custom_species') ? values.custom_species : previous.data?.custom_species).trim();
    const knownSpecies = Number(previous.selectedSpecies?.id) === speciesId ? previous.selectedSpecies : null;
    speciesCombobox?.clear?.({ notify: false });
    const next = commit((state) => ({
      ...state,
      classification,
      speciesId,
      selectedSpecies: speciesId ? knownSpecies || {
        id: speciesId,
        ja_name: Number(state.data?.species_id) === speciesId ? state.data.species_name_ja || '' : '',
        scientific_name: Number(state.data?.species_id) === speciesId ? state.data.species_name || '' : '',
      } : null,
      speciesMode: classification !== 'tarantula' || (!speciesId && customSpecies) ? 'manual' : 'catalog',
      data: { ...(state.data || {}), classification, species_id: speciesId, custom_species: customSpecies }
    }));
    patchSpecies(next);
  }

  function completeDraftRestore(event) {
    const target = currentForm();
    if (!target || event.target !== target) return;
    const file = target.elements.image?.files?.[0] || null;
    draftImageMissing = Boolean(event.detail?.hadFiles) && !file;
    target.dataset.draftHadFile = String(draftImageMissing);
    setFileStatus(file);
    syncSpecimenTransferControl(target, modalState().data);
    const values = Object.fromEntries(new FormData(target));
    const hasImage = Boolean(file) || draftImageMissing || specimenHasPhoto(modalState().data);
    target.querySelectorAll('[data-specimen-intake-section]').forEach((section) => {
      if (specimenSectionHasValues(section.dataset.specimenIntakeSection, values, { hasImage })) section.open = true;
    });
    if (!target.contains(target.ownerDocument?.activeElement)) target.elements.name?.focus?.({ preventScroll: true });
  }

  function setClassification(value) {
    const classification = asText(value || 'tarantula');
    if (classification === (modalState().classification || modalState().data?.classification || 'tarantula')) return;
    const previousSpecies = selectedSpeciesName();
    speciesCombobox?.clear?.({ notify: false });
    const next = commit((state) => ({
      ...state,
      classification,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: classification === 'tarantula' && !previousSpecies ? 'catalog' : 'manual',
      data: {
        ...(state.data || {}),
        classification,
        species_id: '',
        custom_species: previousSpecies
      }
    }));
    clearError();
    patchSpecies(next, { preserveFocus: true });
  }

  function showCatalog() {
    speciesCombobox?.clear?.({ notify: false });
    const next = commit((state) => ({
      ...state,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: 'catalog',
      data: { ...(state.data || {}), species_id: '', custom_species: '' }
    }));
    clearError();
    patchSpecies(next, { focus: '[data-role="species-combobox-input"]' });
  }

  function showManual() {
    const previousSpecies = selectedSpeciesName();
    speciesCombobox?.clear?.({ notify: false });
    const next = commit((state) => ({
      ...state,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: 'manual',
      data: { ...(state.data || {}), species_id: '', custom_species: previousSpecies }
    }));
    clearError();
    patchSpecies(next, { focus: '[name="custom_species"]' });
  }

  function clearSpecies() {
    showCatalog();
  }

  function selectSpecies(item) {
    if (!item?.id) return false;
    speciesCombobox?.clear?.({ notify: false });
    const next = commit((state) => ({
      ...state,
      classification: 'tarantula',
      speciesMode: 'catalog',
      speciesId: item.id,
      selectedSpecies: item,
      data: { ...(state.data || {}), classification: 'tarantula', species_id: item.id, custom_species: '' }
    }));
    clearError();
    patchSpecies(next, { focus: '[data-action="change-specimen-species"]' });
    return true;
  }

  function setPending(pending, label = '保存中…') {
    const target = currentForm();
    if (!target) return;
    const panel = target.closest('.modal, .sheet');
    const backdrop = target.closest('[data-overlay-backdrop]');
    const busyRegion = target.querySelector('[data-specimen-intake-region="busy"]');
    if (pending) {
      backdropAction = backdrop?.dataset.backdropAction || '';
      backdrop?.removeAttribute('data-backdrop-action');
      if (busyRegion) {
        busyRegion.hidden = false;
        busyRegion.textContent = label;
      }
    } else {
      if (backdrop && backdropAction) backdrop.dataset.backdropAction = backdropAction;
      if (busyRegion) {
        busyRegion.hidden = true;
        busyRegion.textContent = '';
      }
      backdropAction = '';
    }
    if (pending) {
      setFormPending(target, true, { label });
      setDialogPending(panel, true, { label });
    } else {
      // The dialog snapshots controls after the form disables them. Restore the
      // outer dialog first so the form can apply each control's original state.
      setDialogPending(panel, false, { label });
      setFormPending(target, false, { label });
    }
  }

  function clearError() {
    const region = currentForm()?.querySelector('[data-specimen-intake-region="error"]');
    if (region) {
      region.hidden = true;
      region.textContent = '';
    }
    currentForm()?.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute('aria-invalid'));
    if (region?.id) {
      currentForm()?.querySelectorAll('[aria-describedby]').forEach((control) => {
        const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== region.id);
        if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
        else control.removeAttribute('aria-describedby');
      });
    }
    commit((state) => ({ ...state, error: null }));
  }

  function focusSpecies() {
    const target = currentForm()?.querySelector('[name="custom_species"]:not([type="hidden"]), [data-role="species-combobox-input"], [data-action="change-specimen-species"]');
    revealFormControl(target);
    target?.focus?.({ preventScroll: true });
    (target?.closest?.('.field') || target)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return target;
  }

  function setError(message, field = '') {
    const target = currentForm();
    if (!target) return;
    const region = target.querySelector('[data-specimen-intake-region="error"]');
    if (region) {
      region.hidden = false;
      region.textContent = asText(message || '入力内容を確認してください。');
    }
    commit((state) => ({ ...state, error: asText(message || '') }));
    let control = field ? target.elements?.namedItem?.(field) : target.querySelector('[aria-invalid="true"]');
    if (control && typeof control.focus === 'function' && control.type !== 'hidden') {
      revealFormControl(control);
      control.focus({ preventScroll: true });
      (control.closest?.('.field') || control).scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    } else if (['species_id', 'species_query', 'custom_species'].includes(field || control?.name)) {
      control = focusSpecies();
    } else {
      region?.focus?.({ preventScroll: true });
    }
    if (control && control.type !== 'hidden') {
      control.setAttribute('aria-invalid', 'true');
      if (region?.id) {
        const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        ids.add(region.id);
        control.setAttribute('aria-describedby', [...ids].join(' '));
      }
    }
  }

  function setFileStatus(file) {
    const target = currentForm();
    const region = target?.querySelector('[data-specimen-intake-region="file-status"]');
    if (!region) return;
    if (file) {
      draftImageMissing = false;
      target.dataset.draftHadFile = 'false';
    }
    region.hidden = !file && !draftImageMissing;
    region.textContent = file ? `${file.name}を選択しています。` : draftImageMissing ? '写真は復元できません。もう一度選択してください。' : '';
  }

  function validate() {
    const target = currentForm();
    if (!target) return false;
    const data = new FormData(target);
    const classification = asText(data.get('classification') || 'tarantula');
    const speciesId = Number(data.get('species_id') || 0);
    const customSpecies = asText(data.get('custom_species')).trim();
    if (classification === 'tarantula' && !speciesId && !customSpecies) {
      setError('図鑑から種を選ぶか、図鑑未登録の種名を入力してください。', 'species_query');
      return false;
    }
    clearError();
    return true;
  }

  function snapshot() {
    const target = currentForm();
    if (!target) return null;
    const values = {};
    new FormData(target).forEach((value, key) => {
      if (globalThis.File && value instanceof globalThis.File) return;
      values[key] = value;
    });
    return {
      values,
      file: target.elements?.image?.files?.[0] || null,
      activeName: target.ownerDocument?.activeElement?.name || '',
      selectionStart: target.ownerDocument?.activeElement?.selectionStart ?? null,
      selectionEnd: target.ownerDocument?.activeElement?.selectionEnd ?? null,
      scrollTop: scrollBody()?.scrollTop || 0
    };
  }

  return {
    mount,
    destroy,
    setClassification,
    showCatalog,
    showManual,
    clearSpecies,
    selectSpecies,
    setPending,
    setError,
    clearError,
    setFileStatus,
    snapshot,
    focusSpecies,
    validate,
    get form() { return currentForm(); },
    get mounted() { return Boolean(currentForm()); },
    appRoot
  };
}
