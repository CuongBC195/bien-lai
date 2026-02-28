// Empty service worker - prevents 404 errors
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => { });
