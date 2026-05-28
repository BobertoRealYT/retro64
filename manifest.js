// PWA Manifest initialization
if ('manifest' in document.head) {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) {
    console.log('PWA Manifest loaded');
  }
}

// Theme color for browser UI
const metaTheme = document.querySelector('meta[name="theme-color"]');
if (metaTheme) {
  metaTheme.setAttribute('content', '#FF6B6B');
}

// Viewport setup for mobile
const metaViewport = document.querySelector('meta[name="viewport"]');
if (metaViewport) {
  metaViewport.setAttribute('content', 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover');
}

// Apple-specific meta tags
function setupAppleMeta() {
  const appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
  if (appleCapable) {
    appleCapable.setAttribute('content', 'yes');
  }

  const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleStatusBar) {
    appleStatusBar.setAttribute('content', 'black-translucent');
  }

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) {
    appleTitle.setAttribute('content', 'Retro64');
  }
}

setupAppleMeta();

// Prevent scroll bounce on iOS
document.body.addEventListener('touchmove', function(e) {
  if (e.target.closest('#library') || e.target.closest('.modal')) {
    return;
  }
  e.preventDefault();
}, { passive: false });

// Handle app install prompt
let installPrompt = null;
let isAppInstalled = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  console.log('Install prompt available');
  
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isAppInstalled = true;
    console.log('App is already installed');
  }
});

window.addEventListener('appinstalled', () => {
  console.log('App installed');
  isAppInstalled = true;
  installPrompt = null;
});

// Detect if running as standalone app
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

console.log('Running as standalone app:', isStandalone());

// Prevent context menu on mobile
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('input') && !e.target.closest('textarea')) {
    e.preventDefault();
  }
}, false);

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('App hidden');
  } else {
    console.log('App visible');
  }
});

// Prevent pinch zoom
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('App is online');
});

window.addEventListener('offline', () => {
  console.log('App is offline');
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(registration => {
      console.log('Service Worker registered:', registration);
      setInterval(() => {
        registration.update();
      }, 60000);
    })
    .catch(error => {
      console.log('Service Worker registration failed:', error);
    });
}

console.log('PWA Initialization Complete');