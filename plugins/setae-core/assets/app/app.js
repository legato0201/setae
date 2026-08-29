import { SetaeApiClient } from './api/client.js';
import {
  AccountService,
  AnimalService,
  AppService,
  BabyService,
  CareService,
  BreedingBoardService,
  EnclosureService,
  FeederService,
  IntegrationService,
  NotificationService,
  OfflineService,
  QrService,
  SessionService,
  SocialService,
  SpeciesService,
  TaskService,
  TopicService
} from './api/services.js';
import { renderToday } from './pages/today.js';
import { normalizeSpecimenTab, renderAnimalDetail, renderSpecimenTabContent, renderSpecimenTabNavigation } from './pages/animal-detail.js';
import { renderCollection } from './pages/collection.js';
import { renderHusbandry } from './pages/husbandry.js';
import { appendRecordsWindow, filterRecords, hydrateRecordsWindow, renderRecords } from './pages/records.js';
import { renderCommunity } from './pages/community.js';
import { renderSettings } from './pages/settings.js';
import { renderAuthPage, renderBootPage, renderConnectionErrorPage } from './pages/auth.js';
import { renderModal } from './components/modals.js';
import { renderAppFeedback, renderAppFrame, renderAppFrameRegions, renderAppPagePreparation } from './components/app-frame.js';
import { renderBrand } from './components/brand.js';
import { button, hydrateActionMenu, nextTabIndex, tabId } from './components/primitives.js';
import { syncDateFieldDisplay } from './components/date-field.js';
import { createOverlayController, resolveActionInvocation } from './components/overlay-controller.js';
import { applyServerFieldErrors, createFormSafetyController, serverFieldErrors, validateForm } from './components/form-safety-controller.js';
import { createFeedbackController } from './components/feedback-controller.js';
import { animalCode, escapeHtml, safeHttpUrl, safeSameOriginHttpUrl } from './components/ui.js';
import { registerMediaFallbacks } from './components/media.js';
import { createRenderCoordinator, waitForInitialPaint } from './runtime/render-coordinator.js';
import { applyPageMetadata, focusAppMain, pageMetadata } from './runtime/page-metadata.js';
import { createNativeViewportController } from './runtime/native-viewport-controller.js';
import { createMobileGestureController } from './runtime/mobile-gesture-controller.js';
import { collectDiagnostics } from './features/diagnostics/model.js';
import { copyDiagnosticJson, downloadDiagnosticJson } from './features/diagnostics/export.js';
import { clampListWindow, createListWindow, extendListWindow, listWindowForGroup, resetListWindow, restoreProgressiveListFocus } from './components/progressive-list.js';
import { captureFormState, restoreFormState, setDialogPending, setFormPending, syncBusyDialogControls } from './components/async-state.js';
import { icon } from './components/icons.js';
import { enclosureEventLabel } from './content/terminology.js';
import { offlineSavedMessage, recordSaved, syncCompleteMessage, syncPartialMessage, syncProgressMessage } from './content/messages.js';
import { offlineQueue } from './offline/queue.js';
import { renderDashboardEditor } from './features/dashboard/editor.js';
import { renderSavedViewEditor } from './features/animals/view-editor.js';
import { createCollectionWindow } from './features/collection/list-window.js';
import { createCollectionWorkspaceController } from './features/collection/workspace-controller.js';
import { clearCollectionSearchInput, createCollectionSearchController } from './features/collection/search.js';
import { runCollectionBatch } from './features/collection/actions.js';
import { collectionItemIntent, isAnimalNavigationId, resolveAnimalNavigationTarget } from './features/collection/interaction.js';
import { renderAnimalCardEditor } from './features/collection/card-editor.js';
import { renderCollectionStatusDialog } from './features/collection/dialog.js';
import { createSpeciesComboboxController } from './features/specimen-intake/species-combobox.js';
import { createSpecimenIntakeController } from './features/specimen-intake/controller.js';
import { renderSpeciesComboboxResults, renderSpecimenSpeciesRegion } from './features/specimen-intake/view.js';
import { appendSpecimenPublicSettings, publicSettingEnabled, qrSettingsPayload, specimenPublicSettings, syncSpecimenPublicSettings } from './features/specimen/public-settings.js';
import {
  loadTodayTaskPreferences,
  normalizeTodayTaskPreferences,
  saveTodayTaskPreferences
} from './features/tasks/preferences.js';
import {
  animalCardModes,
  defaultAnimalCardConfig,
  loadAnimalCardConfig,
  normalizeAnimalCardConfig,
  saveAnimalCardConfig
} from './features/collection/card-config.js';
import {
  clearCollectionSelection,
  createCollectionSelection,
  reconcileCollectionSelection,
  selectCollectionAnimal as selectCollectionState,
  setCollectionSelectedIds,
  setCollectionSelectionMode,
  toggleCollectionAnimal
} from './features/collection/state.js';
import { renderQuickRecordLauncher } from './features/records/quick-record-view.js';
import { appendNurseryRegisterWindow } from './features/nursery/view.js';
import { renderRecordForm } from './features/records/record-form-view.js';
import {
  applyRecordToAnimals,
  recordDataFromForm,
  resolveRecordType,
  submitRecordTargets
} from './features/records/actions.js';
import {
  loadQuickRecordRecent,
  recordQuickRecordUsage
} from './features/records/recent-records.js';
import {
  addDashboardSection,
  addDashboardWidget,
  createDefaultDashboard,
  dashboardFromPreferences,
  findDashboardWidget,
  loadDashboard,
  moveDashboardSection,
  moveDashboardWidget,
  nextWidgetSize,
  removeDashboardSection,
  removeDashboardWidget,
  saveDashboard,
  updateDashboardWidget
} from './features/dashboard/config.js';
import { animalQueryFromSettings } from './queries/animal-query.js';
import { createAnimalSearchIndex } from './queries/animal-search-index.js';
import {
  builtInAnimalViews,
  loadSavedViews,
  normalizeSavedView,
  saveSavedViews,
  savedViewFromSettings
} from './queries/saved-views.js';
import {
  buildPresetSettings,
  loadPersonalization,
  normalizePersonalization,
  savePersonalization,
  setaePresetIds
} from './features/personalization/presets.js';
import { renderSetaeSetup } from './features/personalization/preset-view.js';
import { handleSessionApiError } from './api/error-handler.js';
import { createPlanController, isPlanError } from './features/settings/plan-controller.js';
import { createAppSessionTracker } from './features/analytics/client-context.js';
import { markArrivalViewed } from './features/onboarding/arrival.js';
import {
  completeOnboardingIfNeeded,
  deriveOnboardingProgress,
  loadOnboardingState,
  saveOnboardingState,
  shouldShowGettingStarted
} from './features/onboarding/model.js';
import {
  loadCareProfile,
  normalizeCareProfile,
  rulesFromFormData,
  saveCareProfile
} from './features/care/profile.js';
import { buildTaskModel } from './features/tasks/model.js';
import { createTaskAction } from './features/tasks/lifecycle.js';
import { loadTaskActions, saveTaskActions, upsertTaskAction } from './features/tasks/actions.js';
import {
  enclosureCareRulesFromForm,
  loadEnclosureCareProfile,
  normalizeEnclosureCareProfile,
  saveEnclosureCareProfile
} from './features/husbandry/care-plan.js';
import {
  loadNurseryCareProfile,
  normalizeNurseryCareProfile,
  nurseryCareRulesFromForm,
  saveNurseryCareProfile
} from './features/nursery/care-plan.js';
import { nurseryEventPayload } from './features/nursery/actions.js';
import {
  babyQrSelectionResult,
  createBabyQrSelection,
  filterBabyQrItems,
  loadBabyQrTargets
} from './features/nursery/code-selection.js';
import { saveNurseryEvent } from './controllers/nursery.js';
import {
  addQrHistoryRow,
  addQrQueueTarget,
  applySameBatchDate,
  createQrWorkspaceState,
  loadLabelConfig,
  normalizeLabelConfig,
  parseQrCode,
  qrBatchEntries,
  qrHistoryEntries,
  qrTaskCompletionCandidates,
  removeQrHistoryRow,
  removeQrQueueTarget,
  resetQrHistory,
  saveLabelConfig,
  updateQrHistoryRow
} from './features/qr/state.js';
import { hydrateQrCodes, printCalibration, printLabels } from './features/qr/labels.js';
import { refreshQrLabelPreview } from './features/qr/view.js';
import { cameraErrorPresentation, decodeQrImage, qrCameraActive, startQrCamera, stopQrCamera } from './features/qr/scanner.js';
import {
  createRouteState,
  isRouteState,
  resolveBackPriority,
  sameRoute
} from './features/navigation/controller.js';
const appConfig = window.SETAE_CONFIG || {};
const mockEnabled = appConfig.enableMock === true;
let waitingServiceWorker = null;
let serviceWorkerReloadRequested = false;
const api = new SetaeApiClient();
const services = {
  account: new AccountService(api),
  animals: new AnimalService(api),
  app: new AppService(api),
  babies: new BabyService(api),
  care: new CareService(api),
  breeding: new BreedingBoardService(api),
  enclosures: new EnclosureService(api),
  feeders: new FeederService(api),
  integrations: new IntegrationService(api),
  notifications: new NotificationService(api),
  offline: new OfflineService(api),
  qr: new QrService(api),
  session: new SessionService(api),
  social: new SocialService(api),
  species: new SpeciesService(api),
  tasks: new TaskService(api),
  topics: new TopicService(api)
};
const defaultWidgetOrder = ['pre_molt', 'babies', 'feeders', 'collection'];
const defaultWidgetPreferences = {
  pre_molt: { visible: true, size: 'normal' },
  babies: { visible: true, size: 'normal' },
  feeders: { visible: true, size: 'normal' },
  collection: { visible: true, size: 'wide' }
};
const app = document.querySelector('#app, #setae-gui-root');
const renderCoordinator = createRenderCoordinator(app);
let initialRenderGeneration = 0;
const nativeViewportController = createNativeViewportController();
nativeViewportController.start();
const overlayController = createOverlayController(app, {
  onRequestClose: () => requestBack().catch((error) => console.error('SETAE overlay close failed.', error))
});
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
registerMediaFallbacks(app);
const mockSpeciesSuggestions = [
  { id: 501, ja_name: 'セラドニア', scientific_name: 'Typhochlaena seladonia', genus: 'Typhochlaena' },
  { id: 502, ja_name: 'アンティルピンクトゥー', scientific_name: 'Caribena versicolor', genus: 'Caribena' },
  { id: 503, ja_name: 'インディアンオーナメンタル', scientific_name: 'Poecilotheria regalis', genus: 'Poecilotheria' }
];
let collectionClickTimer = null;
let animalDetailRequestId = 0;
let navigationInitialized = false;
let navigationIndex = 0;
let lastPageMetadataKey = '';
let pendingPageFocus = false;
const collectionSearchController = createCollectionSearchController(updateCollectionSearch);
const speciesComboboxController = createSpeciesComboboxController({
  search: (query, options) => state.mockMode
    ? Promise.resolve(mockSpeciesSuggestions.filter((item) => `${item.ja_name} ${item.scientific_name} ${item.genus}`.toLocaleLowerCase('ja').includes(query.toLocaleLowerCase('ja'))))
    : services.species.suggestions(query, options),
  update: updateSpeciesCombobox,
  onSelect: selectModalSpecies
});
let specimenIntakeController = null;
const storedAnimalView = localStorage.getItem('setae.gui.v4.collectionView') || 'table';
const initialCareProfile = loadCareProfile(localStorage);
const initialAnimalCardConfig = normalizeAnimalCardConfig({
  ...loadAnimalCardConfig(localStorage),
  ...(animalCardModes.includes(storedAnimalView) ? { mode: storedAnimalView } : {})
});
const initialPersonalization = loadPersonalization(localStorage);
const initialEnclosureCareProfile = loadEnclosureCareProfile(localStorage);
const initialNurseryCareProfile = loadNurseryCareProfile(localStorage);
const publicCommunityRoutes = new Map([
  ['/community/', 'topics'],
  ['/species/', 'species'],
  ['/breeding/', 'breeding']
]);
function appHomePath() {
  try {
    const url = new URL(appConfig.appUrl || '/', location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
function cleanAppPath() {
  return appConfig.embedded === true ? appHomePath() : location.pathname;
}
function consumeRequestedReturnUrl() {
  const currentUrl = new URL(location.href);
  const rawReturnUrl = currentUrl.searchParams.get('setae_return') || '';
  if (!rawReturnUrl) return '';
  // setae_return is a one-shot post-authentication destination. Remove it
  // before any navigation so a return target can never survive the next boot
  // and trigger a self-redirect loop on the root application route.
  currentUrl.searchParams.delete('setae_return');
  currentUrl.searchParams.delete('setae_auth');
  const cleanCurrentUrl = currentUrl.href;
  history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` || '/');
  const safeReturnUrl = safeSameOriginHttpUrl(rawReturnUrl || '');
  if (!safeReturnUrl) return '';
  try {
    const targetUrl = new URL(safeReturnUrl, location.origin);
    // Do not allow nested return parameters to recreate the redirect on the
    // destination itself.
    targetUrl.searchParams.delete('setae_return');
    // In the root-app architecture the normal login return target is often
    // the current application URL itself. Staying on the current document is
    // intentional and avoids a pointless full page reload.
    if (targetUrl.href === cleanCurrentUrl) return '';
    return targetUrl.href;
  } catch {
    return '';
  }
}
function publicCommunityTabFromPath(pathname = location.pathname, search = location.search) {
  const queryTab = new URLSearchParams(search).get('setae_public');
  if (['topics', 'species', 'breeding'].includes(queryTab)) return queryTab;
  const normalized = `/${String(pathname || '/').split('/').filter(Boolean).join('/')}/`;
  return publicCommunityRoutes.get(normalized) || null;
}
function setPublicCommunityPath(tab, { replace = false } = {}) {
  let path;
  if (appConfig.embedded === true) {
    const url = new URL(appConfig.appUrl || appHomePath(), location.origin);
    url.searchParams.set('setae_public', ['species', 'breeding'].includes(tab) ? tab : 'topics');
    path = `${url.pathname}${url.search}${url.hash}`;
  } else {
    path = tab === 'species' ? '/species/' : tab === 'breeding' ? '/breeding/' : '/community/';
  }
  if (`${location.pathname}${location.search}${location.hash}` === path) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
}

const state = {
  loading: true,
  viewLoading: false,
  bootstrapped: false,
  authenticated: null,
  publicMode: false,
  mockMode: false,
  online: navigator.onLine,
  page: 'today',
  bootstrap: null,
  error: null,
  connectionError: null,
  toast: null,
  appUpdateAvailable: false,
  appUpdateApplying: false,
  busy: false,

  authView: 'login',
  authSubmitting: false,
  authError: null,
  authMessage: null,

  animals: [],
  animalSearchIndex: createAnimalSearchIndex(),
  careSummary: null,
  babyGroups: null,
  babyDetail: null,
  nurseryCareProfile: initialNurseryCareProfile,
  feeders: null,
  enclosures: null,
  selectedEnclosureId: null,
  selectedEnclosure: null,
  selectedAnimalId: null,
  selectedAnimal: null,
  selectedEvents: null,
  loadingEvents: false,
  specimenTab: 'overview',
  specimenTimelineFilter: 'all',
  specimenPhotoFilter: 'all',

  collectionTab: 'animals',
  husbandryTab: 'enclosures',
  animalView: storedAnimalView === 'table' ? 'table' : 'gallery',
  animalCardConfig: initialAnimalCardConfig,
  cardEditor: false,
  animalSearch: '',
  collectionSelection: createCollectionSelection(),
  collectionWindow: createCollectionWindow(),
  collectionBatchSubmitting: false,
  collectionBatchError: null,
  savedAnimalViews: loadSavedViews(),
  activeAnimalViewId: localStorage.getItem('setae.gui.v2.activeAnimalView') || 'all',
  transientAnimalView: null,
  savedViewEditor: null,

  recordsView: 'history',
  recordFilter: 'all',
  recordsWindow: createListWindow(),
  records: [],
  recordsLoaded: false,
  qr: createQrWorkspaceState({ labelConfig: loadLabelConfig(localStorage) }),

  communityTab: 'care',
  careFeed: null,
  careDetail: null,
  careFilters: { scope: 'all', sort: 'active' },
  topics: null,
  topicDetail: null,
  topicFilters: { search: '', type: '', sort: 'updated' },
  species: null,
  speciesDetail: null,
  speciesSearch: '',
  breedingListings: null,
  communityError: null,

  settingsTab: 'my-setae',
  settings: {
    profile: null,
    pwaConfig: null,
    pwaPreferences: null,
    integrations: { external: null, live: null, chatgpt: null, result: null },
    relationships: null
  },
  diagnostics: {
    enabled: appConfig.canDiagnostics === true,
    loading: false,
    data: null,
    error: ''
  },

  dashboardEditing: false,
  dashboard: loadDashboard(localStorage, { order: loadWidgetOrder(), preferences: loadWidgetPreferences() }),
  dashboardEditor: null,
  personalization: initialPersonalization,
  careProfile: initialCareProfile,
  enclosureCareProfile: initialEnclosureCareProfile,
  taskActions: [],
  taskActionsApi: true,
  todayTasks: loadTodayTaskPreferences(localStorage),
  setupOpen: false,
  setupStep: 'preset',
  setupIntent: 'explore',
  onboarding: null,
  uiPreferencesApi: true,
  syncStatus: navigator.onLine ? 'idle' : 'offline',
  syncMessage: '',
  syncFailedCount: 0,
  sheet: null,
  quickRecord: {
    view: 'launcher',
    type: null,
    animalId: null,
    animalIds: [],
    qrCodes: [],
    submitting: false,
    error: null
  },
  modal: null,
  replyTarget: null,
  nurseryRegisterWindow: { ...createListWindow(), groupId: '' }
};

const collectionWorkspace = createCollectionWorkspaceController({
  appRoot: app, getState: () => state, builtInViews: builtInAnimalViews,
  getCareTasks: () => currentCareModel().tasks
});

function replaceAnimals(animals) {
  state.animals = Array.isArray(animals) ? animals : [];
  state.animalSearchIndex = createAnimalSearchIndex(state.animals);
  return state.animals;
}

const feedbackController = createFeedbackController({
  onChange: (toastState) => {
    state.toast = toastState;
    if (renderCoordinator.frameMounted) {
      renderCoordinator.feedback(renderAppFeedback(toastState));
    } else {
      render();
    }
  }
});

const formSafety = createFormSafetyController(app, {
  ownerId: () => state.mockMode ? 'mock' : currentUserId() || 'guest',
  onOverlayChange: () => overlayController.sync()
});
const planControls = createPlanController({ root: app, services, getProfile: () => state.settings.profile,
  setProfile: (profile) => { state.settings.profile = profile; updateBootstrapUser(profile); }, render, notify: showToast, mock: () => state.mockMode });
const trackAppSession = createAppSessionTracker(services, () => state.authenticated ? currentUserId() : null);

function syncSpecimenIntakeController() {
  const root = app.querySelector('[data-specimen-intake-root]');
  if (state.modal?.type !== 'animal' || !root) {
    specimenIntakeController?.destroy();
    specimenIntakeController = null;
    return null;
  }
  if (!specimenIntakeController) {
    specimenIntakeController = createSpecimenIntakeController({
      appRoot: app,
      getModalState: () => state.modal,
      updateModalState: (next) => { state.modal = next; },
      renderSpeciesRegion: (modalState) => renderSpecimenSpeciesRegion(modalState),
      speciesCombobox: speciesComboboxController,
      formSafety
    });
  }
  specimenIntakeController.mount(root);
  if (state.modal.imageFile) specimenIntakeController.setFileStatus(state.modal.imageFile);
  return specimenIntakeController;
}

function dismissSheetFromGesture(panel) {
  if (!panel?.isConnected || isDialogMutationBusy()) return false;
  const closeControl = panel.querySelector([
    '[data-action="close-quick-record"]',
    '[data-action="close-dashboard-editor"]',
    '[data-action="close-saved-view-editor"]',
    '[data-action="close-card-editor"]',
    '[data-action="close-sheet"]'
  ].join(','));
  if (closeControl && !closeControl.disabled) {
    closeControl.click();
    return true;
  }
  const backdrop = panel.closest('[data-overlay-backdrop][data-backdrop-action]');
  if (!backdrop) return false;
  backdrop.click();
  return true;
}

function swipeSpecimenTab(direction) {
  if (state.page !== 'animal-detail') return false;
  const order = ['overview', 'timeline', 'growth', 'photos', 'breeding'];
  const currentIndex = order.indexOf(normalizeSpecimenTab(state.specimenTab));
  const offset = direction === 'next' ? 1 : -1;
  const nextTab = order[currentIndex + offset];
  if (!nextTab) return false;
  updateSpecimenTab(nextTab);
  return true;
}

const mobileGestureController = createMobileGestureController(app, {
  isStandalone: () => isStandalonePwa(),
  isBusy: () => isDialogMutationBusy(),
  isEdgeAllowed: () => !state.modal
    && !hasSheetOpen()
    && !state.collectionSelection.selectionMode
    && !state.dashboardEditing
    && !document.querySelector('[data-dragging="true"], [aria-grabbed="true"], .is-dragging'),
  keyboardOpen: () => nativeViewportController.snapshot().keyboardOpen,
  onRequestBack: () => requestBack().catch((error) => console.error('SETAE edge navigation failed.', error)),
  onSheetDismiss: dismissSheetFromGesture,
  onSpecimenTabChange: swipeSpecimenTab
});
mobileGestureController.start();

function loadWidgetOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem('setae.gui.v2.dashboard.widgets') || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : [...defaultWidgetOrder];
  } catch {
    return [...defaultWidgetOrder];
  }
}

function loadWidgetPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem('setae.gui.v2.dashboard.preferences') || 'null');
    return Object.fromEntries(defaultWidgetOrder.map((key) => [key, {
      ...defaultWidgetPreferences[key],
      ...(parsed?.[key] || {})
    }]));
  } catch {
    return structuredClone(defaultWidgetPreferences);
  }
}

function applyUiPreferences(preferences = {}) {
  if (Array.isArray(preferences.dashboard_sections) && preferences.dashboard_sections.length) {
    state.dashboard = dashboardFromPreferences(preferences, state.dashboard);
  }
  if (['gallery', 'table'].includes(preferences.collection_view)) state.animalView = preferences.collection_view;
  if (animalCardModes.includes(preferences.animal_view)) {
    state.animalView = 'gallery';
    state.animalCardConfig = normalizeAnimalCardConfig({ ...state.animalCardConfig, mode: preferences.animal_view });
  }
  if (preferences.animal_card && typeof preferences.animal_card === 'object') {
    state.animalCardConfig = normalizeAnimalCardConfig(preferences.animal_card);
  }
  if (preferences.personalization && typeof preferences.personalization === 'object') {
    state.personalization = normalizePersonalization(preferences.personalization);
  }
  if (preferences.care_profile && typeof preferences.care_profile === 'object') {
    state.careProfile = normalizeCareProfile(preferences.care_profile);
  }
  if (preferences.enclosure_care_profile && typeof preferences.enclosure_care_profile === 'object') {
    state.enclosureCareProfile = normalizeEnclosureCareProfile(preferences.enclosure_care_profile);
  }
  if (preferences.nursery_care_profile && typeof preferences.nursery_care_profile === 'object') {
    state.nurseryCareProfile = normalizeNurseryCareProfile(preferences.nursery_care_profile);
  }
  if (preferences.today_tasks && typeof preferences.today_tasks === 'object') {
    state.todayTasks = normalizeTodayTaskPreferences(preferences.today_tasks);
  }
  if (['animals', 'babies'].includes(preferences.collection_tab)) state.collectionTab = preferences.collection_tab;
  if (preferences.collection_tab === 'feeders') state.husbandryTab = 'feeders';
  if (['feeders', 'enclosures', 'care'].includes(preferences.husbandry_tab)) state.husbandryTab = preferences.husbandry_tab;
  if (Array.isArray(preferences.animal_saved_views) && (preferences.animal_saved_views.length || !state.savedAnimalViews.length)) {
    state.savedAnimalViews = preferences.animal_saved_views.map(normalizeSavedView);
  }
  saveDashboard(state.dashboard);
  saveSavedViews(state.savedAnimalViews);
  localStorage.setItem('setae.gui.v2.animalView', state.animalView);
  localStorage.setItem('setae.gui.v4.collectionView', state.animalView);
  saveAnimalCardConfig(localStorage, state.animalCardConfig);
  savePersonalization(localStorage, state.personalization);
  saveCareProfile(localStorage, state.careProfile);
  saveEnclosureCareProfile(localStorage, state.enclosureCareProfile);
  saveNurseryCareProfile(localStorage, state.nurseryCareProfile);
  saveTodayTaskPreferences(localStorage, state.todayTasks);
}

function uiPreferencesPayload() {
  return {
    dashboard_sections: state.dashboard.sections,
    animal_saved_views: state.savedAnimalViews,
    animal_view: state.animalView,
    collection_view: state.animalView,
    collection_tab: state.collectionTab,
    husbandry_tab: state.husbandryTab,
    animal_card: state.animalCardConfig,
    personalization: {
      presetId: state.personalization.presetId,
      customized: state.personalization.customized,
      setupCompleted: state.personalization.setupCompleted
    },
    care_profile: state.careProfile,
    enclosure_care_profile: state.enclosureCareProfile,
    nursery_care_profile: state.nurseryCareProfile,
    today_tasks: state.todayTasks
  };
}

async function loadUiPreferences() {
  if (!state.authenticated || !state.uiPreferencesApi) return;
  try {
    applyUiPreferences(await services.account.uiPreferences());
  } catch (error) {
    if (error?.status === 404) state.uiPreferencesApi = false;
  }
}

function persistUiPreferences() {
  saveDashboard(state.dashboard);
  saveSavedViews(state.savedAnimalViews);
  localStorage.setItem('setae.gui.v2.animalView', state.animalView);
  localStorage.setItem('setae.gui.v4.collectionView', state.animalView);
  saveAnimalCardConfig(localStorage, state.animalCardConfig);
  savePersonalization(localStorage, state.personalization);
  saveCareProfile(localStorage, state.careProfile);
  saveEnclosureCareProfile(localStorage, state.enclosureCareProfile);
  saveNurseryCareProfile(localStorage, state.nurseryCareProfile);
  saveTodayTaskPreferences(localStorage, state.todayTasks);
  if (!state.authenticated || !state.uiPreferencesApi) return;
  window.clearTimeout(persistUiPreferences.timer);
  persistUiPreferences.timer = window.setTimeout(async () => {
    try {
      applyUiPreferences(await services.account.saveUiPreferences(uiPreferencesPayload()));
    } catch (error) {
      if (error?.status === 404) state.uiPreferencesApi = false;
    }
  }, 300);
}

function pageTitle() {
  return ({
    today: '今日',
    animals: '個体管理',
    husbandry: '飼育管理',
    'animal-detail': state.selectedAnimal ? animalCode(state.selectedAnimal) : '個体詳細',
    records: '記録',
    community: '交流',
    settings: '設定'
  })[state.page] || 'SETAE';
}

function currentCareModel() {
  return buildTaskModel({
    animals: state.animals,
    enclosures: state.enclosures,
    nurseries: state.babyGroups,
    records: state.records,
    actions: state.taskActions,
    profile: state.careProfile,
    enclosureProfile: state.enclosureCareProfile,
    nurseryProfile: state.nurseryCareProfile,
    summary: state.careSummary
  });
}

function frameChromeOptions() {
  const userName = state.bootstrap?.user?.display_name || state.settings.profile?.display_name || 'アカウント';
  return { page: state.page, pageTitle: pageTitle(), authenticated: state.authenticated, mockMode: state.mockMode,
    online: state.online, pendingSyncCount: offlineQueue.list().length, syncStatus: state.syncStatus,
    syncMessage: state.syncMessage, syncFailedCount: state.syncFailedCount, userName,
    activeViewId: state.activeAnimalViewId, savedViews: state.savedAnimalViews };
}

function frameOptions(content) {
  const overlaysHtml = `${state.sheet === 'record-launcher' ? renderQuickRecordLauncher({ animals: state.animals, recent: loadQuickRecordRecent(), animalId: state.quickRecord.animalId, careTasks: currentCareModel().tasks }) : ''}
    ${state.sheet === 'record-form' ? renderRecordForm({ quickRecord: state.quickRecord, animals: state.animals, selectedAnimalId: state.selectedAnimalId, recent: loadQuickRecordRecent() }) : ''}
    ${state.sheet === 'collection-status' ? renderCollectionStatusDialog({ count: state.collectionSelection.selectedIds.length, error: state.collectionBatchError, submitting: state.collectionBatchSubmitting }) : ''}
    ${renderDashboardEditor(state.dashboardEditor, state.dashboard)}
    ${renderSavedViewEditor(state.savedViewEditor)}
    ${state.cardEditor ? renderAnimalCardEditor(state.animalCardConfig, state.animals[0]) : ''}
    ${renderModal(state.modal, { animals: state.animals, feeders: state.feeders, enclosures: state.enclosures })}
    ${state.setupOpen ? renderSetaeSetup({
      selectedPresetId: state.personalization.previewPresetId,
      step: state.setupStep,
      intent: state.setupIntent,
      hasExistingData: state.animals.length > 0 || (state.babyGroups?.items || []).length > 0
    }) : ''}`;

  return {
    ...frameChromeOptions(),
    content,
    errorMessage: state.error,
    overlaysHtml,
    toastMessage: state.toast,
    updateNoticeHtml: appUpdateNotice()
  };
}

function renderSyncStatusIslands() {
  if (renderCoordinator.frameMounted) renderCoordinator.chrome(renderAppFrameRegions(frameChromeOptions()));
}

function appUpdateNotice() {
  if (!state.appUpdateAvailable) return '';
  return `
    <aside class="app-update-notice" role="status" aria-live="polite">
      ${renderBrand({ className: 'app-update-brand', size: 'compact', subtitle: '' })}
      <div class="app-update-copy"><strong>新しいバージョンがあります</strong><span>更新すると最新の画面へ切り替わります。</span></div>
      ${button(state.appUpdateApplying ? '更新中…' : '更新', { action: 'apply-app-update', primary: true, disabled: state.appUpdateApplying, loading: state.appUpdateApplying })}
    </aside>
  `;
}

function renderUpdateNoticeIsland() {
  if (renderCoordinator.frameMounted) renderCoordinator.updateNotice(appUpdateNotice());
  else render();
}

function syncMountedContent() { syncBusyDialogControls(app); overlayController.sync(); formSafety.sync(); hydrateQrCodes(app); }
function setAppContent(content, { view = 'standalone' } = {}) {
  overlayController.beforeRender(); renderCoordinator.mount(`${content}${view === 'app' ? '' : appUpdateNotice()}`, { view });
  syncMountedContent();
}
function prepareAppContent(content, { view = 'standalone', generation, afterCommit = null, afterPageCommit = null, stagedPage = null } = {}) { return { generation, afterCommit, afterPageCommit, stagedPage, mount: renderCoordinator.prepareMount(`${content}${view === 'app' ? '' : appUpdateNotice()}`, { view }) }; }
async function commitPreparedAppContent(prepared) {
  if (!prepared || prepared.generation !== initialRenderGeneration) return false;
  overlayController.beforeRender();
  if (!prepared.mount.commit({ guard: () => prepared.generation === initialRenderGeneration })) return false;
  syncMountedContent();
  if (prepared.stagedPage !== null) {
    await waitForInitialPaint();
    if (prepared.generation !== initialRenderGeneration || !renderCoordinator.page(prepared.stagedPage, { force: true })) return false;
    syncMountedContent();
  }
  if (prepared.afterPageCommit && !await prepared.afterPageCommit()) return false;
  prepared.afterCommit?.();
  return true;
}
function renderAppIslands(content, { preservePage = false } = {}) {
  const options = frameOptions(content);
  if (!renderCoordinator.frameMounted) {
    setAppContent(renderAppFrame(options), { view: 'app' });
    syncSpecimenIntakeController();
    return;
  }

  overlayController.beforeRender();
  const regions = renderAppFrameRegions(options);
  if (preservePage) { renderCoordinator.accept('page', regions.page); delete regions.page; }
  const stableSpecimenForm = state.modal?.type === 'animal'
    ? app.querySelector('[data-stable-form="specimen-intake"]')
    : null;
  if (stableSpecimenForm?.isConnected && Object.hasOwn(regions, 'overlays')) {
    renderCoordinator.accept('overlays', regions.overlays);
    delete regions.overlays;
  }
  const changed = renderCoordinator.all(regions);
  const pageChanged = changed.includes('page');
  const overlaysChanged = changed.includes('overlays');
  if (pageChanged || overlaysChanged) {
    syncBusyDialogControls(app);
    formSafety.sync();
    hydrateQrCodes(renderCoordinator.root(overlaysChanged ? 'overlays' : 'page') || app);
    overlayController.sync();
  }
  syncSpecimenIntakeController();
}

function syncPagePresentation() {
  const metadata = pageMetadata({
    page: state.page,
    animal: state.selectedAnimal,
    enclosure: state.selectedEnclosure,
    babyGroup: state.babyDetail,
    collectionTab: state.collectionTab,
    recordsView: state.recordsView,
    communityView: state.communityTab
  });
  const routeChanged = metadata.key !== lastPageMetadataKey;
  applyPageMetadata(metadata, { announce: routeChanged });
  if (routeChanged && pendingPageFocus) {
    requestAnimationFrame(() => focusAppMain());
  }
  if (routeChanged) lastPageMetadataKey = metadata.key;
  pendingPageFocus = false;
}

function render(options = {}) {
  const generation = ++initialRenderGeneration;
  const standalone = (content) => options.prepare ? prepareAppContent(content, { generation }) : setAppContent(content);
  if (state.loading) return standalone(renderBootPage());
  if (state.connectionError && !state.mockMode && !state.publicMode) return standalone(renderConnectionErrorPage({ error: state.connectionError, mockEnabled }));
  if (state.authenticated === false && !state.publicMode && !state.mockMode) {
    return standalone(renderAuthPage({
      view: state.authView,
      registrationEnabled: state.bootstrap?.registration_enabled !== false,
      termsUrl: state.bootstrap?.links?.terms || '/terms/',
      termsVersion: String(state.bootstrap?.terms_version || '2026-03-01'),
      submitting: state.authSubmitting,
      error: state.authError,
      message: state.authMessage,
      mockEnabled
    }));
  }

  let content = '';
  let preparedRecordsWindow = null;
  const careModel = currentCareModel();
  if (state.page === 'today') {
    const onboardingProgress = deriveOnboardingProgress({
      animals: state.animals,
      babyGroups: state.babyGroups,
      records: state.records, firstRecordAt: state.settings.profile?.onboarding?.first_record_at
    });
    content = renderToday({
      summary: state.careSummary,
      animals: state.animals,
      babyGroups: state.babyGroups,
      feeders: state.feeders,
      enclosures: state.enclosures,
      records: state.records,
      careModel,
      taskQueueVisible: state.todayTasks.visible,
      taskPreferences: state.todayTasks,
      dashboardEditing: state.dashboardEditing,
      dashboard: state.dashboard,
      arrivalContext: { ownerId: currentUserId(), notifications: state.settings.pwaPreferences?.enabled },
      onboardingProgress: shouldShowGettingStarted({
        setupCompleted: state.personalization.setupCompleted,
        onboarding: state.onboarding || {},
        progress: onboardingProgress
      }) ? onboardingProgress : null
    });
  } else if (state.page === 'animals') {
    const animalViews = [...builtInAnimalViews, ...state.savedAnimalViews, ...(state.transientAnimalView ? [state.transientAnimalView] : [])];
    const activeAnimalView = activeCollectionView();
    content = renderCollection({
      tab: state.collectionTab,
      animals: state.animals,
      animalMode: state.animalView,
      animalSearch: state.animalSearch,
      animalSearchIndex: state.animalSearchIndex,
      animalViews,
      activeAnimalView,
      careTasks: careModel.tasks,
      collectionSelection: state.collectionSelection,
      collectionWindow: collectionWorkspace.currentWindow(),
      animalCardConfig: state.animalCardConfig,
      babyGroups: state.babyGroups,
      babyDetail: state.babyDetail,
      nurseryCareProfile: state.nurseryCareProfile,
      nurseryRegisterWindow: state.nurseryRegisterWindow,
      loading: state.viewLoading
    });
  } else if (state.page === 'husbandry') {
    content = renderHusbandry({
      tab: state.husbandryTab,
      animals: state.animals,
      feeders: state.feeders,
      enclosures: state.enclosures,
      enclosureDetail: state.selectedEnclosure,
      careProfile: state.careProfile,
      enclosureCareProfile: state.enclosureCareProfile,
      babyGroups: state.babyGroups,
      nurseryCareProfile: state.nurseryCareProfile,
      loading: state.viewLoading
    });
  } else if (state.page === 'animal-detail') {
    content = renderAnimalDetail({
      animal: state.selectedAnimal,
      events: state.selectedEvents,
      babyGroups: state.babyGroups,
      tab: state.specimenTab,
      timelineFilter: state.specimenTimelineFilter,
      photoFilter: state.specimenPhotoFilter,
      loadingEvents: state.loadingEvents
    });
  } else if (state.page === 'records') {
    preparedRecordsWindow = options.prepare && state.recordsView === 'history' && filterRecords(state.records, state.recordFilter).length > 5
      ? { ...state.recordsWindow, initial: Math.min(5, state.recordsWindow.limit), limit: Math.min(5, state.recordsWindow.limit) } : null;
    content = renderRecords({ records: state.records, animals: state.animals, filter: state.recordFilter,
      view: state.recordsView, qr: state.qr, loading: state.viewLoading, listWindow: preparedRecordsWindow || state.recordsWindow, deferRows: Boolean(preparedRecordsWindow) });
  } else if (state.page === 'community') {
    content = renderCommunity({
      tab: state.communityTab,
      authenticated: Boolean(state.authenticated || state.mockMode),
      loading: state.viewLoading,
      data: {
        careFeed: state.careFeed,
        careDetail: state.careDetail,
        careFilters: state.careFilters,
        topics: state.topics,
        topicDetail: state.topicDetail,
        topicFilters: state.topicFilters,
        species: state.species,
        speciesDetail: state.speciesDetail,
        speciesSearch: state.speciesSearch,
        breedingListings: state.breedingListings,
        error: state.communityError
      }
    });
  } else if (state.page === 'settings') {
    content = renderSettings({
      tab: state.settingsTab,
      data: state.settings,
      loading: state.viewLoading,
      offlineQueue: offlineQueue.list(),
      personalization: state.personalization,
      dashboard: state.dashboard,
      animalCardConfig: state.animalCardConfig,
      savedViewCount: builtInAnimalViews.length + state.savedAnimalViews.length,
      careProfile: state.careProfile,
      animals: state.animals,
      todayTasks: state.todayTasks,
      syncStatus: state.syncStatus,
      syncMessage: state.syncMessage,
      syncFailedCount: state.syncFailedCount,
      diagnostics: state.diagnostics,
      appInfo: {
        version: appConfig.version || state.bootstrap?.plugin_version || '',
        termsUrl: state.bootstrap?.links?.terms || '/terms/',
        privacyUrl: state.bootstrap?.links?.privacy || '/privacy-policy/'
      }
    });
  }
  if (options.prepare) {
    const preparedFrame = frameOptions(content);
    return prepareAppContent(renderAppFrame({ ...preparedFrame, content: renderAppPagePreparation() }), {
      view: 'app', generation, stagedPage: content,
      afterPageCommit: preparedRecordsWindow ? async () => {
        const hydrated = await hydrateRecordsWindow(app, { records: state.records, filter: state.recordFilter, initialWindow: preparedRecordsWindow, renderedLimit: 0,
          targetWindow: state.recordsWindow, nextPaint: waitForInitialPaint, guard: () => generation === initialRenderGeneration && state.page === 'records' && state.recordsView === 'history' });
        if (!hydrated) return false;
        renderCoordinator.accept('page', renderRecords({ records: state.records, animals: state.animals, filter: state.recordFilter,
          view: state.recordsView, qr: state.qr, loading: state.viewLoading, listWindow: state.recordsWindow }));
        return true;
      } : null, afterCommit: () => { syncSpecimenIntakeController(); syncPagePresentation(); }
    });
  }
  renderAppIslands(content, options);
  syncPagePresentation();
}

function updateSpecimenTab(tab = state.specimenTab, { focusActive = false } = {}) {
  state.specimenTab = normalizeSpecimenTab(tab);
  if (navigationInitialized && state.page === 'animal-detail') replaceRoute(captureRoute(window.scrollY));
  const navigation = app.querySelector('[data-specimen-tab-navigation]');
  const target = app.querySelector('[data-specimen-tab-content]');
  if (!navigation || !target || !state.selectedAnimal) {
    render();
    return;
  }
  navigation.innerHTML = renderSpecimenTabNavigation(state.specimenTab);
  target.innerHTML = renderSpecimenTabContent(state.specimenTab, {
    animal: state.selectedAnimal,
    events: state.selectedEvents,
    babyGroups: state.babyGroups,
    timelineFilter: state.specimenTimelineFilter,
    photoFilter: state.specimenPhotoFilter,
    loadingEvents: state.loadingEvents
  });
  target.dataset.specimenActiveTab = state.specimenTab;
  target.setAttribute('aria-labelledby', tabId('specimen', state.specimenTab));
  registerMediaFallbacks(target);
  requestAnimationFrame(() => {
    const activeTab = navigation.querySelector('[role="tab"][aria-selected="true"]');
    activeTab?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
    if (focusActive) activeTab?.focus({ preventScroll: true });
  });
}

function escapeForApp(value) {
  return escapeHtml(value ?? '');
}

function animalLabelById(id) {
  const animal = state.animals.find((item) => String(item.id) === String(id));
  return animal ? animalCode(animal) : `#${id}`;
}

function resetQuickRecord(overrides = {}) {
  state.quickRecord = {
    view: 'launcher',
    type: null,
    animalId: null,
    animalIds: [],
    qrCodes: [],
    submitting: false,
    error: null,
    ...overrides
  };
}

const invalidRecordTypeMessage = '記録の種類を確認できませんでした。画面を更新して、もう一度お試しください。';

function requestedRecordType(value, source = 'unknown') {
  const type = resolveRecordType(value);
  if (type) return type;
  console.error('SETAE record action is missing a valid record type.', { source, value });
  showToast(invalidRecordTypeMessage, 'error');
  return null;
}

function notifyProgrammaticInput(control, { change = false } = {}) {
  if (!control) return;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  if (change) control.dispatchEvent(new Event('change', { bubbles: true }));
}

function currentUserId() {
  const user = state.bootstrap?.user || state.settings.profile || {};
  const userId = Number(user.id || user.ID || user.user_id || 0);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function onboardingOwnerId() {
  return state.mockMode ? 'mock' : currentUserId() || 0;
}

function loadCurrentOnboarding() {
  state.onboarding = loadOnboardingState(localStorage, onboardingOwnerId());
  return state.onboarding;
}

function refreshOnboarding({ announce = true, settleExisting = false } = {}) {
  const progress = deriveOnboardingProgress({
    animals: state.animals,
    babyGroups: state.babyGroups,
    records: state.records, firstRecordAt: state.settings.profile?.onboarding?.first_record_at
  });
  if (progress.complete && settleExisting && !state.onboarding?.completionAnnounced) {
    state.onboarding = saveOnboardingState(localStorage, onboardingOwnerId(), {
      ...state.onboarding,
      dismissed: true,
      completionAnnounced: true
    });
    return progress;
  }
  const result = completeOnboardingIfNeeded(state.onboarding || {}, progress, { announce });
  if (result.announced) {
    state.onboarding = saveOnboardingState(localStorage, onboardingOwnerId(), result.state);
    showToast('SETAEの基本設定が完了しました。');
  }
  return progress;
}

function activateOfflineQueueOwner() {
  const result = offlineQueue.setOwner(state.authenticated ? currentUserId() : null);
  if (result.discardedLegacyCount) {
    showToast(`所有者を確認できない旧形式の同期待ち${result.discardedLegacyCount}件は送信しませんでした。`, 'warning');
  }
  syncQueueState();
  return result.ownerId;
}

async function boot() {
  state.loading = true;
  state.connectionError = null;
  state.error = null;
  if (app.querySelector('[data-app-startup]')) await waitForInitialPaint(); else render();
  try {
    state.bootstrap = await services.app.bootstrap();
    state.bootstrapped = true;
    state.authenticated = state.bootstrap?.authenticated === true;
    state.settings.profile = state.bootstrap?.user || null;
    activateOfflineQueueOwner();
    loadCurrentOnboarding();
    applyTheme(state.settings.profile?.theme_preference || 'system');

    const params = new URLSearchParams(location.search);
    const publicRouteTab = publicCommunityTabFromPath();
    const requestedAuthView = params.get('setae_auth');
    if (!state.authenticated && ['login', 'register', 'reset'].includes(requestedAuthView)) {
      state.authView = requestedAuthView === 'register' && state.bootstrap?.registration_enabled === false
        ? 'login'
        : requestedAuthView;
    }
    if (!state.authenticated && params.get('verified') === '1') {
      state.authView = 'login';
      state.authMessage = 'メールアドレスを確認しました。ログインしてください。';
    }
    if (params.get('uid') && params.get('token')) {
      const result = await services.account.verifyEmail(params.get('uid'), params.get('token'));
      state.authMessage = result?.message || 'メールアドレスを確認しました。ログインしてください。';
      history.replaceState({}, '', cleanAppPath());
    }

    if (state.authenticated) {
      await loadUiPreferences();
      state.setupOpen = false;
      await loadPrivateData();
      if (params.get('setae_plan')) { state.page = 'settings'; await loadSettingsTab('plan', { force: true }); }
      refreshOnboarding({ announce: false, settleExisting: true });
      await syncOfflineQueue({ quiet: true });
      const returnUrl = consumeRequestedReturnUrl();
      if (returnUrl) {
        location.replace(returnUrl);
        return;
      }
      if (publicRouteTab) {
        state.page = 'community';
        state.communityTab = publicRouteTab;
        await loadCommunityTab(publicRouteTab);
      }
      const qrCode = parseQrCode(params.get('setae_qr_scan') || '');
      if (qrCode) {
        state.page = 'records';
        state.recordsView = 'qr';
        state.qr = { ...state.qr, section: 'scan', scannerMode: 'single', prefillCode: qrCode };
        const target = await resolveQrCode(qrCode);
        if (params.get('setae_qr_action') === 'open' && target?.target_type === 'spider' && target?.object_id) {
          await openAnimal(target.object_id);
        }
        history.replaceState({}, '', cleanAppPath());
      }
    } else if (publicRouteTab || state.publicMode) {
      state.publicMode = true;
      state.page = 'community';
      state.communityTab = publicRouteTab || 'topics';
      await loadCommunityTab(state.communityTab);
    }
  } catch (error) {
    console.error('SETAE API connection failed.', error);
    state.connectionError = error?.message || 'SETAEに接続できませんでした。通信環境をご確認のうえ、もう一度お試しください。';
    state.authenticated = null;
  } finally {
    state.loading = false;
    const prepared = render({ prepare: true }); await waitForInitialPaint();
    const committed = prepared ? await commitPreparedAppContent(prepared) : false;
    if (!committed && navigationInitialized) return;
    if (!state.connectionError && (state.authenticated || state.mockMode || state.publicMode)) {
      const priorRoute = isRouteState(history.state) ? createRouteState(history.state) : null;
      navigationIndex = priorRoute?.index || 0;
      replaceRoute(captureRoute(priorRoute?.scrollY || window.scrollY));
    }
  }
}

async function loadPrivateData() {
  const [care, animals, recent, taskActions] = await Promise.all([
    services.care.summary(),
    services.animals.listAll({ scope: 'active' }),
    listJournalRecords({ limit: 100 }).catch(() => null),
    loadRemoteTaskActions()
  ]);
  state.careSummary = care;
  replaceAnimals(animals.items);
  state.records = recent ? normalizeRecentRecords(recent, state.animals) : [];
  state.recordsLoaded = Boolean(recent);
  state.taskActions = saveTaskActions(localStorage, [...loadTaskActions(localStorage, taskActionStorageScope()), ...taskActions], taskActionStorageScope());
  state.collectionSelection = reconcileCollectionSelection(state.collectionSelection, state.animals);
  const [babies, feeders, enclosures] = await Promise.allSettled([
    services.babies.list(),
    services.feeders.dashboard(),
    services.enclosures.list()
  ]);
  state.babyGroups = babies.status === 'fulfilled' ? babies.value : null;
  state.feeders = feeders.status === 'fulfilled' ? feeders.value : null;
  state.enclosures = enclosures.status === 'fulfilled' ? enclosures.value : null;
  void trackAppSession();
}

async function refreshAnimalsAndCare({ includeRecords = false } = {}) {
  const requests = [
    services.animals.listAll({ scope: 'active' }),
    services.care.summary()
  ];
  if (includeRecords) requests.push(listJournalRecords({ limit: 100 }));
  const [animals, summary, recent] = await Promise.all(requests);
  replaceAnimals(animals.items);
  state.careSummary = summary;
  if (includeRecords) {
    state.records = normalizeRecentRecords(recent, state.animals);
    state.recordsLoaded = true;
    state.recordsWindow = clampListWindow(state.recordsWindow, filterRecords(state.records, state.recordFilter).length);
  }
  state.collectionSelection = reconcileCollectionSelection(state.collectionSelection, state.animals);
  if (!includeRecords) state.recordsLoaded = false;
  refreshOnboarding();
}

function normalizeRecentRecords(value, animals = state.animals) {
  const items = Array.isArray(value) ? value : value?.items || value?.events || [];
  return items.map((item) => {
    const event = item.event || item;
    const targetType = item.target_type || item.targetType || (item.enclosure || item.enclosure_id || event.enclosure_id ? 'enclosure' : 'animal');
    if (targetType === 'nursery') {
      const nurseryId = item.target_id ?? item.targetId ?? item.nursery_id ?? item.nursery?.id ?? event.target_id;
      const nursery = item.nursery || [...(state.babyGroups?.items || []), ...(state.babyGroups?.archived_items || [])].find((candidate) => String(candidate.id) === String(nurseryId)) || { id: nurseryId, name: item.nursery_name || `ベビー群 #${nurseryId}` };
      return { targetType: 'nursery', targetId: nurseryId, nursery, event: { ...event, type: event.type || event.event_type, date: event.date || event.event_date, target_id: nurseryId } };
    }
    if (targetType === 'enclosure') {
      const enclosureId = item.target_id ?? item.targetId ?? item.enclosure_id ?? item.enclosure?.id ?? event.enclosure_id;
      const enclosure = item.enclosure || enclosureById(enclosureId) || { id: enclosureId, code: item.enclosure_code || `#${enclosureId}`, name: item.enclosure_name || '' };
      return {
        targetType: 'enclosure',
        targetId: enclosureId,
        enclosure,
        event: {
          ...event,
          type: event.type || event.event_type,
          date: event.date || event.event_date,
          enclosure_id: enclosureId
        }
      };
    }
    const animalId = item.animal_id ?? item.spider_id ?? event.animal_id ?? event.spider_id;
    const animal = item.animal || animals.find((candidate) => String(candidate.id) === String(animalId)) || { id: animalId, title: item.animal_code || `#${animalId}`, species_name: item.species_name || '' };
    return { targetType: 'animal', targetId: animalId, event, animal };
  }).sort((left, right) => String(right.event?.date || '').localeCompare(String(left.event?.date || '')) || Number(right.event?.id || 0) - Number(left.event?.id || 0));
}

async function listJournalRecords(options = {}) {
  try {
    return await services.care.listJournal(options);
  } catch (error) {
    if (error?.status !== 404) throw error;
    return services.care.listRecent(options);
  }
}

async function loadRemoteTaskActions() {
  if (!state.authenticated || !state.taskActionsApi) return [];
  const since = new Date();
  since.setDate(since.getDate() - 180);
  try {
    const result = await services.tasks.list({ since: since.toLocaleDateString('sv-SE') });
    return Array.isArray(result) ? result : result?.items || [];
  } catch (error) {
    if (error?.status === 404) state.taskActionsApi = false;
    return [];
  }
}

function taskActionStorageScope() {
  if (state.mockMode) return 'mock';
  const userId = state.bootstrap?.user?.id || state.bootstrap?.user?.ID || state.bootstrap?.user?.user_id;
  return userId ? `user-${userId}` : 'anonymous';
}

function pendingTask(targetType, targetId, type) {
  return currentCareModel().tasks.find((task) => task.targetType === targetType
    && String(task.targetId) === String(targetId)
    && task.type === type
    && ['overdue', 'today'].includes(task.bucket)) || null;
}

async function persistTaskAction(task, outcome, options = {}) {
  if (!task) return null;
  const action = createTaskAction(task, outcome, options);
  await persistPreparedTaskActions([action]);
  return action;
}

async function persistPreparedTaskActions(actions = []) {
  const valid = actions.filter(Boolean);
  if (!valid.length) return [];
  valid.forEach((action) => { state.taskActions = upsertTaskAction(state.taskActions, action); });
  saveTaskActions(localStorage, state.taskActions, taskActionStorageScope());
  if (state.mockMode || !state.taskActionsApi) return valid;
  try {
    const saved = valid.length === 1
      ? await services.tasks.save(valid[0])
      : await services.tasks.saveMany(valid);
    const savedItems = saved?.items || (saved?.item ? [saved.item] : valid);
    savedItems.forEach((action) => { state.taskActions = upsertTaskAction(state.taskActions, action); });
    saveTaskActions(localStorage, state.taskActions, taskActionStorageScope());
  } catch (error) {
    if (error?.status === 404) state.taskActionsApi = false;
    else if (error?.code === 'network_error') {
      const offlineAction = valid.length === 1 ? 'save_task_action' : 'save_task_actions_batch';
      const payload = valid.length === 1 ? valid[0] : { items: valid };
      enqueueOffline(offlineAction, valid[0]?.targetId || 0, payload);
    }
  }
  return valid;
}

const enclosureTaskType = (eventType) => ({
  environment_check: 'environment',
  misting: 'misting',
  watering: 'watering',
  maintenance: 'maintenance',
  substrate_change: 'substrate'
})[eventType] || '';

async function loadCollectionTab(tab) {
  state.collectionTab = ['animals', 'babies'].includes(tab) ? tab : 'animals';
  persistUiPreferences();
  state.babyDetail = null;
  if (state.mockMode) {
    state.viewLoading = false;
    render();
    return;
  }
  state.viewLoading = true;
  render();
  try {
    if (tab === 'babies') state.babyGroups = await services.babies.list();
  } catch (error) {
    await handleApiError(error);
  } finally {
    state.viewLoading = false;
    render();
  }
}

async function loadHusbandryTab(tab = 'enclosures') {
  state.husbandryTab = ['feeders', 'enclosures', 'care'].includes(tab) ? tab : 'enclosures';
  persistUiPreferences();
  state.selectedEnclosureId = null;
  state.selectedEnclosure = null;
  if (state.mockMode || state.husbandryTab === 'care') {
    state.viewLoading = false;
    render();
    return;
  }
  state.viewLoading = true;
  render();
  try {
    if (state.husbandryTab === 'feeders') state.feeders = await services.feeders.dashboard();
    else state.enclosures = await services.enclosures.list();
  } catch (error) {
    await handleApiError(error);
  } finally {
    state.viewLoading = false;
    render();
  }
}

function enclosureById(id) {
  const items = Array.isArray(state.enclosures) ? state.enclosures : state.enclosures?.items || [];
  return items.find((item) => String(item.id) === String(id)) || null;
}

async function openEnclosure(id, { history: historyMode = 'push', scroll = true } = {}) {
  pendingPageFocus = historyMode !== 'none';
  if (historyMode !== 'none') saveCurrentRouteScroll();
  state.selectedEnclosureId = String(id);
  state.page = 'husbandry';
  state.husbandryTab = 'enclosures';
  commitCurrentRoute(historyMode, 0);
  if (scroll) window.scrollTo(0, 0);
  if (state.mockMode) {
    state.selectedEnclosure = enclosureById(id);
    render();
    return;
  }
  state.viewLoading = true;
  render();
  try {
    state.selectedEnclosure = await services.enclosures.get(id);
  } catch (error) {
    await handleApiError(error);
  } finally {
    state.viewLoading = false;
    render();
  }
}

function nurseryById(id) {
  if (String(state.babyDetail?.id || '') === String(id || '')) return state.babyDetail;
  return [...(state.babyGroups?.items || []), ...(state.babyGroups?.archived_items || [])]
    .find((group) => String(group.id) === String(id)) || null;
}

async function openNursery(id, { history: historyMode = 'push', scroll = true } = {}) {
  pendingPageFocus = historyMode !== 'none';
  if (historyMode !== 'none') saveCurrentRouteScroll();
  const groupId = String(id || '');
  if (state.nurseryRegisterWindow.groupId !== groupId) {
    state.nurseryRegisterWindow = listWindowForGroup(resetListWindow(state.nurseryRegisterWindow), groupId);
  }
  state.page = 'animals';
  state.collectionTab = 'babies';
  state.babyDetail = nurseryById(id) || { id };
  commitCurrentRoute(historyMode, 0);
  if (scroll) window.scrollTo(0, 0);
  if (state.mockMode) {
    state.viewLoading = false;
    render();
    return;
  }
  state.viewLoading = true;
  render();
  try { state.babyDetail = await services.babies.get(id); }
  catch (error) { await handleApiError(error); }
  state.viewLoading = false;
  render();
}

async function refreshEnclosures({ detail = true, animals = false } = {}) {
  state.enclosures = await services.enclosures.list();
  if (animals) await refreshAnimalsAndCare();
  if (detail && state.selectedEnclosureId) {
    state.selectedEnclosure = await services.enclosures.get(state.selectedEnclosureId);
  }
}

async function loadRecords({ force = false } = {}) {
  if (state.recordsLoaded && !force) return;
  if (state.mockMode) {
    state.recordsLoaded = true;
    state.viewLoading = false;
    render();
    return;
  }
  state.viewLoading = true;
  render();
  try {
    state.records = normalizeRecentRecords(await listJournalRecords({ limit: 100 }), state.animals);
    state.recordsLoaded = true;
    state.recordsWindow = clampListWindow(state.recordsWindow, filterRecords(state.records, state.recordFilter).length);
  } catch (error) {
    await handleApiError(error);
  } finally {
    state.viewLoading = false;
    render();
  }
}

async function loadQr() {
  if (!state.authenticated) return;
  try {
    state.qr.transfers = await services.qr.transfers();
  } catch (error) {
    await handleApiError(error);
  }
}

async function loadCommunityTab(tab, { force = false } = {}) {
  if (!state.authenticated && tab === 'care') tab = 'topics';
  state.communityTab = tab;
  state.careDetail = null;
  state.topicDetail = null;
  state.speciesDetail = null;
  state.communityError = null;
  state.viewLoading = true;
  render();
  try {
    if (tab === 'care' && (force || !state.careFeed)) {
      state.careFeed = await services.care.feedList(state.careFilters);
      services.care.markFeedRead().catch(() => {});
    } else if (tab === 'topics' && (force || !state.topics)) {
      state.topics = await services.topics.list(state.topicFilters);
    } else if (tab === 'species' && (force || !state.species)) {
      state.species = await services.species.list({ search: state.speciesSearch, perPage: 40 });
    } else if (tab === 'breeding' && (force || !state.breedingListings)) {
      state.breedingListings = await services.breeding.listings();
    }
  } catch (error) {
    if (error?.status === 401) await handleApiError(error);
    else state.communityError = {
      status: Number(error?.status || 0),
      message: error?.message || '交流の内容を読み込めませんでした。'
    };
  } finally {
    state.viewLoading = false;
    render();
  }
}

async function loadSettingsTab(tab, { force = false } = {}) {
  if (state.mockMode) {
    state.settingsTab = tab;
    state.settings.profile ||= state.bootstrap?.user || { display_name: 'デモユーザー', email: 'demo@example.com', theme_preference: 'system' };
    state.viewLoading = false;
    render();
    return;
  }
  if (!state.authenticated) {
    state.publicMode = false;
    render();
    return;
  }
  state.settingsTab = tab;
  state.viewLoading = true;
  render();
  try {
    if (['profile', 'plan'].includes(tab) && (force || tab === 'plan' || !state.settings.profile)) {
      state.settings.profile = await services.account.get();
      updateBootstrapUser(state.settings.profile);
    } else if (tab === 'notifications' && (force || !state.settings.pwaConfig)) {
      const [config, preferences] = await Promise.allSettled([
        services.notifications.config(),
        services.notifications.preferences()
      ]);
      state.settings.pwaConfig = config.status === 'fulfilled' ? config.value : {};
      state.settings.pwaPreferences = preferences.status === 'fulfilled' ? preferences.value : {};
    } else if (tab === 'integrations' && (force || !state.settings.integrations.external)) {
      const [external, live, chatgpt] = await Promise.allSettled([
        services.integrations.externalStatus(),
        services.integrations.liveStatus(),
        services.integrations.chatgptStatus()
      ]);
      state.settings.integrations = {
        ...state.settings.integrations,
        external: external.status === 'fulfilled' ? external.value : {},
        live: live.status === 'fulfilled' ? live.value : {},
        chatgpt: chatgpt.status === 'fulfilled' ? chatgpt.value : {}
      };
    } else if (tab === 'social' && (force || !state.settings.relationships)) {
      state.settings.relationships = await services.social.relationships();
    }
  } catch (error) {
    await handleApiError(error);
  } finally {
    state.viewLoading = false;
    render();
  }
}

function routeSubTab() {
  if (state.page === 'animal-detail') return state.specimenTab;
  if (state.page === 'animals') return state.collectionTab;
  if (state.page === 'husbandry') return state.husbandryTab;
  if (state.page === 'records') return state.recordsView;
  if (state.page === 'community') return state.communityTab;
  if (state.page === 'settings') return state.settingsTab;
  return '';
}

function routeObject() {
  if (state.page === 'animal-detail' && state.selectedAnimalId) {
    return { objectId: state.selectedAnimalId, objectType: 'animal' };
  }
  if (state.page === 'animals' && state.collectionTab === 'babies' && state.babyDetail?.id) {
    return { objectId: state.babyDetail.id, objectType: 'nursery' };
  }
  if (state.page === 'husbandry' && state.selectedEnclosureId) {
    return { objectId: state.selectedEnclosureId, objectType: 'enclosure' };
  }
  if (state.page === 'community') {
    if (state.careDetail?.id || state.careDetail?.feed_id) return { objectId: state.careDetail.id || state.careDetail.feed_id, objectType: 'care' };
    if (state.topicDetail?.id) return { objectId: state.topicDetail.id, objectType: 'topic' };
    if (state.speciesDetail?.id) return { objectId: state.speciesDetail.id, objectType: 'species' };
  }
  return { objectId: null, objectType: '' };
}

function captureRoute(scrollY = window.scrollY) {
  const object = routeObject();
  return createRouteState({
    page: state.page,
    subTab: routeSubTab(),
    objectId: object.objectId,
    scrollY,
    index: navigationIndex,
    context: {
      objectType: object.objectType,
      collectionTab: state.collectionTab,
      husbandryTab: state.husbandryTab,
      recordsView: state.recordsView,
      communityTab: state.communityTab,
      settingsTab: state.settingsTab,
      specimenTab: state.specimenTab,
      activeAnimalViewId: state.activeAnimalViewId,
      animalView: state.animalView,
      animalSearch: state.animalSearch,
      recordFilter: state.recordFilter,
      recordsWindow: { ...state.recordsWindow },
      collectionWindow: { ...state.collectionWindow },
      nurseryRegisterWindow: { ...state.nurseryRegisterWindow },
      careFilters: state.careFilters,
      topicFilters: state.topicFilters,
      speciesSearch: state.speciesSearch,
      transientAnimalView: state.transientAnimalView,
      collectionSelection: createCollectionSelection(state.collectionSelection)
    }
  });
}

function currentHistoryUrl() {
  return `${location.pathname}${location.search}${location.hash}` || appHomePath();
}

function replaceRoute(route = captureRoute(), { url = currentHistoryUrl() } = {}) {
  const normalized = createRouteState({ ...route, index: route.index ?? navigationIndex });
  navigationIndex = normalized.index;
  history.replaceState(normalized, '', url);
  navigationInitialized = true;
  return normalized;
}

function pushRoute(route = captureRoute(0), { url = currentHistoryUrl() } = {}) {
  const normalized = createRouteState({ ...route, index: navigationIndex + 1, scrollY: route.scrollY ?? 0 });
  navigationIndex = normalized.index;
  history.pushState(normalized, '', url);
  navigationInitialized = true;
  return normalized;
}

function saveCurrentRouteScroll() {
  if (!navigationInitialized || !isRouteState(history.state)) return;
  replaceRoute(captureRoute(window.scrollY));
}

function commitCurrentRoute(mode = 'push', scrollY = 0) {
  if (mode === 'none') return captureRoute(scrollY);
  const next = captureRoute(scrollY);
  if (!navigationInitialized) return replaceRoute(next);
  if (mode === 'replace' || sameRoute(history.state, next)) return replaceRoute(next);
  return pushRoute(next);
}

function applyRouteContext(route) {
  const context = route.context || {};
  state.page = route.page;
  state.collectionTab = context.collectionTab || (route.page === 'animals' ? route.subTab : state.collectionTab) || 'animals';
  state.husbandryTab = context.husbandryTab || (route.page === 'husbandry' ? route.subTab : state.husbandryTab) || 'enclosures';
  state.recordsView = context.recordsView || (route.page === 'records' ? route.subTab : state.recordsView) || 'history';
  state.communityTab = context.communityTab || (route.page === 'community' ? route.subTab : state.communityTab) || 'care';
  state.settingsTab = context.settingsTab || (route.page === 'settings' ? route.subTab : state.settingsTab) || 'my-setae';
  state.specimenTab = normalizeSpecimenTab(context.specimenTab || (route.page === 'animal-detail' ? route.subTab : state.specimenTab));
  if (context.activeAnimalViewId) state.activeAnimalViewId = context.activeAnimalViewId;
  if (['gallery', 'table'].includes(context.animalView)) state.animalView = context.animalView;
  if (typeof context.animalSearch === 'string') state.animalSearch = context.animalSearch;
  if (typeof context.recordFilter === 'string') state.recordFilter = context.recordFilter;
  if (context.recordsWindow && typeof context.recordsWindow === 'object') state.recordsWindow = createListWindow(context.recordsWindow);
  if (context.collectionWindow && typeof context.collectionWindow === 'object') state.collectionWindow = createCollectionWindow(context.collectionWindow);
  if (context.nurseryRegisterWindow && typeof context.nurseryRegisterWindow === 'object') {
    state.nurseryRegisterWindow = listWindowForGroup(context.nurseryRegisterWindow, context.nurseryRegisterWindow.groupId);
  }
  if (context.careFilters && typeof context.careFilters === 'object') state.careFilters = { ...state.careFilters, ...context.careFilters };
  if (context.topicFilters && typeof context.topicFilters === 'object') state.topicFilters = { ...state.topicFilters, ...context.topicFilters };
  if (typeof context.speciesSearch === 'string') state.speciesSearch = context.speciesSearch;
  state.transientAnimalView = context.transientAnimalView || null;
  state.collectionSelection = reconcileCollectionSelection(
    createCollectionSelection(context.collectionSelection || state.collectionSelection),
    state.animals
  );
  collectionSearchController.adopt(state.animalSearch);
}

function restoreRouteScroll(scrollY) {
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, Number(scrollY) || 0), left: 0, behavior: 'auto' })));
}

async function restoreRoute(value) {
  const route = isRouteState(value)
    ? createRouteState(value)
    : createRouteState({ page: state.authenticated || state.mockMode ? 'today' : 'community', subTab: state.communityTab, index: 0 });
  navigationIndex = route.index;
  state.sheet = null;
  state.modal = null;
  state.dashboardEditor = null;
  state.savedViewEditor = null;
  state.cardEditor = false;
  pendingPageFocus = false;
  applyRouteContext(route);

  const objectType = route.context?.objectType || '';
  if (route.page === 'animal-detail' && route.objectId) {
    await openAnimal(route.objectId, { history: 'none', scroll: false });
  } else if (route.page === 'animals' && objectType === 'nursery' && route.objectId) {
    await openNursery(route.objectId, { history: 'none', scroll: false });
  } else if (route.page === 'animals') {
    state.babyDetail = null;
    await loadCollectionTab(state.collectionTab);
  } else if (route.page === 'husbandry' && objectType === 'enclosure' && route.objectId) {
    await openEnclosure(route.objectId, { history: 'none', scroll: false });
  } else if (route.page === 'husbandry') {
    state.selectedEnclosureId = null;
    state.selectedEnclosure = null;
    await loadHusbandryTab(state.husbandryTab);
  } else if (route.page === 'records') {
    if (state.recordsView === 'history') await loadRecords();
    else await loadQr();
  } else if (route.page === 'community') {
    await loadCommunityTab(state.communityTab);
    if (route.objectId && objectType === 'care') state.careDetail = await services.care.feedDetail(route.objectId);
    if (route.objectId && objectType === 'topic') state.topicDetail = await services.topics.get(route.objectId);
    if (route.objectId && objectType === 'species') state.speciesDetail = await services.species.get(route.objectId);
  } else if (route.page === 'settings') {
    await loadSettingsTab(state.settingsTab);
  } else {
    render();
  }
  render();
  restoreRouteScroll(route.scrollY);
}

function isDialogMutationBusy() {
  return Boolean(
    state.modal?.submitting
    || state.quickRecord?.submitting
    || state.collectionBatchSubmitting
  );
}

const busyBlockedActions = new Set([
  'close-modal',
  'close-sheet',
  'close-quick-record',
  'cancel-bulk-record',
  'back-record-types',
  'cancel-collection-status'
]);

const overlayGuardedActions = new Set([
  'close-sheet',
  'close-dashboard-editor',
  'close-saved-view-editor',
  'close-card-editor',
  'close-modal',
  'close-quick-record',
  'cancel-bulk-record',
  'back-record-types',
  'dismiss-setae-setup',
  'cancel-collection-status'
]);

const globalGuardedActions = new Set([
  'billing-checkout', 'billing-portal',
  'apply-app-update',
  'logout',
  'request-delete-animal',
  'request-delete-baby'
]);

function actionOverlayScope(actionElement) {
  return actionElement?.closest?.('[data-overlay-backdrop]')
    || actionElement?.closest?.('.modal, .sheet, [data-modal], [data-sheet]')
    || null;
}

function closeModalForBack() {
  if (state.modal?.submitting) return false;
  if (['animal', 'baby-group', 'topic'].includes(state.modal?.type)) {
    speciesComboboxController.clear({ notify: false });
  }
  state.modal = null;
  return true;
}

function hasSheetOpen() {
  return Boolean(state.sheet || state.dashboardEditor || state.savedViewEditor || state.cardEditor || state.setupOpen);
}

function closeSheetForBack() {
  if (state.quickRecord?.submitting || state.collectionBatchSubmitting) return false;
  if (state.dashboardEditor) state.dashboardEditor = null;
  else if (state.savedViewEditor) state.savedViewEditor = null;
  else if (state.cardEditor) state.cardEditor = false;
  else if (state.setupOpen) state.setupOpen = false;
  else if (state.sheet) {
    state.sheet = null;
    resetQuickRecord();
    state.collectionBatchError = null;
  }
  return true;
}

function isNestedRoute() {
  return state.page === 'animal-detail'
    || Boolean(state.selectedEnclosureId)
    || Boolean(state.babyDetail)
    || Boolean(state.careDetail || state.topicDetail || state.speciesDetail);
}

async function requestBack({ fromPopstate = false, poppedState = null, bypassFormSafety = false } = {}) {
  const retainCurrentRoute = () => {
    if (fromPopstate) history.pushState(captureRoute(window.scrollY), '', currentHistoryUrl());
  };
  if (formSafety.cancelGuard()) {
    retainCurrentRoute();
    return 'continue-editing';
  }
  const openMenu = app.querySelector('.action-menu[open]');
  const action = resolveBackPriority({
    menuOpen: Boolean(openMenu),
    modalOpen: Boolean(state.modal),
    sheetOpen: hasSheetOpen(),
    selectionMode: Boolean(state.collectionSelection.selectionMode),
    nestedRoute: isNestedRoute()
  });

  if (action === 'close-menu') {
    const menuTrigger = openMenu.querySelector?.(':scope > summary'); openMenu.removeAttribute('open'); menuTrigger?.focus({ preventScroll: true });
    retainCurrentRoute();
    return action;
  }
  if (action === 'exit-selection') {
    state.collectionSelection = clearCollectionSelection(state.collectionSelection);
    render();
    retainCurrentRoute();
    return action;
  }
  if (['close-modal', 'close-sheet'].includes(action)) {
    if (isDialogMutationBusy()) {
      retainCurrentRoute();
      return 'busy';
    }
    const scope = overlayController.activePanel?.closest?.('[data-overlay-backdrop]')
      || overlayController.activePanel
      || app;
    if (!bypassFormSafety && formSafety.guard(
      () => requestBack({ bypassFormSafety: true }),
      { scope, mode: 'overlay' }
    )) {
      retainCurrentRoute();
      return 'guarded';
    }
    if (action === 'close-modal') closeModalForBack();
    else closeSheetForBack();
    render();
    retainCurrentRoute();
    return action;
  }
  if (!bypassFormSafety && formSafety.guard(
    () => requestBack({ bypassFormSafety: true }),
    { scope: app, mode: 'navigation' }
  )) {
    retainCurrentRoute();
    return 'guarded';
  }
  if (fromPopstate) {
    await restoreRoute(poppedState);
    return action;
  } else if (navigationIndex > 0) {
    history.back();
    return action;
  } else if (action === 'nested-route') {
    await navigateRoute(state.page === 'animal-detail' ? 'animals' : state.page, { history: 'replace' });
    return action;
  } else {
    history.back();
    return action;
  }

  return action;
}

async function openAnimal(id, { history: historyMode = 'push', scroll = true } = {}) {
  if (!isAnimalNavigationId(id)) return;
  const requestId = ++animalDetailRequestId;
  const isCurrentRequest = () => requestId === animalDetailRequestId
    && state.page === 'animal-detail'
    && String(state.selectedAnimalId) === String(id);
  pendingPageFocus = historyMode !== 'none';
  if (historyMode !== 'none') saveCurrentRouteScroll();
  const changedAnimal = String(state.selectedAnimalId || '') !== String(id);
  state.selectedAnimalId = id;
  state.page = 'animal-detail';
  state.selectedEvents = null;
  state.loadingEvents = true;
  state.selectedAnimal = state.animals.find((item) => String(item.id) === String(id)) || null;
  if (changedAnimal) {
    state.specimenTab = 'overview';
    state.specimenTimelineFilter = 'all';
    state.specimenPhotoFilter = 'all';
  }
  commitCurrentRoute(historyMode, 0);
  render();
  if (scroll) window.scrollTo(0, 0);
  if (state.mockMode) {
    state.selectedEvents = { events: mockSpecimenEvents(id) };
    state.loadingEvents = false;
    render();
    return;
  }
  try {
    const [animal, events] = await Promise.all([
      services.animals.get(id),
      services.care.listEvents(id, { perPage: 100 })
    ]);
    if (!isCurrentRequest()) return;
    state.selectedAnimal = animal;
    state.selectedEvents = events;
  } catch (error) {
    if (isCurrentRequest()) await handleApiError(error, { isCurrent: isCurrentRequest });
  } finally {
    if (isCurrentRequest()) {
      state.loadingEvents = false;
      render();
    }
  }
}

function activeCollectionView() {
  return collectionWorkspace.activeView();
}

function visibleCollectionAnimals() {
  return collectionWorkspace.filteredAnimals();
}

function updateCollectionSearch(value) {
  collectionWorkspace.updateSearch(value);
}

function updateSpeciesCombobox(snapshot) {
  const input = app.querySelector('[data-role="species-combobox-input"]');
  const listbox = app.querySelector('[data-role="species-combobox-listbox"]');
  if (!input || !listbox) return;
  input.setAttribute('aria-expanded', snapshot.open ? 'true' : 'false');
  input.toggleAttribute('aria-busy', Boolean(snapshot.loading));
  const activeId = snapshot.activeIndex >= 0 ? `specimen-species-option-${snapshot.activeIndex}` : '';
  if (activeId) input.setAttribute('aria-activedescendant', activeId);
  else input.removeAttribute('aria-activedescendant');
  listbox.hidden = !snapshot.open;
  listbox.innerHTML = renderSpeciesComboboxResults(snapshot);
  if (activeId) listbox.querySelector(`#${activeId}`)?.scrollIntoView({ block: 'nearest' });
}

function preserveRelatedSpeciesDraft() {
  if (!['baby-group', 'topic'].includes(state.modal?.type)) return;
  const role = state.modal.type === 'baby-group' ? 'baby-group-form' : 'topic-form';
  const form = app.querySelector(`[data-role="${role}"]`);
  if (!form) return;
  const draft = formDataObject(new FormData(form), { keepEmpty: true });
  const imageFile = form.elements.image?.files?.[0];
  delete draft.species_query;
  if (state.modal.type === 'baby-group' && form.elements.parent_spider_ids) {
    draft.parent_spider_ids = [...form.elements.parent_spider_ids.selectedOptions].map((option) => Number(option.value));
  }
  if (state.modal.type === 'topic') draft.has_cw = Boolean(form.elements.has_cw?.checked);
  state.modal = {
    ...state.modal,
    imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : state.modal.imageFile,
    data: { ...(state.modal.data || {}), ...draft }
  };
}

function modalSpeciesField() {
  if (state.modal?.type === 'topic') return 'related_species_id';
  return 'species_id';
}

function selectModalSpecies(item) {
  if (!['animal', 'baby-group', 'topic'].includes(state.modal?.type) || !item?.id) return;
  if (state.modal.type === 'animal') {
    syncSpecimenIntakeController()?.selectSpecies(item);
    return;
  }
  preserveRelatedSpeciesDraft();
  const field = modalSpeciesField();
  const data = { ...(state.modal.data || {}), [field]: item.id };
  if (state.modal.type === 'animal') data.custom_species = '';
  if (state.modal.type === 'baby-group') data.species_name = '';
  state.modal = {
    ...state.modal,
    ...(state.modal.type === 'animal' ? { classification: 'tarantula' } : {}),
    speciesMode: 'catalog',
    speciesId: item.id,
    selectedSpecies: item,
    data
  };
  speciesComboboxController.clear({ notify: false });
  render();
}

function openSpecimenIntake(animal = {}, speciesId = '') {
  window.clearTimeout(collectionClickTimer);
  collectionClickTimer = null;
  speciesComboboxController.clear({ notify: false });
  const requestedSpeciesId = Number(speciesId || animal.species_id || 0);
  const detail = requestedSpeciesId && String(state.speciesDetail?.id || '') === String(requestedSpeciesId)
    ? state.speciesDetail
    : null;
  const selectedSpecies = requestedSpeciesId ? {
    id: requestedSpeciesId,
    ja_name: detail?.ja_name || detail?.common_name_ja || animal.species_name_ja || animal.common_name_ja || '',
    scientific_name: detail?.scientific_name || detail?.title || animal.species_name || '',
    genus: detail?.genus || ''
  } : null;
  const classification = animal.classification || 'tarantula';
  state.modal = {
    type: 'animal',
    data: { ...animal },
    classification,
    speciesId: requestedSpeciesId || '',
    selectedSpecies,
    speciesMode: classification === 'tarantula' && !requestedSpeciesId && (animal.custom_species || animal.species_name)
      ? 'manual'
      : 'catalog'
  };
  render();
}

function isDesktopCollection() {
  return state.page === 'animals' && state.collectionTab === 'animals' && matchMedia('(min-width: 1200px)').matches;
}

function selectCollectionAnimal(id) {
  state.collectionSelection = selectCollectionState(state.collectionSelection, id);
  render();
}

async function applyCollectionStatus(status) {
  const ids = [...state.collectionSelection.selectedIds];
  if (!ids.length || !['normal', 'pre_molt', 'post_molt', 'fasting'].includes(status)) return;
  state.collectionBatchSubmitting = true;
  state.collectionBatchError = null;
  render();
  try {
    let result;
    if (state.mockMode) {
      replaceAnimals(state.animals.map((animal) => ids.includes(String(animal.id)) ? { ...animal, status } : animal));
      result = { failed: 0, succeeded: ids.length, errors: [] };
    } else {
      result = await runCollectionBatch(ids, (id) => services.animals.update(id, { status }));
      await refreshAnimalsAndCare();
    }
    if (result.failed) {
      state.collectionSelection = setCollectionSelectedIds(state.collectionSelection, result.errors.map((item) => item.id));
      state.collectionBatchError = `${result.succeeded}匹を変更しました。変更できなかった${result.failed}匹だけを選択しています。`;
      return;
    }
    state.sheet = null;
    state.collectionSelection = clearCollectionSelection(state.collectionSelection, { keepMode: true });
    showToast(`${ids.length}匹の状態を変更しました。`);
  } catch (error) {
    state.collectionBatchError = error?.message || '状態を変更できませんでした。';
  } finally {
    state.collectionBatchSubmitting = false;
    render();
  }
}

async function openCollectionQr(ids) {
  const targets = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!targets.length) return;
  try {
    state.qr.targets = state.mockMode
      ? { items: targets.map((id) => mockQrTargetForAnimal(state.animals.find((animal) => String(animal.id) === id))).filter(Boolean) }
      : await services.qr.targets({ ids: targets, purpose: 'labels' });
    state.qr = { ...state.qr, section: 'labels', error: null };
    state.recordsView = 'qr';
    await navigateRoute('records', { recordsTab: 'qr' });
  } catch (error) {
    if (planControls.showError(error, null)) return;
    await handleApiError(error);
    render();
  }
}

const mockQrAlphabet = '23456789abcdefghjkmnpqrstuvwxyz';

function mockQrCodeForId(id) {
  let value = Math.max(1, Number(id) || 1);
  let encoded = '';
  while (value > 0) {
    encoded = mockQrAlphabet[value % mockQrAlphabet.length] + encoded;
    value = Math.floor(value / mockQrAlphabet.length);
  }
  return `m${encoded}`.padEnd(4, '2').slice(0, 6);
}

function mockQrTargetForAnimal(animal) {
  if (!animal) return null;
  const code = mockQrCodeForId(animal.id);
  return {
    target_type: 'spider',
    object_id: animal.id,
    code,
    url: `https://setae.net/${code}/`,
    permanent_url: `https://setae.net/${code}/`,
    title: animalCode(animal),
    manage_code: animalCode(animal),
    species_name: animal.species_name || '',
    scientific_name: animal.species_name || '',
    short_name: animal.species_name || '',
    family_name: animal.family_name || 'Theraphosidae',
    gender: animal.gender || 'unknown',
    sex: animal.gender || 'unknown',
    instar: animal.instar || '',
    stage: animal.instar ? `instar_${animal.instar}` : 'undetermined',
    origin: animal.origin || '',
    last_feed: animal.last_feed || '',
    last_molt: animal.last_molt || '',
    visibility: specimenPublicSettings(animal).visibility,
    public: specimenPublicSettings(animal).visibility !== 'private',
    archived: publicSettingEnabled(animal.archived),
    transfer_receipt: publicSettingEnabled(animal.transfer_receipt),
    managed_by_viewer: true,
    transfer_enabled: specimenPublicSettings(animal).transfer_enabled,
    transfer_available: false
  };
}

function mockQrTargetForBaby(group, babyCode, index = 0) {
  if (!group || !babyCode) return null;
  const code = mockQrCodeForId(Number(group.id) * 1000 + index + 1);
  return {
    target_type: 'baby',
    object_id: group.id,
    baby_code: babyCode,
    code,
    url: `https://setae.net/${code}/`,
    permanent_url: `https://setae.net/${code}/`,
    title: group.name || 'ベビー群',
    manage_code: babyCode,
    species_name: group.species_name || '',
    short_name: group.species_name || '',
    stage: 'juvenile',
    visibility: 'private',
    managed_by_viewer: true
  };
}

async function getAnimalQrTarget(id, purpose = '') {
  if (state.mockMode) return mockQrTargetForAnimal(state.animals.find((animal) => String(animal.id) === String(id)));
  const response = await services.qr.targets({ ids: [id], purpose });
  return response?.items?.[0] || response?.targets?.[0] || null;
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand?.('copy') === true;
    input.remove();
    return copied;
  }
}

function updateQrScanStatus(message, tone = '') {
  state.qr = { ...state.qr, scanStatus: message, scanStatusTone: tone };
  const output = app.querySelector('[data-role="qr-scan-status"]');
  if (output) {
    output.textContent = message;
    output.className = `qr-scan-status${tone ? ` is-${tone}` : ''}`;
  }
}

function updateQrCameraState(cameraState, message = '', tone = '') {
  const active = cameraState === 'active';
  state.qr = {
    ...state.qr,
    cameraState,
    cameraActive: active,
    scanStatus: message || state.qr.scanStatus,
    scanStatusTone: tone
  };
  const stage = app.querySelector('[data-camera-state]');
  if (stage) {
    stage.dataset.cameraState = cameraState;
    stage.classList.toggle('is-active', active);
    stage.setAttribute('aria-label', `QRカメラ：${cameraState}`);
  }
  const control = app.querySelector('[data-action="toggle-qr-camera"]');
  if (control) {
    const requesting = cameraState === 'requesting';
    control.disabled = requesting;
    control.setAttribute('aria-disabled', requesting ? 'true' : 'false');
    control.querySelector('.button-spinner')?.remove();
    const label = control.querySelector('span:last-child');
    if (label) label.textContent = active ? 'カメラを停止' : requesting ? '準備中…' : 'カメラを開始';
  }
  if (message) updateQrScanStatus(message, tone);
}

let qrResolutionBusy = false;

async function resolveQrCode(value, { restartCamera = false } = {}) {
  const code = parseQrCode(value, location.origin);
  if (!code) {
    updateQrScanStatus('SETAEのコードまたは恒久URLを入力してください。', 'error');
    return null;
  }
  if (qrResolutionBusy) return null;
  qrResolutionBusy = true;
  updateQrScanStatus(`${code.toUpperCase()}を確認しています。`);
  try {
    let target;
    if (state.mockMode) {
      target = [
        ...(state.qr.targets?.items || []),
        ...state.animals.map(mockQrTargetForAnimal)
      ].find((item) => parseQrCode(item?.code || item?.url || '') === code);
      if (!target) throw new Error('モックのラベルを確認できませんでした。');
    } else {
      try {
        target = await services.qr.resolve(code);
      } catch (error) {
        if (error?.status !== 403) throw error;
        target = await services.qr.passport(code);
      }
    }

    if (state.qr.scannerMode === 'batch') {
      if (!target?.object_id) throw new Error('自分が管理しているラベルだけをBatchへ追加できます。');
      const before = state.qr.scanQueue.length;
      state.qr = addQrQueueTarget(resetQrHistory(state.qr, code), target);
      const added = state.qr.scanQueue.length > before;
      state.qr = {
        ...state.qr,
        resolved: target,
        prefillCode: '',
        scanStatus: added ? `${target.manage_code || target.title || code}をQueueへ追加しました。` : 'このラベルはすでにQueueにあります。',
        scanStatusTone: added ? 'success' : ''
      };
    } else {
      state.qr = {
        ...resetQrHistory(state.qr, code),
        resolved: target,
        prefillCode: code,
        scanStatus: target?.object_id ? '管理中の個体を読み取りました。' : '公開Passportを読み取りました。',
        scanStatusTone: 'success'
      };
    }
    if (restartCamera && qrCameraActive()) stopQrCamera();
    const resumeCamera = Boolean(restartCamera && state.qr.scannerMode === 'batch');
    state.qr.cameraState = resumeCamera ? 'requesting' : 'idle';
    state.qr.cameraActive = false;
    render();
    if (resumeCamera) requestAnimationFrame(() => startVisibleQrCamera({ renderFirst: false }));
    return target;
  } catch (error) {
    if (restartCamera && qrCameraActive()) stopQrCamera();
    state.qr = { ...state.qr, cameraState: 'error', cameraActive: false, scanStatus: error?.message || 'QRを確認できませんでした。', scanStatusTone: 'error' };
    render();
    return null;
  } finally {
    qrResolutionBusy = false;
  }
}

async function startVisibleQrCamera({ renderFirst = true } = {}) {
  if (renderFirst) {
    state.qr = { ...state.qr, cameraState: 'requesting', cameraActive: false, scanStatus: 'カメラを準備しています…', scanStatusTone: '' };
    render();
  }
  const video = app.querySelector('[data-role="qr-video"]');
  const canvas = app.querySelector('[data-role="qr-canvas"]');
  if (!video || !canvas) return;
  try {
    await startQrCamera({
      video,
      canvas,
      onCode: (code) => resolveQrCode(code, { restartCamera: state.qr.scannerMode === 'batch' }),
      onStatus: updateQrScanStatus,
      onState: updateQrCameraState
    });
  } catch (error) {
    const presentation = error?.cameraPresentation || cameraErrorPresentation(error);
    state.qr = { ...state.qr, cameraState: presentation.state, cameraActive: false, scanStatus: presentation.message, scanStatusTone: 'error' };
    render();
  }
}

function stopVisibleQrCamera({ rerender = false } = {}) {
  stopQrCamera();
  state.qr.cameraState = 'idle';
  state.qr.cameraActive = false;
  if (rerender) render();
}

function syncQrBatchRows(root = app) {
  const batchRows = { ...(state.qr.batchRows || {}) };
  root.querySelectorAll('[data-qr-code]').forEach((row) => {
    const code = parseQrCode(row.dataset.qrCode || '');
    if (!code) return;
    const values = { ...(batchRows[code] || {}) };
    row.querySelectorAll('[data-batch-field]').forEach((input) => { values[input.dataset.batchField] = input.value; });
    batchRows[code] = values;
  });
  state.qr.batchRows = batchRows;
}

function syncQrHistoryRows(root = app) {
  root.querySelectorAll('[data-history-row-id]').forEach((element) => {
    const values = {};
    element.querySelectorAll('[data-history-field]').forEach((input) => {
      values[input.dataset.historyField] = input.value;
    });
    state.qr = updateQrHistoryRow(state.qr, element.dataset.historyRowId, values);
  });
}

function updateBootstrapUser(profile) {
  state.bootstrap = { ...(state.bootstrap || {}), user: profile, authenticated: true };
}

function applyTheme(preference = 'system') {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function showToast(message, type = 'success') {
  const options = type && typeof type === 'object' ? type : { type };
  return feedbackController.show(message, options);
}

async function refreshDiagnostics() {
  if (!state.diagnostics.enabled || state.diagnostics.loading) return;
  state.diagnostics = { ...state.diagnostics, loading: true, error: '' };
  render();
  try {
    const data = await collectDiagnostics({
      version: appConfig.version || state.bootstrap?.plugin_version || '',
      route: state.page,
      nativeViewport: nativeViewportController.snapshot(),
      gesture: mobileGestureController.snapshot()
    });
    state.diagnostics = { ...state.diagnostics, loading: false, data, error: '' };
  } catch (error) {
    state.diagnostics = {
      ...state.diagnostics,
      loading: false,
      error: error?.message || '診断情報を取得できませんでした。'
    };
  }
  render();
}

function throwIfServerFieldError(error) {
  if (Object.keys(serverFieldErrors(error)).length) throw error;
}

function cloneValue(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function showUndoToast(message, restore) {
  showToast(message, {
    type: 'success',
    actionLabel: '元に戻す',
    action: 'undo-local-change',
    onAction: async () => {
      await restore();
      persistUiPreferences();
      render();
      showToast('変更を元に戻しました。');
    }
  });
}

function syncQueueState(status = '') {
  const count = offlineQueue.list().length;
  state.syncStatus = status || (!state.online ? 'offline' : count ? 'pending' : 'idle');
  state.syncFailedCount = state.syncStatus === 'error' ? count : 0;
  if (state.syncStatus === 'idle') state.syncMessage = '';
  renderSyncStatusIslands();
  return count;
}

function showOfflineQueueToast(count = 1) {
  showToast(offlineSavedMessage(count), {
    type: 'warning',
    actionLabel: '同期待ちを見る',
    action: 'open-offline-queue',
    onAction: () => navigateRoute('settings', { settingsTab: 'integrations' })
  });
}

function enqueueOffline(action, entityId, payload, { notify = true } = {}) {
  const item = offlineQueue.enqueue(action, entityId, payload);
  syncQueueState(state.online ? 'pending' : 'offline');
  if (notify) showOfflineQueueToast(1);
  return item;
}

function personalizationSnapshot() {
  return cloneValue({
    dashboard: state.dashboard,
    animalCardConfig: state.animalCardConfig,
    savedAnimalViews: state.savedAnimalViews,
    animalView: state.animalView,
    activeAnimalViewId: state.activeAnimalViewId,
    transientAnimalView: state.transientAnimalView,
    personalization: state.personalization
  });
}

function restorePersonalizationSnapshot(snapshot) {
  Object.assign(state, cloneValue(snapshot));
  localStorage.setItem('setae.gui.v2.activeAnimalView', state.activeAnimalViewId || 'all');
}

async function handleApiError(error, options = {}) {
  return handleSessionApiError(error, { state, services, offlineQueue, ...options });
}

function useMockData() {
  const today = new Date().toLocaleDateString('sv-SE');
  state.taskActions = loadTaskActions(localStorage, 'mock');
  replaceAnimals([
    { id: 1, title: 'C001', species_name: 'Typhochlaena seladonia', family_name: 'Theraphosidae', gender: 'female', instar: 8, status: 'pre_molt', origin: 'CB', acquired_date: '2025-12-25', temperature: 26, humidity: 75, enclosure: 'T-04', enclosure_id: 201, last_feed: '2026-08-02', last_molt: '2026-07-20', last_observation: '2026-08-10' },
    { id: 2, title: 'C002', species_name: 'Brachypelma hamorii', family_name: 'Theraphosidae', gender: 'unknown', instar: 7, status: 'normal', origin: 'CB', acquired_date: '2025-12-25', temperature: 25, humidity: 68, enclosure: 'B-02', enclosure_id: 202, last_feed: '2026-08-07', last_molt: '2026-07-16', last_observation: today },
    { id: 3, title: 'Y001', species_name: 'Aphonopelma seemanni', family_name: 'Theraphosidae', gender: 'male', instar: 8, status: 'fasting', origin: 'CB', acquired_date: '2025-12-11', enclosure: 'A-01', enclosure_id: 203, last_feed: '2026-07-30', last_molt: '2026-07-03' }
  ]);
  state.careSummary = { total_spiders: 3, observed_today: 2, pending_today: 1, streak: 4, best_streak: 12 };
  const mockNursery = {
    id: 101, name: 'セラドニア 2026-A', prefix: 'A', count: 48, birth_date: '2026-07-18', species_id: 501,
    species_name: 'Typhochlaena seladonia', parent_spider_ids: [1, 3], stats: { alive: 42, dead: 4, rehomed: 2, transferred: 0, molted: 39 },
    events: [
      { id: 'mock-nursery-environment', type: 'environment_check', date: '2026-08-13', data: { temperature: 26.2, humidity: 73 } },
      { id: 'mock-nursery-observation', type: 'observation', date: '2026-08-12', data: { label: '活性良好' } },
      { id: 'mock-nursery-feed', type: 'feed', date: '2026-08-11', data: { prey_type: 'Drosophila hydei', quantity: 0 } },
      { id: 'mock-nursery-count', type: 'count_check', date: '2026-08-07', data: { previous_count: 43, current_count: 42, difference: -1 } }
    ],
    development: [{ instar: 1, count: 3 }, { instar: 2, count: 29 }, { instar: 3, count: 10 }],
    items: Array.from({ length: 48 }, (_, index) => ({ code: `A${String(index + 1).padStart(3, '0')}`, status: index >= 42 ? (index < 46 ? 'dead' : 'rehomed') : 'alive', last_molt: index < 39 ? '2026-08-09' : '', note: '', history: index < 6 ? [{ type: 'molt', date: '2026-08-09', note: '' }] : [] }))
  };
  state.babyGroups = { items: [mockNursery], archived_items: [], summary: { currently_managed: 42, active_groups: 1 } };
  state.feeders = { types: [], inventory: [], egg_batches: [], events: [], summary: { total_count: 156, low_stock_count: 0, active_egg_batches: 0 } };
  const enclosureItems = [
    mockEnclosure({ id: 201, code: 'T-04', name: '樹上種ラック 上段', enclosure_type: 'acrylic', type_label: 'アクリル容器', dimensions_label: '15 × 15 × 20 cm', location: '飼育棚A / 上段', width_mm: 150, depth_mm: 150, height_mm: 200, target_temp_min: 24, target_temp_max: 27, target_humidity_min: 70, target_humidity_max: 80, substrate: 'ヤシガラ', substrate_depth_mm: 40, animal: state.animals[0], temperature: 26.2, humidity: 76, environmentDue: false, maintenanceDue: true }),
    mockEnclosure({ id: 202, code: 'B-02', name: '地表種ケース', enclosure_type: 'plastic', type_label: 'プラケース', dimensions_label: '24 × 18 × 14 cm', location: '飼育棚B / 中段', width_mm: 240, depth_mm: 180, height_mm: 140, target_temp_min: 23, target_temp_max: 27, target_humidity_min: 55, target_humidity_max: 70, substrate: '黒土・ヤシガラ', substrate_depth_mm: 70, animal: state.animals[1], temperature: 25.1, humidity: 66, environmentDue: false, maintenanceDue: false }),
    mockEnclosure({ id: 203, code: 'A-01', name: '成体オス', enclosure_type: 'glass', type_label: 'ガラス容器', dimensions_label: '20 × 20 × 20 cm', location: '飼育棚A / 下段', width_mm: 200, depth_mm: 200, height_mm: 200, target_temp_min: 23, target_temp_max: 26, target_humidity_min: 60, target_humidity_max: 75, substrate: 'ヤシガラ', substrate_depth_mm: 50, animal: state.animals[2], temperature: 24.5, humidity: 58, environmentDue: true, maintenanceDue: false })
  ];
  state.enclosures = { items: enclosureItems, summary: { active: 3, occupants: 3, environment_due: 1, maintenance_due: 1 } };
  replaceAnimals(state.animals.map((animal) => {
    const enclosure = enclosureItems.find((item) => String(item.id) === String(animal.enclosure_id));
    return enclosure ? {
      ...animal,
      enclosure_record: { id: enclosure.id, code: enclosure.code, name: enclosure.name, enclosure_type: enclosure.enclosure_type, location: enclosure.location },
      housing: { current: enclosure, history: enclosure.occupancy_history.map((item) => ({ ...item, enclosure_id: enclosure.id, enclosure_code: enclosure.code })) }
    } : animal;
  }));
  state.selectedEnclosureId = null;
  state.selectedEnclosure = null;
  state.records = [
    { animal: state.animals[1], event: { id: 'mock-today-observation', type: 'observation', date: today, data: { label: '異常なし' } } },
    { animal: state.animals[0], event: { id: 'mock-feed', type: 'feed', date: '2026-08-02', data: { prey_type: 'レッドローチ M' } } },
    { animal: state.animals[2], event: { id: 'mock-molt', type: 'molt', date: '2026-07-03', data: { instar: 8 } } },
    { targetType: 'enclosure', targetId: 202, enclosure: enclosureItems[1], event: { ...enclosureItems[1].last_environment, type: 'environment_check', date: enclosureItems[1].last_environment.event_date } },
    { targetType: 'enclosure', targetId: 201, enclosure: enclosureItems[0], event: { ...enclosureItems[0].events[1], type: 'watering', date: enclosureItems[0].events[1].event_date } },
    { targetType: 'nursery', targetId: 101, nursery: mockNursery, event: mockNursery.events[0] }
  ];
  state.records = normalizeRecentRecords(state.records, state.animals);
  state.recordsLoaded = true;
  state.collectionSelection = createCollectionSelection();
}

function mockEnclosure({ animal, temperature, humidity, environmentDue, maintenanceDue, ...data }) {
  const environmentDate = environmentDue ? '2026-08-10' : '2026-08-13';
  const maintenanceDate = maintenanceDue ? '2026-07-25' : '2026-08-06';
  const occupant = { occupancy_id: data.id + 1000, animal_id: animal.id, animal_code: animal.title, species_name: animal.species_name, started_at: '2026-01-12', ended_at: '', note: '' };
  return {
    ...data,
    status: 'active',
    environment_interval_days: 1,
    maintenance_interval_days: 14,
    occupants: [occupant],
    occupant_count: 1,
    last_environment: { id: `${data.id}-environment`, event_type: 'environment_check', event_label: '環境確認', event_date: environmentDate, temperature, humidity, note: '' },
    last_maintenance: { id: `${data.id}-maintenance`, event_type: 'maintenance', event_label: 'メンテナンス', event_date: maintenanceDate, note: '容器内を清掃' },
    care: { environment_due: environmentDue, environment_due_at: environmentDue ? '2026-08-11' : '2026-08-14', maintenance_due: maintenanceDue, maintenance_due_at: maintenanceDue ? '2026-08-08' : '2026-08-20' },
    events: [
      { id: `${data.id}-environment`, event_type: 'environment_check', event_label: '環境確認', event_date: environmentDate, temperature, humidity, note: '' },
      { id: `${data.id}-water`, event_type: 'watering', event_label: '給水', event_date: '2026-08-11', temperature: null, humidity: null, note: '水入れを交換' },
      { id: `${data.id}-maintenance`, event_type: 'maintenance', event_label: 'メンテナンス', event_date: maintenanceDate, temperature: null, humidity: null, note: '容器内を清掃' }
    ],
    occupancy_history: [occupant]
  };
}

function mockSpecimenEvents(id) {
  const common = [
    { id: 'mock-observation', type: 'observation', date: '2026-08-10', data: { label: '状態確認', note: '腹部の色が濃くなってきました。' } },
    { id: 'mock-feed-3', type: 'feed', date: '2026-08-07', data: { prey_type: 'レッドローチ M', quantity: 1 } },
    { id: 'mock-feed-2', type: 'feed', date: '2026-08-02', data: { prey_type: 'レッドローチ M', refused: true } },
    { id: 'mock-molt-3', type: 'molt', date: '2026-07-20', data: { instar: 8, note: '脱皮殻を確認' } },
    { id: 'mock-feed-1', type: 'feed', date: '2026-07-12', data: { prey_type: 'デュビア S', quantity: 1 } },
    { id: 'mock-molt-2', type: 'molt', date: '2026-05-30', data: { instar: 7 } },
    { id: 'mock-pairing', type: 'pairing', date: '2026-05-12', data: { partner_name: 'Y001', result: 'successful', note: '交接を確認' } },
    { id: 'mock-growth', type: 'growth', date: '2026-04-18', data: { size: '8.5 mm' } },
    { id: 'mock-molt-1', type: 'molt', date: '2026-04-05', data: { instar: 6 } }
  ];
  return String(id) === '1' ? common : common.filter((event) => event.type !== 'pairing');
}

async function syncOfflineQueue({ quiet = false } = {}) {
  const ownerId = currentUserId();
  if (!state.authenticated || !ownerId) return;
  if (offlineQueue.getOwner() !== ownerId) offlineQueue.setOwner(ownerId);
  const items = offlineQueue.list();
  state.online = navigator.onLine;
  if (!items.length) {
    syncQueueState();
    return;
  }
  if (!state.online) {
    syncQueueState('offline');
    return;
  }
  if (state.syncStatus === 'syncing') return;
  state.syncStatus = 'syncing';
  state.syncMessage = syncProgressMessage(items.length);
  state.syncFailedCount = 0;
  renderSyncStatusIslands();
  try {
    const result = await services.offline.sync(items.map(({ created_at, ...operation }) => operation));
    const results = Array.isArray(result?.results) ? result.results : [];
    const succeeded = results.filter((item) => item?.success).map((item) => item.operation_id);
    if (succeeded.length) offlineQueue.remove(succeeded);
    if (!results.length && result?.success) offlineQueue.clear();
    await refreshAnimalsAndCare({ includeRecords: true });
    const remaining = offlineQueue.list().length;
    const syncedCount = Math.max(0, items.length - remaining);
    if (remaining) {
      state.syncStatus = 'error';
      state.syncFailedCount = remaining;
      state.syncMessage = syncPartialMessage(syncedCount, remaining);
      if (!quiet) showToast(state.syncMessage, {
        type: 'warning',
        actionLabel: '同期待ちを見る',
        action: 'open-offline-queue',
        onAction: () => navigateRoute('settings', { settingsTab: 'integrations' })
      });
    } else {
      state.syncStatus = 'idle';
      state.syncFailedCount = 0;
      state.syncMessage = '';
      if (!quiet) showToast(syncCompleteMessage(syncedCount));
    }
  } catch (error) {
    state.syncStatus = 'error';
    state.syncFailedCount = offlineQueue.list().length;
    state.syncMessage = `${state.syncFailedCount}件を同期できませんでした。通信環境を確認して再試行してください。`;
    if (!quiet) showToast(state.syncMessage, {
      type: 'error',
      actionLabel: '同期待ちを見る',
      action: 'open-offline-queue',
      onAction: () => navigateRoute('settings', { settingsTab: 'integrations' })
    });
  }
  render();
}

async function navigateRoute(page, options = {}) {
  if (!options.bypassFormSafety && formSafety.guard(
    () => navigateRoute(page, { ...options, bypassFormSafety: true }),
    { scope: app, mode: 'navigation' }
  )) {
    return 'guarded';
  }
  if (qrCameraActive()) stopVisibleQrCamera();
  if (!state.authenticated && !state.mockMode && page !== 'community') {
    state.publicMode = false;
    render();
    return;
  }
  const historyMode = options.history || 'push';
  pendingPageFocus = historyMode !== 'none' && options.focus !== false;
  if (historyMode !== 'none') saveCurrentRouteScroll();
  state.page = page;
  state.sheet = null;
  state.modal = null;
  state.dashboardEditor = null;
  state.savedViewEditor = null;
  state.cardEditor = false;
  state.dashboardEditing = false;
  if (page === 'animals') state.babyDetail = null;
  if (page === 'husbandry') {
    state.selectedEnclosureId = null;
    state.selectedEnclosure = null;
  }
  if (page === 'community') {
    state.careDetail = null;
    state.topicDetail = null;
    state.speciesDetail = null;
  }
  if (page === 'husbandry' && options.husbandryTab) state.husbandryTab = options.husbandryTab;
  if (page === 'records' && options.recordsTab) state.recordsView = options.recordsTab;
  if (page === 'community' && options.communityTab) state.communityTab = options.communityTab;
  if (page === 'settings' && options.settingsTab) state.settingsTab = options.settingsTab;
  if (page === 'animals' && options.collectionTab) state.collectionTab = options.collectionTab;
  commitCurrentRoute(historyMode, 0);
  render();
  if (page === 'records') {
    if (state.recordsView === 'history') await loadRecords();
    else await loadQr();
  } else if (page === 'community') {
    await loadCommunityTab(state.communityTab);
  } else if (page === 'settings') {
    await loadSettingsTab(state.settingsTab);
  } else if (page === 'husbandry') {
    await loadHusbandryTab(state.husbandryTab);
  } else if (page === 'animals' && state.collectionTab === 'babies') {
    await loadCollectionTab('babies');
  }
}

function markPersonalizationCustomized() {
  if (!state.personalization.setupCompleted || state.personalization.customized) return;
  state.personalization = { ...state.personalization, customized: true };
}

function applyPreset(presetId, { notify = true } = {}) {
  const settings = buildPresetSettings(presetId);
  if (!settings) return;
  const previous = notify ? personalizationSnapshot() : null;
  state.dashboard = settings.dashboard;
  state.animalCardConfig = settings.animalCard;
  state.savedAnimalViews = settings.savedViews;
  state.animalView = 'table';
  state.activeAnimalViewId = 'all';
  state.transientAnimalView = null;
  state.dashboardEditor = null;
  state.savedViewEditor = null;
  state.cardEditor = false;
  state.setupOpen = false;
  state.personalization = normalizePersonalization({
    presetId,
    previewPresetId: presetId,
    customized: false,
    setupCompleted: true
  });
  localStorage.setItem('setae.gui.v2.activeAnimalView', 'all');
  persistUiPreferences();
  render();
  if (notify) showUndoToast(`${settings.preset.title}を適用しました。`, () => restorePersonalizationSnapshot(previous));
}

function finishSetaeSetup(intent = state.setupIntent) {
  const presetId = setaePresetIds.includes(state.personalization.previewPresetId)
    ? state.personalization.previewPresetId
    : 'simple';
  applyPreset(presetId, { notify: false });
  state.setupStep = 'preset';
  state.setupIntent = 'explore';
  if (intent === 'animal') {
    openSpecimenIntake({});
  } else if (intent === 'nursery') {
    speciesComboboxController.clear({ notify: false });
    state.modal = { type: 'baby-group', data: {}, speciesId: '', selectedSpecies: null, speciesMode: 'catalog' };
  } else {
    state.page = 'today';
  }
  render();
  showToast('飼育スタイルを設定しました。');
}

function dismissSetaeSetup() {
  finishSetaeSetup('explore');
}

function commitDashboard({ customized = true } = {}) {
  if (customized) markPersonalizationCustomized();
  persistUiPreferences();
  render();
}

function setAnimalDisplayMode(mode) {
  if (mode === 'table') {
    state.animalView = 'table';
  } else if (mode === 'gallery') {
    state.animalView = 'gallery';
  } else if (animalCardModes.includes(mode)) {
    state.animalView = 'gallery';
    state.animalCardConfig = normalizeAnimalCardConfig({ ...state.animalCardConfig, mode });
  } else {
    return;
  }
  markPersonalizationCustomized();
  persistUiPreferences();
  render();
}

function updateAnimalCardConfig(value, { showCards = false } = {}) {
  state.animalCardConfig = normalizeAnimalCardConfig(value);
  if (showCards) state.animalView = 'gallery';
  markPersonalizationCustomized();
  persistUiPreferences();
  render();
}

function openConfirm({ title, message, confirmLabel = '実行する', action, payload = {}, confirmPhrase = '', confirmHint = '' }) {
  state.modal = {
    type: 'confirm',
    title,
    message,
    confirmLabel,
    confirmAction: action,
    confirmPhrase,
    confirmHint,
    confirmValue: '',
    payload
  };
  render();
}

app.addEventListener('click', async (event) => {
  const clickedActionMenu = event.target.closest('.action-menu');
  if (clickedActionMenu && event.target.closest('summary')) hydrateActionMenu(clickedActionMenu);
  app.querySelectorAll('.action-menu[open]').forEach((menu) => {
    if (menu !== clickedActionMenu) menu.removeAttribute('open');
  });

  const nav = event.target.closest('[data-nav]');
  if (nav) {
    await navigateRoute(nav.dataset.nav, {
      settingsTab: nav.dataset.settingsTab,
      recordsTab: nav.dataset.recordsTab,
      communityTab: nav.dataset.communityTab,
      husbandryTab: nav.dataset.husbandryTab
    });
    return;
  }

  const animalTarget = resolveAnimalNavigationTarget(event.target);
  if (animalTarget) {
    const intent = collectionItemIntent({
      collectionItem: animalTarget.hasAttribute('data-collection-animal'),
      selectionMode: state.collectionSelection.selectionMode,
      wide: isDesktopCollection()
    });
    if (intent === 'toggle-selection') {
      if (event.detail > 1) return;
      state.collectionSelection = toggleCollectionAnimal(state.collectionSelection, animalTarget.dataset.animalId);
      render();
    } else if (intent === 'select-inspector') {
      const id = animalTarget.dataset.animalId;
      window.clearTimeout(collectionClickTimer);
      collectionClickTimer = window.setTimeout(() => {
        collectionClickTimer = null;
        if (animalTarget.isConnected && isDesktopCollection() && !state.modal && !hasSheetOpen()) selectCollectionAnimal(id);
      }, 180);
    } else {
      await openAnimal(animalTarget.dataset.animalId);
    }
    return;
  }

  const invocation = resolveActionInvocation(event);
  if (!invocation?.action) return;
  const { element: actionElement, action } = invocation;
  actionElement.closest('.action-menu')?.removeAttribute('open');

  if (action === 'refresh-diagnostics') {
    await refreshDiagnostics();
    return;
  }
  if (action === 'copy-diagnostics') {
    if (!state.diagnostics.enabled || !state.diagnostics.data) return;
    try {
      const copied = await copyDiagnosticJson(state.diagnostics.data);
      showToast(copied ? '診断情報をコピーしました。' : '診断情報をコピーできませんでした。', copied ? 'success' : 'error');
    } catch {
      showToast('診断情報をコピーできませんでした。', 'error');
    }
    return;
  }
  if (action === 'download-diagnostics') {
    if (!state.diagnostics.enabled || !state.diagnostics.data) return;
    downloadDiagnosticJson(state.diagnostics.data);
    showToast('診断情報をJSONで保存しました。');
    return;
  }

  if (busyBlockedActions.has(action) && isDialogMutationBusy()) return;
  if (actionElement.closest('.modal.is-busy, .sheet.is-busy')) return;

  if (globalGuardedActions.has(action)) {
    if (action === 'apply-app-update') formSafety.flush();
    if (formSafety.guard(() => actionElement.click(), { scope: app, mode: 'navigation' })) return;
  }
  if (overlayGuardedActions.has(action)) {
    const scope = actionOverlayScope(actionElement);
    if (scope && formSafety.guard(() => actionElement.click(), { scope, mode: 'overlay' })) return;
  }
  if (await planControls.handleAction(action, actionElement)) return;
  if (action === 'start-qr-acquisition') { state.qr = { ...state.qr, section: 'scan', scannerMode: 'single' }; state.recordsView = 'qr'; await navigateRoute('records', { recordsTab: 'qr' }); return; }
  if (action === 'open-arrival-animal') { markArrivalViewed(actionElement.dataset.animalId, currentUserId()); await openAnimal(actionElement.dataset.animalId); return; }

  if (action === 'dismiss-error') {
    state.error = null;
    if (renderCoordinator.frameMounted) renderCoordinator.error('');
    else render();
    return;
  }
  if (action === 'dismiss-toast') { feedbackController.dismiss(); return; }
  if (action === 'run-toast-action') { await feedbackController.runAction(); return; }
  if (action === 'apply-app-update') {
    if (!waitingServiceWorker) {
      state.appUpdateAvailable = false;
      state.appUpdateApplying = false;
      renderUpdateNoticeIsland();
      return;
    }
    state.appUpdateApplying = true;
    serviceWorkerReloadRequested = true;
    renderUpdateNoticeIsland();
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  if (action === 'retry-connection') { state.mockMode = false; await boot(); return; }
  if (action === 'auth-view') { state.authView = actionElement.dataset.authView; state.authError = null; state.authMessage = null; render(); return; }
  if (action === 'show-login') { state.publicMode = false; state.mockMode = false; state.authView = 'login'; navigationInitialized = false; history.pushState({}, '', appHomePath()); render(); return; }
  if (action === 'browse-public') {
    state.publicMode = true;
    state.page = 'community';
    state.communityTab = 'topics';
    state.authError = null;
    setPublicCommunityPath('topics');
    render();
    await loadCommunityTab('topics', { force: true });
    navigationIndex += 1;
    replaceRoute(captureRoute(0));
    return;
  }
  if (action === 'use-mock') {
    if (!mockEnabled) return;
    state.connectionError = null;
    state.authError = null;
    state.publicMode = false;
    state.mockMode = true;
    state.authenticated = false;
    offlineQueue.setOwner(null);
    loadCurrentOnboarding();
    state.page = 'today';
    useMockData();
    state.setupOpen = false;
    navigationIndex = 0;
    replaceRoute(captureRoute(0), { url: cleanAppPath() });
    render();
    return;
  }
  if (action === 'logout') {
    if (qrCameraActive()) stopVisibleQrCamera();
    if (state.mockMode) {
      state.mockMode = false;
      state.taskActions = [];
      await boot();
      return;
    }
    state.loading = true;
    render();
    try { await services.session.logout(); }
    catch (error) { state.error = error?.message || 'ログアウトできませんでした。'; }
    state.authenticated = false;
    offlineQueue.setOwner(null);
    state.setupOpen = false;
    state.publicMode = false;
    state.bootstrap = { ...(state.bootstrap || {}), authenticated: false, nonce: null, user: null };
    navigationInitialized = false;
    navigationIndex = 0;
    history.replaceState({}, '', appHomePath());
    replaceAnimals([]);
    state.taskActions = [];
    state.loading = false;
    render();
    return;
  }

  if (action === 'close-sheet') { state.sheet = null; resetQuickRecord(); state.collectionBatchError = null; render(); return; }
  if (action === 'close-dashboard-editor') {
    state.dashboardEditor = null;
    render();
    return;
  }
  if (action === 'close-saved-view-editor') {
    state.savedViewEditor = null;
    render();
    return;
  }
  if (action === 'close-card-editor') {
    state.cardEditor = false;
    render();
    return;
  }
  if (action === 'close-modal') {
    const restoreFieldLabelFocus = state.modal?.type === 'field-label';
    if (['animal', 'baby-group', 'topic'].includes(state.modal?.type)) speciesComboboxController.clear({ notify: false });
    if (state.modal?.type === 'animal') {
      specimenIntakeController?.destroy();
      specimenIntakeController = null;
    }
    state.modal = null;
    render();
    if (restoreFieldLabelFocus) requestAnimationFrame(() => app.querySelector('.field-label-summary [data-action="open-field-label"]')?.focus());
    return;
  }
  if (action === 'select-species-suggestion') {
    speciesComboboxController.select(Number(actionElement.dataset.speciesIndex));
    return;
  }
  if (action === 'change-specimen-species') {
    syncSpecimenIntakeController()?.clearSpecies();
    return;
  }
  if (action === 'specimen-species-manual') {
    syncSpecimenIntakeController()?.showManual();
    return;
  }
  if (action === 'specimen-species-catalog') {
    syncSpecimenIntakeController()?.showCatalog();
    return;
  }
  if (action === 'change-related-species' || action === 'clear-related-species') {
    preserveRelatedSpeciesDraft();
    speciesComboboxController.clear({ notify: false });
    const field = modalSpeciesField();
    state.modal = {
      ...state.modal,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: 'catalog',
      data: { ...(state.modal?.data || {}), [field]: '' }
    };
    render();
    if (action === 'change-related-species') {
      requestAnimationFrame(() => app.querySelector('[data-role="species-combobox-input"]')?.focus());
    }
    return;
  }
  if (action === 'related-species-manual') {
    preserveRelatedSpeciesDraft();
    const previousSpecies = state.modal?.selectedSpecies?.scientific_name || state.modal?.data?.species_name || '';
    speciesComboboxController.clear({ notify: false });
    state.modal = {
      ...state.modal,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: 'manual',
      data: { ...(state.modal?.data || {}), species_id: '', species_name: previousSpecies }
    };
    render();
    requestAnimationFrame(() => app.querySelector('[name="species_name"]')?.focus());
    return;
  }
  if (action === 'related-species-catalog') {
    preserveRelatedSpeciesDraft();
    speciesComboboxController.clear({ notify: false });
    state.modal = {
      ...state.modal,
      speciesId: '',
      selectedSpecies: null,
      speciesMode: 'catalog',
      data: { ...(state.modal?.data || {}), species_id: '', species_name: '' }
    };
    render();
    requestAnimationFrame(() => app.querySelector('[data-role="species-combobox-input"]')?.focus());
    return;
  }
  if (action === 'confirm-modal') { await executeConfirmedAction(); return; }
  if (action === 'open-license-notices') { state.modal = { type: 'license-notices' }; render(); return; }
  if (action === 'open-content-credits') { state.modal = { type: 'content-credits' }; render(); return; }

  if (action === 'open-record-sheet') { resetQuickRecord(); state.sheet = 'record-launcher'; render(); return; }
  if (action === 'quick-record') { resetQuickRecord({ animalId: actionElement.dataset.animalId || state.selectedAnimalId || null }); state.sheet = 'record-launcher'; render(); return; }
  if (action === 'smart-quick-record' || action === 'quick-recommendation' || action === 'quick-recent') {
    const type = requestedRecordType(actionElement.dataset.recordType, action);
    if (!type) return;
    resetQuickRecord({ view: 'form', animalId: actionElement.dataset.animalId || null, type });
    state.sheet = 'record-form';
    render();
    return;
  }
  if (action === 'start-record') {
    const type = requestedRecordType(actionElement.dataset.recordType, action);
    if (!type) return;
    resetQuickRecord({ view: 'form', type });
    state.sheet = 'record-form';
    render();
    return;
  }
  if (action === 'record-type') {
    const type = requestedRecordType(actionElement.dataset.recordType, action);
    if (!type) return;
    state.quickRecord = { ...state.quickRecord, view: 'form', animalId: actionElement.dataset.animalId || state.quickRecord.animalId, type, error: null };
    state.sheet = 'record-form';
    render();
    return;
  }
  if (action === 'back-record-types') { state.quickRecord = { ...state.quickRecord, view: 'launcher', type: null, error: null }; state.sheet = 'record-launcher'; render(); return; }
  if (action === 'close-quick-record' || action === 'cancel-bulk-record') { state.sheet = null; resetQuickRecord(); render(); return; }
  if (action === 'record-quantity') {
    const input = actionElement.closest('form')?.querySelector('input[name="quantity"]');
    if (input) {
      input.value = String(Math.max(1, Math.min(100, Number(input.value || 1) + Number(actionElement.dataset.delta || 0))));
      notifyProgrammaticInput(input);
    }
    return;
  }
  if (action === 'use-recent-prey') {
    const input = actionElement.closest('form')?.querySelector('input[name="prey_type"]');
    if (input) {
      input.value = actionElement.dataset.prey || '';
      notifyProgrammaticInput(input);
      input.focus();
    }
    return;
  }
  if (action === 'open-qr-page') { state.sheet = null; state.recordsView = 'qr'; await navigateRoute('records', { recordsTab: 'qr' }); return; }
  if (action === 'open-qr-collection' || action === 'open-onboarding-collection') { await navigateRoute('animals', { collectionTab: 'animals' }); return; }
  if (action === 'qr-workspace-section') {
    stopVisibleQrCamera();
    state.qr = { ...state.qr, section: actionElement.dataset.section || 'labels', error: null };
    render();
    if (state.qr.section === 'transfer' && state.authenticated) await loadQr();
    return;
  }
  if (action === 'qr-label-config') {
    const key = actionElement.dataset.configKey;
    const rawValue = actionElement.dataset.configValue;
    const value = key === 'tapeLengthMm' ? Number(rawValue) : rawValue;
    const next = {
      ...state.qr.labelConfig,
      [key]: value
    };
    if (key === 'output' && value === 'a4' && next.format === 'micro-id') next.format = 'field';
    if (key === 'output' && value === 'tape' && Number(next.tapeLengthMm) <= 24) next.format = 'micro-id';
    if (key === 'tapeLengthMm' && Number(value) <= 24) next.format = 'micro-id';
    state.qr.labelConfig = saveLabelConfig(localStorage, normalizeLabelConfig(next));
    render();
    return;
  }
  if (action === 'print-field-labels') {
    const output = printLabels(state.qr.targets?.items || [], state.qr.labelConfig);
    if (output.error) {
      state.qr = { ...state.qr, error: output.error };
      render();
    } else showToast(`${output.count}枚の印刷画面を開きました。`);
    return;
  }
  if (action === 'print-label-calibration') {
    const output = printCalibration(actionElement.dataset.type || 'a4', appConfig.version || '');
    if (output.error) {
      state.qr = { ...state.qr, error: output.error };
      render();
    } else showToast('印刷サイズの校正画面を開きました。');
    return;
  }
  if (action === 'copy-label-url') {
    const url = actionElement.dataset.url || '';
    if (!url) return;
    if (await copyText(url)) showToast('恒久リンクをコピーしました。');
    else { state.qr = { ...state.qr, error: 'リンクをコピーできませんでした。' }; render(); }
    return;
  }
  if (action === 'qr-scanner-mode') {
    stopVisibleQrCamera();
    state.qr = {
      ...resetQrHistory(state.qr),
      scannerMode: actionElement.dataset.mode || 'single',
      resolved: null,
      scanStatus: '',
      scanStatusTone: '',
      batchStep: state.qr.batchMode === 'capture' ? 'edit' : state.qr.batchStep
    };
    render();
    return;
  }
  if (action === 'qr-batch-mode') {
    syncQrBatchRows();
    state.qr = {
      ...state.qr,
      batchMode: actionElement.dataset.mode === 'capture' ? 'capture' : 'queue',
      batchStep: actionElement.dataset.mode === 'capture' ? 'edit' : state.qr.batchStep
    };
    render();
    return;
  }
  if (action === 'toggle-qr-camera') {
    if (qrCameraActive()) stopVisibleQrCamera({ rerender: true });
    else await startVisibleQrCamera();
    return;
  }
  if (action === 'remove-qr-batch-target') {
    syncQrBatchRows();
    state.qr = removeQrQueueTarget(state.qr, actionElement.dataset.code);
    render();
    return;
  }
  if (action === 'edit-qr-batch') {
    state.qr = { ...state.qr, batchStep: 'edit' };
    render();
    return;
  }
  if (action === 'qr-batch-event') {
    syncQrBatchRows();
    state.qr = { ...state.qr, batchEventType: actionElement.dataset.eventType || 'observation', batchStep: 'edit' };
    render();
    return;
  }
  if (action === 'apply-qr-same-date') {
    const form = actionElement.closest('form');
    const input = form?.querySelector('[data-role="qr-same-date"]');
    const date = input?.value || state.qr.sameDate;
    form?.querySelectorAll('[data-batch-field="date"]').forEach((dateInput) => {
      dateInput.value = date;
      notifyProgrammaticInput(dateInput, { change: true });
    });
    syncQrBatchRows(form || app);
    state.qr = applySameBatchDate(state.qr, date);
    render();
    return;
  }
  if (action === 'add-resolved-to-batch') {
    if (!state.qr.resolved?.object_id) return;
    state.qr = addQrQueueTarget({ ...state.qr, scannerMode: 'batch' }, state.qr.resolved);
    render();
    return;
  }
  if (action === 'open-qr-history') {
    const code = parseQrCode(state.qr.resolved?.code || state.qr.resolved?.url || '');
    if (!code || !state.qr.resolved?.object_id) return;
    state.qr = { ...resetQrHistory(state.qr, code), historyEditorOpen: true };
    render();
    return;
  }
  if (action === 'close-qr-history') {
    state.qr = resetQrHistory(state.qr, state.qr.resolved?.code || '');
    render();
    return;
  }
  if (action === 'add-qr-history-row') {
    state.qr = addQrHistoryRow(state.qr, actionElement.dataset.eventType || 'observation');
    render();
    return;
  }
  if (action === 'remove-qr-history-row') {
    state.qr = removeQrHistoryRow(state.qr, actionElement.dataset.rowId);
    render();
    return;
  }
  if (action === 'open-babies') { state.sheet = null; await navigateRoute('animals', { collectionTab: 'babies' }); return; }
  if (action === 'open-feeders' || action === 'open-husbandry') { state.sheet = null; await navigateRoute('husbandry', { husbandryTab: 'feeders' }); return; }

  if (action === 'preview-setae-preset') {
    const presetId = actionElement.dataset.presetId;
    if (!setaePresetIds.includes(presetId)) return;
    state.personalization = { ...state.personalization, previewPresetId: presetId };
    savePersonalization(localStorage, state.personalization);
    render();
    return;
  }
  if (action === 'setae-setup-next') {
    state.setupStep = 'start';
    state.setupIntent = (state.animals.length || (state.babyGroups?.items || []).length) ? 'explore' : 'animal';
    render();
    return;
  }
  if (action === 'setae-setup-back') { state.setupStep = 'preset'; render(); return; }
  if (action === 'setae-setup-intent') {
    if (['animal', 'nursery', 'explore'].includes(actionElement.dataset.intent)) state.setupIntent = actionElement.dataset.intent;
    render();
    return;
  }
  if (action === 'finish-setae-setup') { finishSetaeSetup(state.setupIntent); return; }
  if (action === 'apply-setae-preset') { applyPreset(actionElement.dataset.presetId); return; }
  if (action === 'dismiss-setae-setup') { dismissSetaeSetup(); return; }
  if (action === 'dismiss-onboarding') {
    state.onboarding = saveOnboardingState(localStorage, onboardingOwnerId(), { ...state.onboarding, dismissed: true });
    render();
    return;
  }
  if (action === 'reopen-onboarding') {
    state.setupOpen = false;
    state.onboarding = saveOnboardingState(localStorage, onboardingOwnerId(), { ...state.onboarding, dismissed: false });
    await navigateRoute('today');
    return;
  }
  if (action === 'open-onboarding-records') { await navigateRoute('records', { recordsTab: 'history' }); return; }
  if (action === 'open-onboarding-notifications') { await navigateRoute('settings', { settingsTab: 'notifications' }); return; }
  if (action === 'open-personalization-dashboard') {
    await navigateRoute('today');
    state.dashboardEditing = true;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'open-personalization-card') {
    await navigateRoute('animals', { collectionTab: 'animals' });
    state.cardEditor = true;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'open-personalization-views') {
    await navigateRoute('animals', { collectionTab: 'animals' });
    state.activeAnimalViewId = 'all';
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'open-care-profile') { await navigateRoute('husbandry', { husbandryTab: 'care' }); return; }
  if (action === 'remove-care-profile-override') {
    const previous = cloneValue(state.careProfile);
    const scope = actionElement.dataset.scope === 'species' ? 'species' : 'animals';
    const next = { ...state.careProfile, [scope]: { ...state.careProfile[scope] } };
    delete next[scope][actionElement.dataset.key];
    state.careProfile = normalizeCareProfile(next);
    persistUiPreferences();
    render();
    showUndoToast('個別ルールを解除しました。', () => { state.careProfile = previous; });
    return;
  }
  if (action === 'remove-enclosure-care-override') {
    const previous = cloneValue(state.enclosureCareProfile);
    const scope = actionElement.dataset.scope === 'type' ? 'types' : 'enclosures';
    const next = { ...state.enclosureCareProfile, [scope]: { ...state.enclosureCareProfile[scope] } };
    delete next[scope][actionElement.dataset.key];
    state.enclosureCareProfile = normalizeEnclosureCareProfile(next);
    persistUiPreferences();
    render();
    showUndoToast('容器の個別ルールを解除しました。', () => { state.enclosureCareProfile = previous; });
    return;
  }
  if (action === 'remove-nursery-care-override') {
    const previous = cloneValue(state.nurseryCareProfile);
    const scope = actionElement.dataset.scope === 'species' ? 'species' : 'nurseries';
    const next = { ...state.nurseryCareProfile, [scope]: { ...state.nurseryCareProfile[scope] } };
    delete next[scope][actionElement.dataset.key];
    state.nurseryCareProfile = normalizeNurseryCareProfile(next);
    persistUiPreferences();
    render();
    showUndoToast('ベビー群の個別ルールを解除しました。', () => { state.nurseryCareProfile = previous; });
    return;
  }
  if (action === 'open-care-tasks') { await navigateRoute('today'); return; }

  if (action === 'open-task-animal') { await openAnimal(actionElement.dataset.animalId); return; }
  if (action === 'open-task-enclosure' || action === 'open-journal-enclosure') { await openEnclosure(actionElement.dataset.enclosureId); return; }
  if (action === 'open-task-nursery' || action === 'open-journal-nursery') { await openNursery(actionElement.dataset.groupId); return; }
  if (action === 'record-nursery-task') {
    const group = nurseryById(actionElement.dataset.groupId);
    if (group) state.modal = { type: 'nursery-event', group, eventType: actionElement.dataset.eventType };
    render();
    return;
  }
  if (action === 'open-task-actions') {
    const task = currentCareModel().tasks.find((item) => item.id === actionElement.dataset.taskId);
    if (task) state.modal = { type: 'task-action', task };
    render();
    return;
  }
  if (action === 'skip-task') {
    const task = currentCareModel().tasks.find((item) => item.id === actionElement.dataset.taskId) || state.modal?.task;
    if (!task) return;
    state.modal = { ...state.modal, submitting: true, error: null };
    render();
    await persistTaskAction(task, 'skipped');
    state.modal = null;
    showToast('今回は見送り、次の予定日へ進めました。');
    render();
    return;
  }

  if (action === 'collection-tab') { await navigateRoute('animals', { collectionTab: actionElement.dataset.tab }); return; }
  if (action === 'husbandry-tab') { await navigateRoute('husbandry', { husbandryTab: actionElement.dataset.tab }); return; }
  if (action === 'add-enclosure') { state.modal = { type: 'enclosure', data: {} }; render(); return; }
  if (action === 'open-enclosure') { await openEnclosure(actionElement.dataset.enclosureId); return; }
  if (action === 'open-animal-enclosure') { await openEnclosure(actionElement.dataset.enclosureId); return; }
  if (action === 'close-enclosure') { await requestBack(); return; }
  if (action === 'edit-enclosure') {
    const enclosure = enclosureById(actionElement.dataset.enclosureId) || state.selectedEnclosure;
    if (enclosure) state.modal = { type: 'enclosure', data: { ...enclosure, care_plan_overrides: state.enclosureCareProfile.enclosures[String(enclosure.id)] || {} } };
    render();
    return;
  }
  if (action === 'record-enclosure' || action === 'record-enclosure-task') {
    const enclosure = enclosureById(actionElement.dataset.enclosureId) || state.selectedEnclosure;
    state.modal = { type: 'enclosure-event', enclosureId: actionElement.dataset.enclosureId, enclosureCode: enclosure?.code || '', eventType: actionElement.dataset.eventType || 'environment_check' };
    render();
    return;
  }
  if (action === 'assign-enclosure') {
    const enclosure = enclosureById(actionElement.dataset.enclosureId) || state.selectedEnclosure;
    state.modal = { type: 'enclosure-occupancy', enclosureId: actionElement.dataset.enclosureId, enclosureCode: enclosure?.code || '' };
    render();
    return;
  }
  if (action === 'end-enclosure-occupancy') {
    openConfirm({ title: '容器から退居', message: `${actionElement.dataset.animalCode || 'この個体'}を現在の容器から外します。入居履歴は残ります。`, confirmLabel: '退居させる', action: 'end-enclosure-occupancy', payload: { enclosureId: actionElement.dataset.enclosureId, animalId: actionElement.dataset.animalId } });
    return;
  }
  if (action === 'archive-enclosure') {
    openConfirm({ title: '容器をアーカイブ', message: `${actionElement.dataset.enclosureCode || 'この容器'}を使用中の一覧から外します。入居中の個体がいる場合は先に退居させてください。`, confirmLabel: 'アーカイブ', action: 'archive-enclosure', payload: { enclosureId: actionElement.dataset.enclosureId } });
    return;
  }
  if (action === 'enclosure-qr') {
    const enclosure = enclosureById(actionElement.dataset.enclosureId) || state.selectedEnclosure;
    try {
      const mockCode = mockQrCodeForId(10000 + Number(enclosure.id));
      state.qr.targets = state.mockMode
        ? { items: [{ target_type: 'enclosure', object_id: enclosure.id, title: enclosure.code, manage_code: enclosure.code, species_name: enclosure.name || enclosure.type_label, short_name: enclosure.type_label, code: mockCode, url: `https://setae.net/${mockCode}/` }] }
        : await services.qr.targets({ source: 'enclosure', ids: [enclosure.id], purpose: 'labels' });
      state.qr = { ...state.qr, section: 'labels', error: null };
      state.recordsView = 'qr';
      await navigateRoute('records', { recordsTab: 'qr' });
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'open-enclosure-animal') { await openAnimal(actionElement.dataset.animalId); return; }
  if (action === 'toggle-task-workspace') {
    state.todayTasks = normalizeTodayTaskPreferences({ ...state.todayTasks, collapsed: !state.todayTasks.collapsed });
    persistUiPreferences();
    render();
    return;
  }
  if (action === 'toggle-task-section') {
    const section = actionElement.dataset.section;
    if (!['overdue', 'today', 'upcoming'].includes(section)) return;
    state.todayTasks = normalizeTodayTaskPreferences({ ...state.todayTasks, sections: { ...state.todayTasks.sections, [section]: !state.todayTasks.sections[section] } });
    persistUiPreferences();
    render();
    return;
  }
  if (action === 'expand-task-queue') {
    state.todayTasks = normalizeTodayTaskPreferences({ ...state.todayTasks, showAll: !state.todayTasks.showAll });
    persistUiPreferences();
    render();
    return;
  }
  if (action === 'specimen-tab') { updateSpecimenTab(actionElement.dataset.tab || 'overview'); return; }
  if (action === 'specimen-timeline-filter') { state.specimenTimelineFilter = actionElement.dataset.filter || 'all'; updateSpecimenTab('timeline'); return; }
  if (action === 'specimen-photo-filter') { state.specimenPhotoFilter = actionElement.dataset.filter || 'all'; updateSpecimenTab('photos'); return; }
  if (action === 'open-field-label') {
    if (!state.selectedAnimal) return;
    try {
      const target = await getAnimalQrTarget(state.selectedAnimal.id, 'labels');
      if (!target) throw new Error('識別票の情報を取得できませんでした。');
      const labelConfig = normalizeLabelConfig({ ...state.qr.labelConfig, output: 'a4', a4Size: 'standard' });
      state.modal = { type: 'field-label', animal: state.selectedAnimal, target, labelConfig };
      render();
      requestAnimationFrame(() => app.querySelector('.field-label-dialog [data-action="close-modal"]')?.focus());
    } catch (error) {
      await handleApiError(error);
      render();
    }
    return;
  }
  if (action === 'print-specimen-label') {
    const animalId = state.modal?.animal?.id || state.selectedAnimalId;
    state.qr.labelConfig = normalizeLabelConfig({
      ...state.qr.labelConfig,
      ...(state.modal?.labelConfig || {}),
      output: 'a4',
      a4Size: 'standard'
    });
    state.modal = null;
    await openCollectionQr([animalId]);
    return;
  }
  if (action === 'animal-view') { state.animalView = actionElement.dataset.view; markPersonalizationCustomized(); persistUiPreferences(); render(); return; }
  if (action === 'animal-card-mode') { setAnimalDisplayMode(actionElement.dataset.cardMode); return; }
  if (action === 'open-card-editor') { state.cardEditor = true; render(); return; }
  if (action === 'card-config-mode') {
    updateAnimalCardConfig({ ...state.animalCardConfig, mode: actionElement.dataset.cardMode }, { showCards: true });
    return;
  }
  if (action === 'card-config-density') {
    updateAnimalCardConfig({ ...state.animalCardConfig, density: actionElement.dataset.cardDensity });
    return;
  }
  if (action === 'reset-card-config') {
    const previousConfig = cloneValue(state.animalCardConfig);
    const previousView = state.animalView;
    updateAnimalCardConfig(defaultAnimalCardConfig, { showCards: true });
    showUndoToast('カード表示を初期設定に戻しました。', () => {
      state.animalCardConfig = previousConfig;
      state.animalView = previousView;
    });
    return;
  }
  if (action === 'collection-selection-mode') {
    state.collectionSelection = setCollectionSelectionMode(state.collectionSelection, !state.collectionSelection.selectionMode);
    render();
    return;
  }
  if (action === 'toggle-collection-selection') {
    const selection = state.collectionSelection.selectionMode
      ? state.collectionSelection
      : setCollectionSelectionMode(state.collectionSelection, true);
    state.collectionSelection = toggleCollectionAnimal(selection, actionElement.dataset.animalId);
    render();
    return;
  }
  if (action === 'toggle-collection-select-all') {
    if (!state.collectionSelection.selectionMode) {
      state.collectionSelection = setCollectionSelectionMode(state.collectionSelection, true);
    }
    const visibleIds = visibleCollectionAnimals().map((animal) => String(animal.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.collectionSelection.selectedIds.includes(id));
    const nextIds = allSelected
      ? state.collectionSelection.selectedIds.filter((id) => !visibleIds.includes(id))
      : [...state.collectionSelection.selectedIds, ...visibleIds];
    state.collectionSelection = setCollectionSelectedIds(state.collectionSelection, nextIds);
    render();
    return;
  }
  if (action === 'clear-collection-selection') {
    state.collectionSelection = clearCollectionSelection(state.collectionSelection);
    render();
    return;
  }
  if (action === 'open-collection-detail') { await openAnimal(actionElement.dataset.animalId); return; }
  if (action === 'collection-bulk-record') {
    const type = requestedRecordType(actionElement.dataset.recordType, action);
    if (!type) return;
    resetQuickRecord({ view: 'form', animalIds: [...state.collectionSelection.selectedIds], type });
    state.sheet = 'record-form';
    render();
    return;
  }
  if (action === 'open-collection-status') { state.collectionBatchError = null; state.sheet = 'collection-status'; render(); return; }
  if (action === 'cancel-collection-status') { state.collectionBatchError = null; state.sheet = null; render(); return; }
  if (action === 'apply-collection-status') { await applyCollectionStatus(actionElement.dataset.status); return; }
  if (action === 'collection-bulk-qr') { await openCollectionQr(state.collectionSelection.selectedIds); return; }
  if (action === 'collection-animal-qr') { await openCollectionQr([actionElement.dataset.animalId]); return; }
  if (action === 'edit-collection-animal') {
    const animal = state.animals.find((item) => String(item.id) === String(actionElement.dataset.animalId));
    if (!animal) return;
    openSpecimenIntake(animal);
    return;
  }
  if (action === 'sidebar-collection-view') {
    state.activeAnimalViewId = actionElement.dataset.viewId || 'all';
    state.transientAnimalView = null;
    state.collectionTab = 'animals';
    localStorage.setItem('setae.gui.v2.activeAnimalView', state.activeAnimalViewId);
    await navigateRoute('animals');
    return;
  }
  if (action === 'animal-smart-view') {
    state.activeAnimalViewId = actionElement.dataset.viewId || 'all';
    if (state.activeAnimalViewId !== 'dashboard') state.transientAnimalView = null;
    localStorage.setItem('setae.gui.v2.activeAnimalView', state.activeAnimalViewId);
    state.collectionSelection = reconcileCollectionSelection(state.collectionSelection, visibleCollectionAnimals());
    render();
    return;
  }
  if (action === 'clear-collection-search') {
    clearCollectionSearchInput(app, collectionSearchController);
    return;
  }
  if (action === 'clear-collection-filters') {
    state.activeAnimalViewId = 'all';
    state.transientAnimalView = null;
    clearCollectionSearchInput(app, collectionSearchController);
    localStorage.setItem('setae.gui.v2.activeAnimalView', 'all');
    render();
    requestAnimationFrame(() => app.querySelector('[data-role="animal-search"]')?.focus());
    return;
  }
  if (action === 'create-saved-view') { state.savedViewEditor = { view: null }; render(); return; }
  if (action === 'edit-saved-view') {
    const view = state.savedAnimalViews.find((item) => item.id === actionElement.dataset.viewId);
    if (view) state.savedViewEditor = { view };
    render();
    return;
  }
  if (action === 'delete-saved-view') {
    const previousViews = cloneValue(state.savedAnimalViews);
    const previousActiveViewId = state.activeAnimalViewId;
    state.savedAnimalViews = state.savedAnimalViews.filter((item) => item.id !== actionElement.dataset.viewId);
    state.activeAnimalViewId = 'all';
    localStorage.setItem('setae.gui.v2.activeAnimalView', 'all');
    markPersonalizationCustomized();
    persistUiPreferences();
    render();
    showUndoToast('保存した絞り込みを削除しました。', () => {
      state.savedAnimalViews = previousViews;
      state.activeAnimalViewId = previousActiveViewId;
      localStorage.setItem('setae.gui.v2.activeAnimalView', previousActiveViewId || 'all');
    });
    return;
  }
  if (action === 'back-animals') { await requestBack(); return; }
  if (action === 'recover-collection') { state.error = null; await navigateRoute('animals', { collectionTab: 'animals', history: 'replace' }); return; }
  if (action === 'add-animal' || action === 'register-from-species') {
    openSpecimenIntake({}, actionElement.dataset.speciesId || '');
    return;
  }
  if (action === 'edit-animal') {
    openSpecimenIntake(state.selectedAnimal || {});
    return;
  }
  if (action === 'favorite-animal') {
    try {
      await services.animals.favorite(state.selectedAnimalId, !state.selectedAnimal?.is_favorite);
      await openAnimal(state.selectedAnimalId);
      showToast(state.selectedAnimal?.is_favorite ? 'お気に入りに追加しました。' : 'お気に入りを解除しました。');
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'animal-qr') {
    await openCollectionQr([state.selectedAnimalId]);
    return;
  }
  if (action === 'copy-animal-qr-url') {
    try {
      const target = await getAnimalQrTarget(actionElement.dataset.animalId || state.selectedAnimalId);
      const url = safeSameOriginHttpUrl(target?.url);
      if (!url || !(await copyText(url))) throw new Error('恒久リンクをコピーできませんでした。');
      showToast('恒久リンクをコピーしました。');
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'open-animal-passport') {
    const popup = window.open('', '_blank');
    try {
      if (popup) popup.opener = null;
      const target = await getAnimalQrTarget(actionElement.dataset.animalId || state.selectedAnimalId);
      const url = safeSameOriginHttpUrl(target?.url);
      if (!url) throw new Error('Passportを開けませんでした。');
      if (popup) popup.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (error) {
      popup?.close();
      await handleApiError(error);
      render();
    }
    return;
  }
  if (action === 'animal-qr-settings') {
    try {
      const animalId = actionElement.dataset.animalId || state.selectedAnimalId;
      const target = await getAnimalQrTarget(animalId) || {};
      state.modal = { type: 'qr-settings', animalId, data: target };
      render();
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'request-delete-animal') {
    const code = actionElement.dataset.animalName || animalLabelById(actionElement.dataset.animalId);
    openConfirm({
      title: '個体を削除',
      message: `「${code}」とすべての記録を完全に削除します。`,
      confirmLabel: '完全に削除',
      confirmPhrase: code,
      confirmHint: `削除するには「${code}」と入力してください。`,
      action: 'delete-animal',
      payload: { id: actionElement.dataset.animalId }
    });
    return;
  }

  if (action === 'add-baby-group') {
    speciesComboboxController.clear({ notify: false });
    state.modal = { type: 'baby-group', data: {}, speciesId: '', selectedSpecies: null, speciesMode: 'catalog' };
    render();
    return;
  }
  if (action === 'open-baby-group') {
    await openNursery(actionElement.dataset.groupId);
    return;
  }
  if (action === 'close-baby-group') { await requestBack(); return; }
  if (action === 'edit-baby-group') { state.modal = { type: 'baby-group', data: state.babyDetail || {} }; render(); return; }
  if (action === 'record-nursery') { state.modal = { type: 'nursery-event', group: state.babyDetail, eventType: actionElement.dataset.eventType }; render(); return; }
  if (action === 'baby-bulk') { state.modal = { type: 'baby-bulk', groupId: actionElement.dataset.groupId || state.babyDetail?.id, eventType: actionElement.dataset.eventType || '' }; render(); return; }
  if (action === 'baby-promote') { state.modal = { type: 'baby-promote', groupId: actionElement.dataset.groupId }; render(); return; }
  if (action === 'baby-qr') {
    const groupId = actionElement.dataset.groupId || state.babyDetail?.id;
    let group = nurseryById(groupId);
    if (group && !Array.isArray(group.items) && !state.mockMode) {
      try {
        group = await services.babies.get(groupId);
        if (String(state.babyDetail?.id || '') === String(groupId)) state.babyDetail = group;
      } catch (error) {
        await handleApiError(error);
        render();
        return;
      }
    }
    if (!group || !Array.isArray(group.items)) {
      state.error = 'ベビー群の番号を取得できませんでした。';
      render();
      return;
    }
    state.modal = {
      type: 'baby-qr',
      groupId,
      group,
      selection: createBabyQrSelection(group)
    };
    render();
    return;
  }
  if (action === 'baby-qr-select-all') {
    const group = state.modal?.group || {};
    const selection = state.modal?.selection || createBabyQrSelection(group);
    const visibleCodes = filterBabyQrItems(group, selection.search).map((item) => item.code);
    state.modal = {
      ...state.modal,
      selection: { ...selection, selectedCodes: [...new Set([...(selection.selectedCodes || []), ...visibleCodes])] }
    };
    render();
    return;
  }
  if (action === 'baby-qr-clear') {
    state.modal = {
      ...state.modal,
      selection: { ...(state.modal?.selection || {}), selectedCodes: [] }
    };
    render();
    return;
  }
  if (action === 'request-delete-baby') {
    const groupName = actionElement.dataset.groupName || `ベビー群 ${actionElement.dataset.groupId}`;
    openConfirm({
      title: 'ベビー群を削除',
      message: `「${groupName}」と番号別の履歴を完全に削除します。`,
      confirmLabel: '完全に削除',
      confirmPhrase: groupName,
      confirmHint: `削除するには群名「${groupName}」と入力してください。`,
      action: 'delete-baby',
      payload: { id: actionElement.dataset.groupId }
    });
    return;
  }

  if (action === 'add-feeder-action') { state.modal = { type: 'feeder-action', feederType: actionElement.dataset.feederType || '' }; render(); return; }
  if (action === 'add-egg-batch') { state.modal = { type: 'egg-batch' }; render(); return; }
  if (action === 'finish-egg') { state.modal = { type: 'finish-egg', batchId: actionElement.dataset.batchId, status: actionElement.dataset.eggStatus }; render(); return; }

  if (action === 'records-tab') {
    stopVisibleQrCamera();
    await navigateRoute('records', { recordsTab: actionElement.dataset.tab });
    return;
  }
  if (action === 'clear-record-filter') {
    state.recordFilter = 'all';
    state.recordsWindow = resetListWindow(state.recordsWindow);
    render();
    return;
  }
  if (action === 'show-more-collection') {
    const scrollY = window.scrollY;
    const appended = collectionWorkspace.appendWindow();
    if (navigationInitialized) replaceRoute(captureRoute(scrollY));
    render({ preservePage: appended });
    restoreProgressiveListFocus(app, action, 'collection-progressive-footer', scrollY);
    return;
  }
  if (action === 'show-more-records') {
    const scrollY = window.scrollY;
    const total = filterRecords(state.records, state.recordFilter).length;
    state.recordsWindow = extendListWindow(state.recordsWindow, total);
    if (navigationInitialized) replaceRoute(captureRoute(scrollY));
    if (appendRecordsWindow(app, { records: state.records, filter: state.recordFilter, listWindow: state.recordsWindow })) render({ preservePage: true });
    else render();
    restoreProgressiveListFocus(app, 'show-more-records', 'records-progressive-footer', scrollY);
    return;
  }
  if (action === 'show-more-nursery-items') {
    const scrollY = window.scrollY;
    const total = Array.isArray(state.babyDetail?.items) ? state.babyDetail.items.length : 0;
    state.nurseryRegisterWindow = listWindowForGroup(extendListWindow(state.nurseryRegisterWindow, total), state.babyDetail?.id || state.nurseryRegisterWindow.groupId);
    if (navigationInitialized) replaceRoute(captureRoute(scrollY));
    if (appendNurseryRegisterWindow(app, { items: state.babyDetail?.items, registerWindow: state.nurseryRegisterWindow })) render({ preservePage: true });
    else render();
    restoreProgressiveListFocus(app, 'show-more-nursery-items', 'nursery-progressive-footer', scrollY);
    return;
  }
  if (action === 'toggle-refused') {
    try {
      await services.care.update(actionElement.dataset.logId, { refused: actionElement.dataset.refused !== '1' });
      await refreshAnimalsAndCare({ includeRecords: true });
      showToast('給餌記録を更新しました。');
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'share-record') {
    try { await services.care.share(actionElement.dataset.logId, true); showToast('お世話フィードで共有しました。'); }
    catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'delete-record') {
    openConfirm({ title: '記録を削除', message: 'この記録を削除し、個体の最終給餌日・脱皮日などを残りの履歴から再計算します。', confirmLabel: '記録を削除', action: 'delete-record', payload: { logId: actionElement.dataset.logId, animalId: actionElement.dataset.animalId } });
    return;
  }
  if (action === 'open-qr-record') {
    const resolved = state.qr.resolved || {};
    if (resolved.target_type === 'spider' && resolved.object_id) {
      resetQuickRecord({ animalId: String(resolved.object_id) });
      state.sheet = 'record-launcher';
    } else if (resolved.target_type === 'enclosure' && resolved.object_id) {
      await openEnclosure(resolved.object_id);
      const enclosure = enclosureById(resolved.object_id) || state.selectedEnclosure;
      state.modal = { type: 'enclosure-event', enclosureId: String(resolved.object_id), enclosureCode: enclosure?.code || resolved.title || '', eventType: 'environment_check' };
    } else {
      state.qr.prefillCode = actionElement.dataset.qrCode || resolved.code || '';
    }
    render();
    if (!['spider', 'enclosure'].includes(resolved.target_type)) requestAnimationFrame(() => app.querySelector('#qr-record-codes')?.focus());
    return;
  }
  if (action === 'qr-transfer') {
    actionElement.disabled = true;
    try {
      await services.qr.respondTransfer(actionElement.dataset.transferId, actionElement.dataset.transferAction);
      state.qr.transfers = await services.qr.transfers();
      showToast(actionElement.dataset.transferAction === 'approve' ? '引き継ぎを承認しました。' : '引き継ぎを拒否しました。');
    } catch (error) { await handleApiError(error); }
    render();
    return;
  }

  if (action === 'community-tab') {
    const tab = actionElement.dataset.tab;
    if (!state.authenticated && ['topics', 'species', 'breeding'].includes(tab)) {
      saveCurrentRouteScroll();
      setPublicCommunityPath(tab);
      await loadCommunityTab(tab);
      navigationIndex += 1;
      replaceRoute(captureRoute(0));
    } else {
      await navigateRoute('community', { communityTab: tab });
    }
    return;
  }
  if (action === 'retry-community') {
    await loadCommunityTab(state.communityTab, { force: true });
    return;
  }
  if (action === 'clear-care-filters') {
    state.careFilters = { ...state.careFilters, scope: 'all' };
    state.careFeed = null;
    await loadCommunityTab('care', { force: true });
    return;
  }
  if (action === 'clear-topic-filters') {
    state.topicFilters = { search: '', type: '', sort: 'updated' };
    state.topics = null;
    await loadCommunityTab('topics', { force: true });
    return;
  }
  if (action === 'clear-species-search') {
    state.speciesSearch = '';
    state.species = null;
    await loadCommunityTab('species', { force: true });
    return;
  }
  if (action === 'open-care-feed') {
    saveCurrentRouteScroll();
    state.viewLoading = true; render();
    try { state.careDetail = await services.care.feedDetail(actionElement.dataset.feedId); }
    catch (error) { await handleApiError(error); }
    state.viewLoading = false;
    if (state.careDetail) commitCurrentRoute('push', 0);
    render(); return;
  }
  if (action === 'close-care-feed') { await requestBack(); return; }
  if (action === 'care-react') {
    try {
      await services.care.reactFeed(actionElement.dataset.targetId, actionElement.dataset.reaction);
      if (state.careDetail) state.careDetail = await services.care.feedDetail(actionElement.dataset.targetId);
      else state.careFeed = await services.care.feedList(state.careFilters);
      render();
    } catch (error) { await handleApiError(error); render(); }
    return;
  }
  if (action === 'reply-care-comment') { state.replyTarget = { id: actionElement.dataset.commentId, author: actionElement.dataset.author }; const area = app.querySelector('[data-role="care-comment-form"] textarea'); if (area) { area.placeholder = `${state.replyTarget.author}さんへ返信`; area.focus(); } return; }
  if (action === 'unshare-care') { openConfirm({ title: '共有を解除', message: 'この記録をお世話フィードから取り下げます。飼育記録自体は残ります。', confirmLabel: '共有を解除', action: 'unshare-care', payload: { id: actionElement.dataset.feedId } }); return; }
  if (action === 'report-care') { state.modal = { type: 'report', targetType: 'care', targetId: actionElement.dataset.feedId }; render(); return; }
  if (action === 'delete-care-comment') { openConfirm({ title: 'コメントを削除', message: 'このコメントを完全に削除します。', confirmLabel: '削除', action: 'delete-care-comment', payload: { id: actionElement.dataset.commentId } }); return; }
  if (action === 'report-care-comment') { state.modal = { type: 'report', targetType: 'care-comment', targetId: actionElement.dataset.commentId }; render(); return; }

  if (action === 'new-topic') {
    speciesComboboxController.clear({ notify: false });
    state.modal = { type: 'topic', data: {}, speciesId: '', selectedSpecies: null, speciesMode: 'catalog' };
    render();
    return;
  }
  if (action === 'open-topic') {
    saveCurrentRouteScroll();
    state.communityTab = 'topics';
    state.speciesDetail = null;
    state.viewLoading = true; render();
    try { state.topicDetail = await services.topics.get(actionElement.dataset.topicId); if (state.authenticated) services.topics.markRead(actionElement.dataset.topicId).catch(() => {}); }
    catch (error) { await handleApiError(error); }
    state.viewLoading = false;
    if (state.topicDetail) commitCurrentRoute('push', 0);
    render(); return;
  }
  if (action === 'close-topic') { await requestBack(); return; }
  if (action === 'topic-react') { await topicMutation(() => services.topics.react(actionElement.dataset.targetId, actionElement.dataset.reaction)); return; }
  if (action === 'topic-comment-react') { await topicMutation(() => services.topics.reactComment(actionElement.dataset.targetId, actionElement.dataset.reaction)); return; }
  if (action === 'topic-status') { await topicMutation(() => services.topics.status(actionElement.dataset.topicId, actionElement.dataset.status)); return; }
  if (action === 'best-answer') { await topicMutation(() => services.topics.bestAnswer(actionElement.dataset.topicId, Number(actionElement.dataset.commentId))); return; }

  if (action === 'open-species') {
    saveCurrentRouteScroll();
    state.viewLoading = true; render();
    try {
      const id = actionElement.dataset.speciesId;
      const [detail, stats, ads] = await Promise.allSettled([
        services.species.get(id),
        services.species.stats(id),
        services.species.ads(id)
      ]);
      if (detail.status === 'rejected') throw detail.reason;
      state.speciesDetail = {
        ...detail.value,
        _stats: stats.status === 'fulfilled' ? stats.value : null,
        _ads: ads.status === 'fulfilled' ? ads.value : null
      };
    }
    catch (error) { await handleApiError(error); }
    state.viewLoading = false;
    if (state.speciesDetail) commitCurrentRoute('push', 0);
    render(); return;
  }
  if (action === 'close-species') { await requestBack(); return; }

  if (action === 'settings-tab') { await navigateRoute('settings', { settingsTab: actionElement.dataset.tab }); return; }
  if (action === 'enable-push') { await enablePushNotifications(); return; }
  if (action === 'test-push') { try { await services.notifications.test(); showToast('テスト通知を送信しました。'); } catch (error) { await handleApiError(error); render(); } return; }
  if (action === 'create-external-token') { state.modal = { type: 'external-token' }; render(); return; }
  if (action === 'create-live-session') { state.modal = { type: 'live-session' }; render(); return; }
  if (['disable-external', 'disable-live', 'disable-chatgpt'].includes(action)) { openConfirm({ title: '連携を無効化', message: '発行済みの接続情報を無効にします。連携先からSETAEへアクセスできなくなります。', confirmLabel: '無効化', action, payload: {} }); return; }
  if (action === 'copy-integration-result') { const value = state.settings.integrations.result?.token || state.settings.integrations.result?.url || state.settings.integrations.result?.access_url || JSON.stringify(state.settings.integrations.result || {}); await navigator.clipboard.writeText(value); showToast('コピーしました。'); return; }
  if (action === 'sync-offline') { await syncOfflineQueue(); render(); return; }
  if (action === 'clear-offline') { openConfirm({ title: '同期待ちを破棄', message: `${offlineQueue.list().length}件の未同期操作を端末から削除します。`, confirmLabel: '破棄する', action: 'clear-offline' }); return; }
  if (action === 'unfollow-user') { await socialMutation(() => services.social.unfollow(actionElement.dataset.userId)); return; }
  if (action === 'unblock-user') { await socialMutation(() => services.social.unblock(actionElement.dataset.userId)); return; }
  if (action === 'follow-user') { await inlineSocialMutation(() => services.social.follow(actionElement.dataset.userId), 'フォローしました。'); return; }
  if (action === 'unfollow-inline') { await inlineSocialMutation(() => services.social.unfollow(actionElement.dataset.userId), 'フォローを解除しました。'); return; }
  if (action === 'request-block-user') { openConfirm({ title: '利用者をブロック', message: 'この利用者の投稿を非表示にし、相互の交流を制限します。', confirmLabel: 'ブロックする', action: 'block-user', payload: { id: actionElement.dataset.userId } }); return; }

  if (action === 'edit-dashboard') { state.dashboardEditing = true; state.dashboardEditor = null; render(); return; }
  if (action === 'finish-dashboard-edit') { state.dashboardEditing = false; state.dashboardEditor = null; render(); return; }
  if (action === 'reset-dashboard') { state.dashboard = createDefaultDashboard(); state.dashboardEditor = null; commitDashboard(); return; }
  if (action === 'add-dashboard-section') {
    const section = addDashboardSection(state.dashboard);
    state.dashboardEditor = { kind: 'section', sectionId: section.id };
    commitDashboard();
    return;
  }
  if (action === 'edit-dashboard-section') { state.dashboardEditor = { kind: 'section', sectionId: actionElement.dataset.sectionId }; render(); return; }
  if (action === 'open-widget-library') { state.dashboardEditor = { kind: 'library', sectionId: actionElement.dataset.sectionId }; render(); return; }
  if (action === 'add-dashboard-widget') {
    const widget = addDashboardWidget(state.dashboard, actionElement.dataset.sectionId, actionElement.dataset.widgetType);
    state.dashboardEditor = widget ? { kind: 'widget', widgetId: widget.id } : null;
    commitDashboard();
    return;
  }
  if (action === 'configure-widget') { state.dashboardEditor = { kind: 'widget', widgetId: actionElement.dataset.widgetId }; render(); return; }
  if (action === 'widget-up' || action === 'widget-down') { moveDashboardWidget(state.dashboard, actionElement.dataset.widgetId, action === 'widget-up' ? -1 : 1); commitDashboard(); return; }
  if (action === 'widget-size') {
    const found = findDashboardWidget(state.dashboard, actionElement.dataset.widgetId);
    if (found) updateDashboardWidget(state.dashboard, found.widget.id, { size: nextWidgetSize(found.widget) });
    commitDashboard();
    return;
  }
  if (action === 'remove-dashboard-widget') {
    const previous = cloneValue(state.dashboard);
    if (removeDashboardWidget(state.dashboard, actionElement.dataset.widgetId)) {
      commitDashboard();
      showUndoToast('今日の画面から項目を削除しました。', () => { state.dashboard = previous; });
    }
    return;
  }
  if (action === 'section-up' || action === 'section-down') { moveDashboardSection(state.dashboard, actionElement.dataset.sectionId, action === 'section-up' ? -1 : 1); commitDashboard(); return; }
  if (action === 'remove-dashboard-section') {
    const previous = cloneValue(state.dashboard);
    if (!removeDashboardSection(state.dashboard, actionElement.dataset.sectionId)) showToast('最後の区分は削除できません。', 'error');
    else {
      commitDashboard();
      showUndoToast('今日の画面から区分を削除しました。', () => { state.dashboard = previous; });
    }
    return;
  }
  if (action === 'open-widget-animals') {
    const found = findDashboardWidget(state.dashboard, actionElement.dataset.widgetId);
    if (!found) return;
    const query = found.widget.config?.query || { filters: [], sort: { field: 'code', direction: 'asc' } };
    state.transientAnimalView = { id: 'dashboard', title: `ダッシュボード: ${found.widget.title}`, builtin: false, query: { ...query, limit: 0 } };
    state.activeAnimalViewId = 'dashboard';
    state.collectionTab = 'animals';
    await navigateRoute('animals');
  }
});

app.addEventListener('pointerover', (event) => {
  const toastElement = event.target.closest?.('[data-toast]');
  if (toastElement && !toastElement.contains(event.relatedTarget)) feedbackController.pause();
});

app.addEventListener('pointerout', (event) => {
  const toastElement = event.target.closest?.('[data-toast]');
  if (toastElement && !toastElement.contains(event.relatedTarget)) feedbackController.resume();
});

app.addEventListener('focusin', (event) => {
  if (event.target.closest?.('[data-toast]')) feedbackController.pause();
});

app.addEventListener('focusout', (event) => {
  if (event.target.closest?.('[data-toast]') && !event.relatedTarget?.closest?.('[data-toast]')) feedbackController.resume();
});

async function topicMutation(callback) {
  try {
    await callback();
    if (state.topicDetail?.id) state.topicDetail = await services.topics.get(state.topicDetail.id);
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function socialMutation(callback) {
  try { await callback(); state.settings.relationships = await services.social.relationships(); render(); }
  catch (error) { await handleApiError(error); render(); }
}

async function inlineSocialMutation(callback, message) {
  try {
    await callback();
    if (state.careDetail) state.careDetail = await services.care.feedDetail(state.careDetail.item?.id || state.careDetail.id);
    if (state.topicDetail) state.topicDetail = await services.topics.get(state.topicDetail.id);
    showToast(message);
  } catch (error) { await handleApiError(error); render(); }
}

async function executeConfirmedAction() {
  const modal = state.modal;
  if (!modal?.confirmAction) return;
  if (modal.confirmPhrase && String(modal.confirmValue || '').trim() !== String(modal.confirmPhrase).trim()) return;
  state.modal = { ...modal, submitting: true };
  render();
  try {
    const action = modal.confirmAction;
    const payload = modal.payload || {};
    if (action === 'delete-animal') {
      let queued = false;
      try { await services.animals.remove(payload.id); }
      catch (error) {
        if (error?.code === 'network_error') {
          enqueueOffline('delete_spider', payload.id, {}, { notify: false });
          queued = true;
        }
        else throw error;
      }
      state.modal = null;
      state.selectedAnimal = null;
      state.selectedAnimalId = null;
      await refreshAnimalsAndCare();
      await navigateRoute('animals', { collectionTab: 'animals', history: 'replace' });
      if (queued) showOfflineQueueToast(1);
      else showToast('個体を削除しました。');
      return;
    }
    if (action === 'delete-record') {
      let queued = false;
      try { await services.care.remove(payload.logId); }
      catch (error) {
        if (error?.code === 'network_error') {
          enqueueOffline('delete_log', payload.logId, {}, { notify: false });
          queued = true;
        }
        else throw error;
      }
      state.modal = null;
      await refreshAnimalsAndCare({ includeRecords: true });
      state.recordsWindow = clampListWindow(state.recordsWindow, filterRecords(state.records, state.recordFilter).length);
      if (queued) showOfflineQueueToast(1);
      else showToast('記録を削除しました。');
      return;
    }
    if (action === 'delete-baby') {
      await services.babies.remove(payload.id);
      state.modal = null;
      state.babyDetail = null;
      state.babyGroups = await services.babies.list();
      showToast('ベビー群を削除しました。');
      return;
    }
    if (action === 'end-enclosure-occupancy') {
      if (state.mockMode) {
        const enclosure = enclosureById(payload.enclosureId);
        if (enclosure) {
          enclosure.occupants = (enclosure.occupants || []).filter((item) => String(item.animal_id) !== String(payload.animalId));
          enclosure.occupant_count = enclosure.occupants.length;
          enclosure.events.unshift({ id: `mock-move-${Date.now()}`, event_type: 'animal_move_out', event_label: '退居', event_date: new Date().toLocaleDateString('sv-SE'), animal_id: payload.animalId, animal_code: animalLabelById(payload.animalId), note: '' });
          const animal = state.animals.find((item) => String(item.id) === String(payload.animalId));
          if (animal) { animal.enclosure = ''; animal.enclosure_id = 0; }
        }
      } else {
        await services.enclosures.endOccupancy(payload.enclosureId, payload.animalId, { ended_at: new Date().toLocaleDateString('sv-SE') });
        await refreshEnclosures({ animals: true });
      }
      state.modal = null;
      state.selectedEnclosure = enclosureById(payload.enclosureId) || state.selectedEnclosure;
      showToast('入居履歴を残して容器から外しました。');
      return;
    }
    if (action === 'archive-enclosure') {
      if (state.mockMode) {
        const enclosure = enclosureById(payload.enclosureId);
        if (enclosure?.occupant_count) throw new Error('入居中の個体を先に退居させてください。');
        state.enclosures.items = state.enclosures.items.filter((item) => String(item.id) !== String(payload.enclosureId));
      } else {
        await services.enclosures.remove(payload.enclosureId);
        await refreshEnclosures({ detail: false });
      }
      state.modal = null;
      state.selectedEnclosureId = null;
      state.selectedEnclosure = null;
      showToast('飼育容器をアーカイブしました。');
      return;
    }
    if (action === 'unshare-care') {
      await services.care.unshareFeed(payload.id);
      state.modal = null;
      state.careDetail = null;
      state.careFeed = await services.care.feedList(state.careFilters);
      showToast('共有を解除しました。');
      return;
    }
    if (action === 'delete-care-comment') {
      await services.care.removeFeedComment(payload.id);
      state.modal = null;
      state.careDetail = await services.care.feedDetail(state.careDetail.item?.id || state.careDetail.id);
      showToast('コメントを削除しました。');
      return;
    }
    if (action === 'block-user') {
      await services.social.block(payload.id);
      state.modal = null;
      state.careDetail = null;
      state.topicDetail = null;
      state.careFeed = null;
      state.topics = null;
      await loadCommunityTab(state.communityTab, { force: true });
      showToast('利用者をブロックしました。');
      return;
    }
    if (action === 'disable-external') await services.integrations.disableExternal();
    if (action === 'disable-live') await services.integrations.disableLive();
    if (action === 'disable-chatgpt') await services.integrations.disableChatgpt();
    if (action === 'clear-offline') {
      offlineQueue.clear();
      syncQueueState();
    }
    state.modal = null;
    if (action.startsWith('disable-')) await loadSettingsTab('integrations', { force: true });
    else render();
    showToast(action === 'clear-offline' ? '同期待ちを破棄しました。' : '連携を無効化しました。');
  } catch (error) {
    state.modal = { ...modal, submitting: false, error: error?.message || '操作を完了できませんでした。' };
    render();
  }
}

const mutationFormHandlers = [
  ['[data-role="dashboard-section-form"]', submitDashboardSection],
  ['[data-role="dashboard-widget-form"]', submitDashboardWidget],
  ['[data-role="saved-view-form"]', submitSavedView],
  ['[data-role="login-form"]', submitLogin],
  ['[data-role="registration-form"]', submitRegistration],
  ['[data-role="password-reset-form"]', submitPasswordReset],
  ['[data-role="record-form"]', submitRecord],
  ['[data-role="animal-form"]', submitAnimal],
  ['[data-role="baby-group-form"]', submitBabyGroup],
  ['[data-role="nursery-event-form"]', submitNurseryEvent],
  ['[data-role="baby-bulk-form"]', submitBabyBulk],
  ['[data-role="baby-promote-form"]', submitBabyPromote],
  ['[data-role="baby-qr-form"]', submitBabyQr],
  ['[data-role="enclosure-form"]', submitEnclosure],
  ['[data-role="enclosure-event-form"]', submitEnclosureEvent],
  ['[data-role="enclosure-occupancy-form"]', submitEnclosureOccupancy],
  ['[data-role="task-action-form"]', submitTaskAction],
  ['[data-role="feeder-action-form"]', submitFeederAction],
  ['[data-role="egg-batch-form"]', submitEggBatch],
  ['[data-role="finish-egg-form"]', submitFinishEgg],
  ['[data-role="qr-label-target-form"]', submitQrLabelTargets],
  ['[data-role="qr-resolve-form"]', submitQrResolve],
  ['[data-role="qr-batch-record-form"]', submitQrBatchRecord],
  ['[data-role="qr-history-record-form"]', submitQrHistoryRecord],
  ['[data-role="qr-target-form"]', submitQrTarget],
  ['[data-role="qr-record-form"]', submitQrRecord],
  ['[data-role="qr-settings-form"]', submitQrSettings],
  ['[data-role="topic-form"]', submitTopic],
  ['[data-role="care-comment-form"]', submitCareComment],
  ['[data-role="topic-comment-form"]', submitTopicComment],
  ['[data-role="species-suggestion-form"]', submitSpeciesSuggestion],
  ['[data-role="profile-form"]', submitProfile],
  ['[data-role="appearance-form"]', submitAppearance],
  ['[data-role="notification-form"]', submitNotificationPreferences],
  ['[data-role="care-profile-default-form"]', submitCareProfileDefaults],
  ['[data-role="care-profile-species-form"]', (form) => submitCareProfileOverride(form, 'species')],
  ['[data-role="care-profile-animal-form"]', (form) => submitCareProfileOverride(form, 'animals')],
  ['[data-role="enclosure-care-default-form"]', submitEnclosureCareDefaults],
  ['[data-role="enclosure-care-type-form"]', (form) => submitEnclosureCareOverride(form, 'types')],
  ['[data-role="enclosure-care-enclosure-form"]', (form) => submitEnclosureCareOverride(form, 'enclosures')],
  ['[data-role="nursery-care-default-form"]', submitNurseryCareDefaults],
  ['[data-role="nursery-care-species-form"]', (form) => submitNurseryCareOverride(form, 'species')],
  ['[data-role="nursery-care-nursery-form"]', (form) => submitNurseryCareOverride(form, 'nurseries')],
  ['[data-role="external-token-form"]', submitExternalToken],
  ['[data-role="live-session-form"]', submitLiveSession],
  ['[data-role="report-form"]', submitReport]
];

app.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.matches('[data-role="topic-search-form"]')) { await submitTopicSearch(form); return; }
  if (form.matches('[data-role="species-search-form"]')) { await submitSpeciesSearch(form); return; }
  const route = mutationFormHandlers.find(([selector]) => form.matches(selector));
  if (!route || form.dataset.pending === 'true') return;
  if (!validateForm(form)) return;
  const stableSpecimenIntake = form.dataset.stableForm === 'specimen-intake';
  if (stableSpecimenIntake && !syncSpecimenIntakeController()?.validate()) return;
  const label = form.dataset.pendingLabel || (form.matches('[data-role="login-form"]') ? 'ログイン中…' : '保存中…');
  const snapshot = captureFormState(form);
  const returnFocus = form.ownerDocument?.activeElement;
  const draftKey = form.dataset.formDraftKey || '';
  const panel = form.closest('.modal, .sheet');
  const modalType = form.closest('[data-modal]') ? state.modal?.type || '' : '';
  const sheetType = form.closest('[data-sheet]') ? state.sheet || '' : '';
  const role = /^[a-z0-9-]+$/.test(form.dataset.role || '') ? form.dataset.role : '';
  let mutationError = null;
  try {
    const operation = route[1](form);
    if (modalType && state.modal?.type === modalType && !state.modal.submitting && !stableSpecimenIntake) {
      state.modal = { ...state.modal, submitting: true, error: null };
    }
    setFormPending(form, true, { label });
    setDialogPending(panel, true, { label: panel?.dataset.busyLabel || '保存しています…' });
    await operation;
  } catch (error) {
    mutationError = error;
  } finally {
    let needsRender = false;
    if (modalType && state.modal?.type === modalType && state.modal.submitting) {
      state.modal = { ...state.modal, submitting: false };
      if (stableSpecimenIntake) specimenIntakeController?.setPending(false);
      else needsRender = true;
    }
    if (sheetType === 'record-form' && state.sheet === sheetType && state.quickRecord.submitting) {
      state.quickRecord = { ...state.quickRecord, submitting: false };
      needsRender = true;
    }
    if (needsRender) render();
    setDialogPending(panel, false);
    setFormPending(form, false);
    const contextStillOpen = (modalType && state.modal?.type === modalType)
      || (sheetType && state.sheet === sheetType);
    const replacement = role ? app.querySelector(`form[data-role="${role}"]`) : null;
    if (contextStillOpen && !form.isConnected && role) {
      restoreFormState(replacement, snapshot);
    }
    const activeForm = replacement || (form.isConnected ? form : null);
    if (mutationError && isPlanError(mutationError)) {
      planControls.showError(mutationError, activeForm, { returnFocus });
      if (activeForm === form && returnFocus?.isConnected && form.contains(returnFocus) && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
    }
    else if (mutationError && !applyServerFieldErrors(activeForm, mutationError)) {
      await handleApiError(mutationError);
      render();
    }
    if (!mutationError && draftKey && !contextStillOpen && !replacement) {
      formSafety.markSubmitted(draftKey);
    }
  }
});

function submitCareProfileDefaults(form) {
  state.careProfile = normalizeCareProfile({
    ...state.careProfile,
    defaults: rulesFromFormData(new FormData(form))
  });
  persistUiPreferences();
  render();
  showToast('全体の飼育ルールを保存しました。');
}

function submitCareProfileOverride(form, scope) {
  const data = new FormData(form);
  const key = String(data.get('key') || '').trim();
  if (!key) return;
  state.careProfile = normalizeCareProfile({
    ...state.careProfile,
    [scope]: {
      ...state.careProfile[scope],
      [key]: rulesFromFormData(data, { partial: true })
    }
  });
  persistUiPreferences();
  render();
  showToast(scope === 'species' ? '種ごとのルールを保存しました。' : '個体ごとのルールを保存しました。');
}

function submitEnclosureCareDefaults(form) {
  state.enclosureCareProfile = normalizeEnclosureCareProfile({
    ...state.enclosureCareProfile,
    defaults: enclosureCareRulesFromForm(new FormData(form))
  });
  persistUiPreferences();
  render();
  showToast('飼育容器の全体ルールを保存しました。');
}

function submitEnclosureCareOverride(form, scope) {
  const data = new FormData(form);
  const key = String(data.get('key') || '').trim();
  if (!key) return;
  state.enclosureCareProfile = normalizeEnclosureCareProfile({
    ...state.enclosureCareProfile,
    [scope]: {
      ...state.enclosureCareProfile[scope],
      [key]: enclosureCareRulesFromForm(data, { partial: true })
    }
  });
  persistUiPreferences();
  render();
  showToast(scope === 'types' ? '容器種別の飼育ルールを保存しました。' : '個別容器の飼育ルールを保存しました。');
}

function submitNurseryCareDefaults(form) {
  state.nurseryCareProfile = normalizeNurseryCareProfile({
    ...state.nurseryCareProfile,
    defaults: nurseryCareRulesFromForm(new FormData(form))
  });
  persistUiPreferences();
  render();
  showToast('ベビー群の全体ルールを保存しました。');
}

function submitNurseryCareOverride(form, scope) {
  const data = new FormData(form);
  const key = String(data.get('key') || '').trim();
  if (!key) return;
  state.nurseryCareProfile = normalizeNurseryCareProfile({
    ...state.nurseryCareProfile,
    [scope]: { ...state.nurseryCareProfile[scope], [key]: nurseryCareRulesFromForm(data, { partial: true }) }
  });
  persistUiPreferences();
  render();
  showToast(scope === 'species' ? '種ごとのベビー群ルールを保存しました。' : '個別ベビー群の飼育ルールを保存しました。');
}

async function submitTaskAction(form) {
  const task = currentCareModel().tasks.find((item) => item.id === form.dataset.taskId) || state.modal?.task;
  if (!task) return;
  const retryAt = String(new FormData(form).get('retry_at') || '');
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  await persistTaskAction(task, 'deferred', { retryAt });
  state.modal = null;
  showToast(`${retryAt}まで延期しました。`);
  render();
}

function submitDashboardSection(form) {
  const title = String(new FormData(form).get('title') || '').trim();
  const section = state.dashboard.sections.find((item) => item.id === form.dataset.sectionId);
  if (section && title) section.title = title.slice(0, 40);
  state.dashboardEditor = null;
  commitDashboard();
}

function submitDashboardWidget(form) {
  const data = new FormData(form);
  const found = findDashboardWidget(state.dashboard, form.dataset.widgetId);
  if (!found) return;

  const limit = Math.min(30, Math.max(1, Number(data.get('limit') || 8)));
  let config = { ...found.widget.config, limit };
  if (form.dataset.widgetType === 'smart_animals') {
    config = {
      ...config,
      query: animalQueryFromSettings({
        status: String(data.get('status') || ''),
        excludePreMolt: data.get('exclude_pre_molt') === 'on',
        feedDays: data.get('feed_days') === '' ? '' : Number(data.get('feed_days')),
        species: String(data.get('species') || '').trim(),
        classification: String(data.get('classification') || ''),
        favorite: data.get('favorite') === 'on',
        sortField: String(data.get('sort_field') || 'code'),
        sortDirection: String(data.get('sort_direction') || 'asc'),
        limit
      }),
      quickAction: String(data.get('quick_action') || '')
    };
  } else if (form.dataset.widgetType === 'feed_due') {
    config = {
      ...config,
      quickAction: String(data.get('quick_action') || 'feed')
    };
    delete config.days;
  }

  updateDashboardWidget(state.dashboard, found.widget.id, {
    title: String(data.get('title') || found.widget.title).trim().slice(0, 40),
    size: String(data.get('size') || found.widget.size),
    config
  });
  state.dashboardEditor = null;
  commitDashboard();
}

function submitSavedView(form) {
  const data = new FormData(form);
  const view = savedViewFromSettings({
    id: form.dataset.viewId || undefined,
    title: String(data.get('title') || '').trim(),
    status: String(data.get('status') || ''),
    excludePreMolt: data.get('exclude_pre_molt') === 'on',
    feedDays: data.get('feed_days') === '' ? '' : Number(data.get('feed_days')),
    species: String(data.get('species') || '').trim(),
    classification: String(data.get('classification') || ''),
    favorite: data.get('favorite') === 'on',
    sortField: String(data.get('sort_field') || 'code'),
    sortDirection: String(data.get('sort_direction') || 'asc')
  });
  const index = state.savedAnimalViews.findIndex((item) => item.id === view.id);
  if (index >= 0) state.savedAnimalViews[index] = view;
  else state.savedAnimalViews.push(view);
  state.activeAnimalViewId = view.id;
  state.transientAnimalView = null;
  state.savedViewEditor = null;
  localStorage.setItem('setae.gui.v2.activeAnimalView', view.id);
  markPersonalizationCustomized();
  persistUiPreferences();
  render();
}

async function submitLogin(form) {
  const data = new FormData(form);
  const login = String(data.get('login') || '').trim();
  const password = String(data.get('password') || '');
  state.authSubmitting = true;
  state.authError = null;
  render();
  try {
    const session = await services.session.login({ login, password, remember: data.get('remember') === 'on' });
    state.authenticated = true;
    state.publicMode = false;
    state.bootstrap = { ...(state.bootstrap || {}), authenticated: true, nonce: session?.nonce || null, user: session?.user || null };
    state.settings.profile = session?.user || null;
    activateOfflineQueueOwner();
    loadCurrentOnboarding();
    applyTheme(session?.user?.theme_preference || 'system');
    await loadUiPreferences();
    state.setupOpen = false;
    await loadPrivateData();
    refreshOnboarding({ announce: false, settleExisting: true });
    await syncOfflineQueue({ quiet: true });
    state.page = 'today';
    const returnUrl = consumeRequestedReturnUrl();
    if (returnUrl) {
      location.replace(returnUrl);
      return;
    }
    replaceRoute(captureRoute(0), { url: cleanAppPath() });
  } catch (error) {
    state.authenticated = false;
    offlineQueue.setOwner(null);
    state.authError = error?.message || 'ログインできませんでした。';
  } finally {
    state.authSubmitting = false;
    render();
  }
}

async function submitRegistration(form) {
  const data = new FormData(form);
  state.authSubmitting = true;
  state.authError = null;
  render();
  try {
    const result = await services.account.register({
      email: String(data.get('email') || '').trim(),
      username: String(data.get('username') || '').trim(),
      password: String(data.get('password') || ''),
      referral_code: String(data.get('referral_code') || '').trim(),
      referral_source: 'gui_v2_local',
      terms_accepted: data.get('terms_accepted') === '1',
      terms_version: String(data.get('terms_version') || state.bootstrap?.terms_version || '')
    });
    state.authView = 'login';
    state.authMessage = result?.message || '仮登録が完了しました。確認メールをご確認ください。';
  } catch (error) {
    state.authError = error?.message || '登録できませんでした。';
  } finally {
    state.authSubmitting = false;
    render();
  }
}

async function submitPasswordReset(form) {
  const login = String(new FormData(form).get('login') || '').trim();
  state.authSubmitting = true;
  state.authError = null;
  render();
  try {
    const result = await services.account.passwordReset(login);
    state.authMessage = result?.message || '再設定メールの送信を受け付けました。';
  } catch (error) {
    state.authError = error?.message || '再設定メールを送信できませんでした。';
  } finally {
    state.authSubmitting = false;
    render();
  }
}

async function submitRecord(form) {
  const formData = new FormData(form);
  const type = requestedRecordType(state.quickRecord.type, 'submit-record');
  if (!type) {
    state.quickRecord = { ...state.quickRecord, error: invalidRecordTypeMessage };
    render();
    return;
  }
  const batchIds = [...new Set((state.quickRecord.animalIds || []).map(String).filter(Boolean))];
  const animalId = formData.get('animal_id');
  const targetIds = batchIds.length ? batchIds : [String(animalId || '')].filter(Boolean);
  if (!targetIds.length) {
    state.quickRecord = { ...state.quickRecord, error: '記録する個体を選択してください。' };
    render();
    return;
  }
  const date = formData.get('date');
  const data = recordDataFromForm(formData, type);
  const image = formData.get('image');
  const relatedTasks = new Map(targetIds.map((id) => [String(id), pendingTask('animal', id, type)]).filter(([, task]) => task));

  state.quickRecord = { ...state.quickRecord, submitting: true, error: null };
  render();
  try {
    let result = { total: targetIds.length, succeeded: targetIds.length, failed: 0, errors: [] };
    let queuedCount = 0;
    if (state.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      replaceAnimals(applyRecordToAnimals(state.animals, targetIds, type, date, data));
      const savedEvents = [];
      targetIds.forEach((id, index) => {
        const animal = state.animals.find((item) => String(item.id) === String(id));
        const event = { id: `mock-${Date.now()}-${index}`, type, date, data };
        savedEvents.push({ animal, event });
        state.records.unshift({ animal, event });
      });
      state.recordsLoaded = true;
      if (state.selectedAnimalId && targetIds.includes(String(state.selectedAnimalId))) {
        state.selectedAnimal = state.animals.find((item) => String(item.id) === String(state.selectedAnimalId)) || state.selectedAnimal;
        state.selectedEvents = [
          ...savedEvents.filter(({ animal }) => String(animal?.id) === String(state.selectedAnimalId)).map(({ event }) => event),
          ...state.selectedEvents
        ];
      }
    } else {
      result = await submitRecordTargets({
        ids: targetIds,
        type,
        date,
        data,
        image,
        create: (targetId, payload) => services.care.create(targetId, payload),
        enqueue: (targetId, payload) => {
          queuedCount += 1;
          return enqueueOffline('create_log', 0, { spider_id: Number(targetId), ...payload }, { notify: false });
        }
      });
      await refreshAnimalsAndCare({ includeRecords: true });
      if (state.selectedAnimalId && targetIds.includes(String(state.selectedAnimalId))) {
        const [animal, events] = await Promise.all([services.animals.get(state.selectedAnimalId), services.care.listEvents(state.selectedAnimalId, { perPage: 100 })]);
        state.selectedAnimal = animal;
        state.selectedEvents = events;
      }
    }
    const failedIds = new Set(result.errors.map((item) => String(item.id)));
    await persistPreparedTaskActions(targetIds.filter((id) => !failedIds.has(String(id))).map((id) => {
      const task = relatedTasks.get(String(id));
      return task ? createTaskAction(task, type === 'feed' && data.refused ? 'attempted' : 'completed') : null;
    }));
    targetIds.filter((id) => !failedIds.has(String(id))).forEach((id) => {
      recordQuickRecordUsage(localStorage, { animalId: id, type, preyType: data.prey_type || '' });
    });
    if (result.failed) {
      const retryIds = result.errors.map((item) => item.id);
      state.quickRecord = { ...state.quickRecord, animalIds: retryIds, error: `${result.succeeded}匹に記録しました。失敗した${result.failed}匹だけを残しています。` };
      state.collectionSelection = setCollectionSelectedIds(state.collectionSelection, retryIds);
      return;
    }
    state.sheet = null;
    if (batchIds.length) state.collectionSelection = clearCollectionSelection(state.collectionSelection, { keepMode: true });
    resetQuickRecord();
    refreshOnboarding();
    if (queuedCount) showOfflineQueueToast(queuedCount);
    else showToast(recordSaved(type, targetIds.length));
  } catch (error) {
    state.quickRecord = { ...state.quickRecord, error: error?.message || '記録できませんでした。' };
  } finally {
    state.quickRecord = { ...state.quickRecord, submitting: false };
    render();
  }
}

async function submitAnimal(form) {
  const controller = syncSpecimenIntakeController();
  const id = form.dataset.animalId;
  const data = new FormData(form);
  data.delete('species_query');
  const classification = String(data.get('classification') || 'tarantula');
  const speciesId = Number(data.get('species_id') || 0);
  const customSpecies = String(data.get('custom_species') || '').trim();
  if (classification === 'tarantula' && !speciesId && !customSpecies) {
    controller?.setError('図鑑から種を選ぶか、図鑑未登録の種名を入力してください。', 'species_query');
    return;
  }
  let image = data.get('image');
  if ((!(image instanceof File) || image.size === 0) && state.modal?.imageFile instanceof File && state.modal.imageFile.size > 0) {
    image = state.modal.imageFile;
    data.set('image', image);
  }
  if (!(image instanceof File) || image.size === 0) data.delete('image');
  data.set('archived', form.elements.archived?.checked ? '1' : '0');
  const publicSettingsChanged = appendSpecimenPublicSettings(data, form, state.modal?.data);
  const json = formDataObject(data, { keepEmpty: Boolean(id) });
  state.modal = { ...state.modal, submitting: true, error: null };
  controller?.clearError();
  controller?.setPending(true, id ? '個体情報を保存しています…' : '個体を登録しています…');
  try {
    const payload = data.has('image') ? data : json;
    try {
      if (id) await services.animals.update(id, payload);
      else await services.animals.create(payload);
    } catch (error) {
      if (error?.code === 'network_error' && !data.has('image') && !publicSettingsChanged) {
        enqueueOffline(id ? 'update_spider' : 'create_spider', Number(id || -Date.now()), json);
        controller?.destroy();
        specimenIntakeController = null;
        state.modal = null;
        render();
        return;
      }
      if (error?.code === 'network_error' && publicSettingsChanged) error.message = '公開設定を含む変更の保存結果を確認できませんでした。入力は保持しています。通信状態を確認し、もう一度保存してください。';
      throw error;
    }
    controller?.destroy();
    specimenIntakeController = null;
    state.modal = null;
    await refreshAnimalsAndCare({ includeRecords: true });
    if (id) await openAnimal(id);
    else render();
    showToast(id ? '個体情報を更新しました。' : '個体を登録しました。');
  } catch (error) {
    state.modal = { ...state.modal, submitting: false, error: error?.message || '保存できませんでした。' };
    controller?.setPending(false);
    if (isPlanError(error)) throw error;
    if (!applyServerFieldErrors(form, error)) {
      controller?.setError(error?.message || '保存できませんでした。');
    } else {
      controller?.setError('入力内容を確認してください。');
    }
  }
}

async function submitBabyGroup(form) {
  const id = form.dataset.groupId;
  const data = new FormData(form);
  data.delete('species_query');
  const payload = formDataObject(data);
  if (!id) payload.parent_spider_ids = [...form.elements.parent_spider_ids.selectedOptions].map((option) => Number(option.value));
  else payload.archived = form.elements.archived?.checked || false;
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    const result = id ? await services.babies.update(id, payload) : await services.babies.create(payload);
    state.modal = null;
    state.babyGroups = await services.babies.list();
    if (id) state.babyDetail = result;
    refreshOnboarding();
    showToast(id ? 'ベビー群を更新しました。' : 'ベビー群を作成しました。');
    render();
  } catch (error) {
    throwIfServerFieldError(error);
    if (isPlanError(error)) throw error;
    state.modal = { ...state.modal, submitting: false, error: error?.message || 'ベビー群を保存できませんでした。' };
    render();
  }
}

async function submitNurseryEvent(form) {
  const group = nurseryById(form.dataset.groupId);
  if (!group) return;
  const payload = nurseryEventPayload(new FormData(form));
  const taskType = ({ count_check: 'count', environment_check: 'environment' })[payload.type] || payload.type;
  const relatedTask = pendingTask('nursery', group.id, taskType);
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    const result = await saveNurseryEvent({ service: services.babies, group, payload, mock: state.mockMode });
    state.babyDetail = result.group;
    if (state.mockMode) {
      const replace = (items = []) => items.map((item) => String(item.id) === String(group.id) ? result.group : item);
      state.babyGroups = { ...state.babyGroups, items: replace(state.babyGroups?.items), archived_items: replace(state.babyGroups?.archived_items) };
      state.records.unshift({ targetType: 'nursery', targetId: group.id, nursery: result.group, event: result.event });
    } else {
      state.babyGroups = await services.babies.list();
      state.records = normalizeRecentRecords(await listJournalRecords({ limit: 100 }), state.animals);
    }
    state.recordsLoaded = true;
    refreshOnboarding();
    await persistTaskAction(relatedTask, 'completed');
    state.modal = null;
    showToast(`${nurseryEventLabel(payload.type)}を記録しました。`);
  } catch (error) {
    throwIfServerFieldError(error);
    state.modal = { ...state.modal, submitting: false, error: error?.message || 'ベビー群の記録を保存できませんでした。' };
  }
  render();
}

async function submitBabyBulk(form) {
  const groupId = form.dataset.groupId;
  const payload = formDataObject(new FormData(form));
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    const result = await services.babies.bulk(groupId, payload);
    state.babyDetail = result.group || await services.babies.get(groupId);
    state.nurseryRegisterWindow = {
      ...clampListWindow(state.nurseryRegisterWindow, state.babyDetail?.items?.length || 0),
      groupId: String(groupId)
    };
    state.babyGroups = await services.babies.list();
    state.modal = null;
    showToast(recordSaved(payload.event, result.updated || 0));
    render();
  } catch (error) { state.modal = { ...state.modal, submitting: false, error: error?.message || '一括記録できませんでした。' }; render(); }
}

async function submitBabyPromote(form) {
  const groupId = form.dataset.groupId;
  const codes = new FormData(form).get('codes');
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    const result = await services.babies.promote(groupId, codes);
    state.babyDetail = result.group || await services.babies.get(groupId);
    state.nurseryRegisterWindow = {
      ...clampListWindow(state.nurseryRegisterWindow, state.babyDetail?.items?.length || 0),
      groupId: String(groupId)
    };
    state.babyGroups = await services.babies.list();
    await refreshAnimalsAndCare();
    state.modal = null;
    showToast(`${result.created?.length || 0}匹を通常個体へ移動しました。`);
    render();
  } catch (error) { if (isPlanError(error)) throw error; state.modal = { ...state.modal, submitting: false, error: error?.message || '移動できませんでした。' }; render(); }
}

async function submitBabyQr(form) {
  const groupId = form.dataset.groupId;
  const group = state.modal?.group || nurseryById(groupId);
  const selection = state.modal?.selection || createBabyQrSelection(group);
  const selected = babyQrSelectionResult(group, selection);
  if (selected.error || !selected.codes.length) {
    state.modal = { ...state.modal, error: selected.error || '印刷する番号を選択してください。' };
    render();
    return;
  }
  const codes = selected.codes;
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    if (state.mockMode) {
      const knownCodes = new Set((group?.items || []).map((item) => String(item.code)));
      const items = codes.filter((code) => knownCodes.has(String(code))).map((code, index) => mockQrTargetForBaby(group, code, index));
      if (!items.length) throw new Error('ベビー群に存在する番号を入力してください。');
      state.qr.targets = { items, count: items.length };
    } else {
      state.qr.targets = await loadBabyQrTargets(services.qr, groupId, codes, { purpose: 'labels' });
    }
    state.qr = { ...state.qr, section: 'labels', error: null };
    state.modal = null;
    state.recordsView = 'qr';
    await navigateRoute('records', { recordsTab: 'qr' });
  } catch (error) { if (isPlanError(error)) throw error; state.modal = { ...state.modal, submitting: false, error: error?.message || 'QRラベルを取得できませんでした。' }; render(); }
}

async function submitEnclosure(form) {
  const id = form.dataset.enclosureId;
  const formData = new FormData(form);
  const careOverrides = enclosureCareRulesFromForm(formData, { partial: true });
  const data = formDataObject(formData, { keepEmpty: Boolean(id) });
  const payload = { ...data };
  Object.keys(payload).filter((key) => key.startsWith('care_')).forEach((key) => delete payload[key]);
  ['width', 'depth', 'height'].forEach((key) => {
    const value = payload[`${key}_cm`];
    delete payload[`${key}_cm`];
    if (value !== undefined) payload[`${key}_mm`] = value === '' ? '' : Number(value) * 10;
  });
  const substrateDepth = payload.substrate_depth_cm;
  delete payload.substrate_depth_cm;
  if (substrateDepth !== undefined) payload.substrate_depth_mm = substrateDepth === '' ? '' : Number(substrateDepth) * 10;

  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    let result;
    if (state.mockMode) {
      const existing = enclosureById(id);
      const base = existing || mockEnclosure({
        id: Date.now(),
        code: payload.code || `E${String((state.enclosures?.items?.length || 0) + 1).padStart(3, '0')}`,
        name: payload.name || '',
        enclosure_type: payload.enclosure_type || 'unspecified',
        type_label: enclosureTypeLabel(payload.enclosure_type),
        dimensions_label: '寸法未設定',
        location: payload.location || '',
        animal: { id: 0, title: '', species_name: '' },
        temperature: null,
        humidity: null,
        environmentDue: true,
        maintenanceDue: false
      });
      Object.assign(base, payload, {
        code: String(payload.code || base.code).toUpperCase(),
        type_label: enclosureTypeLabel(payload.enclosure_type || base.enclosure_type),
        dimensions_label: enclosureDimensions(payload)
      });
      if (!existing) {
        base.occupants = [];
        base.occupant_count = 0;
        base.occupancy_history = [];
        state.enclosures.items.push(base);
      }
      result = base;
      state.enclosures.summary.active = state.enclosures.items.length;
    } else {
      result = id ? await services.enclosures.update(id, payload) : await services.enclosures.create(payload);
      await refreshEnclosures({ detail: Boolean(state.selectedEnclosureId) });
    }
    state.modal = null;
    const enclosureId = String(result?.id || id || '');
    if (enclosureId) {
      const enclosures = { ...state.enclosureCareProfile.enclosures };
      if (Object.keys(careOverrides).length) enclosures[enclosureId] = careOverrides;
      else delete enclosures[enclosureId];
      state.enclosureCareProfile = normalizeEnclosureCareProfile({ ...state.enclosureCareProfile, enclosures });
      persistUiPreferences();
    }
    if (id && state.selectedEnclosureId) state.selectedEnclosure = result;
    showToast(id ? '飼育容器を更新しました。' : '飼育容器を登録しました。');
    render();
  } catch (error) {
    throwIfServerFieldError(error);
    state.modal = { ...state.modal, submitting: false, error: error?.message || '飼育容器を保存できませんでした。' };
    render();
  }
}

async function submitEnclosureEvent(form) {
  const id = form.dataset.enclosureId;
  const payload = formDataObject(new FormData(form));
  const relatedTask = pendingTask('enclosure', id, enclosureTaskType(payload.event_type));
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    if (state.mockMode) {
      const enclosure = enclosureById(id);
      const event = {
        id: `mock-enclosure-${Date.now()}`,
        event_type: payload.event_type,
        event_label: enclosureEventLabel(payload.event_type),
        event_date: payload.event_date,
        temperature: payload.temperature === undefined ? null : Number(payload.temperature),
        humidity: payload.humidity === undefined ? null : Number(payload.humidity),
        note: payload.note || ''
      };
      enclosure.events.unshift(event);
      if (event.event_type === 'environment_check') {
        if (event.temperature == null && event.humidity == null) throw new Error('温度または湿度を入力してください。');
        enclosure.last_environment = event;
        enclosure.care.environment_due = false;
      }
      if (['maintenance', 'substrate_change'].includes(event.event_type)) {
        enclosure.last_maintenance = event;
        enclosure.care.maintenance_due = false;
      }
      state.records.unshift({
        targetType: 'enclosure',
        targetId: enclosure.id,
        enclosure,
        event: { ...event, type: event.event_type, date: event.event_date }
      });
      state.selectedEnclosure = enclosure;
    } else {
      const enclosure = await services.enclosures.record(id, payload);
      if (String(state.selectedEnclosureId || '') === String(id)) state.selectedEnclosure = enclosure;
      await refreshEnclosures({ detail: false });
      state.records = normalizeRecentRecords(await listJournalRecords({ limit: 100 }), state.animals);
      state.recordsLoaded = true;
    }
    await persistTaskAction(relatedTask, 'completed');
    state.modal = null;
    showToast('容器の記録を保存しました。');
    render();
  } catch (error) {
    state.modal = { ...state.modal, submitting: false, error: error?.message || '容器の記録を保存できませんでした。' };
    render();
  }
}

async function submitEnclosureOccupancy(form) {
  const id = form.dataset.enclosureId;
  const data = new FormData(form);
  const animalIds = [...form.elements.animal_ids.selectedOptions].map((option) => String(option.value));
  if (!animalIds.length) return;
  const payload = { animal_ids: animalIds, started_at: data.get('started_at'), note: data.get('note') };
  state.modal = { ...state.modal, submitting: true, error: null };
  render();
  try {
    if (state.mockMode) {
      const target = enclosureById(id);
      animalIds.forEach((animalId) => {
        const animal = state.animals.find((item) => String(item.id) === animalId);
        const previous = enclosureById(animal?.enclosure_id);
        if (previous) {
          previous.occupants = previous.occupants.filter((item) => String(item.animal_id) !== animalId);
          previous.occupant_count = previous.occupants.length;
        }
        const occupant = { occupancy_id: Date.now() + Number(animalId), animal_id: animal.id, animal_code: animalCode(animal), species_name: animal.species_name, started_at: payload.started_at, ended_at: '', note: payload.note || '' };
        target.occupants.push(occupant);
        target.occupant_count = target.occupants.length;
        target.occupancy_history.unshift(occupant);
        target.events.unshift({ id: `mock-move-${Date.now()}-${animalId}`, event_type: 'animal_move_in', event_label: '入居', event_date: payload.started_at, animal_id: animal.id, animal_code: animalCode(animal), note: payload.note || '' });
        animal.enclosure_id = Number(id);
        animal.enclosure = target.code;
      });
      state.selectedEnclosure = target;
    } else {
      state.selectedEnclosure = await services.enclosures.assign(id, payload);
      await refreshEnclosures({ detail: false, animals: true });
    }
    state.modal = null;
    showToast(`${animalIds.length}匹を容器へ移動しました。`);
    render();
  } catch (error) {
    state.modal = { ...state.modal, submitting: false, error: error?.message || '個体を容器へ移動できませんでした。' };
    render();
  }
}

async function submitFeederAction(form) {
  try {
    await services.feeders.action(formDataObject(new FormData(form)));
    state.feeders = await services.feeders.dashboard();
    state.modal = null;
    showToast('餌在庫を記録しました。');
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '記録できませんでした。' }; render(); }
}

async function submitEggBatch(form) {
  try {
    await services.feeders.createEgg(formDataObject(new FormData(form)));
    state.feeders = await services.feeders.dashboard();
    state.modal = null;
    showToast('卵セットを追加しました。');
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '追加できませんでした。' }; render(); }
}

async function submitFinishEgg(form) {
  try {
    await services.feeders.updateEgg(form.dataset.batchId, formDataObject(new FormData(form)));
    state.feeders = await services.feeders.dashboard();
    state.modal = null;
    showToast('卵セットを更新しました。');
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '更新できませんでした。' }; render(); }
}

async function submitQrResolve(form) {
  await resolveQrCode(new FormData(form).get('code'));
}

async function submitQrLabelTargets(form) {
  const ids = new FormData(form).getAll('animal_ids').map(String).filter(Boolean);
  if (!ids.length) {
    state.qr = { ...state.qr, error: '印刷する個体を選択してください。' };
    render();
    return;
  }
  await openCollectionQr(ids);
}

async function submitQrTarget(form) {
  try { state.qr.targets = await services.qr.targets({ ids: [new FormData(form).get('animal_id')], purpose: 'labels' }); render(); }
  catch (error) { await handleApiError(error); render(); }
}

async function submitQrRecord(form) {
  const data = new FormData(form);
  try {
    const result = await services.qr.records({ codes: splitValues(data.get('codes')), type: data.get('type'), date: data.get('date'), note: data.get('note'), prey_type: data.get('prey_type') });
    await refreshAnimalsAndCare({ includeRecords: true });
    state.qr.prefillCode = '';
    showToast(recordSaved(data.get('type'), result.created || result.count || 0));
    form.reset();
  } catch (error) { await handleApiError(error); }
  render();
}

function applyMockQrRecordEntries(entries, targetsByCode) {
  entries.forEach((entry, index) => {
    const target = targetsByCode.get(parseQrCode(entry.code));
    if (!target?.object_id) return;
    const data = { note: entry.note, prey_type: entry.prey_type };
    if (target.target_type === 'baby') {
      const group = nurseryById(target.object_id);
      const baby = group?.items?.find((item) => String(item.code) === String(target.baby_code));
      if (!baby) return;
      const history = [...(baby.history || [])];
      const existing = history.findIndex((item) => item.type === entry.type && item.date === entry.date);
      const event = { type: entry.type, date: entry.date, note: entry.note };
      if (entry.type === 'feed' && entry.prey_type) event.prey_type = entry.prey_type;
      if (existing >= 0) history[existing] = { ...history[existing], ...event };
      else history.push(event);
      baby.history = history.sort((left, right) => `${left.date}${left.type}`.localeCompare(`${right.date}${right.type}`));
      if (entry.type === 'molt') {
        baby.molts = [...new Set([...(baby.molts || []), entry.date])].sort();
        baby.last_molt = baby.molts.at(-1) || '';
      }
    } else if (target.target_type === 'spider') {
      replaceAnimals(applyRecordToAnimals(state.animals, [String(target.object_id)], entry.type, entry.date, data));
      const animal = state.animals.find((item) => String(item.id) === String(target.object_id));
      state.records.unshift({ animal, event: { id: `mock-qr-${Date.now()}-${index}`, type: entry.type, date: entry.date, data } });
    }
  });
  state.recordsLoaded = true;
}

async function refreshQrRecordTargets(targetsByCode) {
  await refreshAnimalsAndCare({ includeRecords: true });
  const nurseryIds = [...new Set([...targetsByCode.values()]
    .filter((target) => target?.target_type === 'baby' && target.object_id)
    .map((target) => String(target.object_id)))];
  if (!nurseryIds.length) return;
  state.babyGroups = await services.babies.list();
  if (nurseryIds.includes(String(state.babyDetail?.id || ''))) {
    state.babyDetail = await services.babies.get(state.babyDetail.id);
  }
}

async function persistQrRecordEntries(entries, targetsByCode) {
  let queued = false;
  if (state.mockMode) {
    applyMockQrRecordEntries(entries, targetsByCode);
  } else {
    try {
      await services.qr.records({ entries });
    } catch (error) {
      if (error?.code !== 'network_error') throw error;
      enqueueOffline('create_qr_records', 0, { entries }, { notify: false });
      queued = true;
    }
    if (!queued) await refreshQrRecordTargets(targetsByCode);
  }

  const taskActions = qrTaskCompletionCandidates(entries, targetsByCode).map(({ target, type }) => {
    const task = pendingTask('animal', target.object_id, type);
    return task ? createTaskAction(task, 'completed') : null;
  });
  await persistPreparedTaskActions(taskActions);
  return { queued };
}

async function submitQrBatchRecord(form) {
  syncQrBatchRows(form);
  const entries = qrBatchEntries(state.qr);
  if (!entries.length || entries.length !== state.qr.scanQueue.length) {
    state.qr = { ...state.qr, error: '全ての個体に有効な日付を入力してください。' };
    render();
    return;
  }

  const targetsByCode = new Map(state.qr.scanQueue.map((target) => [parseQrCode(target.code), target]));
  state.qr = { ...state.qr, saving: true, error: null };
  render();
  try {
    const { queued } = await persistQrRecordEntries(entries, targetsByCode);
    state.qr = {
      ...resetQrHistory(state.qr),
      scanQueue: [],
      batchRows: {},
      batchStep: 'scan',
      resolved: null,
      saving: false,
      error: null,
      scanStatus: queued ? `${entries.length}件を同期待ちへ保存しました。` : recordSaved(state.qr.batchEventType, entries.length),
      scanStatusTone: 'success'
    };
    if (queued) showOfflineQueueToast(entries.length);
    else showToast(recordSaved(state.qr.batchEventType, entries.length));
  } catch (error) {
    state.qr = { ...state.qr, saving: false, error: error?.message || '一括記録を保存できませんでした。' };
    render();
  }
}

async function submitQrHistoryRecord(form) {
  syncQrHistoryRows(form);
  const rows = state.qr.historyRows || [];
  const entries = qrHistoryEntries(state.qr);
  if (!rows.length || rows.length !== entries.length) {
    state.qr = { ...state.qr, error: 'すべての履歴に有効な日付を入力してください。' };
    render();
    return;
  }
  const target = state.qr.resolved;
  const code = parseQrCode(state.qr.historyTargetCode || target?.code || '');
  if (!target?.object_id || !code) {
    state.qr = { ...state.qr, error: '管理対象のQRをもう一度読み取ってください。' };
    render();
    return;
  }

  const targetsByCode = new Map([[code, target]]);
  state.qr = { ...state.qr, saving: true, error: null };
  render();
  try {
    const { queued } = await persistQrRecordEntries(entries, targetsByCode);
    let refreshedTarget = target;
    if (!queued && !state.mockMode) {
      try { refreshedTarget = await services.qr.resolve(code); }
      catch {}
    }
    state.qr = {
      ...resetQrHistory(state.qr, code),
      resolved: refreshedTarget,
      prefillCode: code,
      saving: false,
      scanStatus: queued ? `${entries.length}件を同期待ちへ保存しました。` : `${entries.length}件の履歴を記録しました。`,
      scanStatusTone: 'success'
    };
    if (queued) showOfflineQueueToast(entries.length);
    else showToast(`${entries.length}件の履歴を記録しました。`);
  } catch (error) {
    state.qr = { ...state.qr, saving: false, error: error?.message || '履歴を保存できませんでした。' };
    render();
  }
}

async function submitQrSettings(form) {
  const data = new FormData(form);
  if (!data.has('visibility')) return;
  const settings = qrSettingsPayload(data);
  state.modal = { ...state.modal, data: { ...state.modal.data, ...settings }, submitting: true, error: null };
  render();
  try {
    const result = state.mockMode
      ? { target: { ...mockQrTargetForAnimal(state.animals.find((animal) => String(animal.id) === String(form.dataset.animalId))), ...settings } }
      : await services.qr.settings(form.dataset.animalId, settings);
    state.modal = null;
    syncSpecimenPublicSettings(state, form.dataset.animalId, result?.target || settings);
    showToast('公開設定を保存しました。');
  } catch (error) {
    state.modal = { ...state.modal, submitting: false, error: error?.message || '公開設定を保存できませんでした。' };
  }
  render();
}

async function submitTopic(form) {
  const data = new FormData(form);
  data.delete('species_query');
  let image = data.get('image');
  if ((!(image instanceof File) || image.size === 0) && state.modal?.imageFile instanceof File && state.modal.imageFile.size > 0) {
    image = state.modal.imageFile;
    data.set('image', image);
  }
  if (!(image instanceof File) || image.size === 0) data.delete('image');
  data.set('has_cw', form.elements.has_cw.checked ? '1' : '0');
  const payload = data.has('image') ? data : formDataObject(data);
  try {
    const result = await services.topics.create(payload);
    state.modal = null;
    state.topics = await services.topics.list(state.topicFilters);
    const id = result?.id || result?.topic?.id;
    if (id) state.topicDetail = await services.topics.get(id);
    showToast('相談を投稿しました。');
    render();
  } catch (error) {
    throwIfServerFieldError(error);
    state.modal = { ...state.modal, error: error?.message || '相談を投稿できませんでした。入力内容を確認して、もう一度お試しください。' };
    render();
  }
}

async function submitCareComment(form) {
  const id = form.dataset.feedId;
  try {
    await services.care.commentFeed(id, new FormData(form).get('content'), state.replyTarget?.id || 0);
    formSafety.markSubmitted(form);
    state.replyTarget = null;
    state.careDetail = await services.care.feedDetail(id);
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function submitTopicComment(form) {
  const data = new FormData(form);
  const image = data.get('image');
  if (!(image instanceof File) || image.size === 0) data.delete('image');
  const payload = data.has('image') ? data : { content: data.get('content') };
  try {
    await services.topics.comment(form.dataset.topicId, payload);
    formSafety.markSubmitted(form);
    state.topicDetail = await services.topics.get(form.dataset.topicId);
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function submitTopicSearch(form) {
  const data = new FormData(form);
  state.topicFilters = { ...state.topicFilters, search: data.get('search'), type: data.get('type'), sort: data.get('sort') };
  state.topics = null;
  await loadCommunityTab('topics', { force: true });
}

async function submitSpeciesSearch(form) {
  state.speciesSearch = String(new FormData(form).get('search') || '').trim();
  state.species = null;
  await loadCommunityTab('species', { force: true });
}

async function submitSpeciesSuggestion(form) {
  try {
    const result = await services.species.suggest(form.dataset.speciesId, formDataObject(new FormData(form)));
    formSafety.markSubmitted(form);
    form.reset();
    showToast(result?.message || '修正提案を送信しました。');
  } catch (error) { await handleApiError(error); render(); }
}

async function submitProfile(form) {
  const data = new FormData(form);
  const image = data.get('profile_image');
  if (!(image instanceof File) || image.size === 0) data.delete('profile_image');
  const payload = data.has('profile_image') ? data : formDataObject(data);
  try {
    const profile = await services.account.update(payload);
    state.settings.profile = profile;
    updateBootstrapUser(profile);
    showToast('プロフィールを保存しました。');
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function submitAppearance(form) {
  const data = new FormData(form);
  try {
    const showTasks = data.get('show_care_focus') === 'on';
    const profile = await services.account.update({ theme_preference: data.get('theme_preference'), show_care_focus: showTasks });
    state.settings.profile = profile;
    state.todayTasks = normalizeTodayTaskPreferences({ ...state.todayTasks, visible: showTasks });
    persistUiPreferences();
    updateBootstrapUser(profile);
    applyTheme(profile.theme_preference);
    showToast('表示設定を保存しました。');
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function submitNotificationPreferences(form) {
  const data = new FormData(form);
  const payload = {
    enabled: data.get('enabled') === 'on',
    care_reminders: data.get('care_reminders') === 'on',
    community_messages: data.get('community_messages') === 'on',
    care_hour: Number(data.get('care_hour')),
    care_minute: Number(data.get('care_minute')),
    timezone: data.get('timezone')
  };
  try {
    state.settings.pwaPreferences = await services.notifications.savePreferences(payload);
    showToast('通知設定を保存しました。');
    render();
  } catch (error) { await handleApiError(error); render(); }
}

async function submitExternalToken(form) {
  try {
    state.settings.integrations.result = await services.integrations.createExternalToken(new FormData(form).get('mode'));
    state.modal = null;
    await loadSettingsTab('integrations', { force: true });
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '発行できませんでした。' }; render(); }
}

async function submitLiveSession(form) {
  const data = new FormData(form);
  try {
    state.settings.integrations.result = await services.integrations.createLiveSession(data.get('mode'), Number(data.get('duration')));
    state.modal = null;
    await loadSettingsTab('integrations', { force: true });
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '発行できませんでした。' }; render(); }
}

async function submitReport(form) {
  const reason = new FormData(form).get('reason');
  try {
    if (form.dataset.targetType === 'care') await services.care.reportFeed(form.dataset.targetId, reason);
    if (form.dataset.targetType === 'care-comment') await services.care.reportFeedComment(form.dataset.targetId, reason);
    state.modal = null;
    showToast('通報を受け付けました。');
    render();
  } catch (error) { state.modal = { ...state.modal, error: error?.message || '通報できませんでした。' }; render(); }
}

function enclosureTypeLabel(type) {
  return ({ acrylic: 'アクリル容器', glass: 'ガラス容器', plastic: 'プラケース', terrarium: 'テラリウム', vial: 'バイアル', rack_tub: 'ラックケース', custom: 'カスタム容器', unspecified: '種類未設定' })[type] || '種類未設定';
}

function enclosureDimensions(data) {
  const values = ['width_mm', 'depth_mm', 'height_mm'].map((key) => Number(data[key]));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return '寸法未設定';
  return `${values.map((value) => Number.isInteger(value / 10) ? value / 10 : (value / 10).toFixed(1)).join(' × ')} cm`;
}

function formDataObject(data, { keepEmpty = false } = {}) {
  const result = {};
  for (const [key, value] of data.entries()) {
    if (value instanceof File) continue;
    if (value === '' && !keepEmpty) continue;
    if (Object.hasOwn(result, key)) result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    else result[key] = value;
  }
  return result;
}

function splitValues(value) {
  return String(value || '').split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

function updateBabyQrSelectionSummary() {
  if (state.modal?.type !== 'baby-qr') return;
  const result = babyQrSelectionResult(state.modal.group, state.modal.selection);
  const status = app.querySelector('[data-role="baby-qr-selection-status"]');
  const submit = app.querySelector('[data-role="baby-qr-submit"]');
  if (status) {
    const count = status.querySelector('strong');
    const message = status.querySelector('span');
    if (count) count.textContent = `${result.codes.length}枚`;
    if (message) message.textContent = result.error || '印刷する識別票を準備します。';
  }
  if (submit) {
    submit.textContent = `${result.codes.length}枚のラベルを準備`;
    submit.disabled = Boolean(result.error || !result.codes.length);
  }
}

app.addEventListener('compositionstart', (event) => {
  if (event.target.matches('[data-role="animal-search"]')) {
    collectionSearchController.compositionStart();
  } else if (event.target.matches('[data-role="species-combobox-input"]')) {
    speciesComboboxController.compositionStart();
  }
});

app.addEventListener('compositionend', (event) => {
  if (event.target.matches('[data-role="animal-search"]')) {
    collectionSearchController.compositionEnd(event.target.value);
  } else if (event.target.matches('[data-role="species-combobox-input"]')) {
    speciesComboboxController.compositionEnd(event.target.value);
  }
});

app.addEventListener('input', (event) => {
  if (event.target.matches('[data-role="confirm-phrase"]')) {
    state.modal = { ...state.modal, confirmValue: event.target.value };
    const confirmButton = app.querySelector('[data-action="confirm-modal"]');
    if (confirmButton) {
      confirmButton.disabled = event.target.value.trim() !== String(state.modal?.confirmPhrase || '').trim();
      confirmButton.setAttribute('aria-disabled', confirmButton.disabled ? 'true' : 'false');
    }
    return;
  }
  if (event.target.matches('.date-field-control')) {
    syncDateFieldDisplay(event.target);
  }
  if (event.target.matches('[data-history-field]')) {
    const row = event.target.closest('[data-history-row-id]');
    if (row) {
      state.qr = updateQrHistoryRow(state.qr, row.dataset.historyRowId, {
        [event.target.dataset.historyField]: event.target.value
      });
    }
    return;
  }
  if (event.target.matches('[data-role="baby-qr-range"]')) {
    state.modal = {
      ...state.modal,
      error: null,
      selection: {
        ...(state.modal?.selection || {}),
        [event.target.dataset.rangeKey]: event.target.value
      }
    };
    updateBabyQrSelectionSummary();
    return;
  }
  if (event.target.matches('[data-role="baby-qr-search"]')) {
    const search = event.target.value;
    state.modal = {
      ...state.modal,
      selection: { ...(state.modal?.selection || {}), search }
    };
    const visibleCodes = new Set(filterBabyQrItems(state.modal.group, search).map((item) => item.code));
    app.querySelectorAll('[data-baby-code]').forEach((item) => {
      item.hidden = !visibleCodes.has(item.dataset.babyCode);
    });
    return;
  }
  if (event.target.matches('[data-batch-field]')) {
    const row = event.target.closest('[data-qr-code]');
    const code = parseQrCode(row?.dataset.qrCode || '');
    if (code) {
      state.qr.batchRows = {
        ...state.qr.batchRows,
        [code]: { ...(state.qr.batchRows?.[code] || {}), [event.target.dataset.batchField]: event.target.value }
      };
    }
    return;
  }
  if (event.target.matches('[data-role="qr-same-date"]')) {
    state.qr.sameDate = event.target.value;
    return;
  }
  if (event.target.matches('[data-role="animal-search"]')) {
    collectionSearchController.input(event.target.value, { isComposing: event.isComposing });
    return;
  }
  if (event.target.matches('[data-role="species-combobox-input"]')) {
    speciesComboboxController.input(event.target.value, { isComposing: event.isComposing });
    return;
  }
  if (event.target.matches('[data-role="nursery-current-count"]')) {
    const form = event.target.closest('form');
    const previous = Number(form?.querySelector('[data-role="nursery-previous-count"]')?.textContent || 0);
    const current = Number(event.target.value || 0);
    const difference = current - previous;
    const output = form?.querySelector('[data-role="nursery-count-difference"]');
    const warning = form?.querySelector('[data-role="nursery-count-warning"]');
    if (output) output.textContent = `${difference > 0 ? '+' : ''}${difference}`;
    if (warning) {
      warning.hidden = difference === 0;
      warning.textContent = difference < 0 ? `${Math.abs(difference)}匹を確認できませんでした。` : difference > 0 ? `${difference}匹増えています。番号別状態も確認してください。` : '';
    }
  }
});

app.addEventListener('change', async (event) => {
  if (event.target.matches('.date-field-control')) {
    syncDateFieldDisplay(event.target);
  }
  if (event.target.matches('[data-role="baby-qr-mode"]')) {
    state.modal = {
      ...state.modal,
      error: null,
      selection: { ...(state.modal?.selection || {}), mode: event.target.value }
    };
    render();
    return;
  }
  if (event.target.matches('[data-role="baby-qr-item"]')) {
    const selected = new Set(state.modal?.selection?.selectedCodes || []);
    if (event.target.checked) selected.add(event.target.value);
    else selected.delete(event.target.value);
    state.modal = {
      ...state.modal,
      error: null,
      selection: { ...(state.modal?.selection || {}), selectedCodes: [...selected] }
    };
    updateBabyQrSelectionSummary();
    return;
  }
  if (event.target.matches('[data-role="qr-tape-length"]')) {
    const tapeLengthMm = Number(event.target.value);
    state.qr.labelConfig = saveLabelConfig(localStorage, normalizeLabelConfig({
      ...state.qr.labelConfig,
      tapeLengthMm,
      ...(tapeLengthMm <= 24 ? { format: 'micro-id' } : {})
    }));
    render();
    return;
  }
  if (event.target.matches('[data-role="specimen-classification"]')) {
    syncSpecimenIntakeController()?.setClassification(event.target.value || 'tarantula');
    return;
  }
  if (event.target.matches('[data-role="qr-label-toggle"]')) {
    state.qr.labelConfig = saveLabelConfig(localStorage, normalizeLabelConfig({
      ...state.qr.labelConfig,
      [event.target.dataset.configKey]: event.target.checked
    }));
    refreshQrLabelPreview(app, { qr: state.qr });
    return;
  }
  if (event.target.matches('[data-role="qr-image-input"]')) {
    const file = event.target.files?.[0];
    const canvas = app.querySelector('[data-role="qr-canvas"]');
    if (!file || !canvas) return;
    updateQrScanStatus('画像からQRを確認しています。');
    try {
      const code = await decodeQrImage(file, canvas);
      await resolveQrCode(code);
    } catch (error) {
      state.qr = { ...state.qr, scanStatus: error?.message || '画像を確認できませんでした。', scanStatusTone: 'error' };
      render();
    } finally {
      event.target.value = '';
    }
    return;
  }
  if (event.target.matches('[data-role="animal-card-mode"]')) {
    setAnimalDisplayMode(event.target.value);
    return;
  }
  if (event.target.matches('[data-role="collection-view-filter"]')) {
    state.activeAnimalViewId = event.target.value || 'all';
    if (state.activeAnimalViewId !== 'dashboard') state.transientAnimalView = null;
    localStorage.setItem('setae.gui.v2.activeAnimalView', state.activeAnimalViewId);
    state.collectionSelection = reconcileCollectionSelection(state.collectionSelection, visibleCollectionAnimals());
    render();
    return;
  }
  if (event.target.matches('[data-role="card-config-field"]')) {
    const field = event.target.dataset.cardField;
    if (!Object.hasOwn(state.animalCardConfig.fields, field)) return;
    updateAnimalCardConfig({
      ...state.animalCardConfig,
      fields: { ...state.animalCardConfig.fields, [field]: event.target.checked }
    });
    return;
  }
  if (event.target.matches('[data-role="card-config-action"]')) {
    const index = Number(event.target.dataset.cardActionIndex);
    if (!Number.isInteger(index) || index < 0 || index > 2) return;
    const actions = [0, 1, 2].map((slot) => state.animalCardConfig.quickActions[slot] || '');
    actions[index] = event.target.value;
    updateAnimalCardConfig({ ...state.animalCardConfig, quickActions: actions.filter(Boolean) });
    return;
  }
  if (event.target.matches('.file-picker input[type="file"]')) {
    const name = event.target.files?.[0]?.name || '選択されていません';
    const target = event.target.closest('.file-picker')?.querySelector('[data-file-name]');
    if (target) target.textContent = name;
    if (['animal', 'topic'].includes(state.modal?.type)) {
      state.modal = { ...state.modal, imageFile: event.target.files?.[0] || null };
    }
    if (state.modal?.type === 'animal') specimenIntakeController?.setFileStatus(event.target.files?.[0] || null);
    return;
  }
  if (event.target.matches('[data-role="record-filter"]')) {
    state.recordFilter = event.target.value;
    state.recordsWindow = resetListWindow(state.recordsWindow);
    render();
    return;
  }
  if (event.target.matches('[data-role="care-scope"]')) {
    state.careFilters.scope = event.target.value;
    state.careFeed = null;
    await loadCommunityTab('care', { force: true });
    return;
  }
  if (event.target.matches('[data-role="care-sort"]')) {
    state.careFilters.sort = event.target.value;
    state.careFeed = null;
    await loadCommunityTab('care', { force: true });
  }
});

app.addEventListener('dblclick', async (event) => {
  const card = resolveAnimalNavigationTarget(event.target);
  if (!card?.hasAttribute('data-collection-animal') || !isDesktopCollection() || state.collectionSelection.selectionMode) return;
  window.clearTimeout(collectionClickTimer);
  collectionClickTimer = null;
  await openAnimal(card.dataset.animalId);
});

app.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
  if (event.target.matches('[data-role="species-combobox-input"]')) {
    const handled = speciesComboboxController.keydown(event.key);
    if (handled) event.preventDefault();
    if (handled || event.key === 'Tab') return;
  }
  const currentTab = event.target.closest?.('.tabs[role="tablist"] > [role="tab"]');
  if (currentTab && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const tabButtons = [...currentTab.parentElement.children].filter((item) => item.matches('[role="tab"]:not([disabled])'));
    const nextIndex = nextTabIndex(tabButtons.indexOf(currentTab), tabButtons.length, event.key);
    const nextTab = tabButtons[nextIndex];
    if (!nextTab) return;
    if (nextTab.dataset.action === 'specimen-tab') {
      updateSpecimenTab(nextTab.dataset.tab, { focusActive: true });
      return;
    }
    const tabIdentity = Object.entries(nextTab.dataset).find(([name]) => name !== 'action');
    nextTab.click();
    requestAnimationFrame(() => {
      const renderedTab = [...app.querySelectorAll('[role="tab"]')].find((item) => (
        item.dataset.action === nextTab.dataset.action
        && (!tabIdentity || item.dataset[tabIdentity[0]] === tabIdentity[1])
      ));
      renderedTab?.focus();
    });
    return;
  }
  if (event.key === 'Escape' && !overlayController.activePanel) {
    event.preventDefault();
    if (isDialogMutationBusy()) return;
    requestBack().catch((error) => console.error('SETAE back navigation failed.', error));
    return;
  }
  const card = resolveAnimalNavigationTarget(event.target);
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    const intent = collectionItemIntent({
      collectionItem: card.hasAttribute('data-collection-animal'),
      selectionMode: state.collectionSelection.selectionMode,
      wide: isDesktopCollection()
    });
    if (intent === 'toggle-selection') {
      state.collectionSelection = toggleCollectionAnimal(state.collectionSelection, card.dataset.animalId);
      render();
    } else if (intent === 'select-inspector') {
      selectCollectionAnimal(card.dataset.animalId);
    } else {
      openAnimal(card.dataset.animalId);
    }
  }
});

window.addEventListener('online', async () => {
  state.online = true;
  syncQueueState();
  await syncOfflineQueue({ quiet: false });
});

window.addEventListener('offline', () => {
  state.online = false;
  state.syncStatus = 'offline';
  state.syncMessage = '操作はこの端末に保存し、再接続後に同期します。';
  renderSyncStatusIslands();
});

function isStandalonePwa() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

window.addEventListener('popstate', (event) => {
  const hasLocalLayer = Boolean(
    app.querySelector('.action-menu[open]')
    || state.modal
    || hasSheetOpen()
    || state.collectionSelection.selectionMode
  );
  if (!hasLocalLayer && !isRouteState(event.state)) return;
  requestBack({ fromPopstate: true, poppedState: event.state })
    .catch((error) => console.error('SETAE route restoration failed.', error));
});

window.addEventListener('pagehide', () => {
  saveCurrentRouteScroll();
  if (qrCameraActive()) stopVisibleQrCamera();
  mobileGestureController.stop();
  nativeViewportController.stop();
});
window.addEventListener('pageshow', () => {
  nativeViewportController.start();
  mobileGestureController.start();
});

async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    state.error = 'このブラウザはプッシュ通知に対応していません。';
    render();
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      state.error = '通知が許可されませんでした。ブラウザ設定をご確認ください。';
      render();
      return;
    }
    const config = state.settings.pwaConfig || await services.notifications.config();
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(config.public_key)
      });
    }
    await services.notifications.subscribe({
      subscription: subscription.toJSON(),
      device_name: navigator.userAgentData?.platform || navigator.platform || 'ブラウザ',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
    });
    await loadSettingsTab('notifications', { force: true });
    showToast('この端末で通知を受け取れるようになりました。');
  } catch (error) {
    await handleApiError(error);
    render();
  }
}

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function offerServiceWorkerUpdate(worker) {
  if (!worker || !navigator.serviceWorker.controller) return;
  waitingServiceWorker = worker;
  state.appUpdateAvailable = true;
  state.appUpdateApplying = false;
  renderUpdateNoticeIsland();
}

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting) {
    offerServiceWorkerUpdate(registration.waiting);
  }
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        offerServiceWorkerUpdate(worker);
      }
    });
  });
}

if ('serviceWorker' in navigator && appConfig.serviceWorkerUrl) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!serviceWorkerReloadRequested) return;
    serviceWorkerReloadRequested = false;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(appConfig.serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none'
    }).then(watchServiceWorkerRegistration).catch((error) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}

boot();
