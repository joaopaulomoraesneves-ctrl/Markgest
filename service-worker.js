/* ============================================================
   FESTAGEST PRO - Service Worker
   Cache strategy: Network First com fallback para cache
   ============================================================ */

const CACHE_NAME = 'festagest-pro-v1.0.0';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/assets/icons/icon-72.svg',
    '/assets/icons/icon-96.svg',
    '/assets/icons/icon-128.svg',
    '/assets/icons/icon-144.svg',
    '/assets/icons/icon-152.svg',
    '/assets/icons/icon-192.svg',
    '/assets/icons/icon-384.svg',
    '/assets/icons/icon-512.svg'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Todos os assets foram cacheados.');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Erro ao cachear assets:', error);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Removendo cache antigo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker ativado.');
            return self.clients.claim();
        })
    );
});

// Estratégia de fetch: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Clonar resposta para armazenar no cache
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });
                return networkResponse;
            })
            .catch(() => {
                // Fallback para cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se for uma página, retornar index.html (SPA)
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline - Recurso não disponível', { status: 503 });
                });
            })
    );
});

// Sincronização em segundo plano (para futuras funcionalidades)
self.addEventListener('sync', (event) => {
    console.log('[SW] Evento de sincronização:', event.tag);
});
