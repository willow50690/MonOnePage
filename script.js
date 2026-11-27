/**
 * Mon One Page - Jeu de Rôle Solo
 * Script JavaScript principal
 *
 * Ce script gère toute la logique de l'application :
 * - Parties multiples (plusieurs personnages, oracles et journaux)
 * - Feuille de personnage : 6 caractéristiques (1-6, total max 18),
 *   thèmes de dons (avec pop-up de création/édition et bibliothèque),
 *   équipement (nom, description, bonus) et lanceur de dés
 * - Oracle (gestion des listes et tirages aléatoires)
 * - Journal d'aventure
 * - Sauvegarde fiable (localStorage + cookie) et export/import JSON
 * - Mode hors-ligne (enregistrement d'un "service worker")
 */

// ============================================
// Constantes
// ============================================

/**
 * Clés utilisées pour enregistrer les données :
 * - dans le "localStorage" du navigateur (stockage principal, très fiable),
 * - dans un cookie (secours, pour rester compatible avec les anciennes données).
 */
const STORAGE_KEY = 'monOnePageData';
const COOKIE_KEY = 'monOnePageData';

/**
 * Les 6 caractéristiques : clé interne -> nom affiché.
 * Chacune va de 1 à 6, vaut 2 par défaut, et le total ne dépasse pas 18.
 */
const STAT_KEYS = ['corps', 'ame', 'esprit', 'precision', 'puissance', 'potentiel'];
const STAT_LABELS = {
    corps: 'Corps',
    ame: 'Âme',
    esprit: 'Esprit',
    precision: 'Précision',
    puissance: 'Puissance',
    potentiel: 'Potentiel'
};
const STAT_MIN = 1;      // valeur minimale d'une caractéristique
const STAT_MAX = 6;      // valeur maximale d'une caractéristique
const TOTAL_MAX = 18;    // total maximum des 6 caractéristiques

/**
 * Valeur d'un thème selon le nombre de dons qu'il possède :
 * 1 à 2 dons -> 1 ; 3 à 5 -> 2 ; 6 à 9 -> 4 ; 10 et plus -> 5 (maximum).
 */
const THEME_MAX = 5;
function themeValueFromGifts(giftCount) {
    if (giftCount >= 10) return 5;
    if (giftCount >= 6) return 4;
    if (giftCount >= 3) return 2;
    if (giftCount >= 1) return 1;
    return 0;
}

/**
 * Bibliothèque de dons prédéfinis, proposée dans la pop-up de création.
 * Le joueur peut aussi créer ses propres dons (nom + description libre).
 */
const GIFT_LIBRARY = [
    { name: 'Pas de loup', description: 'Vous vous déplacez sans bruit, même sur terrain difficile.' },
    { name: 'Œil de lynx', description: 'Vous repérez les détails que d\'autres manquent, de jour comme de nuit.' },
    { name: 'Mains rapides', description: 'Vous dégainez, crochetez ou attrapez avant que quiconque ne réagisse.' },
    { name: 'Verbe engageant', description: 'Vos paroles apaisent les colères et convainquent les hésitants.' },
    { name: 'Vigueur étonnante', description: 'Vous encaissez fatigue, poison et longues marches sans faiblir.' },
    { name: 'Sens du danger', description: 'Un frisson vous prévient juste avant que le piège ne se referme.' },
    { name: 'Nez des souterrains', description: 'Vous retrouvez votre chemin et sentez l\'air vicié des profondeurs.' },
    { name: 'Doigts de fée', description: 'Mécanismes, nœuds et serrures cèdent sous vos mains habiles.' },
    { name: 'Mémoire parfaite', description: 'Vous vous souvenez de chaque visage, carte et conversation.' },
    { name: 'Peau de pierre', description: 'Votre chair durcit sous les coups et les chutes.' },
    { name: 'Cœur vaillant', description: 'Face à la peur, votre courage redresse ceux qui doutent.' },
    { name: 'Souffle long', description: 'Vous nagez, courez ou vous cachez longtemps sans respirer.' }
];

/**
 * Listes de mots d'exemple pour l'Oracle, ajoutées en un clic.
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
 * Données de l'application. Une "partie" contient son oracle, son
 * personnage, son équipement et son journal. On peut en créer autant
 * que l'on veut et basculer entre elles.
 *
 * Format v2 :
 * {
 *   version: 2,
 *   currentGameId: 'abc123',
 *   games: [
 *     {
 *       id: 'abc123',
 *       name: 'Ma partie',
 *       oracle: { lists: [...], history: [...] },
 *       character: { description: {...}, stats: {...6 clés...}, themes: {...} },
 *       equipment: [ {id, name, description, bonus}, ... ],
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

/**
 * État de la fenêtre modale (pop-up) des dons et de l'équipement :
 * quel mode est ouvert ('gift-new', 'gift-edit', 'equip-new', 'equip-edit')
 * et sur quel thème / quel objet on travaille.
 */
const modalState = { mode: null, themeId: null, giftIndex: null, equipmentId: null };

/** État de la petite fenêtre d'information d'un objet d'équipement. */
const infoState = { equipmentId: null };

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
 * Crée un objet "personnage" vide (valeurs par défaut).
 * Les dons sont des objets { name, description } (plus de simples textes).
 */
function createEmptyCharacter() {
    const stats = {};
    STAT_KEYS.forEach(key => { stats[key] = 2; });
    return {
        description: { name: '', adjective: '', role: '' },
        stats: stats,
        themes: {
            theme1: { name: '', gifts: [] },
            theme2: { name: '', gifts: [] },
            theme3: { name: '', gifts: [] }
        }
    };
}

/**
 * Crée une nouvelle partie vierge (oracle vide, personnage neuf,
 * équipement vide, journal vide)
 * @param {string} name - Nom de la partie affiché dans le menu
 * @returns {Object} La nouvelle partie
 */
function createEmptyGame(name) {
    return {
        id: generateId(),
        name: name,
        oracle: { lists: [], history: [] },
        character: createEmptyCharacter(),
        equipment: [],
        journal: []
    };
}

/**
 * Complète un personnage partiel (venu d'une sauvegarde incomplète ou
 * d'une ancienne version) pour qu'il possède toujours toutes ses
 * propriétés : 6 caractéristiques (1-6), 3 thèmes, dons en objets.
 * @param {Object} raw - Personnage brut éventuellement incomplet
 * @returns {Object} Personnage complet et sûr à utiliser
 */
function normalizeCharacter(raw) {
    const character = Object.assign(createEmptyCharacter(), raw || {});
    character.description = Object.assign({ name: '', adjective: '', role: '' }, character.description || {});

    // Caractéristiques : les 6 existent, en nombres bornés entre 1 et 6
    character.stats = Object.assign(createEmptyCharacter().stats, character.stats || {});
    STAT_KEYS.forEach(key => {
        let value = character.stats[key];
        if (typeof value !== 'number' || isNaN(value)) {
            value = 2;
        }
        character.stats[key] = Math.min(STAT_MAX, Math.max(STAT_MIN, Math.round(value)));
    });

    // Les trois thèmes doivent TOUJOURS exister (sinon plantage à l'affichage)
    const themes = Object.assign({
        theme1: { name: '', gifts: [] },
        theme2: { name: '', gifts: [] },
        theme3: { name: '', gifts: [] }
    }, character.themes || {});
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        // Les dons étaient autrefois de simples textes : les convertir
        // en objets { name, description }
        let gifts = themes[themeId] && themes[themeId].gifts;
        if (typeof gifts === 'string') {
            // Un seul don stocké comme texte : en faire une liste
            gifts = [gifts];
        } else if (!Array.isArray(gifts)) {
            gifts = [];
        }
        themes[themeId] = {
            name: (themes[themeId] && themes[themeId].name) || '',
            gifts: gifts
                .map(gift => typeof gift === 'string'
                    ? { name: gift, description: '' }
                    : { name: (gift && gift.name) || '', description: (gift && gift.description) || '' })
                .filter(gift => gift.name)
        };
    });
    character.themes = themes;

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
                equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
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
        // Équipement : liste d'objets {id, name, description, bonus}
        equipment: (Array.isArray(g.equipment) ? g.equipment : [])
            .map(eq => ({
                id: (eq && eq.id) || generateId(),
                name: (eq && eq.name) || '',
                description: (eq && eq.description) || '',
                bonus: (eq && typeof eq.bonus === 'number' && !isNaN(eq.bonus)) ? eq.bonus : 0
            }))
            .filter(eq => eq.name),
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
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

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
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');

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
 * Puis affiche les éléments importables pour la première partie trouvée.
 */
function renderCrossControls() {
    const select = document.getElementById('cross-game-select');
    const optionsBox = document.getElementById('cross-options');
    const importBtn = document.getElementById('cross-import-btn');
    select.innerHTML = '';

    const others = appData.games.filter(g => g.id !== appData.currentGameId);

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

    // 1) Personnage : copie profonde (indépendante de la source)
    if (wantCharacter) {
        game.character = normalizeCharacter(JSON.parse(JSON.stringify(source.character)));
    }

    // 2) Listes d'Oracle : nouveaux identifiants, contenus copiés ;
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

    const items = listItems.split('\n').map(item => item.trim()).filter(item => item);

    const newList = {
        id: generateId(),
        name: listName,
        items: items
    };

    getGame().oracle.lists.push(newList);
    persist();

    document.getElementById('new-list-name').value = '';
    document.getElementById('new-list-items').value = '';

    renderWordLists();
    renderListSelect();

    showNotification(`Liste "${listName}" ajoutée avec ${items.length} mots`);
}

/**
 * Réinstalle les listes d'exemple (une seule fois chacune).
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
                <button class="edit-btn" data-action="edit-word-list" data-list-id="${list.id}">Modifier</button>
                <button class="delete-btn" data-action="delete-word-list" data-list-id="${list.id}">Supprimer</button>
            </div>
        `;
        container.appendChild(listElement);
    });
}

/**
 * Modifie une liste de mots (remplit le formulaire et supprime l'ancienne)
 * @param {string} listId - ID de la liste à modifier
 */
function editWordList(listId) {
    const game = getGame();
    const list = game.oracle.lists.find(l => l.id === listId);
    if (!list) return;

    document.getElementById('new-list-name').value = list.name;
    document.getElementById('new-list-items').value = list.items.join('\n');

    game.oracle.lists = game.oracle.lists.filter(l => l.id !== listId);
    persist();
    renderWordLists();
    renderListSelect();

    showNotification(`Modifiez la liste "${list.name}" et cliquez sur Ajouter`);
}

/**
 * Met à jour le sélecteur de listes
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

    const results = [];
    for (let i = 0; i < Math.min(count, list.items.length); i++) {
        const randomIndex = Math.floor(Math.random() * list.items.length);
        results.push(list.items[randomIndex]);
    }

    const resultContainer = document.getElementById('draw-result');
    resultContainer.innerHTML = results.map(item => `<span class="result-item">${item}</span>`).join('');

    const historyItem = {
        id: generateId(),
        listId: listId,
        listName: list.name,
        results: results,
        date: new Date().toISOString()
    };

    game.oracle.history.unshift(historyItem);

    if (game.oracle.history.length > 20) {
        game.oracle.history.pop();
    }

    persist();
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
// Feuille de Personnage : description
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

// ============================================
// Feuille de Personnage : caractéristiques (1-6, total max 18)
// ============================================

/**
 * Met à jour l'affichage des 6 caractéristiques
 */
function updateStatsDisplay() {
    const stats = getGame().character.stats;

    // Valeurs et points de chaque caractéristique
    STAT_KEYS.forEach(key => {
        document.getElementById(`${key}-value`).textContent = stats[key];
        updateStatDots(key, stats[key]);
    });

    // Total
    const total = STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
    document.getElementById('total-stats').textContent = total;

    updateStatButtons();

    // Les listes du lanceur de dés affichent les valeurs des
    // caractéristiques : il faut les reconstruire après un changement
    renderDiceOptions();
}

/**
 * Met à jour l'affichage des points pour une caractéristique
 * (6 points au lieu de 4 depuis la version à 6 caractéristiques)
 * @param {string} stat - Nom (clé) de la caractéristique
 * @param {number} value - Valeur de la caractéristique
 */
function updateStatDots(stat, value) {
    const dotsContainer = document.getElementById(`${stat}-dots`);
    dotsContainer.innerHTML = '';

    for (let i = 0; i < STAT_MAX; i++) {
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
 * Active ou désactive les boutons + / - selon les limites
 * (chaque caractéristique entre 1 et 6, total au plus 18)
 */
function updateStatButtons() {
    const stats = getGame().character.stats;
    const total = STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);

    document.querySelectorAll('.stat-btn.plus').forEach(btn => {
        btn.disabled = total >= TOTAL_MAX || stats[btn.dataset.stat] >= STAT_MAX;
    });

    document.querySelectorAll('.stat-btn.minus').forEach(btn => {
        btn.disabled = stats[btn.dataset.stat] <= STAT_MIN;
    });
}

/**
 * Modifie la valeur d'une caractéristique
 * @param {string} stat - Nom (clé) de la caractéristique
 * @param {number} change - Changement (+1 ou -1)
 */
function changeStat(stat, change) {
    const stats = getGame().character.stats;
    const newValue = stats[stat] + change;

    // Limites : entre 1 et 6 par caractéristique
    if (newValue < STAT_MIN || newValue > STAT_MAX) {
        return;
    }

    // Le total des 6 caractéristiques ne dépasse pas 18
    const total = STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
    if (change > 0 && total + change > TOTAL_MAX) {
        showNotification(`Le total des caractéristiques ne peut pas dépasser ${TOTAL_MAX}`, 'error');
        return;
    }

    stats[stat] = newValue;
    persist();
    updateStatsDisplay();
}

// ============================================
// Feuille de Personnage : thèmes de dons
// ============================================

/**
 * Met à jour l'affichage des thèmes de dons.
 * La valeur d'un thème dépend du nombre de dons qu'il contient :
 * 1-2 dons -> 1 ; 3-5 -> 2 ; 6-9 -> 4 ; 10 et plus -> 5 (maximum).
 */
function updateThemesDisplay() {
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        const theme = getGame().character.themes[themeId];

        const nameInput = document.querySelector(`.theme-name[data-theme="${themeId}"]`);
        if (nameInput) {
            nameInput.value = theme.name || '';
        }

        const themeValue = themeValueFromGifts(theme.gifts.length);
        const valueElement = document.querySelector(`.theme-value[data-theme="${themeId}"]`);
        if (valueElement) {
            valueElement.textContent = themeValue;
        }

        updateThemeDots(themeId, themeValue);
        updateGiftsList(themeId);
    });

    // La valeur des thèmes sert au lanceur de dés : reconstruire les listes
    renderDiceOptions();
}

/**
 * Met à jour l'affichage des points pour un thème (1 à 5 points)
 * @param {string} themeId - ID du thème
 * @param {number} value - Valeur du thème
 */
function updateThemeDots(themeId, value) {
    const dotsContainer = document.querySelector(`.theme-dots[data-theme="${themeId}"]`);
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    dotsContainer.setAttribute('data-value', value);

    for (let i = 0; i < THEME_MAX; i++) {
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
 * Met à jour la liste des dons d'un thème.
 * Chaque don affiche son nom, un « ? » (ouvre la fenêtre pour voir et
 * modifier le don) et une croix pour le supprimer.
 * NB : on ne rappelle PAS updateThemesDisplay() ici, sinon les deux
 * fonctions s'appellent l'une l'autre sans fin (plantage).
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
            <span class="gift-name">${gift.name}</span>
            <button class="gift-info-btn" data-action="edit-gift" data-theme="${themeId}" data-index="${index}"
                title="Voir et modifier le don">?</button>
            <button class="delete-gift" data-action="delete-gift" data-theme="${themeId}" data-index="${index}"
                title="Supprimer le don">×</button>
        `;
        giftsList.appendChild(li);
    });
}

// ============================================
// Fenêtre modale (pop-up) : dons et équipement
// ============================================

/**
 * Ouvre la pop-up pour créer ou modifier un don.
 * À la création, la bibliothèque de dons prédéfinis est proposée :
 * choisir un don y remplit automatiquement le nom et la description,
 * que l'on peut ensuite adapter librement.
 * @param {string} themeId - Thème concerné ('theme1', 'theme2', 'theme3')
 * @param {number|null} giftIndex - Index du don à modifier, ou null pour créer
 */
function openGiftModal(themeId, giftIndex = null) {
    modalState.mode = giftIndex === null ? 'gift-new' : 'gift-edit';
    modalState.themeId = themeId;
    modalState.giftIndex = giftIndex;
    modalState.equipmentId = null;

    const theme = getGame().character.themes[themeId];
    const themeName = (theme && theme.name) || 'Thème';

    document.getElementById('modal-title').textContent =
        giftIndex === null ? `Nouveau don — ${themeName}` : `Modifier le don — ${themeName}`;

    // Bibliothèque : uniquement à la création
    const library = document.getElementById('modal-library');
    const libraryLabel = document.getElementById('modal-library-label');
    if (giftIndex === null) {
        library.innerHTML = '<option value="">— Don de la bibliothèque (facultatif) —</option>';
        GIFT_LIBRARY.forEach(gift => {
            const option = document.createElement('option');
            option.value = gift.name;
            option.textContent = gift.name;
            library.appendChild(option);
        });
        library.value = '';
        library.style.display = '';
        libraryLabel.style.display = '';
    } else {
        library.style.display = 'none';
        libraryLabel.style.display = 'none';
    }

    // Champ bonus : réservé à l'équipement
    document.getElementById('modal-bonus-label').style.display = 'none';
    document.getElementById('modal-bonus').style.display = 'none';

    // Pré-remplir les champs
    if (giftIndex === null) {
        document.getElementById('modal-name').value = '';
        document.getElementById('modal-description').value = '';
    } else {
        const gift = theme.gifts[giftIndex];
        document.getElementById('modal-name').value = gift.name;
        document.getElementById('modal-description').value = gift.description || '';
    }

    document.getElementById('modal-save-btn').textContent =
        giftIndex === null ? 'Ajouter' : 'Enregistrer';

    openModal();
}

/**
 * Ouvre la pop-up pour créer ou modifier un objet d'équipement
 * @param {string|null} equipmentId - ID de l'objet, ou null pour créer
 */
function openEquipmentModal(equipmentId = null) {
    modalState.mode = equipmentId === null ? 'equip-new' : 'equip-edit';
    modalState.equipmentId = equipmentId;
    modalState.themeId = null;
    modalState.giftIndex = null;

    document.getElementById('modal-title').textContent =
        equipmentId === null ? 'Nouvel équipement' : 'Modifier l\'équipement';

    // Bibliothèque : pas d'équipement prédéfini
    document.getElementById('modal-library').style.display = 'none';
    document.getElementById('modal-library-label').style.display = 'none';

    // Champ bonus : visible pour l'équipement
    document.getElementById('modal-bonus-label').style.display = '';
    document.getElementById('modal-bonus').style.display = '';

    if (equipmentId === null) {
        document.getElementById('modal-name').value = '';
        document.getElementById('modal-description').value = '';
        document.getElementById('modal-bonus').value = '0';
    } else {
        const item = getGame().equipment.find(eq => eq.id === equipmentId);
        document.getElementById('modal-name').value = item ? item.name : '';
        document.getElementById('modal-description').value = item ? (item.description || '') : '';
        document.getElementById('modal-bonus').value = item ? item.bonus : 0;
    }

    document.getElementById('modal-save-btn').textContent =
        equipmentId === null ? 'Ajouter' : 'Enregistrer';

    openModal();
}

/**
 * Le joueur a choisi un don de la bibliothèque : remplir les champs
 * (il peut encore modifier le texte avant d'enregistrer).
 */
function onLibraryChange() {
    const name = document.getElementById('modal-library').value;
    if (!name) return;
    const gift = GIFT_LIBRARY.find(g => g.name === name);
    if (gift) {
        document.getElementById('modal-name').value = gift.name;
        document.getElementById('modal-description').value = gift.description;
    }
}

/**
 * Enregistre le contenu de la pop-up (don ou équipement), selon le mode
 */
function saveModal() {
    const name = document.getElementById('modal-name').value.trim();
    const description = document.getElementById('modal-description').value.trim();

    if (!name) {
        showNotification('Veuillez entrer un nom', 'error');
        return;
    }

    const game = getGame();

    if (modalState.mode === 'gift-new' || modalState.mode === 'gift-edit') {
        const theme = game.character.themes[modalState.themeId];
        if (!theme) return;

        if (modalState.mode === 'gift-new') {
            theme.gifts.push({ name: name, description: description });
        } else {
            const gift = theme.gifts[modalState.giftIndex];
            if (gift) {
                gift.name = name;
                gift.description = description;
            }
        }
        persist();
        updateThemesDisplay();
    } else if (modalState.mode === 'equip-new' || modalState.mode === 'equip-edit') {
        // Le bonus est un nombre (peut être négatif, ex. objet maudit)
        let bonus = parseInt(document.getElementById('modal-bonus').value, 10);
        if (isNaN(bonus)) {
            bonus = 0;
        }

        if (modalState.mode === 'equip-new') {
            game.equipment.push({
                id: generateId(),
                name: name,
                description: description,
                bonus: bonus
            });
        } else {
            const item = game.equipment.find(eq => eq.id === modalState.equipmentId);
            if (item) {
                item.name = name;
                item.description = description;
                item.bonus = bonus;
            }
        }
        persist();
        renderEquipment();
    }

    closeModal();
    showNotification('Enregistré !');
}

/**
 * Affiche la pop-up
 */
function openModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    const nameInput = document.getElementById('modal-name');
    if (nameInput.focus) {
        nameInput.focus();
    }
}

/**
 * Ferme la pop-up
 */
function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    modalState.mode = null;
    modalState.themeId = null;
    modalState.giftIndex = null;
    modalState.equipmentId = null;
}

// ============================================
// Équipement
// ============================================

/**
 * Affiche la liste d'équipement : nom + bonus + « ? » (toutes les infos).
 */
function renderEquipment() {
    const list = document.getElementById('equipment-list');
    list.innerHTML = '';

    const equipment = getGame().equipment;
    if (equipment.length === 0) {
        list.innerHTML = '<li class="equipment-empty">Aucun objet. Cliquez sur « Nouveau » !</li>';
        renderDiceOptions();
        return;
    }

    equipment.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="equip-name">${item.name}</span>
            <span class="equip-bonus">+${item.bonus}</span>
            <button class="equip-info-btn" data-action="equip-info" data-id="${item.id}"
                title="Voir toutes les informations">?</button>
            <button class="equip-delete" data-action="equip-delete" data-id="${item.id}"
                title="Supprimer l'objet">×</button>
        `;
        list.appendChild(li);
    });

    // Un objet ajouté ou supprimé doit apparaître/disparaître
    // dans la liste de choix du lanceur de dés
    renderDiceOptions();
}

/**
 * Affiche la petite fenêtre d'information d'un objet : toutes ses infos
 * (nom, description, bonus) avec des boutons Modifier / Supprimer.
 * @param {string} equipmentId - ID de l'objet à montrer
 */
function showEquipmentInfo(equipmentId) {
    const item = getGame().equipment.find(eq => eq.id === equipmentId);
    if (!item) return;

    infoState.equipmentId = equipmentId;

    document.getElementById('info-title').textContent = item.name;
    let body = item.description ? item.description : '(Aucune description)';
    body += `\n\nBonus : +${item.bonus}`;
    document.getElementById('info-body').textContent = body;

    document.getElementById('info-overlay').classList.remove('hidden');
}

/**
 * Ferme la fenêtre d'information
 */
function closeInfo() {
    document.getElementById('info-overlay').classList.add('hidden');
    infoState.equipmentId = null;
}

/**
 * Supprime un objet d'équipement (avec confirmation)
 * @param {string} equipmentId - ID de l'objet à supprimer
 */
function deleteEquipment(equipmentId) {
    const item = getGame().equipment.find(eq => eq.id === equipmentId);
    if (!item) return;

    if (!confirm(`Supprimer "${item.name}" de l'équipement ?`)) {
        return;
    }

    const game = getGame();
    game.equipment = game.equipment.filter(eq => eq.id !== equipmentId);
    persist();
    closeInfo();
    renderEquipment();
    showNotification('Objet supprimé');
}

// ============================================
// Lanceur de dés
// ============================================

/**
 * Remplit les 4 listes de choix du lanceur de dés :
 *   1) les 3 premières caractéristiques (Corps, Âme, Esprit)
 *   2) les 3 suivantes (Précision, Puissance, Potentiel)
 *   3) les thèmes
 *   4) les objets d'équipement
 */
function renderDiceOptions() {
    const stats = getGame().character.stats;
    const themes = getGame().character.themes;
    const equipment = getGame().equipment;

    // Se souvenir de ce que le joueur avait choisi, pour ne pas
    // lui faire perdre sa sélection quand on reconstruit les listes
    const previous = {
        stat1: document.getElementById('dice-stat1').value,
        stat2: document.getElementById('dice-stat2').value,
        theme: document.getElementById('dice-theme').value,
        equip: document.getElementById('dice-equip').value
    };

    // Liste 1 : Corps / Âme / Esprit
    const select1 = document.getElementById('dice-stat1');
    select1.innerHTML = '';
    ['corps', 'ame', 'esprit'].forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${STAT_LABELS[key]} (${stats[key]})`;
        select1.appendChild(option);
    });
    if (previous.stat1) {
        select1.value = previous.stat1;
    }

    // Liste 2 : Précision / Puissance / Potentiel
    const select2 = document.getElementById('dice-stat2');
    select2.innerHTML = '';
    ['precision', 'puissance', 'potentiel'].forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${STAT_LABELS[key]} (${stats[key]})`;
        select2.appendChild(option);
    });
    if (previous.stat2) {
        select2.value = previous.stat2;
    }

    // Liste 3 : les thèmes (valeur = valeur du thème selon ses dons)
    const selectTheme = document.getElementById('dice-theme');
    selectTheme.innerHTML = '';
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        const theme = themes[themeId];
        const option = document.createElement('option');
        option.value = themeId;
        const themeName = (theme && theme.name) || `Thème ${themeId.slice(-1)}`;
        const themeValue = themeValueFromGifts(theme.gifts.length);
        option.textContent = `${themeName} (${themeValue})`;
        selectTheme.appendChild(option);
    });
    if (previous.theme) {
        selectTheme.value = previous.theme;
    }

    // Liste 4 : les objets d'équipement (valeur = bonus)
    const selectEquip = document.getElementById('dice-equip');
    selectEquip.innerHTML = '';
    if (equipment.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '— Aucun objet —';
        option.disabled = true;
        selectEquip.appendChild(option);
    } else {
        equipment.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (+${item.bonus})`;
            selectEquip.appendChild(option);
        });
        // Restaurer l'objet choisi (sauf s'il vient d'être supprimé)
        if (previous.equip && equipment.some(item => item.id === previous.equip)) {
            selectEquip.value = previous.equip;
        }
    }

    updateDiceFormula();
}

/**
 * Lit les 4 listes et renvoie la sélection du joueur.
 * Chaque élément choisi devient une "partie" du lancer :
 * { label: texte à afficher, value: nombre à ajouter }
 * @returns {Array<{label: string, value: number}>}
 */
function diceSelection() {
    const parts = [];
    const stats = getGame().character.stats;
    const themes = getGame().character.themes;

    // Caractéristique 1
    const key1 = document.getElementById('dice-stat1').value;
    if (key1) {
        parts.push({ label: `${STAT_LABELS[key1]} (${stats[key1]})`, value: stats[key1] });
    }

    // Caractéristique 2
    const key2 = document.getElementById('dice-stat2').value;
    if (key2) {
        parts.push({ label: `${STAT_LABELS[key2]} (${stats[key2]})`, value: stats[key2] });
    }

    // Thème
    const themeId = document.getElementById('dice-theme').value;
    if (themeId && themes[themeId]) {
        const theme = themes[themeId];
        const themeValue = themeValueFromGifts(theme.gifts.length);
        const themeName = theme.name || `Thème ${themeId.slice(-1)}`;
        parts.push({ label: `${themeName} (${themeValue})`, value: themeValue });
    }

    // Équipement
    const equipId = document.getElementById('dice-equip').value;
    if (equipId) {
        const item = getGame().equipment.find(eq => eq.id === equipId);
        if (item) {
            parts.push({ label: `${item.name} (+${item.bonus})`, value: item.bonus });
        }
    }

    return parts;
}

/**
 * Met à jour le champ de formule, ex. :
 * "Corps (3) + Épée (+2) + 1d20"
 */
function updateDiceFormula() {
    const parts = diceSelection();
    const labels = parts.map(part => part.label).concat(['1d20']);
    document.getElementById('dice-formula').textContent = labels.join(' + ');
}

/**
 * Lance un dé 20 faces (nombre aléatoire entre 1 et 20)
 * @returns {number}
 */
function rollD20() {
    return 1 + Math.floor(Math.random() * 20);
}

/**
 * Lance les dés !
 * - 'normal'     : 1d20 + les bonus des choix
 * - 'advantage'  : 2d20, on garde le MEILLEUR
 * - 'disadvantage' : 2d20, on garde le PLUS BAS
 * @param {string} mode - 'normal', 'advantage' ou 'disadvantage'
 */
function rollDice(mode = 'normal') {
    const parts = diceSelection();
    const sum = parts.reduce((total, part) => total + part.value, 0);

    let d20;
    let diceDetail = '1d20';

    if (mode === 'advantage') {
        const a = rollD20();
        const b = rollD20();
        d20 = Math.max(a, b);
        diceDetail = `2d20 → ${a} et ${b}, on garde ${d20}`;
    } else if (mode === 'disadvantage') {
        const a = rollD20();
        const b = rollD20();
        d20 = Math.min(a, b);
        diceDetail = `2d20 → ${a} et ${b}, on garde ${d20}`;
    } else {
        d20 = rollD20();
    }

    const total = sum + d20;
    const bonusText = sum > 0 ? ` (+${sum} de bonus)` : '';

    document.getElementById('dice-result').textContent =
        `Résultat : ${total}${bonusText} — ${diceDetail}`;

    showNotification(`Lancer : ${total} !`);
}

// ============================================
// Feuille de personnage : remise à zéro
// ============================================

/**
 * Remplace le personnage actuel par un personnage neuf
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

    // Mettre à jour les caractéristiques, les thèmes, l'équipement et les dés
    updateStatsDisplay();
    updateThemesDisplay();
    renderEquipment();
    renderDiceOptions();
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
            <button class="delete-entry" data-action="delete-entry" data-id="${entry.id}">Supprimer</button>
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

    // Thèmes de dons : le nom du thème sert aussi dans le lanceur de dés
    document.querySelectorAll('.theme-name').forEach(input => {
        input.addEventListener('input', (e) => {
            const themeId = e.target.dataset.theme;
            getGame().character.themes[themeId].name = e.target.value.trim();
            persist();
            renderDiceOptions();
        });
    });

    // Boutons "Nouveau don" : ouvrent la pop-up (bibliothèque + champs libres)
    document.querySelectorAll('.add-gift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openGiftModal(btn.dataset.theme, null);
        });
    });

    // Équipement : bouton "Nouveau"
    document.getElementById('new-equipment-btn').addEventListener('click', () => {
        openEquipmentModal(null);
    });

    // Lanceur de dés
    ['dice-stat1', 'dice-stat2', 'dice-theme', 'dice-equip'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateDiceFormula);
    });
    document.getElementById('dice-roll-btn').addEventListener('click', () => rollDice('normal'));
    document.getElementById('dice-adv-btn').addEventListener('click', () => rollDice('advantage'));
    document.getElementById('dice-dis-btn').addEventListener('click', () => rollDice('disadvantage'));

    // Pop-up (dons et équipement)
    document.getElementById('modal-library').addEventListener('change', onLibraryChange);
    document.getElementById('modal-save-btn').addEventListener('click', saveModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

    // Fenêtre d'information (équipement)
    document.getElementById('info-edit-btn').addEventListener('click', () => {
        const id = infoState.equipmentId;
        closeInfo();
        openEquipmentModal(id);
    });
    document.getElementById('info-delete-btn').addEventListener('click', () => {
        deleteEquipment(infoState.equipmentId);
    });
    document.getElementById('info-close-btn').addEventListener('click', closeInfo);

    // Fermer les fenêtres en cliquant sur le fond sombre
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('info-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeInfo();
    });

    // Boutons créés dynamiquement (dons, équipement, journal)
    // On écoute TOUT le corps de la page : quand un bouton portant
    // data-action est cliqué, on agit selon sa valeur.
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index, 10);

        if (action === 'edit-gift') {
            openGiftModal(btn.dataset.theme, index);
        } else if (action === 'delete-gift') {
            deleteGift(btn.dataset.theme, index);
        } else if (action === 'equip-info') {
            showEquipmentInfo(btn.dataset.id);
        } else if (action === 'equip-delete') {
            deleteEquipment(btn.dataset.id);
        } else if (action === 'delete-entry') {
            deleteJournalEntry(btn.dataset.id);
        } else if (action === 'edit-word-list') {
            editWordList(btn.dataset.id);
        } else if (action === 'delete-word-list') {
            deleteWordList(btn.dataset.id);
        }
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
// Dons : suppression
// ============================================

/**
 * Supprime un don d'un thème (avec confirmation)
 * @param {string} themeId - ID du thème
 * @param {number} giftIndex - Position du don dans la liste
 */
function deleteGift(themeId, giftIndex) {
    const theme = getGame().character.themes[themeId];
    if (!theme || !theme.gifts[giftIndex]) return;

    const gift = theme.gifts[giftIndex];
    if (!confirm(`Supprimer le don "${gift.name}" ?`)) {
        return;
    }

    theme.gifts.splice(giftIndex, 1);
    persist();
    updateThemesDisplay();
    showNotification('Don supprimé');
}

// ============================================
// Démarrage de l'application
// ============================================

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', init);
