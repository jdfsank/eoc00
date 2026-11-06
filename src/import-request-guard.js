// Keep asynchronous file reads from applying after a newer user decision.
// This is transient UI state, never part of a saved world or rule version.
export function createImportRequestGuard() {
  let current = null;
  return Object.freeze({
    begin() {
      current = Object.freeze({});
      return current;
    },
    isCurrent(token) {
      return current !== null && token === current;
    },
    invalidate() {
      current = null;
    },
  });
}
