const widgets = new Map();

export function registerWidget(definition) {
  if (!definition?.type || typeof definition.render !== 'function') {
    throw new TypeError('表示項目にはtypeとrenderが必要です。');
  }
  widgets.set(definition.type, {
    title: definition.type,
    description: '',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    defaultConfig: {},
    configurable: false,
    ...definition
  });
  return widgets.get(definition.type);
}

export const getWidgetDefinition = (type) => widgets.get(type) || null;
export const listWidgetDefinitions = () => [...widgets.values()];

const widgetId = () => globalThis.crypto?.randomUUID?.() || `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function createWidget(type, overrides = {}) {
  const definition = getWidgetDefinition(type);
  if (!definition) throw new RangeError(`未登録のWidgetです: ${type}`);
  return {
    id: String(overrides.id || widgetId()),
    type,
    title: String(overrides.title || definition.title),
    size: definition.sizes.includes(overrides.size) ? overrides.size : definition.defaultSize,
    config: { ...definition.defaultConfig, ...(overrides.config || {}) }
  };
}

export function renderWidgetContent(widget, context) {
  const definition = getWidgetDefinition(widget?.type);
  if (!definition) return '<div class="widget-empty">この表示項目は利用できません。</div>';
  return definition.render({ widget, config: { ...definition.defaultConfig, ...(widget.config || {}) }, context });
}
