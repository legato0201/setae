import { list, loadingBlock } from '../components/content.js';
import { actionMenu, button, tabPanel, tabs } from '../components/primitives.js';
import { workspaceHeader } from '../components/patterns.js';
import { renderAnimals } from './animals.js';
import { renderNurseryRegistry, renderNurseryWorkspace } from '../features/nursery/view.js';
import { nurseryCodeRange, nurseryLivingCount } from '../features/nursery/model.js';
import { renderStartChoices } from '../features/onboarding/view.js';

export function renderCollection({
  tab = 'animals',
  animals = [],
  animalMode = 'table',
  animalSearch = '',
  animalSearchIndex = null,
  animalViews = [],
  activeAnimalView = null,
  careTasks = [],
  collectionSelection = {},
  collectionWindow = undefined,
  animalCardConfig = {},
  babyGroups = null,
  babyDetail = null,
  nurseryCareProfile = {},
  nurseryRegisterWindow = undefined,
  loading = false
}) {
  const navigation = tabs([
    { id: 'animals', label: '個体' },
    { id: 'babies', label: 'ベビー群' }
  ], {
    activeId: tab,
    action: 'collection-tab',
    dataKey: 'tab',
    label: 'コレクション種別',
    className: 'collection-workspace-tabs',
    idPrefix: 'collection',
    panelId: 'collection-tabpanel'
  });

  if (tab === 'animals') {
    const header = workspaceHeader('コレクション', {
      meta: `${animals.length}匹`,
      navigationHtml: navigation
    });
    if (loading) return collectionPanel(`<div class="collection-screen-v4 collection-loading-v4">${header}${loadingBlock('個体を読み込み中…', 'registry')}</div>`, tab);
    if (!animals.length && !list(babyGroups, ['groups', 'items']).length) return collectionPanel(`<div class="collection-screen-v4">${header}${renderStartChoices()}</div>`, tab);
    return collectionPanel(`<div class="collection-screen-v4">${renderAnimals({
      animals,
      mode: animalMode,
      search: animalSearch,
      searchIndex: animalSearchIndex,
      embedded: true,
      views: animalViews,
      activeView: activeAnimalView,
      careTasks,
      selection: collectionSelection,
      listWindow: collectionWindow,
      cardConfig: animalCardConfig,
      headerHtml: header
    })}</div>`, tab);
  }

  if (babyDetail) {
    const groupId = babyDetail.id;
    const codeRange = nurseryCodeRange(babyDetail);
    const header = workspaceHeader(babyDetail.name || codeRange || 'ベビー群', {
      meta: `${codeRange} · ${nurseryLivingCount(babyDetail)}匹生存`,
      navigationHtml: navigation,
      actionsHtml: `${button('QRラベル', { action: 'baby-qr', iconName: 'qr', data: { 'group-id': groupId } })}${actionMenu('ベビー群の操作', [
        { label: '群の設定', action: 'edit-baby-group', data: { 'group-id': groupId } },
        { label: '通常個体へ移動', action: 'baby-promote', data: { 'group-id': groupId } }
      ], { iconName: 'more', iconOnly: true, className: 'nursery-header-menu' })}`
    });
    const content = loading ? loadingBlock('ベビー群を読み込み中…', 'property') : renderNurseryWorkspace(babyDetail, {
      careProfile: nurseryCareProfile,
      registerWindow: nurseryRegisterWindow
    });
    return collectionPanel(`<div class="collection-secondary-screen nursery-screen-v4 is-detail">${header}<div class="collection-secondary-content">${content}</div></div>`, tab);
  }

  const header = workspaceHeader('ベビー群', {
    meta: `${list(babyGroups, ['groups', 'items']).length}群`,
    navigationHtml: navigation,
    actionsHtml: button('ベビー群を作成', { action: 'add-baby-group', iconName: 'plus', primary: true })
  });
  const content = loading ? loadingBlock('ベビー群を読み込み中…', 'registry') : renderNurseryRegistry(babyGroups);
  return collectionPanel(`<div class="collection-secondary-screen nursery-screen-v4">${header}<div class="collection-secondary-content">${content}</div></div>`, tab);
}

function collectionPanel(content, activeId) {
  return tabPanel(content, {
    id: 'collection-tabpanel',
    idPrefix: 'collection',
    activeId,
    className: 'collection-tabpanel'
  });
}
