import { escapeHtml } from '../../components/ui.js';
import { cardDensityLabel, cardModeLabel } from '../../content/terminology.js';

export function presetSummary(preset) {
  const sections = preset?.dashboard?.sections || [];
  return {
    widgetCount: sections.reduce((count, section) => count + (section.widgets?.length || 0), 0),
    sectionCount: sections.length,
    card: `${cardModeLabel(preset?.animalCard?.mode)} / ${cardDensityLabel(preset?.animalCard?.density)}`,
    savedViewCount: preset?.savedViews?.length || 0,
    quickActionCount: preset?.animalCard?.quickActions?.length || 0
  };
}

export function renderPresetPreview(preset, { compact = false } = {}) {
  if (!preset) return '';
  const summary = presetSummary(preset);
  const widgetNames = (preset.dashboard?.sections || []).flatMap((section) => section.widgets || []).map((widget) => widget.title);
  return `<div class="preset-preview ${compact ? 'is-compact' : ''}">
    <div class="preset-preview-heading"><div><strong>${escapeHtml(preset.title)}</strong><span>${escapeHtml(preset.description)}</span></div><b>${summary.widgetCount}項目</b></div>
    <div class="preset-preview-metrics">
      <div><span>Dashboard</span><strong>${summary.sectionCount} Sections</strong></div>
      <div><span>個体カード</span><strong>${escapeHtml(summary.card)}</strong></div>
      <div><span>Quick Action</span><strong>${summary.quickActionCount}</strong></div>
    </div>
    ${compact ? '' : `<div class="preset-preview-detail"><div><span>主な表示項目</span><p>${widgetNames.map(escapeHtml).join(' / ')}</p></div><div><span>コレクション表示</span><p>${(preset.viewHighlights || []).map(escapeHtml).join(' / ')}</p></div></div>`}
  </div>`;
}
