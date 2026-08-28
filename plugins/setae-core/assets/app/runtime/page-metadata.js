const cleanLabel = (value, fallback = '') => String(value || fallback).trim();

const animalIdentifier = (animal = {}) => cleanLabel(
  animal.manage_code || animal.code || animal.title || animal.id,
  '個体詳細'
);

const nurseryIdentifier = (group = {}) => cleanLabel(
  group.code_range || group.codeRange || group.name || group.manage_code || group.id,
  'ベビー群'
);

const enclosureIdentifier = (enclosure = {}) => cleanLabel(
  enclosure.code || enclosure.manage_code || enclosure.name || enclosure.id,
  '飼育容器'
);

export function pageMetadata({
  page = 'today',
  animal = null,
  enclosure = null,
  babyGroup = null,
  collectionTab = 'animals',
  recordsView = 'history',
  communityView = 'care'
} = {}) {
  let label = 'SETAE';
  let announcement = 'SETAEを表示しました';
  let key = page;

  if (page === 'today') [label, announcement] = ['今日', '今日を表示しました'];
  else if (page === 'animals' && babyGroup) {
    label = nurseryIdentifier(babyGroup);
    announcement = `${label}を表示しました`;
    key = `${page}:nursery:${cleanLabel(babyGroup.id || label)}`;
  } else if (page === 'animals' && collectionTab === 'babies') {
    [label, announcement, key] = ['ベビー群', 'ベビー群を表示しました', `${page}:babies`];
  } else if (page === 'animals') [label, announcement] = ['コレクション', 'コレクションを表示しました'];
  else if (page === 'animal-detail') {
    label = animalIdentifier(animal || {});
    announcement = `${label}の個体詳細を表示しました`;
    key = `${page}:${cleanLabel(animal?.id || label)}`;
  } else if (page === 'records' && recordsView === 'qr') {
    [label, announcement, key] = ['QR・ラベル', 'QR・ラベルを表示しました', `${page}:qr`];
  } else if (page === 'records') [label, announcement] = ['記録履歴', '記録履歴を表示しました'];
  else if (page === 'husbandry' && enclosure) {
    label = enclosureIdentifier(enclosure);
    announcement = `${label}の飼育容器を表示しました`;
    key = `${page}:enclosure:${cleanLabel(enclosure.id || label)}`;
  } else if (page === 'husbandry') [label, announcement] = ['飼育管理', '飼育管理を表示しました'];
  else if (page === 'settings') [label, announcement] = ['設定', '設定を表示しました'];
  else if (page === 'community') {
    const communityLabel = ({ care: 'お世話フィード', topics: '相談', breeding: '繁殖募集', species: '図鑑' })[communityView] || '交流';
    label = '交流';
    announcement = `${communityLabel}を表示しました`;
    key = `${page}:${communityView}`;
  }

  return { key, title: `${label} | SETAE`, announcement };
}

export function applyPageMetadata(metadata, { documentRef = document, announce = true } = {}) {
  if (!metadata) return;
  documentRef.title = metadata.title || 'SETAE';
  if (!announce) return;
  const region = documentRef.querySelector('[data-app-route-announcer]');
  if (region) region.textContent = metadata.announcement || '';
}

export function focusAppMain({ documentRef = document, preventScroll = true } = {}) {
  const target = documentRef.querySelector('#setae-main-content');
  if (!target) return false;
  target.focus({ preventScroll });
  return documentRef.activeElement === target;
}
