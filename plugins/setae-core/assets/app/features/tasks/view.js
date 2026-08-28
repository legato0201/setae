import { escapeHtml } from '../../components/ui.js';
import { icon, recordIcon } from '../../components/icons.js';
import { button, contentAction, iconButton } from '../../components/primitives.js';
import { taskOutcomeLabel, taskTypeLabel } from '../../content/terminology.js';

const taskIcons = {
  feed: 'feed',
  observation: 'observation',
  environment: 'environment_check',
  misting: 'misting',
  watering: 'watering',
  maintenance: 'maintenance',
  substrate: 'substrate_change'
};

const dueLabel = (task) => task.daysUntilDue === 1 ? '明日' : task.daysUntilDue > 1 ? `${task.daysUntilDue}日後` : '';

function targetButton(task) {
  const action = task.targetType === 'enclosure' ? 'open-task-enclosure' : task.targetType === 'nursery' ? 'open-task-nursery' : 'open-task-animal';
  const targetData = task.targetType === 'enclosure'
    ? { 'enclosure-id': task.targetId }
    : task.targetType === 'nursery'
      ? { 'group-id': task.targetId }
      : { 'animal-id': task.targetId };
  const kind = task.targetType === 'enclosure' ? '容器' : task.targetType === 'nursery' ? 'ベビー群' : '個体';
  return contentAction({
    action,
    data: targetData,
    className: 'care-task-main',
    ariaLabel: `${task.title}を開く`,
    contentHtml: `
    <span class="care-task-kind">${kind}</span>
    <span class="care-task-identity"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subtitle)}</small></span>
    <span class="care-task-reason">${escapeHtml(task.reason)}</span>`
  });
}

function actionButton(task) {
  if (task.targetType === 'enclosure') {
    return button(taskTypeLabel(task.type), { action: 'record-enclosure-task', className: 'care-task-action', data: { 'enclosure-id': task.targetId, 'event-type': task.action.eventType } });
  }
  if (task.targetType === 'nursery') {
    return button(taskTypeLabel(task.type), { action: 'record-nursery-task', className: 'care-task-action', data: { 'group-id': task.targetId, 'event-type': task.action.eventType } });
  }
  return button(taskTypeLabel(task.type), { action: 'smart-quick-record', className: 'care-task-action', data: { 'animal-id': task.targetId, 'record-type': task.action.recordType } });
}

function taskRow(task, { upcoming = false } = {}) {
  return `<div class="care-task-row task-target-${escapeHtml(task.targetType)} ${task.priority === 'overdue' ? 'is-overdue' : ''} ${upcoming ? 'is-upcoming' : ''}">
    <span class="care-task-icon" aria-hidden="true">${recordIcon(taskIcons[task.type] || task.type)}</span>
    ${targetButton(task)}
    ${upcoming ? `<span class="care-task-due">${escapeHtml(dueLabel(task))}</span>` : ''}
    ${actionButton(task)}
    ${upcoming ? '' : iconButton('more', { action: 'open-task-actions', label: `${task.title}の延期・見送り`, title: '延期・見送り', className: 'care-task-menu', data: { 'task-id': task.id } })}
  </div>`;
}

function taskSection(key, eyebrow, title, tasks, { upcoming = false, open = true, count = tasks.length } = {}) {
  if (!tasks.length && !count) return '';
  return `<section class="care-task-group ${key === 'overdue' ? 'is-overdue-group' : ''} ${upcoming ? 'is-upcoming-group' : ''} ${open ? 'is-open' : 'is-collapsed'} ${!tasks.length && count ? 'is-compact-empty' : ''}">
    ${contentAction({ action: 'toggle-task-section', data: { section: key }, className: 'care-task-group-title', ariaLabel: `${title}を${open ? '閉じる' : '開く'}`, expanded: open, contentHtml: `<span><small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong></span><span class="care-task-group-count"><b data-metric>${count}</b>${icon(open ? 'chevronUp' : 'chevronDown')}</span>` })}
    ${open && tasks.length ? `<div class="care-task-list">${tasks.map((task) => taskRow(task, { upcoming })).join('')}</div>` : ''}
  </section>`;
}

export function compactTaskQueue(overdue = [], today = [], { limit = 8, showAll = false } = {}) {
  const safeOverdue = Array.isArray(overdue) ? overdue : [];
  const safeToday = Array.isArray(today) ? today : [];
  const safeLimit = Math.max(1, Number(limit) || 8);
  const total = safeOverdue.length + safeToday.length;
  if (showAll || total <= safeLimit) {
    return { visibleOverdue: safeOverdue, visibleToday: safeToday, hiddenCount: 0, total, compact: false };
  }
  const visibleOverdue = safeOverdue.slice(0, safeLimit);
  const todaySlots = Math.max(0, safeLimit - visibleOverdue.length);
  const visibleToday = safeToday.slice(0, todaySlots);
  return {
    visibleOverdue,
    visibleToday,
    hiddenCount: total - visibleOverdue.length - visibleToday.length,
    total,
    compact: true
  };
}

export function renderTaskWorkQueue(model, preferences = {}) {
  const progress = model?.progress || { completed: 0, required: 0, percent: 100 };
  const overdue = model?.overdue || [];
  const today = model?.today || [];
  const upcoming = model?.upcoming || [];
  const handled = model?.handled || model?.completed || [];
  const pending = [...overdue, ...today];
  const collapsed = preferences.collapsed === true;
  const sections = { overdue: true, today: true, upcoming: false, ...(preferences.sections || {}) };
  const compactQueue = compactTaskQueue(overdue, today, { limit: preferences.compactThreshold || 8, showAll: preferences.showAll === true });
  const remaining = Math.max(0, progress.required - progress.completed);
  const queueToggle = compactQueue.hiddenCount
    ? button(`残り${compactQueue.hiddenCount}件を表示`, { action: 'expand-task-queue', className: 'care-task-reveal' })
    : preferences.showAll === true && compactQueue.total > Number(preferences.compactThreshold || 8)
      ? button('8件表示に戻す', { action: 'expand-task-queue', className: 'care-task-reveal' })
      : '';
  const emptyQueue = pending.length
    ? ''
    : progress.required > 0
      ? '<div class="care-all-done"><strong>今日の作業は完了しました</strong><span>次の予定は「近日」で確認できます。</span></div>'
      : `<div class="care-all-done is-empty"><strong>今日の作業はありません</strong><span>新しい記録を追加するか、近日の予定を確認できます。</span>${button('記録する', { action: 'open-record-sheet', primary: true })}</div>`;
  return `<section class="care-workspace task-workspace" aria-labelledby="today-care-title">
    <div class="care-workspace-head">
      <div class="care-workspace-heading"><div class="eyebrow">お世話予定</div><div class="section-title" id="today-care-title">今日の作業</div></div>
      <div class="task-work-summary" aria-label="今日の作業状況">
        <span><small>期限超過</small><strong data-metric>${overdue.length}</strong></span>
        <span><small>未対応</small><strong data-metric>${remaining}</strong></span>
        <span><small>対応済み</small><strong data-metric>${handled.length}</strong></span>
      </div>
      <div class="care-workspace-summary"><div class="care-progress-count"><strong data-metric>${progress.completed}</strong><span>/ ${progress.required} 対応</span></div>${iconButton(collapsed ? 'chevronDown' : 'chevronUp', { action: 'toggle-task-workspace', label: `今日のお世話を${collapsed ? '開く' : '閉じる'}`, className: 'care-workspace-toggle', expanded: !collapsed })}</div>
    </div>
    ${collapsed ? '' : `<div class="progress care-progress" aria-label="今日の作業進捗"><span style="width:${progress.percent}%"></span></div>
      ${emptyQueue}
      ${taskSection('overdue', '要対応', '期限超過', compactQueue.visibleOverdue, { open: sections.overdue, count: overdue.length })}
      ${taskSection('today', '本日', '今日', compactQueue.visibleToday, { open: sections.today, count: today.length })}
      ${queueToggle}
      ${renderHandled(handled)}
      ${taskSection('upcoming', '予定', '近日', upcoming, { upcoming: true, open: sections.upcoming })}`}
  </section>`;
}

function renderHandled(items) {
  if (!items.length) return '';
  return `<details class="care-task-handled"><summary><span><small>対応履歴</small><strong>今日の対応済み</strong></span><b>${items.length}</b></summary><div>${items.map((item) => `<div class="care-task-handled-row"><span>${escapeHtml(item.title || '作業')}</span><strong>${escapeHtml(taskTypeLabel(item.type))}</strong><em>${escapeHtml(taskOutcomeLabel(item.outcome))}${item.retryAt ? ` / 次回 ${escapeHtml(item.retryAt)}` : ''}</em></div>`).join('')}</div></details>`;
}
