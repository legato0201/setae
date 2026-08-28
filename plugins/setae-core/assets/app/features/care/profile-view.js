import { animalCode, escapeHtml, scientificName } from '../../components/ui.js';
import {
  button,
  checkboxControl,
  hiddenField,
  selectField,
  textButton,
  textField
} from '../../components/primitives.js';
import { careSpeciesKey, defaultCareRules, normalizeCareProfile } from './profile.js';

const numberField = (name, label, value, { min = 1, max = 365, optional = false } = {}) => textField({
  label,
  name,
  type: 'number',
  value: value === undefined && optional ? '' : value,
  min,
  max,
  required: !optional,
  suffix: '日',
  hint: optional ? '空欄は継承' : ''
});

const overrideFields = (rules = {}) => `${numberField('feedIntervalDays', '給餌間隔', rules.feedIntervalDays, { optional: true })}${numberField('observationIntervalDays', '観察間隔', rules.observationIntervalDays, { optional: true })}${numberField('postMoltFeedDelayDays', '脱皮後の給餌休止', rules.postMoltFeedDelayDays, { min: 0, max: 90, optional: true })}`;

export function renderCareProfileSettings(profile, animals = []) {
  const normalized = normalizeCareProfile(profile);
  const species = [...new Map(animals.map((animal) => [careSpeciesKey(animal), animal]).filter(([key]) => key)).entries()];
  return `<div class="care-plan-stack care-profile-settings">
    <header class="care-plan-heading"><span class="eyebrow">個体の飼育ルール</span><h2>個体の作業間隔</h2><p>全体、種、個体の順で上書きします</p></header>
    <form class="care-plan-form panel-form" data-role="care-profile-default-form">
      <header class="care-plan-form-heading"><h3>全体デフォルト</h3><p>種・個体の設定がない場合に使用します</p></header>
      <div class="care-plan-rule-grid">${numberField('feedIntervalDays', '給餌間隔', normalized.defaults.feedIntervalDays)}${numberField('observationIntervalDays', '観察間隔', normalized.defaults.observationIntervalDays)}${numberField('preMoltObservationDays', '脱皮前の確認間隔', normalized.defaults.preMoltObservationDays, { max: 30 })}${numberField('postMoltFeedDelayDays', '脱皮後の給餌休止', normalized.defaults.postMoltFeedDelayDays, { min: 0, max: 90 })}${numberField('dueSoonDays', '近日に表示する期間', normalized.defaults.dueSoonDays, { max: 30 })}</div>
      ${checkboxControl({ checked: normalized.defaults.excludePreMoltFeed, label: '脱皮前は給餌対象から除外する', name: 'excludePreMoltFeed', value: 'on' })}
      ${button('ルールを保存', { type: 'submit', primary: true })}
    </form>

    <section class="care-plan-overrides">
      <header class="care-plan-form-heading"><h3>種ごとの上書き</h3><p>空欄は全体デフォルトを使用します</p></header>
      ${Object.entries(normalized.species).map(([key, rules]) => overrideForm('species', key, species.find(([itemKey]) => itemKey === key)?.[1]?.species_name || key, rules)).join('')}
      <form class="care-plan-override-form panel-form" data-role="care-profile-species-form">
        ${selectField({ label: '種', name: 'key', value: '', options: [{ value: '', label: '選択してください' }, ...species.map(([key, animal]) => ({ value: key, label: scientificName(animal) }))], required: true })}
        <div class="care-plan-rule-grid">${overrideFields()}</div>
        ${button('種の設定を追加', { type: 'submit' })}
      </form>
    </section>

    <section class="care-plan-overrides">
      <header class="care-plan-form-heading"><h3>個体ごとの上書き</h3><p>最も優先される設定です</p></header>
      ${Object.entries(normalized.animals).map(([key, rules]) => {
        const animal = animals.find((item) => String(item.id) === key);
        return overrideForm('animal', key, animal ? `${animalCode(animal)} / ${scientificName(animal)}` : `#${key}`, rules);
      }).join('')}
      <form class="care-plan-override-form panel-form" data-role="care-profile-animal-form">
        ${selectField({ label: '個体', name: 'key', value: '', options: [{ value: '', label: '選択してください' }, ...animals.map((animal) => ({ value: animal.id, label: `${animalCode(animal)} / ${scientificName(animal)}` }))], required: true })}
        <div class="care-plan-rule-grid">${overrideFields()}</div>
        ${button('個体の設定を追加', { type: 'submit' })}
      </form>
    </section>
    <p class="care-plan-order">適用順: 全体デフォルト、種、個体</p>
  </div>`;
}

function overrideForm(scope, key, label, rules) {
  return `<form class="care-plan-override-form panel-form" data-role="care-profile-${scope}-form" data-existing="1">
    ${hiddenField('key', key)}
    <div class="care-plan-override-heading"><strong>${escapeHtml(label)}</strong>${textButton('解除', {
      action: 'remove-care-profile-override',
      danger: true,
      data: { scope, key }
    })}</div>
    <div class="care-plan-rule-grid">${overrideFields(rules)}</div>
    ${button('上書きを保存', { type: 'submit' })}
  </form>`;
}

export { defaultCareRules };
