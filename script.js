/**
 * Mon One Page - Jeu de Rôle Solo
 * Script JavaScript principal
 *
 * Ce script gère toute la logique de l'application :
 * - Parties multiples (plusieurs personnages, oracles et journaux)
 * - Oracle (gestion des listes et tirages aléatoires)
 * - Feuille de personnage (caractéristiques, thèmes de dons)
 * - Journal d'aventure
 * - Sauvegarde fiable (localStorage + cookie) et export/import JSON
 * - Mode hors-ligne (enregistrement d'un "service worker")
 */

// ============================================
// Constantes de stockage
// ============================================

/**
 * Clé utilisée pour enregistrer les données :
 * - dans le "localStorage" du navigateur (stockage principal, très fiable,
 *   survit au nettoyage du cache et dure des années),
 * - dans un cookie (secours, pour rester compatible avec les anciennes données).
 */
const STORAGE_KEY = 'monOnePageData';
const COOKIE_KEY = 'monOnePageData';

/**
 * Listes de mots d'exemple pour l'Oracle.
 * Elles sont ajoutées en un clic avec "Restaurer les listes d'exemple",
 * uniquement si elles ne sont pas déjà présentes.
 */
const DEFAULT_ORACLE_LISTS = [
    {
        name: 'Actions',
        items: ['attaque', 'négocie', 'se cache', 'fuit', 'explore', 'répare', 'surveille', 'se déguise', 'enquête', 'improvise']
    },
    {
        name: 'Lieux',
        items: ['forêt dense', 'village abandonné', 'ruines anciennes', 'grotte profonde', 'taverne animée', 'tour isolée', 'pont escarpé', 'marché bondé', 'temple en ruine', 'marais brumeux']
    },
    {
        name: 'PNJ',
        items: ['marchand ambulant', 'garde municipal', 'vieil ermite', 'chef de bandits', 'prêtre mystérieux', 'enfant curieux', 'chasseur solitaire', 'sorcière exilée', 'barde farceur', 'mineur inquiet']
    },
    {
        name: 'Événements',
        items: ['embuscade', 'orage soudain', 'rencontre inattendue', 'trésor caché', 'roue cassée', 'incendie', 'rumeur inquiétante', 'journée de chasse', 'famine', 'voleurs sur le marché']
    },
    {
        name: 'Indices',
        items: ['tache de sang', 'lettre déchirée', 'empreinte de botte', 'pièce de monnaie', 'plume étrange', 'sifflet perdu', 'carte au trésor', 'parchemin brûlé', 'cadenas forcé', 'marque au sol']
    }
];

// ============================================
// Variables globales
// ============================================

/**
 * Données de l'application.
 * Une "partie" (un jeu) contient son oracle, son personnage et son journal.
 * On peut créer autant de parties que l'on veut et basculer entre elles.
 *
 * Format v2 :
 * {
 *   version: 2,
 *   currentGameId: 'abc123',   // id de la partie actuellement ouverte
 *   games: [                   // toutes les parties du joueur
 *     {
 *       id: 'abc123',          // identifiant unique de la partie
 *       name: 'Ma partie',     // nom affiché dans le menu déroulant
 *       oracle: { lists: [...], history: [...] },
 *       character: { description: {...}, stats: {...}, themes: {...} },
 *       journal: [ ... ]
 *     },
 *     ...
 *   ]
 * }
 */
let appData = {
    version: 2,
    currentGameId: null,
    games: []
};

// ============================================
// Fonctions utilitaires
// ============================================

/**
 * Génère un identifiant unique
 * @returns {string} Identifiant unique
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Formate une date pour affichage
 * @param {Date|string} date - Date à formater
 * @returns {string} Date formatée
 */
function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Crée un objet "personnage" vide (valeurs par défaut)
 * @returns {Object} Un personnage vierge
 */
function createEmptyCharacter() {
    return {
        description: {
            name: '',
            adjective: '',
            role: ''
        },
        stats: {
            corps: 2,
            ame: 2,
            esprit: 2
        },
        themes: {
            theme1: { name: '', gifts: [] },
            theme2: { name: '', gifts: [] },
            theme3: { name: '', gifts: [] }
        }
    };
}

/**
 * Crée une nouvelle partie vierge (oracle vide, personnage neuf, journal vide)
 * @param {string} name - Nom de la partie affiché dans le menu
 * @returns {Object} La nouvelle partie
 */
function createEmptyGame(name) {
    return {
        id: generateId(),
        name: name,
        oracle: { lists: [], history: [] },
        character: createEmptyCharacter(),
        journal: []
    };
}

/**
 * Complète un personnage partiel (venu d'une sauvegarde incomplète)
 * pour qu'il possède toujours toutes ses propriétés.
 * @param {Object} raw - Personnage brut éventuellement incomplet
 * @returns {Object} Personnage complet et sûr à utiliser
 */
function normalizeCharacter(raw) {
    const character = Object.assign(createEmptyCharacter(), raw || {});
    character.description = Object.assign({ name: '', adjective: '', role: '' }, character.description || {});
    character.stats = Object.assign({ corps: 2, ame: 2, esprit: 2 }, character.stats || {});

    // Les trois thèmes doivent TOUJOURS exister (sinon plantage à l'affichage)
    const themes = Object.assign({
        theme1: { name: '', gifts: [] },
        theme2: { name: '', gifts: [] },
        theme3: { name: '', gifts: [] }
    }, character.themes || {});
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        themes[themeId] = {
            name: (themes[themeId] && themes[themeId].name) || '',
            gifts: Array.isArray(themes[themeId] && themes[themeId].gifts) ? themes[themeId].gifts : []
        };
    });
    character.themes = themes;

    // Les valeurs des caractéristiques doivent être des nombres
    ['corps', 'ame', 'esprit'].forEach(stat => {
        if (typeof character.stats[stat] !== 'number') {
            character.stats[stat] = 2;
        }
    });

    return character;
}

/**
 * Vérifie et complète les données venant d'une sauvegarde
 * (ou d'un ancien export JSON) pour éviter les erreurs.
 * Accepte aussi l'ANCIEN format (avant la v2) qui contenait directement
 * "character" sans tableau "games" : dans ce cas, on fabrique une partie.
 * @param {Object} raw - Données brutes lues (json parsé) ou null
 * @returns {Object|null} Données normalisées, ou null si inutilisables
 */
function normalizeData(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    let data;
    if (Array.isArray(raw.games) && raw.games.length > 0) {
        // Format actuel (v2) : on garde les parties existantes
        data = raw;
    } else if (raw.character) {
        // Ancien format : envelopper dans une première partie
        data = {
            version: 2,
            currentGameId: null,
            games: [{
                id: generateId(),
                name: 'Partie 1',
                oracle: raw.oracle || { lists: [], history: [] },
                character: raw.character,
                journal: Array.isArray(raw.journal) ? raw.journal : []
            }]
        };
    } else {
        return null;
    }

    // Compléter chaque partie si des morceaux manquent
    data.version = 2;
    data.games = data.games.map(g => ({
        id: g.id || generateId(),
        name: g.name || 'Partie',
        oracle: {
            lists: Array.isArray(g.oracle && g.oracle.lists) ? g.oracle.lists : [],
            history: Array.isArray(g.oracle && g.oracle.history) ? g.oracle.history : []
        },
        character: normalizeCharacter(g.character),
        journal: Array.isArray(g.journal) ? g.journal : []
    }));

    // S'assurer que currentGameId pointe vers une partie existante
    if (!data.games.some(g => g.id === data.currentGameId)) {
        data.currentGameId = data.games[0].id;
    }

    return data;
}

/**
 * Renvoie la partie actuellement ouverte.
 * S'il n'y en a pas (cas improbable), crée et renvoie une partie vide.
 * @returns {Object} La partie courante
 */
function getGame() {
    let game = appData.games.find(g => g.id === appData.currentGameId);
    if (!game) {
        game = createEmptyGame('Partie 1');
        appData.games.push(game);
        appData.currentGameId = game.id;
        persist();
    }
    return game;
}

/**
 * Sauvegarde silencieuse : écrit les données dans le localStorage
 * (stockage principal) et dans un cookie (secours).
 * Appelée après chaque modification, pour ne rien perdre.
 */
function persist() {
    try {
        const jsonData = JSON.stringify(appData);
        // Stockage local : c'est ici que les données sont le mieux gardées
        localStorage.setItem(STORAGE_KEY, jsonData);

        // Cookie : secours de compatibilité (expire dans 365 jours).
        // Attention : un cookie est limité en taille (~4 Ko), il peut donc
        // refuser un jeu très rempli — le localStorage, lui, est fiable.
        const expires = new Date();
        expires.setDate(expires.getDate() + 365);
        document.cookie = `${COOKIE_KEY}=${encodeURIComponent(jsonData)}; expires=${expires.toUTCString()}; path=/`;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde :', error);
    }
}

/**
 * Sauvegarde manuelle (bouton "Sauvegarder") : écrit les données
 * et affiche une confirmation visible.
 */
function saveGame() {
    persist();
    showNotification('Données sauvegardées (stockage local + cookie) !');
}

/**
 * Charge les données enregistrées.
 * On lit d'abord le localStorage (le plus fiable), puis le cookie en secours.
 * Les données anciennes (v1) sont automatiquement converties.
 * @returns {boolean} True si des données ont été chargées, false sinon
 */
function loadFromStorage() {
    try {
        // 1. Essayer le localStorage
        let raw = null;
        const fromLocal = localStorage.getItem(STORAGE_KEY);
        if (fromLocal) {
            raw = fromLocal;
        } else {
            // 2. Sinon, essayer le cookie (ancien format de sauvegarde)
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = decodeURIComponent(value);
                return acc;
            }, {});
            if (cookies[COOKIE_KEY]) {
                raw = cookies[COOKIE_KEY];
            }
        }

        if (!raw) {
            return false;
        }

        const normalized = normalizeData(JSON.parse(raw));
        if (normalized) {
            appData = normalized;
            // Si les données venaient du cookie (ancienne sauvegarde),
            // les copier tout de suite dans le localStorage, plus fiable.
            if (!fromLocal) {
                persist();
            }
            console.log('Données chargées depuis le stockage du navigateur');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erreur lors du chargement :', error);
        showNotification('Erreur lors du chargement des données', 'error');
        return false;
    }
}

/**
 * Efface les données enregistrées (localStorage + cookie)
 */
function clearStoredData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        // Le localStorage peut être indisponible : on ignore l'erreur
    }
    document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    console.log('Données supprimées du stockage du navigateur');
}

/**
 * Affiche une notification
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'success') {
    // Créer un élément de notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Ajouter des styles
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        background-color: ${type === 'error' ? '#e74c3c' : type === 'info' ? '#3498db' : '#27ae60'};
        color: white;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Supprimer après 3 secondes
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Copie du texte dans le presse-papiers
 * @param {string} text - Texte à copier
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copié dans le presse-papiers !');
    } catch (error) {
        console.error('Erreur lors de la copie :', error);
        showNotification('Impossible de copier dans le presse-papiers', 'error');
    }
}

// ============================================
// Navigation
// ============================================

/**
 * Change de section active
 * @param {string} sectionId - ID de la section à activer
 */
function switchSection(sectionId) {
    // Désactiver toutes les sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Désactiver tous les boutons de navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activer la section demandée
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');

        // Activer le bouton correspondant
        const activeBtn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
}

// ============================================
// Gestion des parties multiples
// ============================================

/**
 * Remplit le menu déroulant des parties et sélectionne la partie courante
 */
function renderGameSelect() {
    const select = document.getElementById('game-select');
    select.innerHTML = '';

    appData.games.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        // Afficher aussi le nom du personnage, si on le connaît
        const hero = game.character && game.character.description.name;
        option.textContent = hero ? `${game.name} — ${hero}` : game.name;
        select.appendChild(option);
    });

    select.value = appData.currentGameId;
}

/**
 * Ouvre une autre partie : met à jour les données et toute l'interface
 * @param {string} gameId - Identifiant de la partie à ouvrir
 */
function switchGame(gameId) {
    const game = appData.games.find(g => g.id === gameId);
    if (!game) {
        return;
    }
    appData.currentGameId = gameId;
    persist();
    refreshAllUI();
    showNotification(`Partie "${game.name}" ouverte`, 'info');
}

/**
 * Crée une nouvelle partie (vierge) et bascule dessus
 * @param {string} [forcedName] - Nom imposé (utilisé par les tests),
 *        sinon une fenêtre demande le nom au joueur
 */
function createGame(forcedName) {
    let gameName = forcedName;
    if (!gameName) {
        gameName = prompt(`Nom de la nouvelle partie :`, `Partie ${appData.games.length + 1}`);
    }
    if (gameName === null) {
        // Le joueur a annulé
        return;
    }
    gameName = (gameName || '').trim() || `Partie ${appData.games.length + 1}`;

    const newGame = createEmptyGame(gameName);
    appData.games.push(newGame);
    appData.currentGameId = newGame.id;
    persist();
    refreshAllUI();
    showNotification(`Partie "${gameName}" créée`);
}

/**
 * Renomme la partie courante
 */
function renameGame() {
    const game = getGame();
    const newName = prompt(`Nouveau nom de la partie :`, game.name);
    if (newName === null) {
        return;
    }
    game.name = (newName || '').trim() || game.name;
    persist();
    refreshAllUI();
    showNotification('Partie renommée');
}

/**
 * Supprime la partie courante (avec confirmation).
 * On garde toujours au moins une partie.
 */
function deleteGame() {
    if (appData.games.length <= 1) {
        showNotification('Vous devez garder au moins une partie', 'error');
        return;
    }

    const game = getGame();
    if (!confirm(`Supprimer définitivement la partie "${game.name}" ?\n\nPensez à exporter le JSON avant, si vous voulez la garder.`)) {
        return;
    }

    appData.games = appData.games.filter(g => g.id !== game.id);
    appData.currentGameId = appData.games[0].id;
    persist();
    refreshAllUI();
    showNotification('Partie supprimée');
}

// ============================================
// Partage entre parties (onglet "Parties")
// ============================================

/**
 * Remplit le sélecteur de partie source avec toutes les parties SAUF
 * la partie courante (on ne peut s'importer soi-même).
 * Puis affiche les éléments importables pour la première partie founde.
 */
function renderCrossControls() {
    const select = document.getElementById('cross-game-select');
    const optionsBox = document.getElementById('cross-options');
    const importBtn = document.getElementById('cross-import-btn');
    select.innerHTML = '';

    const others = appData.games.filter(g => g.id !== appData.currentGameId);

    // Cas simple : il n'y a qu'une partie, rien à importer
    if (others.length === 0) {
        select.innerHTML = '<option value="">Aucune autre partie</option>';
        optionsBox.style.display = 'none';
        importBtn.disabled = true;
        return;
    }

    optionsBox.style.display = '';
    importBtn.disabled = false;

    others.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        const hero = game.character && game.character.description.name;
        option.textContent = hero ? `${game.name} — ${hero}` : game.name;
        select.appendChild(option);
    });

    // Afficher le contenu de la première partie de la liste
    renderCrossLists(others[0].id);
}

/**
 * Affiche les listes d'Oracle de la partie source, sous forme de cases
 * à cocher, pour choisir quoi importer.
 * @param {string} sourceId - Identifiant de la partie source
 */
function renderCrossLists(sourceId) {
    const box = document.getElementById('cross-lists-box');
    box.innerHTML = '';

    const source = appData.games.find(g => g.id === sourceId);
    if (!source || source.oracle.lists.length === 0) {
        box.innerHTML = '<p>Aucune liste de mots dans cette partie.</p>';
        return;
    }

    source.oracle.lists.forEach(list => {
        const label = document.createElement('label');
        label.className = 'cross-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cross-list-chk';
        checkbox.dataset.listId = list.id;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${list.name} (${list.items.length} mots)`));
        box.appendChild(label);
    });
}

/**
 * Importe dans la partie courante ce qui est coché dans l'onglet
 * "Parties" : le personnage complet de la partie source et/ou les
 * listes d'Oracle cochées. La partie source n'est jamais modifiée.
 */
function importCrossData() {
    const sourceId = document.getElementById('cross-game-select').value;
    const source = appData.games.find(g => g.id === sourceId);

    if (!source) {
        showNotification('Veuillez choisir une partie source', 'error');
        return;
    }

    // Ce que le joueur a coché
    const wantCharacter = document.getElementById('cross-character-chk').checked;
    const listIds = [];
    document.querySelectorAll('.cross-list-chk:checked').forEach(cb => {
        listIds.push(cb.dataset.listId);
    });

    if (!wantCharacter && listIds.length === 0) {
        showNotification('Cochez au moins un élément à importer', 'error');
        return;
    }

    if (!confirm('Importer la sélection dans la partie courante ?')) {
        return;
    }

    const game = getGame();

    // 1) Personnage : on copie une copie profonde (indépendante de la source)
    if (wantCharacter) {
        game.character = normalizeCharacter(JSON.parse(JSON.stringify(source.character)));
    }

    // 2) Listes d'Oracle : nouvelles identifiants, contenus copiés ;
    //    si un nom existe déjà, on ajoute " (importé)" pour distinguer.
    let importedLists = 0;
    const existingNames = new Set(game.oracle.lists.map(list => list.name));
    source.oracle.lists.forEach(list => {
        if (listIds.includes(list.id)) {
            let name = list.name;
            if (existingNames.has(name)) {
                name = `${name} (importé)`;
            }
            game.oracle.lists.push({
                id: generateId(),
                name: name,
                items: list.items.slice()
            });
            existingNames.add(name);
            importedLists++;
        }
    });

    persist();

    // Rafraîchir l'interface : personnage, listes et panneaux de partage
    updateCharacterUI();
    renderWordLists();
    renderListSelect();
    renderCrossControls();

    showNotification(`Import terminé : ${importedLists} liste(s)${wantCharacter ? ' + personnage' : ''}`);
}

// ============================================
// Oracle
// ============================================

/**
 * Ajoute une nouvelle liste de mots
 */
function addWordList() {
    const listName = document.getElementById('new-list-name').value.trim();
    const listItems = document.getElementById('new-list-items').value.trim();

    if (!listName) {
        showNotification('Veuillez entrer un nom pour la liste', 'error');
        return;
    }

    if (!listItems) {
        showNotification('Veuillez entrer des mots pour la liste', 'error');
        return;
    }

    // Créer la liste
    const items = listItems.split('\n').map(item => item.trim()).filter(item => item);

    const newList = {
        id: generateId(),
        name: listName,
        items: items
    };

    // Ajouter à la partie courante
    getGame().oracle.lists.push(newList);
    persist();

    // Réinitialiser le formulaire
    document.getElementById('new-list-name').value = '';
    document.getElementById('new-list-items').value = '';

    // Mettre à jour l'interface
    renderWordLists();
    renderListSelect();

    showNotification(`Liste "${listName}" ajoutée avec ${items.length} mots`);
}

/**
 * Réinstalle les listes d'exemple (une seule fois chacune).
 * Les listes déjà présentes (même nom) ne sont pas dupliquées.
 */
function restoreDefaultLists() {
    const game = getGame();
    const existingNames = game.oracle.lists.map(list => list.name);
    let added = 0;

    DEFAULT_ORACLE_LISTS.forEach(defaultList => {
        if (!existingNames.includes(defaultList.name)) {
            game.oracle.lists.push({
                id: generateId(),
                name: defaultList.name,
                items: defaultList.items.slice()
            });
            added++;
        }
    });

    persist();
    renderWordLists();
    renderListSelect();

    if (added > 0) {
        showNotification(`${added} liste(s) d'exemple ajoutée(s)`);
    } else {
        showNotification('Les listes d\'exemple sont déjà installées', 'info');
    }
}

/**
 * Supprime une liste de mots
 * @param {string} listId - ID de la liste à supprimer
 */
function deleteWordList(listId) {
    if (confirm('Voulez-vous vraiment supprimer cette liste ?')) {
        const game = getGame();
        game.oracle.lists = game.oracle.lists.filter(list => list.id !== listId);
        persist();
        renderWordLists();
        renderListSelect();
        showNotification('Liste supprimée');
    }
}

/**
 * Affiche les listes de mots dans l'interface
 */
function renderWordLists() {
    const container = document.getElementById('existing-lists');
    container.innerHTML = '';

    const lists = getGame().oracle.lists;
    if (lists.length === 0) {
        container.innerHTML = '<p>Aucune liste de mots disponible. Ajoutez-en une !</p>';
        return;
    }

    lists.forEach(list => {
        const listElement = document.createElement('div');
        listElement.className = 'list-item';
        listElement.innerHTML = `
            <div>
                <h4>${list.name}</h4>
                <p>${list.items.length} mots</p>
            </div>
            <div class="list-actions">
                <button class="edit-btn" onclick="editWordList('${list.id}')">Modifier</button>
                <button class="delete-btn" onclick="deleteWordList('${list.id}')">Supprimer</button>
            </div>
        `;
        container.appendChild(listElement);
    });
}

/**
 * Modifie une liste de mots
 * @param {string} listId - ID de la liste à modifier
 */
function editWordList(listId) {
    const game = getGame();
    const list = game.oracle.lists.find(l => l.id === listId);
    if (!list) return;

    // Remplir le formulaire avec les données de la liste
    document.getElementById('new-list-name').value = list.name;
    document.getElementById('new-list-items').value = list.items.join('\n');

    // Supprimer l'ancienne liste
    game.oracle.lists = game.oracle.lists.filter(l => l.id !== listId);
    persist();
    renderWordLists();
    renderListSelect();

    showNotification(`Modifiez la liste "${list.name}" et cliquez sur Ajouter`);
}

/**
 * Met à jour le sélécteur de listes
 */
function renderListSelect() {
    const select = document.getElementById('list-select');
    select.innerHTML = '<option value="">Choisir une liste...</option>';

    getGame().oracle.lists.forEach(list => {
        const option = document.createElement('option');
        option.value = list.id;
        option.textContent = `${list.name} (${list.items.length} mots)`;
        select.appendChild(option);
    });
}

/**
 * Effectue un tirage aléatoire
 */
function drawRandom() {
    const game = getGame();
    const listId = document.getElementById('list-select').value;
    const count = parseInt(document.getElementById('draw-count').value) || 1;

    if (!listId) {
        showNotification('Veuillez sélectionner une liste', 'error');
        return;
    }

    const list = game.oracle.lists.find(l => l.id === listId);
    if (!list || list.items.length === 0) {
        showNotification('La liste sélectionnée est vide', 'error');
        return;
    }

    // Effectuer le tirage
    const results = [];
    for (let i = 0; i < Math.min(count, list.items.length); i++) {
        const randomIndex = Math.floor(Math.random() * list.items.length);
        results.push(list.items[randomIndex]);
    }

    // Afficher les résultats
    const resultContainer = document.getElementById('draw-result');
    resultContainer.innerHTML = results.map(item => `<span class="result-item">${item}</span>`).join('');

    // Ajouter à l'historique
    const historyItem = {
        id: generateId(),
        listId: listId,
        listName: list.name,
        results: results,
        date: new Date().toISOString()
    };

    game.oracle.history.unshift(historyItem);

    // Limiter l'historique à 20 entrées
    if (game.oracle.history.length > 20) {
        game.oracle.history.pop();
    }

    persist();

    // Mettre à jour l'historique
    renderHistory();

    showNotification(`${results.length} résultat(s) tiré(s) de "${list.name}"`);
}

/**
 * Affiche l'historique des tirages
 */
function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';

    const history = getGame().oracle.history;
    if (history.length === 0) {
        container.innerHTML = '<li>Aucun tirage effectué</li>';
        return;
    }

    history.forEach(historyItem => {
        const item = document.createElement('li');
        const date = formatDate(historyItem.date);
        const results = historyItem.results.join(', ');

        item.innerHTML = `<strong>${historyItem.listName}</strong> : ${results} <small>(${date})</small>`;
        container.appendChild(item);
    });
}

// ============================================
// Feuille de Personnage
// ============================================

/**
 * Met à jour la description complète du personnage
 */
function updateFullDescription() {
    const { name, adjective, role } = getGame().character.description;
    const fullDescription = [];

    if (name) fullDescription.push(name);
    if (adjective) fullDescription.push(adjective);
    if (role) fullDescription.push(role);

    const descriptionElement = document.getElementById('full-description');

    if (fullDescription.length > 0) {
        descriptionElement.textContent = fullDescription.join(' ');
    } else {
        descriptionElement.textContent = 'Personnage non défini';
    }
}

/**
 * Met à jour l'affichage des caractéristiques
 */
function updateStatsDisplay() {
    const stats = getGame().character.stats;

    // Mettre à jour les valeurs
    document.getElementById('corps-value').textContent = stats.corps;
    document.getElementById('ame-value').textContent = stats.ame;
    document.getElementById('esprit-value').textContent = stats.esprit;

    // Mettre à jour les points
    updateStatDots('corps', stats.corps);
    updateStatDots('ame', stats.ame);
    updateStatDots('esprit', stats.esprit);

    // Mettre à jour le total
    const total = stats.corps + stats.ame + stats.esprit;
    document.getElementById('total-stats').textContent = total;

    // Activer/désactiver les boutons en fonction des limites
    updateStatButtons();
}

/**
 * Met à jour l'affichage des points pour une caractéristique
 * @param {string} stat - Nom de la caractéristique
 * @param {number} value - Valeur de la caractéristique
 */
function updateStatDots(stat, value) {
    const dotsContainer = document.getElementById(`${stat}-dots`);
    dotsContainer.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        if (i >= value) {
            dot.classList.add('empty');
        }
        dot.textContent = '•';
        dotsContainer.appendChild(dot);
    }
}

/**
 * Active ou désactive les boutons des caractéristiques en fonction des limites
 */
function updateStatButtons() {
    const stats = getGame().character.stats;
    const total = stats.corps + stats.ame + stats.esprit;

    // Désactiver le bouton + si le total atteint 12
    document.querySelectorAll('.stat-btn.plus').forEach(btn => {
        btn.disabled = total >= 12;
    });

    // Désactiver le bouton - si la valeur est à 2
    document.querySelectorAll('.stat-btn.minus').forEach(btn => {
        const stat = btn.dataset.stat;
        btn.disabled = stats[stat] <= 2;
    });
}

/**
 * Modifie la valeur d'une caractéristique
 * @param {string} stat - Nom de la caractéristique
 * @param {number} change - Changement (+1 ou -1)
 */
function changeStat(stat, change) {
    const stats = getGame().character.stats;
    const currentValue = stats[stat];
    const newValue = currentValue + change;

    // Vérifier les limites (entre 2 et 4 par caractéristique)
    if (newValue < 2 || newValue > 4) {
        return;
    }

    // Vérifier que le total ne dépasse pas 12
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (change > 0 && total + change > 12) {
        showNotification('Le total des caractéristiques ne peut pas dépasser 12', 'error');
        return;
    }

    // Mettre à jour la valeur et sauvegarder
    stats[stat] = newValue;
    persist();

    // Mettre à jour l'affichage
    updateStatsDisplay();
}

/**
 * Met à jour l'affichage des thèmes de dons
 */
function updateThemesDisplay() {
    // Mettre à jour chaque thème
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        const theme = getGame().character.themes[themeId];

        // Mettre à jour le nom du thème
        const nameInput = document.querySelector(`.theme-name[data-theme="${themeId}"]`);
        if (nameInput) {
            nameInput.value = theme.name || '';
        }

        // Mettre à jour la valeur du thème (basée sur le nombre de dons)
        const themeValue = Math.min(4, Math.max(2, theme.gifts.length));
        const valueElement = document.querySelector(`.theme-value[data-theme="${themeId}"]`);
        if (valueElement) {
            valueElement.textContent = themeValue;
        }

        // Mettre à jour les points du thème
        updateThemeDots(themeId, themeValue);

        // Mettre à jour la liste des dons
        updateGiftsList(themeId);
    });
}

/**
 * Met à jour l'affichage des points pour un thème
 * @param {string} themeId - ID du thème
 * @param {number} value - Valeur du thème
 */
function updateThemeDots(themeId, value) {
    const dotsContainer = document.querySelector(`.theme-dots[data-theme="${themeId}"]`);
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    dotsContainer.setAttribute('data-value', value);

    for (let i = 0; i < 4; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        if (i >= value) {
            dot.classList.add('empty');
        }
        dot.textContent = '•';
        dotsContainer.appendChild(dot);
    }
}

/**
 * Met à jour la liste des dons pour un thème.
 * NB : on ne rappelle PAS updateThemesDisplay() ici, sinon les deux
 * fonctions s'appellent l'une l'autre sans fin (plantage « Maximum
 * call stack size exceeded ») et AUCUN bouton de la page ne fonctionne.
 * Les fonctions qui modifient les dons (addGift, deleteGift) mettent
 * déjà à jour les thèmes elles-mêmes après avoir appelé celle-ci.
 * @param {string} themeId - ID du thème
 */
function updateGiftsList(themeId) {
    const giftsList = document.querySelector(`.gifts-list[data-theme="${themeId}"]`);
    if (!giftsList) return;

    const theme = getGame().character.themes[themeId];
    giftsList.innerHTML = '';

    theme.gifts.forEach((gift, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${gift}</span>
            <button class="delete-gift" onclick="deleteGift('${themeId}', ${index})">×</button>
        `;
        giftsList.appendChild(li);
    });
}

/**
 * Ajoute un don à un thème
 * @param {string} themeId - ID du thème
 */
function addGift(themeId) {
    const input = document.querySelector(`.new-gift-input[data-theme="${themeId}"]`);
    const giftName = input.value.trim();

    if (!giftName) {
        showNotification('Veuillez entrer un nom pour le don', 'error');
        return;
    }

    // Vérifier que le don n'existe pas déjà
    const theme = getGame().character.themes[themeId];
    if (theme.gifts.includes(giftName)) {
        showNotification('Ce don existe déjà dans ce thème', 'error');
        return;
    }

    // Un thème ne peut pas avoir plus de 4 dons
    if (theme.gifts.length >= 4) {
        showNotification('Un thème ne peut pas avoir plus de 4 dons', 'error');
        return;
    }

    // Ajouter le don et sauvegarder
    theme.gifts.push(giftName);
    persist();

    // Réinitialiser l'input
    input.value = '';

    // Mettre à jour l'affichage
    updateGiftsList(themeId);
    updateThemesDisplay();

    showNotification(`Don "${giftName}" ajouté au thème`);
}

/**
 * Supprime un don d'un thème
 * @param {string} themeId - ID du thème
 * @param {number} giftIndex - Index du don à supprimer
 */
function deleteGift(themeId, giftIndex) {
    const theme = getGame().character.themes[themeId];
    const giftName = theme.gifts[giftIndex];

    if (confirm(`Voulez-vous vraiment supprimer le don "${giftName}" ?`)) {
        theme.gifts.splice(giftIndex, 1);
        persist();
        updateGiftsList(themeId);
        updateThemesDisplay();
        showNotification(`Don "${giftName}" supprimé`);
    }
}

/**
 * Enregistre le nom d'un thème pendant la frappe
 * @param {string} themeId - ID du thème
 */
function updateThemeName(themeId) {
    const input = document.querySelector(`.theme-name[data-theme="${themeId}"]`);
    const newName = input.value.trim();

    getGame().character.themes[themeId].name = newName;
    persist();
}

/**
 * Réinitialise la feuille de personnage de la partie courante
 */
function resetCharacter() {
    if (confirm('Voulez-vous vraiment réinitialiser le personnage ? Toutes les données non sauvegardées seront perdues.')) {
        getGame().character = createEmptyCharacter();
        persist();

        // Mettre à jour l'interface
        updateCharacterUI();
        showNotification('Nouveau personnage créé');
    }
}

/**
 * Met à jour toute l'interface du personnage
 */
function updateCharacterUI() {
    const character = getGame().character;

    // Mettre à jour la description
    document.getElementById('character-name').value = character.description.name || '';
    document.getElementById('character-adjective').value = character.description.adjective || '';
    document.getElementById('character-role').value = character.description.role || '';
    updateFullDescription();

    // Mettre à jour les caractéristiques
    updateStatsDisplay();

    // Mettre à jour les thèmes
    updateThemesDisplay();
}

// ============================================
// Journal d'Aventure
// ============================================

/**
 * Ajoute une nouvelle entrée dans le journal
 */
function addJournalEntry() {
    const game = getGame();
    const title = document.getElementById('entry-title').value.trim();
    const content = document.getElementById('entry-content').value.trim();

    if (!title) {
        showNotification('Veuillez entrer un titre pour l\'entrée', 'error');
        return;
    }

    const newEntry = {
        id: generateId(),
        title: title,
        content: content,
        date: new Date().toISOString()
    };

    game.journal.unshift(newEntry);
    persist();

    // Réinitialiser le formulaire
    document.getElementById('entry-title').value = '';
    document.getElementById('entry-content').value = '';

    // Mettre à jour l'affichage
    renderJournalEntries();

    showNotification('Entrée ajoutée au journal');
}

/**
 * Affiche les entrées du journal
 */
function renderJournalEntries() {
    const container = document.getElementById('entries-list');
    container.innerHTML = '';

    const journal = getGame().journal;
    if (journal.length === 0) {
        container.innerHTML = '<p>Aucune entrée dans le journal. Ajoutez-en une !</p>';
        return;
    }

    journal.forEach(entry => {
        const entryElement = document.createElement('div');
        entryElement.className = 'entry-card';
        entryElement.innerHTML = `
            <h4>${entry.title}</h4>
            <p>${entry.content}</p>
            <span class="entry-date">${formatDate(entry.date)}</span>
            <button class="delete-entry" onclick="deleteJournalEntry('${entry.id}')">Supprimer</button>
        `;
        container.appendChild(entryElement);
    });
}

/**
 * Supprime une entrée du journal
 * @param {string} entryId - ID de l'entrée à supprimer
 */
function deleteJournalEntry(entryId) {
    if (confirm('Voulez-vous vraiment supprimer cette entrée du journal ?')) {
        const game = getGame();
        game.journal = game.journal.filter(entry => entry.id !== entryId);
        persist();
        renderJournalEntries();
        showNotification('Entrée supprimée du journal');
    }
}

// ============================================
// Export/Import JSON
// ============================================

/**
 * Exporte TOUTES les parties au format JSON
 */
function exportToJSON() {
    try {
        const json = JSON.stringify(appData, null, 2);
        document.getElementById('export-json').value = json;
        showNotification('Données exportées au format JSON');
    } catch (error) {
        console.error('Erreur lors de l\'export :', error);
        showNotification('Erreur lors de l\'export', 'error');
    }
}

/**
 * Importe des données depuis du JSON
 * (accepte le format actuel multi-parties ou l'ancien format mono-partie)
 */
function importFromJSON() {
    try {
        const json = document.getElementById('export-json').value.trim();
        if (!json) {
            showNotification('Veuillez entrer du JSON valide', 'error');
            return;
        }

        const normalized = normalizeData(JSON.parse(json));

        // Valider les données importées
        if (!normalized) {
            showNotification('Les données importées ne sont pas valides', 'error');
            return;
        }

        if (confirm('Voulez-vous vraiment importer ces données ? Les données actuelles seront écrasées.')) {
            appData = normalized;
            persist();

            // Mettre à jour toute l'interface
            refreshAllUI();

            showNotification('Données importées avec succès !');
        }
    } catch (error) {
        console.error('Erreur lors de l\'import :', error);
        showNotification('Erreur lors de l\'import : JSON invalide', 'error');
    }
}

/**
 * Copie le JSON dans le presse-papiers
 */
function copyJSON() {
    const json = document.getElementById('export-json').value;
    if (!json) {
        showNotification('Aucun JSON à copier', 'error');
        return;
    }

    copyToClipboard(json);
}

// ============================================
// Mode hors-ligne (service worker)
// ============================================

/**
 * Enregistre le "service worker" (fichier sw.js).
 * Celui-ci met le site en cache : lors des visites suivantes, la page
 * s'affiche même si le serveur local (Termux) n'est pas démarré.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(error => {
            // Échec silencieux : le site fonctionne quand même en ligne
            console.warn('Service worker non enregistré :', error);
        });
    }
}

// ============================================
// Initialisation
// ============================================

/**
 * Rafraîchit tous les affichages après un changement de partie,
 * une création, une suppression ou un import
 */
function refreshAllUI() {
    renderGameSelect();
    updateCharacterUI();
    renderWordLists();
    renderListSelect();
    renderJournalEntries();
    renderHistory();
    renderCrossControls();
}

/**
 * Initialise l'application
 */
function init() {
    // Charger les données depuis le localStorage (ou le cookie en secours)
    const hasData = loadFromStorage();

    // Si aucune donnée, créer une première partie toute neuve
    if (!hasData) {
        appData = {
            version: 2,
            currentGameId: null,
            games: []
        };
        const firstGame = createEmptyGame('Ma première partie');
        appData.games.push(firstGame);
        appData.currentGameId = firstGame.id;
        persist();
    }

    // Initialiser l'interface
    refreshAllUI();

    // Enregistrer le service worker pour le mode hors-ligne
    registerServiceWorker();

    // Configurer les écouteurs d'événements
    setupEventListeners();

    // Sécurité : sauvegarder aussi quand on quitte la page
    window.addEventListener('beforeunload', persist);

    console.log('Application initialisée');
}

/**
 * Configure les écouteurs d'événements
 */
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchSection(btn.dataset.section);
        });
    });

    // Gestion des parties
    document.getElementById('game-select').addEventListener('change', (e) => {
        switchGame(e.target.value);
    });
    document.getElementById('new-game-btn').addEventListener('click', () => createGame());
    document.getElementById('rename-game-btn').addEventListener('click', renameGame);
    document.getElementById('delete-game-btn').addEventListener('click', deleteGame);

    // Partage entre parties
    document.getElementById('cross-game-select').addEventListener('change', (e) => {
        renderCrossLists(e.target.value);
    });
    document.getElementById('cross-import-btn').addEventListener('click', importCrossData);

    // Oracle
    document.getElementById('add-list-btn').addEventListener('click', addWordList);
    document.getElementById('restore-lists-btn').addEventListener('click', restoreDefaultLists);
    document.getElementById('draw-btn').addEventListener('click', drawRandom);

    // Caractéristiques
    document.querySelectorAll('.stat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stat = btn.dataset.stat;
            const change = btn.classList.contains('plus') ? 1 : -1;
            changeStat(stat, change);
        });
    });

    // Description du personnage
    document.getElementById('character-name').addEventListener('input', (e) => {
        getGame().character.description.name = e.target.value.trim();
        updateFullDescription();
        persist();
    });

    document.getElementById('character-adjective').addEventListener('input', (e) => {
        getGame().character.description.adjective = e.target.value.trim();
        updateFullDescription();
        persist();
    });

    document.getElementById('character-role').addEventListener('input', (e) => {
        getGame().character.description.role = e.target.value.trim();
        updateFullDescription();
        persist();
    });

    // Thèmes de dons
    document.querySelectorAll('.theme-name').forEach(input => {
        input.addEventListener('input', (e) => {
            const themeId = e.target.dataset.theme;
            getGame().character.themes[themeId].name = e.target.value.trim();
            persist();
        });
    });

    document.querySelectorAll('.add-gift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const themeId = btn.dataset.theme;
            addGift(themeId);
        });
    });

    document.querySelectorAll('.new-gift-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const themeId = e.target.dataset.theme;
                addGift(themeId);
            }
        });
    });

    // Sauvegarde
    document.getElementById('save-character-btn').addEventListener('click', saveGame);
    document.getElementById('load-character-btn').addEventListener('click', () => {
        const hasData = loadFromStorage();
        if (hasData) {
            refreshAllUI();
            showNotification('Données chargées depuis le stockage du navigateur');
        } else {
            showNotification('Aucune donnée trouvée', 'info');
        }
    });
    document.getElementById('new-character-btn').addEventListener('click', resetCharacter);

    // Export/Import
    document.getElementById('export-btn').addEventListener('click', exportToJSON);
    document.getElementById('import-btn').addEventListener('click', importFromJSON);
    document.getElementById('copy-btn').addEventListener('click', copyJSON);

    // Journal
    document.getElementById('add-entry-btn').addEventListener('click', addJournalEntry);
}

// ============================================
// Démarrage de l'application
// ============================================

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', init);
