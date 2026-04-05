/**
 * Polyfills that must run before any other module loads.
 * Import this as the FIRST import in index.js.
 */

// window polyfill for browser-targeting packages (for example socket.io-client)
if (typeof window === 'undefined') {
  global.window = global;
}

// document polyfill so packages that access window.document don't crash
if (!global.document) {
  global.document = {
    title: '',
    documentElement: { style: {} },
    head: { appendChild: function() {} },
    body: { appendChild: function() {} },
    createElement: function() { return {}; },
    getElementsByTagName: function() { return []; },
    querySelector: function() { return null; },
    addEventListener: function() {},
    removeEventListener: function() {},
  };
}

// location polyfill so packages that call window.location.href don't crash
if (!global.location) {
  global.location = {
    href: '',
    origin: '',
    protocol: '',
    host: '',
    hostname: '',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    assign: function() {},
    replace: function() {},
    reload: function() {},
  };
}

// history polyfill for expo-router's createMemoryHistory
if (!global.history) {
  global.history = {
    state: null,
    length: 0,
    pushState: function() {},
    replaceState: function() {},
    go: function() {},
    back: function() {},
    forward: function() {},
  };
}
