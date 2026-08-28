export const DEFAULT_TOAST_DURATION = 3200;
export const ACTION_TOAST_DURATION = 6000;

export function normalizeToast(message, options = {}, id = 1) {
  const settings = typeof options === 'string' ? { type: options } : options || {};
  const actionLabel = String(settings.actionLabel || '');
  const action = String(settings.action || '');
  return {
    id,
    message: String(message || ''),
    type: ['default', 'success', 'warning', 'error'].includes(settings.type) ? settings.type : 'success',
    actionLabel,
    action,
    data: settings.data && typeof settings.data === 'object' ? settings.data : {},
    duration: Number(settings.duration) > 0
      ? Number(settings.duration)
      : actionLabel && action ? ACTION_TOAST_DURATION : DEFAULT_TOAST_DURATION
  };
}

export function createFeedbackController({
  onChange = () => {},
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  now = () => Date.now()
} = {}) {
  let sequence = 0;
  let current = null;
  let timer = null;
  let startedAt = 0;
  let remaining = 0;
  let actionHandler = null;

  const clear = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };

  const dismiss = () => {
    clear();
    current = null;
    remaining = 0;
    actionHandler = null;
    onChange(null);
  };

  const schedule = () => {
    clear();
    if (!current || remaining <= 0) return;
    startedAt = now();
    timer = setTimer(dismiss, remaining);
  };

  const show = (message, options = {}) => {
    const settings = typeof options === 'string' ? { type: options } : options || {};
    current = normalizeToast(message, settings, ++sequence);
    remaining = current.duration;
    actionHandler = typeof settings.onAction === 'function' ? settings.onAction : null;
    onChange(current);
    schedule();
    return current;
  };

  const pause = () => {
    if (!current || !timer) return;
    remaining = Math.max(0, remaining - (now() - startedAt));
    clear();
  };

  const resume = () => {
    if (!current || timer) return;
    if (remaining <= 0) dismiss();
    else schedule();
  };

  const runAction = async () => {
    if (!current?.action) return false;
    const snapshot = current;
    const handler = actionHandler;
    dismiss();
    if (handler) await handler(snapshot.data, snapshot.action);
    return true;
  };

  return {
    show,
    dismiss,
    pause,
    resume,
    runAction,
    get value() { return current; },
    get remaining() { return remaining; }
  };
}
