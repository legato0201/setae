import {
  animalCode,
  escapeHtml,
  familyName,
  formatRelativeDays,
  genderLabel,
  safeHttpUrl,
  scientificName,
  statusLabel
} from '../../components/ui.js';
import { renderAnimalMedia, renderMediaFrame } from '../../components/media.js';
import { recordIcon } from '../../components/icons.js';
import {
  actionMenu,
  button,
  emptyState,
  iconButton,
  linkButton,
  segmentedControl,
  statusIndicator,
  tabId,
  tabs as tabsPrimitive
} from '../../components/primitives.js';
import { propertyList } from '../../components/property-list.js';
import { activityList, activityRow } from '../../components/activity-list.js';
import { fieldLabelSummary, identityPanel } from '../../components/identity-panel.js';
import { chartFrame, metricSummary } from '../../components/data-visualization.js';
import { mediaGrid } from '../../components/media-grid.js';
import {
  buildGrowthMetrics,
  buildPhotoRecords,
  eventSummary,
  eventTypeLabel,
  groupEventsByMonth,
  normalizeSpecimenEvents,
  relatedBabyGroups
} from './model.js';

export const specimenTabs = [
  { id: 'overview', label: '概要' },
  { id: 'timeline', label: '生活史' },
  { id: 'growth', label: '成長' },
  { id: 'photos', label: '写真' },
  { id: 'breeding', label: '繁殖' }
];

const timelineFilters = [
  { id: 'all', label: 'すべて' },
  { id: 'feed', label: '給餌' },
  { id: 'molt', label: '脱皮' },
  { id: 'growth', label: '成長' },
  { id: 'observation', label: '観察' },
  { id: 'pairing', label: 'ペアリング' }
];

const formatDate = (date) => date ? String(date).slice(0, 10).replaceAll('-', '/') : '—';

export function normalizeSpecimenTab(tab) {
  return specimenTabs.some((item) => item.id === tab) ? tab : 'overview';
}

export function renderSpecimenTabNavigation(tab = 'overview') {
  return tabsPrimitive(specimenTabs, {
    activeId: normalizeSpecimenTab(tab),
    action: 'specimen-tab',
    dataKey: 'tab',
    label: '個体ワークスペース',
    className: 'specimen-workspace-tabs',
    idPrefix: 'specimen',
    panelId: 'specimen-tabpanel'
  });
}

export function renderSpecimenWorkspace({
  animal,
  events,
  babyGroups,
  tab = 'overview',
  timelineFilter = 'all',
  photoFilter = 'all',
  loadingEvents = false
}) {
  if (!animal) return `<div class="page">${emptyState('', {
    title: '個体データを取得できませんでした',
    description: 'コレクションに戻って、個体を選び直してください。',
    iconName: 'collection',
    reason: 'error',
    action: 'recover-collection',
    actionLabel: 'コレクションに戻る',
    primary: true
  })}</div>`;
  const activeTab = normalizeSpecimenTab(tab);
  const eventItems = normalizeSpecimenEvents(events);
  const context = { animal, events: eventItems, babyGroups, timelineFilter, photoFilter, loadingEvents };
  return `<div class="page specimen-workspace-v4">
    ${workspaceHeader(animal)}
    <div class="specimen-workspace-body">
      <div class="specimen-workspace-navigation" data-specimen-tab-navigation>${renderSpecimenTabNavigation(activeTab)}</div>
      <section id="specimen-tabpanel" class="specimen-workspace-content" role="tabpanel" aria-labelledby="${escapeHtml(tabId('specimen', activeTab))}" tabindex="0" data-specimen-tab-content data-specimen-active-tab="${escapeHtml(activeTab)}">${renderTab(activeTab, context)}</section>
      ${renderIdentity(animal)}
    </div>
  </div>`;
}

function workspaceHeader(animal) {
  const traits = [genderLabel(animal.gender), animal.instar ? `齢期 ${animal.instar}` : null].filter(Boolean).join(' · ');
  return `<header class="specimen-workspace-header">
    <div class="specimen-workspace-back">${button('コレクション', { action: 'back-animals', iconName: 'chevronLeft', className: 'text-button' })}</div>
    <div class="specimen-workspace-title"><span>${escapeHtml(animalCode(animal))}</span><h1>${escapeHtml(scientificName(animal))}</h1><div>${statusIndicator(statusLabel(animal.status), { tone: statusTone(animal.status) })}${traits ? `<span>${escapeHtml(traits)}</span>` : ''}</div></div>
    <div class="specimen-workspace-header-actions">
      ${iconButton('star', { action: 'favorite-animal', label: animal.is_favorite ? 'お気に入りを解除' : 'お気に入りに追加', className: `favorite-button ${animal.is_favorite ? 'is-favorite' : ''}`, pressed: Boolean(animal.is_favorite) })}
      ${actionMenu('個体操作', [
        { label: '個体を編集', action: 'edit-animal', iconName: 'edit' },
        { label: '識別票をプレビュー', action: 'open-field-label', iconName: 'qr' },
        { label: 'リンクをコピー', action: 'copy-animal-qr-url', iconName: 'externalLink', data: { 'animal-id': animal.id } },
        { label: 'Passportを開く', action: 'open-animal-passport', iconName: 'externalLink', data: { 'animal-id': animal.id } }
      ], { iconName: 'more', iconOnly: true, className: 'specimen-more-menu' })}
    </div>
  </header>`;
}

function renderIdentity(animal) {
  const current = currentEnclosure(animal);
  const recordMenu = actionMenu('記録', [
    recordMenuItem('観察', 'observation', 'observation', animal.id),
    recordMenuItem('脱皮', 'molt', 'molt', animal.id),
    recordMenuItem('計測', 'growth', 'growth', animal.id),
    recordMenuItem('ペアリング', 'pairing', 'pairing', animal.id),
    recordMenuItem('写真付き観察', 'observation', 'photo', animal.id)
  ], { iconName: 'plus', className: 'specimen-record-menu' });
  const actionsHtml = `${button('給餌', { action: 'smart-quick-record', iconName: 'feed', data: { 'record-type': 'feed', 'animal-id': animal.id } })}${recordMenu}`;
  const identityMeta = [genderLabel(animal.gender), specimenStage(animal)].filter(Boolean).join(' · ');
  const labelActions = `${button('プレビュー', { action: 'open-field-label', iconName: 'qr' })}${button('印刷', { action: 'print-specimen-label', iconName: 'print' })}`;
  return identityPanel({
    className: 'specimen-identity-panel',
    mediaHtml: renderAnimalMedia(animal, { ratio: 'auto', loading: 'eager', fetchPriority: 'high' }),
    mediaLabel: '個体写真',
    identity: {
      code: animalCode(animal),
      title: scientificName(animal),
      meta: identityMeta
    },
    facts: [
      { label: '状態', value: statusLabel(animal.status) },
      { label: '飼育容器', value: current?.code || '未割り当て', mono: true },
      { label: '入手日', value: formatDate(animal.acquired_date), mono: true }
    ],
    actionsHtml,
    labelHtml: fieldLabelSummary('識別票', '65 × 25 mm · QR付き', labelActions, '印刷・貼付して使用する識別票です。')
  });
}

function recordMenuItem(label, recordType, iconName, animalId) {
  return { label, action: 'smart-quick-record', iconName, data: { 'record-type': recordType, 'animal-id': animalId } };
}

function renderTab(tab, context) {
  if (tab === 'timeline') return renderTimeline(context);
  if (tab === 'growth') return renderGrowth(context);
  if (tab === 'photos') return renderPhotos(context);
  if (tab === 'breeding') return renderBreeding(context);
  return renderOverview(context);
}

export function renderSpecimenTabContent(tab, {
  animal,
  events,
  babyGroups,
  timelineFilter = 'all',
  photoFilter = 'all',
  loadingEvents = false
}) {
  return renderTab(normalizeSpecimenTab(tab), {
    animal,
    events: normalizeSpecimenEvents(events),
    babyGroups,
    timelineFilter,
    photoFilter,
    loadingEvents
  });
}

function renderOverview({ animal, events, loadingEvents }) {
  return `<div class="specimen-overview-v4">
    ${propertyList('現在の状態', [
      ['状態', statusLabel(animal.status)],
      ['最終確認', formatRelativeDays(animal.last_observation), { mono: true }],
      ['最終給餌', formatRelativeDays(animal.last_feed ?? animal.last_feed_date), { mono: true }],
      ['最終脱皮', formatRelativeDays(animal.last_molt ?? animal.last_molt_date), { mono: true }]
    ], { eyebrow: '現在の状態' })}
    ${renderHusbandry(animal)}
    ${propertyList('来歴', [
      ['由来', animal.origin],
      ['入手日', formatDate(animal.acquired_date), { mono: true }],
      ['分類群', familyName(animal) || '未設定']
    ])}
    ${animal.notes ? propertyList('飼育メモ', [['記録', animal.notes]], { className: 'specimen-notes-section' }) : ''}
    ${recentActivity(events, loadingEvents)}
  </div>`;
}

function renderHusbandry(animal) {
  const current = currentEnclosure(animal);
  if (!current) {
    return propertyList('飼育環境', [['飼育容器', '未割り当て'], ['温度', animal.temperature ? `${animal.temperature} °C` : '—'], ['湿度', animal.humidity ? `${animal.humidity} %` : '—'], ['床材', animal.substrate]]);
  }
  const environment = current.last_environment || {};
  const rows = [
    ['飼育容器', current.code || `容器 #${current.id}`, { mono: true, detail: current.name || current.type_label || '', actionHtml: button('開く', { action: 'open-animal-enclosure', className: 'text-button', data: { 'enclosure-id': current.id } }) }],
    ['温度', environment.temperature == null ? animal.temperature ? `${animal.temperature} °C` : '—' : `${environment.temperature} °C`, { mono: true }],
    ['湿度', environment.humidity == null ? animal.humidity ? `${animal.humidity} %` : '—' : `${environment.humidity} %`, { mono: true }],
    ['床材', current.substrate || animal.substrate],
    ['設置場所', current.location]
  ];
  const history = animal.housing?.history || [];
  const historyHtml = history.length ? `<details class="property-history"><summary>移動履歴 <span>${history.length}</span></summary>${activityList([{ title: '', rowsHtml: history.map((item) => activityRow({ date: formatDate(item.started_at), title: item.enclosure_code || '飼育容器', summary: item.ended_at ? `${formatDate(item.started_at)} から ${formatDate(item.ended_at)}` : `${formatDate(item.started_at)} から現在`, action: 'open-animal-enclosure', data: { 'enclosure-id': item.enclosure_id } })).join('') }])}</details>` : '';
  return `${propertyList('飼育環境', rows)}${historyHtml}`;
}

function recentActivity(events, loadingEvents) {
  const action = button('すべて表示', { action: 'specimen-tab', className: 'text-button', data: { tab: 'timeline' } });
  if (loadingEvents) return `<section class="specimen-section"><header><div><h2>最近の記録</h2></div>${action}</header><div class="specimen-empty">記録を読み込み中…</div></section>`;
  const rows = events.slice(0, 5).map((event) => activityRow({
    date: formatDate(event.date),
    title: eventTypeLabel(event.type),
    summary: eventSummary(event) || '記録',
    iconHtml: recordIcon(event.type),
    action: 'specimen-tab',
    data: { tab: 'timeline' }
  })).join('');
  return `<section class="specimen-section"><header><div><h2>最近の記録</h2></div>${action}</header>${activityList(rows ? [{ title: '', rowsHtml: rows }] : [], { emptyMessage: 'まだ記録がありません。' })}</section>`;
}

function renderTimeline({ animal, events, timelineFilter, loadingEvents }) {
  const filtered = timelineFilter === 'all' ? events : events.filter((event) => event.type === timelineFilter);
  const groups = groupEventsByMonth(filtered).map((group) => ({ title: group.key, rowsHtml: group.events.map((event) => renderTimelineEvent(event, animal)).join('') }));
  return `<section class="specimen-tab-panel">${panelHeader('LABORATORY JOURNAL', '生活史', `${events.length}件`)}${segmentedControl(timelineFilters, { activeId: timelineFilter, action: 'specimen-timeline-filter', dataKey: 'filter', label: '記録種別', className: 'specimen-filter-tabs' })}${loadingEvents ? '<div class="specimen-empty">記録を読み込み中…</div>' : activityList(groups, { emptyMessage: 'この種別の記録はありません。' })}</section>`;
}

function renderTimelineEvent(event, animal) {
  const image = safeHttpUrl(event.image);
  const date = new Date(event.date || '');
  const day = Number.isNaN(date.getTime()) ? '—' : String(date.getDate()).padStart(2, '0');
  const time = Number.isNaN(date.getTime()) || !String(event.date || '').includes('T') ? '' : date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const mediaHtml = image ? `<a class="activity-media" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer">${renderMediaFrame({ src: image, alt: `${eventTypeLabel(event.type)}の写真`, scientificName: scientificName(animal), ratio: 'wide', compact: true })}</a>` : '';
  const actionsHtml = `${button('共有', { action: 'share-record', className: 'text-button', data: { 'log-id': event.id } })}${button('削除', { action: 'delete-record', className: 'text-button danger', data: { 'log-id': event.id, 'animal-id': animal.id } })}`;
  return activityRow({ date: day, time, title: eventTypeLabel(event.type), summary: eventSummary(event), iconHtml: recordIcon(event.type), mediaHtml, flag: event.refused ? '食べなかった' : '', actionsHtml });
}

function renderGrowth({ animal, events }) {
  const metrics = buildGrowthMetrics(events, animal.instar);
  const feedSummary = metrics.feedStats ? [
    { label: '平均給餌間隔', value: `${metrics.feedStats.average}日` },
    { label: '最短', value: `${metrics.feedStats.minimum}日` },
    { label: '最長', value: `${metrics.feedStats.maximum}日` }
  ] : [];
  const moltAverage = metrics.moltIntervals.length ? Math.round(metrics.moltIntervals.reduce((sum, item) => sum + item.days, 0) / metrics.moltIntervals.length) : null;
  return `<section class="specimen-tab-panel">${panelHeader('GROWTH RECORD', '成長', '', button('成長を記録', { action: 'smart-quick-record', iconName: 'growth', data: { 'animal-id': animal.id, 'record-type': 'growth' } }))}<section class="specimen-analysis-section"><h3>齢期推移</h3>${renderInstarChart(metrics.moltPoints)}</section>${metricSummary([{ label: '平均脱皮間隔', value: moltAverage ? `${moltAverage}日` : '—' }, ...feedSummary])}${metrics.moltIntervals.length ? propertyList('脱皮間隔', metrics.moltIntervals.slice().reverse().map((item) => [`齢期 ${item.from} から ${item.to}`, `${item.days}日`, { mono: true }])) : '<div class="specimen-empty compact">2件以上の脱皮記録で間隔を表示します。</div>'}${metrics.sizePoints.length ? propertyList('サイズ記録', metrics.sizePoints.slice().reverse().map((point) => [formatDate(point.date), point.size, { mono: true }])) : ''}</section>`;
}

function renderInstarChart(points) {
  if (!points.length) return '<div class="specimen-empty">脱皮記録が増えると齢期の推移を表示します。</div>';
  const width = 640;
  const height = 220;
  const left = 44;
  const right = 18;
  const top = 20;
  const bottom = 40;
  const minDate = Math.min(...points.map((point) => new Date(point.date).getTime()));
  const maxDate = Math.max(...points.map((point) => new Date(point.date).getTime()));
  const minInstar = Math.min(...points.map((point) => point.instar));
  const maxInstar = Math.max(...points.map((point) => point.instar));
  const x = (point) => points.length === 1 ? width / 2 : left + ((new Date(point.date).getTime() - minDate) / Math.max(1, maxDate - minDate)) * (width - left - right);
  const y = (point) => top + ((maxInstar - point.instar) / Math.max(1, maxInstar - minInstar)) * (height - top - bottom);
  const coordinates = points.map((point) => `${x(point)},${y(point)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="齢期の推移"><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="chart-axis"></line><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="chart-axis"></line>${minInstar === maxInstar ? '' : `<text x="${left - 10}" y="${y({ instar: maxInstar }) + 4}" text-anchor="end">${maxInstar}</text><text x="${left - 10}" y="${y({ instar: minInstar }) + 4}" text-anchor="end">${minInstar}</text>`}<polyline points="${coordinates}" class="chart-line"></polyline>${points.map((point, index) => `<g><circle cx="${x(point)}" cy="${y(point)}" r="5" class="chart-point"></circle>${index % labelStep === 0 || index === points.length - 1 ? `<text x="${x(point)}" y="${height - 16}" text-anchor="middle">${escapeHtml(monthLabel(point.date))}</text>` : ''}<title>${escapeHtml(`${formatDate(point.date)} 齢期 ${point.instar}`)}</title></g>`).join('')}</svg>`;
  return chartFrame(svg, { label: '齢期の推移', caption: `${points.length}件の脱皮記録` });
}

function renderPhotos({ animal, events, photoFilter }) {
  const photos = buildPhotoRecords(animal, events);
  const instars = [...new Set(photos.map((photo) => photo.instar).filter(Boolean))].sort((a, b) => b - a);
  const filters = [{ id: 'all', label: 'すべて' }, { id: 'molt', label: '脱皮' }, ...instars.map((instar) => ({ id: `instar:${instar}`, label: `齢期 ${instar}` })), { id: 'best', label: 'ベストショット' }];
  const filtered = photos.filter((photo) => photoFilter === 'all' || (photoFilter === 'molt' && photo.type === 'molt') || (photoFilter === 'best' && photo.best) || (photoFilter.startsWith('instar:') && String(photo.instar) === photoFilter.split(':')[1]));
  const groups = groupPhotosByMonth(filtered);
  const addPhoto = button('写真を追加', { action: 'smart-quick-record', iconName: 'photo', data: { 'animal-id': animal.id, 'record-type': 'observation' } });
  return `<section class="specimen-tab-panel">${panelHeader('PHOTOGRAPHIC RECORD', '写真', `${photos.length}点`, addPhoto)}${segmentedControl(filters, { activeId: photoFilter, action: 'specimen-photo-filter', dataKey: 'filter', label: '写真フィルター', className: 'specimen-filter-tabs' })}${groups.length ? groups.map((group) => `<section class="specimen-media-group"><h3>${escapeHtml(group.title)}</h3>${mediaGrid(group.photos.map(photoMediaItem))}</section>`).join('') : '<div class="specimen-empty">条件に一致する写真はありません。</div>'}</section>`;
}

function photoMediaItem(photo) {
  const url = safeHttpUrl(photo.url);
  return {
    mediaHtml: url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${renderMediaFrame({ src: url, alt: `${formatDate(photo.date)}の個体写真`, ratio: 'square', compact: true })}</a>` : '',
    actionsHtml: url ? linkButton('開く', { href: url, iconName: 'externalLink', className: 'media-grid-open', external: true }) : '',
    date: formatDate(photo.date),
    title: photo.instar ? `齢期 ${photo.instar}` : '齢期未設定',
    detail: `${photo.type === 'profile' ? '個体写真' : eventTypeLabel(photo.type)}${photo.best ? ' · ベストショット' : ''}`
  };
}

function renderBreeding({ animal, events, babyGroups }) {
  const pairings = events.filter((event) => event.type === 'pairing');
  const offspring = relatedBabyGroups(babyGroups, animal.id);
  const record = button('ペアリングを記録', { action: 'smart-quick-record', iconName: 'pairing', data: { 'animal-id': animal.id, 'record-type': 'pairing' } });
  const contact = safeHttpUrl(animal.breeding_contact_url) ? linkButton(animal.breeding_contact_label || '外部連絡先を開く', { href: safeHttpUrl(animal.breeding_contact_url), iconName: 'externalLink', external: true }) : '';
  const pairingGroups = pairings.length ? [{ title: '', rowsHtml: pairings.map((event) => activityRow({ date: formatDate(event.date), title: event.data?.partner_name || event.data?.partner || '相手未設定', summary: pairingResult(event.data?.result || event.data?.status || event.note), iconHtml: recordIcon('pairing') })).join('') }] : [];
  const offspringGroups = offspring.length ? [{ title: '', rowsHtml: offspring.map((group) => activityRow({ date: formatDate(group.birth_date), title: group.name || `ベビー群 #${group.id}`, summary: `${group.living_count ?? group.stats?.alive ?? group.count ?? 0}匹生存`, iconHtml: recordIcon('growth'), action: 'open-baby-group', data: { 'group-id': group.id } })).join('') }] : [];
  return `<section class="specimen-tab-panel">${panelHeader('BREEDING RECORD', '繁殖', '', record)}${propertyList('繁殖情報', [['性別', genderLabel(animal.gender)], ['最終ペアリング', formatRelativeDays(animal.last_pairing), { mono: true }], ['繁殖募集', breedingListingLabel(animal.bl_status)]])}${animal.bl_status === 'recruiting' ? `<section class="specimen-section"><header><div><h2>公開中の募集</h2></div>${contact}</header><p class="specimen-section-copy">${escapeHtml(animal.bl_terms || '募集条件は未記入です。')}</p></section>` : ''}<section class="specimen-section"><header><div><h2>ペアリング履歴</h2></div></header>${activityList(pairingGroups, { emptyMessage: 'ペアリング記録はありません。' })}</section><section class="specimen-section"><header><div><h2>子孫・ベビー群</h2></div></header>${activityList(offspringGroups, { emptyMessage: 'この個体を親に設定したベビー群はありません。' })}</section></section>`;
}

function panelHeader(eyebrow, title, meta = '', actionsHtml = '') {
  return `<header class="specimen-panel-header"><div><span>${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</div>${actionsHtml}</header>`;
}

function currentEnclosure(animal) {
  return animal.housing?.current || animal.enclosure_record || null;
}

function statusTone(status) {
  return status === 'normal' ? 'success' : ['pre_molt', 'fasting'].includes(status) ? 'warning' : 'neutral';
}

function specimenStage(animal) {
  return animal.stage || animal.life_stage || (animal.instar ? `齢期 ${animal.instar}` : 'ステージ未設定');
}

function monthLabel(date) {
  const parsed = new Date(date || '');
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getMonth() + 1}月`;
}

function groupPhotosByMonth(photos) {
  const groups = [];
  photos.forEach((photo) => {
    const parsed = new Date(photo.date || '');
    const title = Number.isNaN(parsed.getTime()) ? '日付未設定' : `${parsed.getFullYear()}年${parsed.getMonth() + 1}月`;
    let group = groups.find((item) => item.title === title);
    if (!group) {
      group = { title, photos: [] };
      groups.push(group);
    }
    group.photos.push(photo);
  });
  return groups;
}

function breedingListingLabel(status) {
  return status === 'recruiting' ? '募集中' : '募集していない';
}

function pairingResult(result) {
  const normalized = String(result || '').toLowerCase();
  return ({ successful: '成功', success: '成功', no_confirmation: '未確認', failed: '不成立' })[normalized] || result || '結果未設定';
}
