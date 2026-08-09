let skippedBodyScanThisSession = false;

export function markBodyScanSkippedThisSession() {
  skippedBodyScanThisSession = true;
}

export function hasSkippedBodyScanThisSession() {
  return skippedBodyScanThisSession;
}
