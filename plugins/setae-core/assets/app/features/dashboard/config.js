import { createWidget, getWidgetDefinition } from '../../widgets/registry.js';

const STORAGE_KEY = 'setae.gui.v2.dashboard.sections';
const SIZES = ['small', 'medium', 'large'];
export const JOURNAL_WIDGET_TYPES = ['recent_records', 'recent_molts', 'favorites', 'environment', 'recent_photos'];

const copy = (value) => JSON.parse(JSON.stringify(value));
const sectionId = () => globalThis.crypto?.randomUUID?.() || `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function createDefaultDashboard() {
  return {
    version: 2,
    sections: [
      {
        id: 'recent', title: '最近の動き', widgets: [
          createWidget('recent_records', { id: 'recent-records', title: '最近の記録', size: 'large' }),
          createWidget('recent_molts', { id: 'recent-molts', size: 'medium' })
        ]
      },
      {
        id: 'collection-journal', title: 'コレクションノート', widgets: [
          createWidget('favorites', { id: 'favorites', size: 'medium' }),
          createWidget('environment', { id: 'environment', size: 'medium' })
        ]
      }
    ]
  };
}

export function normalizeDashboard(value) {
  if (!Array.isArray(value?.sections) || !value.sections.length) return createDefaultDashboard();
  const sections = value.sections.map((section) => ({
    id: String(section.id || sectionId()),
    title: String(section.title || 'セクション').trim().slice(0, 40) || 'セクション',
    widgets: (Array.isArray(section.widgets) ? section.widgets : [])
      .filter((widget) => JOURNAL_WIDGET_TYPES.includes(widget?.type) && getWidgetDefinition(widget?.type))
      .map((widget) => createWidget(widget.type, widget))
  }));
  return sections.length && sections.some((section) => section.widgets.length)
    ? { version: 2, sections }
    : createDefaultDashboard();
}

export function migrateLegacyDashboard(order = [], preferences = {}) {
  void order;
  void preferences;
  return createDefaultDashboard();
}

export function loadDashboard(storage = globalThis.localStorage, legacy = {}) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (parsed) return normalizeDashboard(parsed);
  } catch {
    // Continue with legacy migration or defaults.
  }
  if (legacy.order?.length) return migrateLegacyDashboard(legacy.order, legacy.preferences);
  return createDefaultDashboard();
}

export function saveDashboard(dashboard, storage = globalThis.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeDashboard(dashboard)));
}

export function dashboardFromPreferences(preferences, fallback) {
  return Array.isArray(preferences?.dashboard_sections)
    ? normalizeDashboard({ sections: preferences.dashboard_sections })
    : normalizeDashboard(fallback);
}

export function findDashboardWidget(dashboard, widgetId) {
  for (const section of dashboard.sections) {
    const widget = section.widgets.find((item) => item.id === widgetId);
    if (widget) return { section, widget };
  }
  return null;
}

export function addDashboardSection(dashboard, title = '新しいセクション') {
  dashboard.sections.push({ id: sectionId(), title, widgets: [] });
  return dashboard.sections.at(-1);
}

export function addDashboardWidget(dashboard, sectionIdValue, type) {
  const section = dashboard.sections.find((item) => item.id === sectionIdValue);
  if (!section) return null;
  const widget = createWidget(type);
  section.widgets.push(widget);
  return widget;
}

export function updateDashboardWidget(dashboard, widgetIdValue, changes) {
  const found = findDashboardWidget(dashboard, widgetIdValue);
  if (!found) return null;
  const previousConfig = found.widget.config;
  Object.assign(found.widget, changes);
  if (changes.config) found.widget.config = { ...previousConfig, ...changes.config };
  return found.widget;
}

export function moveDashboardWidget(dashboard, widgetIdValue, delta) {
  const found = findDashboardWidget(dashboard, widgetIdValue);
  if (!found) return false;
  const index = found.section.widgets.findIndex((item) => item.id === widgetIdValue);
  const target = index + delta;
  if (target < 0 || target >= found.section.widgets.length) return false;
  [found.section.widgets[index], found.section.widgets[target]] = [found.section.widgets[target], found.section.widgets[index]];
  return true;
}

export function moveDashboardSection(dashboard, sectionIdValue, delta) {
  const index = dashboard.sections.findIndex((section) => section.id === sectionIdValue);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= dashboard.sections.length) return false;
  [dashboard.sections[index], dashboard.sections[target]] = [dashboard.sections[target], dashboard.sections[index]];
  return true;
}

export function removeDashboardWidget(dashboard, widgetIdValue) {
  const found = findDashboardWidget(dashboard, widgetIdValue);
  if (!found) return false;
  found.section.widgets = found.section.widgets.filter((item) => item.id !== widgetIdValue);
  return true;
}

export function removeDashboardSection(dashboard, sectionIdValue) {
  if (dashboard.sections.length <= 1) return false;
  dashboard.sections = dashboard.sections.filter((section) => section.id !== sectionIdValue);
  return true;
}

export function nextWidgetSize(widget) {
  const definition = getWidgetDefinition(widget?.type);
  const sizes = definition?.sizes || SIZES;
  const index = sizes.indexOf(widget?.size);
  return sizes[(index + 1) % sizes.length];
}

export const cloneDashboard = (dashboard) => copy(normalizeDashboard(dashboard));
