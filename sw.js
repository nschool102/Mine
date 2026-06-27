// =========================================================================
// SERVICE WORKER CHO PWA
// =========================================================================

const CACHE_NAME = 'toi-app-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/icon.png'
];

// Cài đặt Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache mở thành công');
                return cache.addAll(ASSETS);
            })
            .catch(err => console.log('Lỗi cache:', err))
    );
    self.skipWaiting();
}); // end event install

// Kích hoạt Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
}); // end event activate

// Xử lý fetch
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
}); // end event fetch

// Xử lý thông báo đẩy
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'TÔI - Nhắc hẹn';
    const options = {
        body: data.body || 'Bạn có lịch hẹn sắp tới!',
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200]
    };
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
}); // end event push

// Xử lý click vào thông báo
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
}); // end event notificationclick

// Nhận message từ main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon } = event.data;
        self.registration.showNotification(title, {
            body: body,
            icon: icon || '/icon.png',
            vibrate: [200, 100, 200]
        });
    }
}); // end event message
