// Lightweight helper to start MSW in development when running node preflight.
try {
  const { worker } = require('./browser')
  // no-op here; in dev the app should import and start the worker on the client
  if (worker && worker.start) {
    // don't start from node in this script; keep for future use
  }
} catch (e) {
  // ignore in CI
}
// Lightweight helper to start MSW in development when running node preflight.
try {
  const { worker } = require('./browser')
  // no-op here; in dev the app should import and start the worker on the client
  if (worker && worker.start) {
    // don't start from node in this script; keep for future use
  }
} catch (e) {
  // ignore in CI
}
