import { escapeHtml } from '../../components/ui.js';
import { button, hiddenField, selectField, textButton, textField } from '../../components/primitives.js';
import {
  enclosureCareDefinitions,
  enclosureCareRuleKeys,
  normalizeEnclosureCareProfile
} from './care-plan.js';

const enclosureTypeOptions = [
  { value: 'unspecified', label: '種類未設定' },
  { value: 'acrylic', label: 'アクリル容器' },
  { value: 'glass', label: 'ガラス容器' },
  { value: 'plastic', label: 'プラケース' },
  { value: 'terrarium', label: 'テラリウム' },
  { value: 'vial', label: 'バイアル' },
  { value: 'rack_tub', label: 'ラックケース' },
  { value: 'custom', label: 'カスタム容器' }
];

const intervalField = (key, value, { optional = false } = {}) => textField({
  label: enclosureCareDefinitions[key].label,
  name: `care_${key}`,
  type: 'number',
  value: value === undefined && optional ? '' : value,
  min: 0,
  max: 3650,
  required: !optional,
  suffix: '日',
  hint: optional ? '空欄は継承' : '0で予定を作成しません'
});

const ruleFields = (rules, optional = false) => enclosureCareRuleKeys
  .map((key) => intervalField(key, rules?.[key], { optional }))
  .join('');

const dueSoonField = (value) => textField({
  label: '近日に表示する期間',
  name: 'care_dueSoonDays',
  type: 'number',
  value,
  min: 1,
  max: 30,
  required: true,
  suffix: '日'
});

export function renderEnclosureCarePlanSettings(profile, enclosures = []) {
  const normalized = normalizeEnclosureCareProfile(profile);
  const items = Array.isArray(enclosures) ? enclosures : enclosures?.items || [];
  return `<div class="care-plan-stack enclosure-care-profile">
    <header class="care-plan-heading"><span class="eyebrow">飼育容器の飼育ルール</span><h2>飼育容器の作業間隔</h2><p>全体、容器種別、個別容器の順で上書きします</p></header>
    <form class="care-plan-form panel-form" data-role="enclosure-care-default-form">
      <header class="care-plan-form-heading"><h3>全体デフォルト</h3><p>0日の作業はTodayに表示しません</p></header>
      <div class="care-plan-rule-grid">${ruleFields(normalized.defaults)}${dueSoonField(normalized.defaults.dueSoonDays)}</div>
      ${button('容器ルールを保存', { type: 'submit', primary: true })}
    </form>

    <section class="care-plan-overrides">
      <header class="care-plan-form-heading"><h3>容器種別ごとの上書き</h3><p>空欄は全体デフォルトを使用します</p></header>
      ${Object.entries(normalized.types).map(([key, rules]) => overrideForm('type', key, enclosureTypeOptions.find((item) => item.value === key)?.label || key, rules)).join('')}
      <form class="care-plan-override-form panel-form" data-role="enclosure-care-type-form">
        ${selectField({ label: '容器種別', name: 'key', value: '', options: [{ value: '', label: '選択してください' }, ...enclosureTypeOptions], required: true })}
        <div class="care-plan-rule-grid">${ruleFields({}, true)}</div>
        ${button('種別ルールを追加', { type: 'submit' })}
      </form>
    </section>

    <section class="care-plan-overrides">
      <header class="care-plan-form-heading"><h3>個別容器の上書き</h3><p>容器の設定画面からも変更できます</p></header>
      ${Object.entries(normalized.enclosures).map(([key, rules]) => {
        const enclosure = items.find((item) => String(item.id) === key);
        return overrideForm('enclosure', key, enclosure ? `${enclosure.code} / ${enclosure.name || enclosure.type_label}` : `#${key}`, rules);
      }).join('')}
      ${items.length ? `<form class="care-plan-override-form panel-form" data-role="enclosure-care-enclosure-form">
        ${selectField({ label: '飼育容器', name: 'key', value: '', options: [{ value: '', label: '選択してください' }, ...items.map((item) => ({ value: item.id, label: `${item.code} / ${item.name || item.type_label}` }))], required: true })}
        <div class="care-plan-rule-grid">${ruleFields({}, true)}</div>
        ${button('個別ルールを追加', { type: 'submit' })}
      </form>` : ''}
    </section>
  </div>`;
}

function overrideForm(scope, key, label, rules) {
  return `<form class="care-plan-override-form panel-form" data-role="enclosure-care-${scope}-form" data-existing="1">
    ${hiddenField('key', key)}
    <div class="care-plan-override-heading"><strong>${escapeHtml(label)}</strong>${textButton('解除', {
      action: 'remove-enclosure-care-override',
      danger: true,
      data: { scope, key }
    })}</div>
    <div class="care-plan-rule-grid">${ruleFields(rules, true)}</div>
    ${button('上書きを保存', { type: 'submit' })}
  </form>`;
}
