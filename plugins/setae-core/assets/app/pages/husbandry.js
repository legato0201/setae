import { loadingBlock } from '../components/content.js';
import { actionMenu, button, tabPanel, tabs } from '../components/primitives.js';
import { workspaceHeader } from '../components/patterns.js';
import { renderCareProfileSettings } from '../features/care/profile-view.js';
import { renderEnclosureDetail, renderEnclosureRegistry } from '../features/husbandry/enclosure-view.js';
import { renderEnclosureCarePlanSettings } from '../features/husbandry/care-plan-view.js';
import { renderFeeders } from '../features/husbandry/feeder-view.js';
import { renderNurseryCarePlanSettings } from '../features/nursery/care-plan-view.js';

export function renderHusbandry({
  tab = 'feeders',
  animals = [],
  feeders = null,
  enclosures = null,
  enclosureDetail = null,
  careProfile = {},
  enclosureCareProfile = {},
  babyGroups = null,
  nurseryCareProfile = {},
  loading = false
} = {}) {
  const navigation = tabs([
    { id: 'feeders', label: '餌在庫' },
    { id: 'enclosures', label: '飼育容器' },
    { id: 'care', label: '飼育ルール' }
  ], {
    activeId: tab,
    action: 'husbandry-tab',
    dataKey: 'tab',
    label: '飼育管理',
    className: 'husbandry-tabs',
    idPrefix: 'husbandry',
    panelId: 'husbandry-tabpanel'
  });

  let content;
  if (loading) content = loadingBlock();
  else if (tab === 'enclosures') content = enclosureDetail
    ? renderEnclosureDetail(enclosureDetail, { loading, careProfile: enclosureCareProfile })
    : renderEnclosureRegistry(enclosures);
  else if (tab === 'care') content = `<div class="husbandry-care-workbench">${renderCareProfileSettings(careProfile, animals)}${renderEnclosureCarePlanSettings(enclosureCareProfile, enclosures)}${renderNurseryCarePlanSettings(nurseryCareProfile, babyGroups)}</div>`;
  else content = renderFeeders(feeders);

  const header = enclosureDetail && tab === 'enclosures'
    ? workspaceHeader(enclosureDetail.code || '飼育容器', {
      meta: [enclosureDetail.name, enclosureDetail.type_label, enclosureDetail.location].filter(Boolean).join(' · '),
      navigationHtml: navigation,
      actionsHtml: enclosureDetailActions(enclosureDetail)
    })
    : workspaceHeader(tabTitle(tab), {
      navigationHtml: navigation,
      actionsHtml: tab === 'feeders'
        ? button('在庫を記録', { action: 'add-feeder-action', iconName: 'plus', primary: true })
        : tab === 'enclosures'
          ? button('容器を登録', { action: 'add-enclosure', iconName: 'plus', primary: true })
          : ''
    });

  return tabPanel(`${header}<div class="husbandry-content">${content}</div>`, {
    id: 'husbandry-tabpanel',
    idPrefix: 'husbandry',
    activeId: tab,
    className: `page husbandry-page husbandry-workbench ${enclosureDetail ? 'is-detail' : ''}`
  });
}

function tabTitle(tab) {
  return ({ feeders: '餌在庫', enclosures: '飼育容器', care: '飼育ルール' })[tab] || '飼育管理';
}

function enclosureDetailActions(enclosure) {
  const data = { 'enclosure-id': enclosure.id };
  return `${button('容器を記録', { action: 'record-enclosure', iconName: 'plus', primary: true, data })}${button('QR', { action: 'enclosure-qr', iconName: 'qr', data })}${actionMenu('容器の操作', [
    { label: '設定', action: 'edit-enclosure', iconName: 'settings', data },
    { separator: true },
    { label: 'アーカイブ', action: 'archive-enclosure', className: 'danger', data: { ...data, 'enclosure-code': enclosure.code } }
  ], { iconName: 'more', iconOnly: true, className: 'enclosure-header-menu' })}`;
}
