import { escapeHtml } from '../../components/ui.js';
import { button, hiddenField, selectField, textButton, textField } from '../../components/primitives.js';
import {
  normalizeNurseryCareProfile,
  nurseryCareDefinitions,
  nurseryCareRuleKeys,
  nurserySpeciesKey
} from './care-plan.js';

const intervalField = (key, value, { optional = false } = {}) => textField({
    label: nurseryCareDefinitions[key].label,
    name: `care_${key}`,
    type: 'number',
    value: value === undefined && optional ? '' : value,
    min: 0,
    max: 3650,
    required: !optional,
    suffix: '日',
    hint: optional ? '空欄は継承' : '0で予定を作成しません'
  });

const ruleFields = (rules, optional = false) => nurseryCareRuleKeys
  .map((key) => intervalField(key, rules?.[key], { optional }))
  .join('');

const dueSoonField = (value) => textField({
    label: '近日に表示する期間',
    name: 'care_dueSoonDays',
    type: 'number',
    value,
    min: 1,
    max: 30,
    suffix: '日',
    required: true
  });

export function renderNurseryCarePlanSettings(profile, groups = []) {
  const normalized = normalizeNurseryCareProfile(profile);
  const items = Array.isArray(groups) ? groups : groups?.items || [];
  const species = [...new Map(items
    .map((group) => [nurserySpeciesKey(group), group.species_name || `図鑑 #${group.species_id}`])
    .filter(([key]) => key)).entries()];
  return `<div class="care-plan-stack nursery-care-profile">
    <header class="care-plan-heading nursery-care-plan-heading"><span class="eyebrow">ベビー群の飼育ルール</span><h2>ベビー群の作業間隔</h2><p>全体、種、ベビー群の順で上書きします</p></header>
    <form class="care-plan-form nursery-care-form panel-form" data-role="nursery-care-default-form">
      <header class="care-plan-form-heading nursery-care-form-heading"><h3>全体デフォルト</h3><p>群全体の給餌・観察・個体数・環境確認を予定化します</p></header>
      <div class="care-plan-rule-grid care-rule-grid nursery-care-rule-grid">${ruleFields(normalized.defaults)}${dueSoonField(normalized.defaults.dueSoonDays)}</div>
      ${button('ベビー群ルールを保存', { type: 'submit', primary: true })}
    </form>
    <section class="care-plan-overrides nursery-care-overrides">
      <header class="care-plan-form-heading nursery-care-form-heading"><h3>種ごとの上書き</h3><p>空欄は全体デフォルトを使用します</p></header>
      ${Object.entries(normalized.species).map(([key, rules]) => overrideForm('species', key, species.find(([value]) => value === key)?.[1] || key, rules)).join('')}
      ${species.length ? `<form class="care-plan-override-form nursery-care-override-form panel-form" data-role="nursery-care-species-form">${selectField({
        label: '種',
        name: 'key',
        value: '',
        options: [{ value: '', label: '選択してください' }, ...species.map(([key, label]) => ({ value: key, label }))],
        required: true
      })}<div class="care-plan-rule-grid care-rule-grid nursery-care-rule-grid">${ruleFields({}, true)}</div>${button('種ルールを追加', { type: 'submit' })}</form>` : ''}
    </section>
    <section class="care-plan-overrides nursery-care-overrides">
      <header class="care-plan-form-heading nursery-care-form-heading"><h3>個別ベビー群の上書き</h3></header>
      ${Object.entries(normalized.nurseries).map(([key, rules]) => {
        const group = items.find((item) => String(item.id) === key);
        return overrideForm('nursery', key, group?.name || `ベビー群 #${key}`, rules);
      }).join('')}
      ${items.length ? `<form class="care-plan-override-form nursery-care-override-form panel-form" data-role="nursery-care-nursery-form">${selectField({
        label: 'ベビー群',
        name: 'key',
        value: '',
        options: [{ value: '', label: '選択してください' }, ...items.map((group) => ({
          value: group.id,
          label: `${group.name || `ベビー群 #${group.id}`} / ${group.species_name || '種未設定'}`
        }))],
        required: true
      })}<div class="care-plan-rule-grid care-rule-grid nursery-care-rule-grid">${ruleFields({}, true)}</div>${button('個別ルールを追加', { type: 'submit' })}</form>` : ''}
    </section>
  </div>`;
}

function overrideForm(scope, key, label, rules) {
  return `<form class="care-plan-override-form nursery-care-override-form panel-form" data-role="nursery-care-${scope}-form" data-existing="1">
    ${hiddenField('key', key)}
    <div class="care-plan-override-heading nursery-care-override-heading"><strong>${escapeHtml(label)}</strong>${textButton('解除', {
      action: 'remove-nursery-care-override',
      danger: true,
      data: { scope, key }
    })}</div>
    <div class="care-plan-rule-grid care-rule-grid nursery-care-rule-grid">${ruleFields(rules, true)}</div>
    ${button('上書きを保存', { type: 'submit' })}
  </form>`;
}
