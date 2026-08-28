import { escapeHtml } from '../../components/ui.js';
import { button, contentAction, textButton } from '../../components/primitives.js';
import { setaePresetIds, setaePresets } from './presets.js';
import { presetSummary, renderPresetPreview } from './preset-preview.js';
import { icon } from '../../components/icons.js';
import { cardDensityLabel, cardModeLabel } from '../../content/terminology.js';

function presetChoices(selectedId, currentId = '') {
  return `<div class="setae-preset-grid">${setaePresetIds.map((id) => {
    const preset = setaePresets[id];
    const selected = selectedId === id;
    const current = currentId === id;
    const contentHtml = `<span class="preset-option-mark" aria-hidden="true">${icon(({ simple: 'check', collection: 'collection', breeder: 'pairing', research: 'growth' })[id])}</span><span><strong>${escapeHtml(preset.title)}</strong><small>${escapeHtml(preset.description)}</small></span>${current ? '<b>現在</b>' : ''}`;
    return contentAction({
      contentHtml,
      action: 'preview-setae-preset',
      data: { 'preset-id': id },
      className: `setae-preset-option ${selected ? 'is-selected' : ''}`,
      ariaLabel: `${preset.title}をプレビュー`,
      pressed: selected
    });
  }).join('')}</div>`;
}

export function renderMySetae({ personalization, dashboard, animalCardConfig, savedViewCount = 0 } = {}) {
  const selectedId = personalization?.previewPresetId || (setaePresetIds.includes(personalization?.presetId) ? personalization.presetId : 'simple');
  const selectedPreset = setaePresets[selectedId];
  const basePreset = setaePresets[personalization?.presetId];
  const currentTitle = personalization?.customized || !basePreset ? 'カスタム' : basePreset.title;
  const currentNote = personalization?.customized && basePreset ? `${basePreset.title}をベースに調整中` : basePreset?.description || '自分で細かく設定';
  const dashboardWidgets = (dashboard?.sections || []).reduce((count, section) => count + (section.widgets?.length || 0), 0);
  const cardSummary = `${cardModeLabel(animalCardConfig?.mode)} / ${cardDensityLabel(animalCardConfig?.density)}`;

  return `<div class="my-setae-layout">
    <section class="my-setae-current">
      <div><div class="eyebrow">MY SETAE</div><h2>${escapeHtml(currentTitle)}</h2><p>${escapeHtml(currentNote)}</p></div>
      <div class="my-setae-summary">
        <div><span>今日の画面</span><strong>${dashboardWidgets}項目</strong>${textButton('編集', { action: 'open-personalization-dashboard' })}</div>
        <div><span>個体カード</span><strong>${escapeHtml(cardSummary)}</strong>${textButton('編集', { action: 'open-personalization-card' })}</div>
        <div><span>保存した絞り込み</span><strong>${savedViewCount}件</strong>${textButton('編集', { action: 'open-personalization-views' })}</div>
        <div><span>お世話判定</span><strong>飼育ルール</strong>${textButton('編集', { action: 'open-care-profile' })}</div>
      </div>
      <div class="my-setae-onboarding-action">${button('はじめに戻る', { action: 'reopen-onboarding' })}</div>
    </section>
    <section class="my-setae-presets">
      <div class="section-header"><div><div class="section-title">飼育スタイル</div><div class="secondary">用途を選ぶと、表示設定をまとめて変更します</div></div></div>
      ${presetChoices(selectedId, personalization?.customized ? '' : personalization?.presetId)}
      <div class="my-setae-preview-panel">
        ${renderPresetPreview(selectedPreset)}
        <p>${escapeHtml(selectedPreset.note)}</p>
        ${button(`${selectedPreset.title}を適用`, { action: 'apply-setae-preset', data: { 'preset-id': selectedId }, primary: true })}
      </div>
    </section>
  </div>`;
}

export function renderSetaeSetup({ selectedPresetId = 'simple', step = 'preset', intent = 'explore', hasExistingData = false } = {}) {
  const selectedId = setaePresetIds.includes(selectedPresetId) ? selectedPresetId : 'simple';
  const selectedPreset = setaePresets[selectedId];
  const summary = presetSummary(selectedPreset);
  const startChoices = [
    ...(hasExistingData ? [{ id: 'explore', title: '現在のデータから始める', description: 'Todayを開き、登録済みの個体と記録を確認します', iconName: 'today' }] : []),
    { id: 'animal', title: '個体を登録する', description: '最初の個体番号と種を登録します', iconName: 'collection' },
    { id: 'nursery', title: 'ベビー群を登録する', description: '孵化したベビーを番号単位で管理します', iconName: 'growth' },
    ...(!hasExistingData ? [{ id: 'explore', title: '画面を見てから決める', description: 'Todayを開き、後から登録します', iconName: 'today' }] : [])
  ];
  return `<div class="setup-backdrop">
    <section class="setae-setup" role="dialog" aria-modal="true" aria-labelledby="setae-setup-title">
      <div class="setup-heading"><div class="eyebrow">MY SETAE · 手順 ${step === 'start' ? '2' : '1'} / 2</div><h1 id="setae-setup-title">${step === 'start' ? '最初に何をしますか？' : 'SETAEへようこそ'}</h1><p>${step === 'start' ? '選んだ作業を開いた状態で始めます。' : '飼育スタイルに合わせて、最初の画面を整えます。'}</p></div>
      ${step === 'start'
        ? `<div class="setae-setup-intents">${startChoices.map((choice) => contentAction({
            contentHtml: `<span class="preset-option-mark" aria-hidden="true">${icon(choice.iconName)}</span><span><strong>${escapeHtml(choice.title)}</strong><small>${escapeHtml(choice.description)}</small></span>`,
            action: 'setae-setup-intent',
            data: { intent: choice.id },
            className: `setae-setup-intent ${intent === choice.id ? 'is-selected' : ''}`,
            ariaLabel: choice.title,
            pressed: intent === choice.id
          })).join('')}</div>`
        : `${presetChoices(selectedId)}${renderPresetPreview(selectedPreset, { compact: true })}`}
      <div class="setup-actions">${step === 'start' ? textButton('戻る', { action: 'setae-setup-back' }) : textButton('この設定で画面を見る', { action: 'dismiss-setae-setup' })}${button(step === 'start' ? 'この内容で始める' : '次へ', { action: step === 'start' ? 'finish-setae-setup' : 'setae-setup-next', data: { 'preset-id': selectedId }, primary: true })}</div>
      <small>${step === 'start' ? '後から「はじめに戻る」で再表示できます。' : `今日の画面 ${summary.widgetCount}項目、カード ${escapeHtml(summary.card)}。まだ設定は確定しません。`}</small>
    </section>
  </div>`;
}
