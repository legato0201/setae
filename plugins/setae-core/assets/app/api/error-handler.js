/** Reconcile expired authentication without discarding a valid session. */
export async function handleSessionApiError(error, { state, services, offlineQueue, isCurrent = () => true }) {
  if (!isCurrent()) return;
  if (error?.status === 401) {
    try {
      const session = await services.session.get();
      if (!isCurrent()) return;
      if (!session?.authenticated) {
        state.authenticated = false;
        offlineQueue.setOwner(null);
        state.publicMode = false;
        state.sheet = null;
        state.modal = null;
        state.authError = 'セッションの有効期限が切れました。もう一度ログインしてください。';
        return;
      }
    } catch {
      if (!isCurrent()) return;
      state.authenticated = false;
      offlineQueue.setOwner(null);
      state.publicMode = false;
      return;
    }
  }
  state.error = error?.message || '操作を完了できませんでした。';
}
