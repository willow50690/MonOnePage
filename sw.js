/**
 * Service worker : met le site en cache pour permettre le MODE HORS-LIGNE.
 *
 * Après une première visite, la tablette garde une copie des fichiers du
 * site. Ainsi, même si le serveur local (Termux) n'est pas démarré,
 * `http://localhost:8080` continue de s'afficher avec la copie en cache.
 *
 * NB : le service worker n'est actif que sur http://localhost ou https,
 * ce qui est exactement notre cas.
 */

// Nom du cache : PRÉCISER la version quand les fichiers du site changent
// (ex. 'mononepage-v2'), pour que les tablettes rechargent le nouveau contenu
// au lieu de garder l'ancien.
const CACHE_NAME = 'mononepage-v2';

// Fichiers à mettre en cache dès la première visite
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './script.js'
];

// Installation : copier tous les fichiers du site dans le cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activation : supprimer les anciens caches (des versions précédentes)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Réponse aux requêtes :
// - on sert d'abord la copie en cache (rapide, fonctionne hors-ligne),
// - en arrière-plan on re-télécharge la version fraîche pour la prochaine fois.
self.addEventListener('fetch', (event) => {
    // Ne gérer que les requêtes GET (pas de formulaires envoyés en POST)
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            const refresh = fetch(event.request)
                .then(response => {
                    // Ranger la version fraîche dans le cache si elle est valide
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    // Pas de réseau : revenir au cache existant
                    return cached || caches.match('./index.html');
                });
            return cached || refresh;
        })
    );
});
