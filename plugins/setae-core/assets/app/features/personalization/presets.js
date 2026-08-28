import '../../widgets/core.js';
import { normalizeDashboard } from '../dashboard/config.js';
import { normalizeAnimalCardConfig } from '../collection/card-config.js';
import { normalizeSavedView } from '../../queries/saved-views.js';
import { createWidget } from '../../widgets/registry.js';

export const PERSONALIZATION_STORAGE_KEY = 'setae.gui.v2.personalization';
export const setaePresetIds = ['simple', 'collection', 'breeder', 'research'];

const allCardFields = [
  'scientificName', 'gender', 'instar', 'status', 'lastFeed', 'lastMolt',
  'lastObservation', 'origin', 'temperature', 'humidity', 'enclosure', 'acquiredDate'
];

const cardFields = (...enabled) => Object.fromEntries(allCardFields.map((key) => [key, enabled.includes(key)]));

const widget = (type, id, options = {}) => createWidget(type, { id, ...options });

const queryView = (id, title, filters, sort = { field: 'code', direction: 'asc' }) => ({
  id,
  title,
  query: { filters, sort }
});

export const setaePresets = {
  simple: {
    id: 'simple',
    title: 'Simple',
    description: '少数飼育を、迷わず簡単に',
    note: '今日必要な操作と直近の記録だけに絞ります。',
    dashboard: {
      version: 2,
      sections: [
        { id: 'simple-history', title: '最近', widgets: [
          widget('recent_records', 'simple-recent-records', { size: 'large' }),
          widget('environment', 'simple-environment', { size: 'medium' })
        ] }
      ]
    },
    animalCard: {
      mode: 'hybrid',
      density: 'standard',
      fields: cardFields('scientificName', 'status', 'lastFeed', 'lastMolt'),
      quickActions: ['feed', 'observation']
    },
    savedViews: [],
    viewHighlights: ['すべて', '給餌対象', '脱皮前']
  },
  collection: {
    id: 'collection',
    title: 'Collection',
    description: '写真と個体を眺めることを重視',
    note: '写真、お気に入り、脱皮履歴を中心に構成します。',
    dashboard: {
      version: 2,
      sections: [
        { id: 'collection-photos', title: '写真', widgets: [
          widget('recent_photos', 'collection-recent-photos', { size: 'large' })
        ] },
        { id: 'collection-overview', title: 'コレクションノート', widgets: [
          widget('favorites', 'collection-favorites', { size: 'medium' }),
          widget('recent_molts', 'collection-recent-molts', { size: 'medium' }),
          widget('environment', 'collection-environment', { size: 'medium' })
        ] }
      ]
    },
    animalCard: {
      mode: 'photo',
      density: 'detailed',
      fields: cardFields('scientificName', 'gender', 'instar', 'status'),
      quickActions: ['observation']
    },
    savedViews: [],
    viewHighlights: ['お気に入り', '脱皮前', '写真中心']
  },
  breeder: {
    id: 'breeder',
    title: 'Breeder',
    description: '大量飼育・繁殖・一括管理',
    note: '50匹以上でも給餌、ベビー、餌在庫を横断して確認できます。',
    dashboard: {
      version: 2,
      sections: [
        { id: 'breeder-journal', title: '最近の動き', widgets: [
          widget('recent_records', 'breeder-records', { size: 'large', config: { limit: 10 } }),
          widget('recent_molts', 'breeder-molts', { size: 'medium' }),
          widget('environment', 'breeder-environment', { size: 'medium' })
        ] }
      ]
    },
    animalCard: {
      mode: 'data',
      density: 'compact',
      fields: cardFields('scientificName', 'instar', 'status', 'lastFeed', 'lastMolt', 'lastObservation'),
      quickActions: ['feed', 'observation', 'molt']
    },
    savedViews: [
      queryView('breeder-fasting', '拒食', [{ field: 'status', operator: '=', value: 'fasting' }]),
      queryView('breeder-post-molt', '脱皮後', [{ field: 'status', operator: '=', value: 'post_molt' }], { field: 'days_since_molt', direction: 'asc' })
    ],
    viewHighlights: ['給餌対象', '脱皮前', 'お気に入り', '拒食']
  },
  research: {
    id: 'research',
    title: 'Research',
    description: '観察・成長・データを重視',
    note: '観察、脱皮、成長、環境データを詳しく追跡します。',
    dashboard: {
      version: 2,
      sections: [
        { id: 'research-observation', title: '観察', widgets: [
          widget('recent_records', 'research-observations', { title: '最近の観察', size: 'large', config: { eventType: 'observation', limit: 8 } }),
          widget('environment', 'research-environment', { size: 'medium' })
        ] },
        { id: 'research-analysis', title: '成長と記録', widgets: [
          widget('recent_molts', 'research-recent-molts', { size: 'medium' }),
          widget('recent_photos', 'research-recent-photos', { size: 'large' })
        ] }
      ]
    },
    animalCard: {
      mode: 'data',
      density: 'detailed',
      fields: cardFields('scientificName', 'gender', 'instar', 'status', 'lastFeed', 'lastMolt', 'lastObservation', 'temperature', 'humidity', 'origin'),
      quickActions: ['observation', 'growth', 'molt']
    },
    savedViews: [
      queryView('research-female', 'メス', [{ field: 'gender', operator: '=', value: 'female' }]),
      queryView('research-molt-history', '脱皮記録あり', [{ field: 'days_since_molt', operator: 'exists', value: true }], { field: 'days_since_molt', direction: 'asc' })
    ],
    viewHighlights: ['メス', '脱皮記録あり', '脱皮前']
  }
};

export const defaultPersonalization = {
  presetId: 'custom',
  customized: false,
  setupCompleted: false,
  previewPresetId: 'simple'
};

export function normalizePersonalization(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const presetId = setaePresetIds.includes(source.presetId) ? source.presetId : 'custom';
  return {
    presetId,
    customized: Boolean(source.customized),
    setupCompleted: Boolean(source.setupCompleted),
    previewPresetId: setaePresetIds.includes(source.previewPresetId)
      ? source.previewPresetId
      : presetId === 'custom' ? 'simple' : presetId
  };
}

export function loadPersonalization(storage = globalThis.localStorage) {
  try {
    return normalizePersonalization(JSON.parse(storage?.getItem(PERSONALIZATION_STORAGE_KEY) || 'null'));
  } catch {
    return normalizePersonalization();
  }
}

export function savePersonalization(storage = globalThis.localStorage, value = defaultPersonalization) {
  const normalized = normalizePersonalization(value);
  storage?.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function buildPresetSettings(presetId) {
  const preset = setaePresets[presetId];
  if (!preset) return null;
  return {
    preset,
    dashboard: normalizeDashboard(preset.dashboard),
    animalCard: normalizeAnimalCardConfig(preset.animalCard),
    savedViews: preset.savedViews.map((view) => normalizeSavedView(view))
  };
}
