/**
 * Mon One Page - Jeu de Rôle Solo
 * Script JavaScript principal
 * 
 * Ce script gère toute la logique de l'application :
 * - Oracle (gestion des listes et tirages aléatoires)
 * - Feuille de personnage (caractéristiques, thèmes de dons)
 * - Journal d'aventure
 * - Sauvegarde dans les cookies
 * - Export/Import JSON
 */

// ============================================
// Variables globales
// ============================================

/**
 * Données de l'application
 * @typedef {Object} AppData
 * @property {Object} oracle - Données de l'oracle
 * @property {Array} oracle.lists - Liste des listes de mots
 * @property {Array} oracle.history - Historique des tirages
 * @property {Object} character - Données du personnage
 * @property {Object} character.description - Description du personnage
 * @property {string} character.description.name - Nom du personnage
 * @property {string} character.description.adjective - Adjectif
 * @property {string} character.description.role - Rôle
 * @property {Object} character.stats - Caractéristiques
 * @property {number} character.stats.corps - Valeur Corps (2-4)
 * @property {number} character.stats.ame - Valeur Âme (2-4)
 * @property {number} character.stats.esprit - Valeur Esprit (2-4)
 * @property {Object} character.themes - Thèmes de dons
 * @property {Array} journal - Entrées du journal
 */

let appData = {
    oracle: {
        lists: [],
        history: []
    },
    character: {
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
    },
    journal: []
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
 * Sauvegarde les données dans les cookies
 */
function saveToCookies() {
    try {
        // Convertir les données en JSON
        const jsonData = JSON.stringify(appData);
        
        // Sauvegarder dans un cookie
        // Le cookie expire dans 365 jours
        const expires = new Date();
        expires.setDate(expires.getDate() + 365);
        
        document.cookie = `monOnePageData=${encodeURIComponent(jsonData)}; expires=${expires.toUTCString()}; path=/`;
        
        console.log('Données sauvegardées dans les cookies');
        showNotification('Données sauvegardées avec succès !');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde :', error);
        showNotification('Erreur lors de la sauvegarde', 'error');
    }
}

/**
 * Charge les données depuis les cookies
 * @returns {boolean} True si des données ont été chargées, false sinon
 */
function loadFromCookies() {
    try {
        // Récupérer le cookie
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
        
        if (cookies.monOnePageData) {
            const jsonData = cookies.monOnePageData;
            const parsedData = JSON.parse(jsonData);
            
            // Vérifier que les données sont valides
            if (parsedData && parsedData.character) {
                appData = parsedData;
                console.log('Données chargées depuis les cookies');
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Erreur lors du chargement :', error);
        showNotification('Erreur lors du chargement des données', 'error');
        return false;
    }
}

/**
 * Supprime les données des cookies
 */
function clearCookies() {
    document.cookie = 'monOnePageData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    console.log('Données supprimées des cookies');
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
    
    // Ajouter à la liste des listes
    appData.oracle.lists.push(newList);
    
    // Réinitialiser le formulaire
    document.getElementById('new-list-name').value = '';
    document.getElementById('new-list-items').value = '';
    
    // Mettre à jour l'interface
    renderWordLists();
    renderListSelect();
    
    showNotification(`Liste "${listName}" ajoutée avec ${items.length} mots`);
}

/**
 * Supprime une liste de mots
 * @param {string} listId - ID de la liste à supprimer
 */
function deleteWordList(listId) {
    if (confirm('Voulez-vous vraiment supprimer cette liste ?')) {
        appData.oracle.lists = appData.oracle.lists.filter(list => list.id !== listId);
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
    
    if (appData.oracle.lists.length === 0) {
        container.innerHTML = '<p>Aucune liste de mots disponible. Ajoutez-en une !</p>';
        return;
    }
    
    appData.oracle.lists.forEach(list => {
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
    const list = appData.oracle.lists.find(l => l.id === listId);
    if (!list) return;
    
    // Remplir le formulaire avec les données de la liste
    document.getElementById('new-list-name').value = list.name;
    document.getElementById('new-list-items').value = list.items.join('\n');
    
    // Supprimer l'ancienne liste
    deleteWordList(listId);
    
    showNotification(`Modifiez la liste "${list.name}" et cliquez sur Ajouter`);
}

/**
 * Met à jour le sélecteur de listes
 */
function renderListSelect() {
    const select = document.getElementById('list-select');
    select.innerHTML = '<option value="">Choisir une liste...</option>';
    
    appData.oracle.lists.forEach(list => {
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
    const listId = document.getElementById('list-select').value;
    const count = parseInt(document.getElementById('draw-count').value) || 1;
    
    if (!listId) {
        showNotification('Veuillez sélectionner une liste', 'error');
        return;
    }
    
    const list = appData.oracle.lists.find(l => l.id === listId);
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
    
    appData.oracle.history.unshift(historyItem);
    
    // Limiter l'historique à 20 entrées
    if (appData.oracle.history.length > 20) {
        appData.oracle.history.pop();
    }
    
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
    
    if (appData.oracle.history.length === 0) {
        container.innerHTML = '<li>Aucun tirage effectué</li>';
        return;
    }
    
    appData.oracle.history.forEach(historyItem => {
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
    const { name, adjective, role } = appData.character.description;
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
    // Mettre à jour les valeurs
    document.getElementById('corps-value').textContent = appData.character.stats.corps;
    document.getElementById('ame-value').textContent = appData.character.stats.ame;
    document.getElementById('esprit-value').textContent = appData.character.stats.esprit;
    
    // Mettre à jour les points
    updateStatDots('corps', appData.character.stats.corps);
    updateStatDots('ame', appData.character.stats.ame);
    updateStatDots('esprit', appData.character.stats.esprit);
    
    // Mettre à jour le total
    const total = appData.character.stats.corps + appData.character.stats.ame + appData.character.stats.esprit;
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
    const stats = appData.character.stats;
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
    const currentValue = appData.character.stats[stat];
    const newValue = currentValue + change;
    
    // Vérifier les limites
    if (newValue < 2 || newValue > 4) {
        return;
    }
    
    // Vérifier que le total ne dépasse pas 12
    const total = Object.values(appData.character.stats).reduce((sum, val) => sum + val, 0);
    if (change > 0 && total + change > 12) {
        showNotification('Le total des caractéristiques ne peut pas dépasser 12', 'error');
        return;
    }
    
    // Mettre à jour la valeur
    appData.character.stats[stat] = newValue;
    
    // Mettre à jour l'affichage
    updateStatsDisplay();
}

/**
 * Met à jour l'affichage des thèmes de dons
 */
function updateThemesDisplay() {
    // Mettre à jour chaque thème
    ['theme1', 'theme2', 'theme3'].forEach(themeId => {
        const theme = appData.character.themes[themeId];
        
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
 * Met à jour la liste des dons pour un thème
 * @param {string} themeId - ID du thème
 */
function updateGiftsList(themeId) {
    const giftsList = document.querySelector(`.gifts-list[data-theme="${themeId}"]`);
    if (!giftsList) return;
    
    const theme = appData.character.themes[themeId];
    giftsList.innerHTML = '';
    
    theme.gifts.forEach((gift, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${gift}</span>
            <button class="delete-gift" onclick="deleteGift('${themeId}', ${index})">×</button>
        `;
        giftsList.appendChild(li);
    });
    
    // Mettre à jour la valeur du thème
    updateThemesDisplay();
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
    const theme = appData.character.themes[themeId];
    if (theme.gifts.includes(giftName)) {
        showNotification('Ce don existe déjà dans ce thème', 'error');
        return;
    }
    
    // Ajouter le don
    theme.gifts.push(giftName);
    
    // Limiter à 4 dons par thème
    if (theme.gifts.length > 4) {
        theme.gifts = theme.gifts.slice(0, 4);
        showNotification('Un thème ne peut pas avoir plus de 4 dons', 'warning');
    }
    
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
    const theme = appData.character.themes[themeId];
    const giftName = theme.gifts[giftIndex];
    
    if (confirm(`Voulez-vous vraiment supprimer le don "${giftName}" ?`)) {
        theme.gifts.splice(giftIndex, 1);
        updateGiftsList(themeId);
        updateThemesDisplay();
        showNotification(`Don "${giftName}" supprimé`);
    }
}

/**
 * Met à jour le nom d'un thème
 * @param {string} themeId - ID du thème
 */
function updateThemeName(themeId) {
    const input = document.querySelector(`.theme-name[data-theme="${themeId}"]`);
    const newName = input.value.trim();
    
    appData.character.themes[themeId].name = newName;
}

/**
 * Réinitialise la feuille de personnage
 */
function resetCharacter() {
    if (confirm('Voulez-vous vraiment réinitialiser le personnage ? Toutes les données non sauvegardées seront perdues.')) {
        appData.character = {
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
        
        // Mettre à jour l'interface
        updateCharacterUI();
        showNotification('Nouveau personnage créé');
    }
}

/**
 * Met à jour toute l'interface du personnage
 */
function updateCharacterUI() {
    // Mettre à jour la description
    document.getElementById('character-name').value = appData.character.description.name || '';
    document.getElementById('character-adjective').value = appData.character.description.adjective || '';
    document.getElementById('character-role').value = appData.character.description.role || '';
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
    
    appData.journal.unshift(newEntry);
    
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
    
    if (appData.journal.length === 0) {
        container.innerHTML = '<p>Aucune entrée dans le journal. Ajoutez-en une !</p>';
        return;
    }
    
    appData.journal.forEach(entry => {
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
        appData.journal = appData.journal.filter(entry => entry.id !== entryId);
        renderJournalEntries();
        showNotification('Entrée supprimée du journal');
    }
}

// ============================================
// Export/Import JSON
// ============================================

/**
 * Exporte les données au format JSON
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
 */
function importFromJSON() {
    try {
        const json = document.getElementById('export-json').value.trim();
        if (!json) {
            showNotification('Veuillez entrer du JSON valide', 'error');
            return;
        }
        
        const importedData = JSON.parse(json);
        
        // Valider les données importées
        if (!importedData.character) {
            showNotification('Les données importées ne sont pas valides', 'error');
            return;
        }
        
        if (confirm('Voulez-vous vraiment importer ces données ? Les données actuelles seront écrasées.')) {
            appData = importedData;
            
            // Mettre à jour l'interface
            updateCharacterUI();
            renderWordLists();
            renderListSelect();
            renderJournalEntries();
            
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
// Initialisation
// ============================================

/**
 * Initialise l'application
 */
function init() {
    // Charger les données depuis les cookies
    const hasData = loadFromCookies();
    
    // Si pas de données dans les cookies, initialiser avec un nouveau personnage
    if (!hasData) {
        resetCharacter();
    }
    
    // Initialiser l'interface
    updateCharacterUI();
    renderWordLists();
    renderListSelect();
    renderJournalEntries();
    renderHistory();
    
    // Configurer les écouteurs d'événements
    setupEventListeners();
    
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
    
    // Oracle
    document.getElementById('add-list-btn').addEventListener('click', addWordList);
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
        appData.character.description.name = e.target.value.trim();
        updateFullDescription();
    });
    
    document.getElementById('character-adjective').addEventListener('input', (e) => {
        appData.character.description.adjective = e.target.value.trim();
        updateFullDescription();
    });
    
    document.getElementById('character-role').addEventListener('input', (e) => {
        appData.character.description.role = e.target.value.trim();
        updateFullDescription();
    });
    
    // Thèmes de dons
    document.querySelectorAll('.theme-name').forEach(input => {
        input.addEventListener('input', (e) => {
            const themeId = e.target.dataset.theme;
            appData.character.themes[themeId].name = e.target.value.trim();
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
    document.getElementById('save-character-btn').addEventListener('click', saveToCookies);
    document.getElementById('load-character-btn').addEventListener('click', () => {
        const hasData = loadFromCookies();
        if (hasData) {
            updateCharacterUI();
            renderWordLists();
            renderListSelect();
            renderJournalEntries();
            showNotification('Données chargées depuis les cookies');
        } else {
            showNotification('Aucune donnée trouvée dans les cookies', 'info');
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
