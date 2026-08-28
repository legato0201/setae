import { escapeHtml } from '../components/ui.js';
import { button, iconButton } from '../components/primitives.js';
import { getWidgetDefinition, renderWidgetContent } from '../widgets/registry.js';
import { renderTaskWorkQueue } from '../features/tasks/view.js';
import { renderGettingStarted } from '../features/onboarding/view.js';
import { renderArrivalChecklist } from '../features/onboarding/arrival.js';
import '../widgets/core.js';

export function renderToday({
  summary,
  animals = [],
  babyGroups,
  feeders,
  enclosures,
  records = [],
  careModel,
  taskQueueVisible = true,
  taskPreferences = {},
  dashboard,
  dashboardEditing = false,
  onboardingProgress = null,
  arrivalContext = {}
}) {
  const context = { summary, animals, babyGroups, feeders, enclosures, records, care: careModel };
  const now = new Date();
  const dateTitle = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' }).format(now);
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(now);
  const dateTime = now.toLocaleDateString('sv-SE');

  return `
    <div class="page dashboard-page today-workbench">
      <header class="page-header journal-header">
        <div>
          <div class="eyebrow">FIELD NOTEBOOK</div>
          <h1 class="journal-date-title"><time datetime="${escapeHtml(dateTime)}">${escapeHtml(dateTitle)}</time></h1>
          <div class="journal-date-meta">${escapeHtml(weekday)} · ${escapeHtml(now.getFullYear())}</div>
        </div>
        ${button(dashboardEditing ? '編集を完了' : '表示を調整', { action: dashboardEditing ? 'finish-dashboard-edit' : 'edit-dashboard', className: 'text-button journal-edit-button' })}
      </header>

      ${onboardingProgress ? renderGettingStarted(onboardingProgress) : ''}
      ${renderArrivalChecklist({ animals, records, ...arrivalContext })}
      ${taskQueueVisible ? renderTaskWorkQueue(careModel, taskPreferences) : ''}

      ${dashboardEditing ? `
        <div class="dashboard-edit-banner">
          <div><strong>二次情報を編集中</strong><div class="secondary">今日のお世話の下に表示する記録を調整します。</div></div>
          <div class="inline-actions">${button('区分を追加', { action: 'add-dashboard-section' })}${button('初期構成に戻す', { action: 'reset-dashboard' })}</div>
        </div>` : ''}

      <div class="dashboard-sections ${dashboardEditing ? 'is-editing' : ''}">
        ${(dashboard?.sections || []).filter((section) => dashboardEditing || section.widgets.length).map((section, sectionIndex, visibleSections) => renderSection(section, sectionIndex, visibleSections.length, context, dashboardEditing)).join('')}
      </div>
    </div>`;
}

function renderSection(section, sectionIndex, totalSections, context, editing) {
  return `
    <section class="dashboard-section" data-dashboard-section="${escapeHtml(section.id)}">
      <div class="section-header dashboard-section-header">
        <div class="section-title">${escapeHtml(section.title)}</div>
        ${editing ? `<div class="dashboard-section-actions">
          ${iconButton('moveUp', { action: 'section-up', label: '区分を上へ', data: { 'section-id': section.id }, disabled: sectionIndex === 0 })}
          ${iconButton('moveDown', { action: 'section-down', label: '区分を下へ', data: { 'section-id': section.id }, disabled: sectionIndex === totalSections - 1 })}
          ${button('名前を変更', { action: 'edit-dashboard-section', data: { 'section-id': section.id } })}
          ${button('項目を追加', { action: 'open-widget-library', data: { 'section-id': section.id } })}
          ${iconButton('trash', { action: 'remove-dashboard-section', label: '区分を削除', className: 'danger-icon', data: { 'section-id': section.id } })}
        </div>` : ''}
      </div>
      ${section.widgets.length
        ? `<div class="dashboard-grid">${section.widgets.map((widget, index) => renderWidget(widget, index, section.widgets.length, context, editing)).join('')}</div>`
        : editing ? `<div class="dashboard-empty-section"><span>表示項目がありません。</span>${button('項目を追加', { action: 'open-widget-library', data: { 'section-id': section.id } })}</div>` : ''}
    </section>`;
}

function renderWidget(widget, index, total, context, editing) {
  const definition = getWidgetDefinition(widget.type);
  return `
    <article class="widget widget-size-${escapeHtml(widget.size || 'medium')} ${editing ? 'surface is-editing' : ''}" data-widget-id="${escapeHtml(widget.id)}">
      <div class="widget-heading">
        <div><div class="widget-title">${escapeHtml(widget.title || definition?.title || '項目')}</div>${definition?.description ? `<div class="widget-description">${escapeHtml(definition.description)}</div>` : ''}</div>
        ${editing ? `<div class="widget-menu-actions">
          ${iconButton('moveLeft', { action: 'widget-up', label: '左へ移動', data: { 'widget-id': widget.id }, disabled: index === 0 })}
          ${iconButton('moveRight', { action: 'widget-down', label: '右へ移動', data: { 'widget-id': widget.id }, disabled: index === total - 1 })}
          ${iconButton('resize', { action: 'widget-size', label: '大きさを変更', data: { 'widget-id': widget.id } })}
          ${iconButton('settings', { action: 'configure-widget', label: '項目を設定', data: { 'widget-id': widget.id } })}
          ${iconButton('trash', { action: 'remove-dashboard-widget', label: '項目を削除', className: 'danger-icon', data: { 'widget-id': widget.id } })}
        </div>` : ''}
      </div>
      <div class="widget-body">${renderWidgetContent(widget, context)}</div>
    </article>`;
}
