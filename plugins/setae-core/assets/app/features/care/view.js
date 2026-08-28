import { animalCode, escapeHtml, scientificName } from '../../components/ui.js';
import { button, contentAction } from '../../components/primitives.js';
import { taskTypeLabel } from '../../content/terminology.js';

const dueLabel = (task) => task.daysUntilDue === 1 ? '明日' : task.daysUntilDue > 1 ? `${task.daysUntilDue}日後` : '';

function taskRow(task, { upcoming = false } = {}) {
  return `<div class="care-task-row ${task.priority === 'overdue' ? 'is-overdue' : ''}">
    ${contentAction({ contentHtml: `
      <span class="care-task-identity"><strong>${escapeHtml(animalCode(task.animal))}</strong><small>${escapeHtml(scientificName(task.animal))}</small></span>
      <span class="care-task-reason">${escapeHtml(task.reason)}</span>`, className: 'care-task-main', data: { 'animal-id': task.animalId }, ariaLabel: `${animalCode(task.animal)}を開く` })}
    ${upcoming ? `<span class="care-task-due">${escapeHtml(dueLabel(task))}</span>` : ''}
    ${button(taskTypeLabel(task.type), { action: 'smart-quick-record', className: 'care-task-action', data: { 'animal-id': task.animalId, 'record-type': task.recommendedAction } })}
  </div>`;
}

function taskSection(title, tasks, { upcoming = false } = {}) {
  if (!tasks.length) return '';
  return `<section class="care-task-group ${title === '要対応' ? 'is-overdue-group' : ''}"><div class="care-task-group-title"><strong>${title === '要対応' ? '<i aria-hidden="true"></i>' : ''}${escapeHtml(title)}</strong><span>${tasks.length}</span></div><div class="care-task-list">${tasks.map((task) => taskRow(task, { upcoming })).join('')}</div></section>`;
}

export function renderCareWorkQueue(model) {
  const progress = model?.progress || { completed: 0, required: 0, percent: 100 };
  const pending = [...(model?.overdue || []), ...(model?.today || [])];
  return `<section class="care-workspace" aria-labelledby="today-care-title">
    <div class="care-workspace-head">
      <div><div class="eyebrow">お世話候補</div><div class="section-title" id="today-care-title">今日のお世話</div><div class="secondary">${pending.length}匹に対応が必要です</div></div>
      <div class="care-progress-count"><strong>${progress.completed}</strong><span>/ ${progress.required} 完了</span></div>
    </div>
    <div class="progress care-progress" aria-label="今日のお世話進捗"><span style="width:${progress.percent}%"></span></div>
    ${pending.length ? '' : '<div class="care-all-done"><strong>今日のお世話は完了しました</strong><span>次の予定は「近日」で確認できます。</span></div>'}
    ${taskSection('要対応', model?.overdue || [])}
    ${taskSection('今日', model?.today || [])}
    ${taskSection('近日', model?.upcoming || [], { upcoming: true })}
  </section>`;
}
