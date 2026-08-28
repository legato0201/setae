export const defaultTodayTaskPreferences = Object.freeze({
  visible: true,
  collapsed: false,
  compactThreshold: 8,
  showAll: false,
  sections: Object.freeze({ overdue: true, today: true, upcoming: false })
});

export function normalizeTodayTaskPreferences(value = {}) {
  return {
    visible: value.visible !== false,
    collapsed: value.collapsed === true,
    compactThreshold: 8,
    showAll: value.showAll === true || value.show_all === true,
    sections: {
      overdue: value.sections?.overdue !== false,
      today: value.sections?.today !== false,
      upcoming: value.sections?.upcoming === true
    }
  };
}

export function loadTodayTaskPreferences(storage = globalThis.localStorage) {
  try {
    return normalizeTodayTaskPreferences(JSON.parse(storage?.getItem('setae.gui.v2.todayTasks') || '{}'));
  } catch {
    return normalizeTodayTaskPreferences();
  }
}

export function saveTodayTaskPreferences(storage, preferences) {
  storage?.setItem('setae.gui.v2.todayTasks', JSON.stringify(normalizeTodayTaskPreferences(preferences)));
}
