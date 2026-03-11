const CACHE_NAME = 'talleres-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/apple-touch-icon.png',
    '/site.webmanifest',
    // Add more assets here if needed
];

self.addEventListener('install', event => {
    console.log('Service Worker installing.');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return Promise.all(urlsToCache.map(url => {
                    return fetch(url, { mode: 'no-cors' })
                        .then(response => {
                            if (!response.ok) {
                                throw new TypeError('Bad response status');
                            }
                            return cache.put(url, response);
                        })
                        .catch(error => {
                            console.error('Failed to fetch and cache:', url, error);
                        });
                }));
            })
            .catch(error => {
                console.error('Failed to open cache or add resources:', error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting cache: ', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    console.log('Fetch intercepted for:', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});