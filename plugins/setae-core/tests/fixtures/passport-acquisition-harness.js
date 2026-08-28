/* No network or account fake here: the test runner sends local requests through actual PHP. */
document.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.fixtureReady = 'true';
});
