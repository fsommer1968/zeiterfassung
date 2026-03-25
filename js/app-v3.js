// ===================================
// Zeiterfassung Web App - JavaScript v3
// ===================================

// ===================================
// FEATURE FLAGS - Hier Features aktivieren/deaktivieren
// ===================================
const FEATURES = {
    FEIERTAGE_LADEN: true  // true = Feiertage von API laden (benötigt Webserver)
                           // false = Nur Wochenenden markieren (funktioniert mit file://)
};

// ===================================
// KONSTANTEN
// ===================================
const DEFAULT_WOCHENSTUNDEN = 39.0;
const ARBEITSTAGE_PRO_WOCHE = 5;
const MINUTEN_PRO_STUNDE = 60;
const MOBILE_BREAKPOINT = 992;
// Feldnamen-Konstanten für Zeiterfassung
const FIELDS = {
    VON1: 'von1',
    BIS1: 'bis1',
    VON2: 'von2',
    BIS2: 'bis2',
    VORNACH: 'vornach',
    STUNDEN: 'stunden'
};


// Globale Variablen
let aktuellesJahr = new Date().getFullYear();
let aktuellerMonat = new Date().getMonth();
let zeiterfassungDaten = {};
let manuellEditierteStunden = new Set(); // Speichert Tags von manuell editierten Stunden-Feldern
let ungespeicherteTage = new Set(); // Speichert Tags mit ungespeicherten Änderungen
let feiertageCache = {}; // Cache für Feiertage nach Jahr (pro Bundesland)
let kopierterTag = null; // Zwischenspeicher für kopierten Tag
let kopierterTagDaten = null; // Daten des kopierten Tags
let kopierteWoche = null; // Zwischenspeicher für kopierte Woche (Sonntag-Tag)
let kopierteWocheDaten = null; // Array mit 7 Tagen Daten
let wochenstunden = DEFAULT_WOCHENSTUNDEN; // Standard-Wochenstunden bei 100%
let bundesland = 'BW'; // Standard-Bundesland für Feiertage
let urlaubstage = []; // DEPRECATED: Wird nicht mehr verwendet, nur für Kompatibilität
let speicherQueue = []; // Queue für Speicheroperationen
let speicherQueueAktiv = false; // Flag ob Queue gerade abgearbeitet wird

// Deutsche Monatsnamen
const MONATSNAMEN = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Deutsche Wochentage (kurz)
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// ===================================
// SICHERHEITS-FUNKTIONEN (XSS-Schutz)
// ===================================

/**
 * Escaped HTML-Sonderzeichen um XSS-Angriffe zu verhindern
 * @param {string} text - Der zu escapende Text
 * @returns {string} - Der gesicherte Text
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
/**
 * Sanitisiert Benutzereingaben um XSS-Angriffe zu verhindern
 * @param {string} input - Die zu bereinigende Eingabe
 * @param {number} maxLength - Maximale Länge (Standard: 1000)
 * @returns {string} - Die bereinigte Eingabe
 */
function sanitizeInput(input, maxLength = 1000) {
    if (input === null || input === undefined) return '';
    
    return String(input)
        .replace(/[<>\"'`]/g, '') // Entferne HTML/JS-gefährliche Zeichen
        .trim()
        .substring(0, maxLength); // Begrenze Länge
}


/**
 * Erstellt ein HTML-Element sicher mit textContent statt innerHTML
 *
 * SICHERHEIT:
 * - Validiert CSS-Klassennamen (nur alphanumerisch, Bindestrich, Unterstrich)
 * - Blockiert Event-Handler-Attribute (onclick, onload, etc.)
 * - Whitelist für erlaubte Attribute
 * - Sanitisiert Attributwerte (entfernt <, >, ", ', `)
 * - Verhindert XSS und CSS-Injection Angriffe
 *
 * @param {string} tag - Der HTML-Tag-Name (z.B. 'div', 'span')
 * @param {Object} options - Optionen für das Element
 * @param {string} options.className - CSS-Klassen (werden validiert)
 * @param {string} options.text - Textinhalt (wird escaped via textContent)
 * @param {Object} options.style - Style-Objekt
 * @param {Object} options.attributes - Weitere Attribute (werden validiert)
 * @returns {HTMLElement} - Das erstellte Element
 */
function createElementSafe(tag, options = {}) {
    const element = document.createElement(tag);
    
    // Whitelist erlaubter Attribute (keine Event-Handler!)
    const SAFE_ATTRIBUTES = [
        'data-field', 'data-tag', 'data-datum', 'placeholder', 'type', 
        'id', 'name', 'value', 'role', 'aria-label', 'aria-labelledby',
        'aria-describedby', 'title', 'alt', 'href', 'target', 'rel',
        'for', 'tabindex', 'disabled', 'readonly', 'required', 'min', 
        'max', 'step', 'pattern', 'autocomplete', 'spellcheck'
    ];
    
    if (options.className) {
        // Nur alphanumerische Zeichen, Bindestriche und Unterstriche erlauben
        // Keine Sonderzeichen, die für CSS-Injection missbraucht werden könnten
        const sanitizedClassName = options.className
            .split(/\s+/)
            .filter(cls => {
                // Prüfe auf gültiges CSS-Klassen-Format
                // Erlaubt: a-z, A-Z, 0-9, Bindestrich, Unterstrich
                return cls && /^[a-zA-Z0-9_-]+$/.test(cls);
            })
            .join(' ');
        
        if (sanitizedClassName) {
            element.className = sanitizedClassName;
        }
    }
    
    if (options.text !== undefined) {
        element.textContent = options.text;
    }
    
    if (options.style) {
        Object.assign(element.style, options.style);
    }
    
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            // Blockiere Event-Handler (on*) und andere gefährliche Attribute
            const keyLower = key.toLowerCase();
            
            if (SAFE_ATTRIBUTES.includes(keyLower) && !keyLower.startsWith('on')) {
                // Konvertiere Wert zu String und entferne potentiell gefährliche Zeichen
                const sanitizedValue = String(value)
                    .replace(/[<>\"'`]/g, '') // Entferne HTML/JS-gefährliche Zeichen
                    .substring(0, 1000); // Begrenze Länge
                
                element.setAttribute(key, sanitizedValue);
            } else {
                console.warn(`[Security] Blocked unsafe attribute: "${key}"`);
            }
        });
    }
    
    return element;
}


/**
 * Erstellt sicher ein Element mit mehreren Kindern
 * @param {string} tag - Der HTML-Tag-Name
 * @param {Object} options - Optionen (wie createElementSafe)
 * @param {Array<HTMLElement|string>} children - Array von Kind-Elementen oder Texten
 * @returns {HTMLElement} - Das erstellte Element mit Kindern
 */
function createElementWithChildren(tag, options = {}, children = []) {
    const element = createElementSafe(tag, options);
    
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement) {
            element.appendChild(child);
        }
    });
    
    return element;
}

/**
 * Setzt sicher HTML-Inhalt mit Text und Formatierung
 * Verwendet für Fälle wo <br>, <small> etc. benötigt werden
 * @param {HTMLElement} element - Das Ziel-Element
 * @param {string} mainText - Haupttext (wird escaped)
 * @param {Object} options - Optionen für zusätzlichen Inhalt
 * @param {string} options.subText - Untertext (wird escaped)
 * @param {string} options.subTextStyle - CSS-Style für Untertext
 * @param {string} options.subTextColor - Farbe für Untertext
 */
function setElementContentSafe(element, mainText, options = {}) {
    // Lösche vorhandenen Inhalt
    element.textContent = '';
    
    // Füge Haupttext hinzu
    element.appendChild(document.createTextNode(mainText));
    
    // Füge optionalen Untertext hinzu
    if (options.subText) {
        element.appendChild(document.createElement('br'));
        
        const small = createElementSafe('small', {
            text: options.subText,
            style: {
                fontWeight: 'normal',
                fontSize: '0.8em',
                ...(options.subTextColor && { color: options.subTextColor })
            }
        });
        
        if (options.subTextStyle) {
            Object.assign(small.style, options.subTextStyle);
        }
        
        element.appendChild(small);
    }
}
/**
 * Erstellt sicher den Header für eine Mobile Card
 * @param {number} tag - Tag-Nummer
 * @param {string} wochentag - Wochentag
 * @param {boolean} istUrlaub - Ist Urlaubstag
 * @param {boolean} istKrank - Ist Kranktag
 * @param {string} feiertagName - Name des Feiertags (optional)
 * @param {boolean} istWochenende - Ist Wochenende
 * @returns {HTMLElement} - Der Header-Container
 */
function erstelleMobileCardHeader(tag, wochentag, istUrlaub, istKrank, feiertagName, istWochenende) {
    // Helper: Bestimmt den Icon-Typ basierend auf Tag-Status
    function getIconType(istUrlaub, istKrank, istWochenende) {
        if (istUrlaub && istKrank) return 'heart-pulse';
        if (istUrlaub) return 'calendar-check';
        if (istWochenende) return 'moon';
        return 'sun';
    }
    
    // Helper: Erstellt einen Status-Span mit optionaler Farbe
    function createStatusSpan(text, color = null) {
        return createElementSafe('span', {
            text,
            style: {
                fontSize: '0.85em',
                ...(color && { color })
            }
        });
    }
    
    const header = document.createElement('div');
    header.className = `day-card-header ${istWochenende ? 'weekend-header' : ''} ${istUrlaub ? 'urlaub-header' : ''}`;
    
    // Linke Seite: Tag und Wochentag
    const leftDiv = document.createElement('div');
    
    const dayNumber = createElementSafe('div', {
        className: 'day-number',
        text: tag.toString()
    });
    leftDiv.appendChild(dayNumber);
    
    const dayName = createElementSafe('div', {
        className: 'day-name'
    });
    dayName.textContent = wochentag;
    
    // Füge Status-Span hinzu wenn nötig
    if (istUrlaub) {
        dayName.appendChild(document.createTextNode(' '));
        const statusText = istKrank ? '(Krank)' : '(Urlaub)';
        const statusColor = istKrank ? '#f8d7da' : '#d4edda';
        dayName.appendChild(createStatusSpan(statusText, statusColor));
    } else if (feiertagName) {
        dayName.appendChild(document.createTextNode(' '));
        dayName.appendChild(createStatusSpan(`(${feiertagName})`));
    }
    
    leftDiv.appendChild(dayName);
    header.appendChild(leftDiv);
    
    // Rechte Seite: Icon
    const rightDiv = document.createElement('div');
    const iconType = getIconType(istUrlaub, istKrank, istWochenende);
    const icon = document.createElement('i');
    icon.className = `bi bi-${iconType}`;
    rightDiv.appendChild(icon);
    header.appendChild(rightDiv);
    
    return header;
}

/**
 * Erstellt sicher ein Input-Feld für die Mobile Card
 * @param {string} label - Label-Text
 * @param {string} field - Feldname (data-field)
 * @param {string} value - Wert (optional)
 * @param {boolean} isCalculated - Ist berechnetes Feld
 * @returns {HTMLElement} - Das Input-Container-Element
 */
function erstelleMobileInputFeld(label, field, value = '', isCalculated = false) {
    const container = createElementSafe('div', {
        className: 'time-field'
    });
    
    const labelEl = createElementSafe('label', {
        text: label
    });
    container.appendChild(labelEl);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = `time-input${isCalculated ? ' calculated-field' : ''}`;
    input.placeholder = 'HH:MM';
    input.dataset.field = field;
    if (value) {
        input.value = value;
    }
    container.appendChild(input);
    
    return container;
}



// ===================================
// LocalStorage Utility-Funktionen
// ===================================

/**
 * Holt den Urlaubstage-Index aus dem LocalStorage
 * @returns {Set} - Set mit allen Datumstrings die Urlaubstage haben
 */
function holeUrlaubstageIndex() {
    const indexJson = localStorage.getItem('urlaub_index');
    return indexJson ? new Set(JSON.parse(indexJson)) : new Set();
}

/**
 * Speichert den Urlaubstage-Index im LocalStorage
 * @param {Set} index - Set mit allen Datumstrings
 */
function speichereUrlaubstageIndex(index) {
    localStorage.setItem('urlaub_index', JSON.stringify([...index]));
}

/**
 * Setzt einen Urlaubstag-Eintrag im LocalStorage
 * @param {Date} datum - Das Datum
 * @param {number} tage - Anzahl der Urlaubstage (0, 0.5, 1, etc.)
 */
function setzeUrlaubstag(datum, tage) {
    const datumString = formatiereDatumLokal(datum);
    const key = `urlaub_tage_${datumString}`;
    localStorage.setItem(key, tage.toString());
    
    // Aktualisiere Index
    const index = holeUrlaubstageIndex();
    index.add(datumString);
    speichereUrlaubstageIndex(index);
}

/**
 * Holt einen Urlaubstag-Eintrag aus dem LocalStorage
 * @param {Date} datum - Das Datum
 * @returns {number} - Anzahl der Urlaubstage (0 wenn nicht vorhanden)
 */
function holeUrlaubstag(datum) {
    const datumString = formatiereDatumLokal(datum);
    const key = `urlaub_tage_${datumString}`;
    const wert = localStorage.getItem(key);
    const parsed = wert ? parseFloat(wert) : 0;
    return parsed > 0 ? parsed : 0;
}

/**
 * Setzt den Krank-Status für ein Datum
 * @param {Date} datum - Das Datum
 * @param {boolean} istKrank - true wenn Kranktag, false sonst
 */
function setzeKrankstatus(datum, istKrank) {
    const datumString = formatiereDatumLokal(datum);
    const key = `krank_${datumString}`;
    localStorage.setItem(key, istKrank ? 'true' : 'false');
}

/**
 * Holt den Krank-Status für ein Datum
 * @param {Date} datum - Das Datum
 * @returns {boolean} - true wenn Kranktag, false sonst
 */
function holeKrankstatus(datum) {
    const datumString = formatiereDatumLokal(datum);
    const key = `krank_${datumString}`;
    const wert = localStorage.getItem(key);
    return wert === 'true';
}

/**
 * Löscht Urlaubstag und Krank-Status für ein Datum (setzt auf 0/false)
 * @param {Date} datum - Das Datum
 */
function loescheUrlaubUndKrank(datum) {
    const datumString = formatiereDatumLokal(datum);
    localStorage.setItem(`urlaub_tage_${datumString}`, "0");
    localStorage.setItem(`krank_${datumString}`, "false");
}

/**
 * Erstellt ein Datum-Objekt für einen Tag im aktuellen Monat
 * @param {number} tag - Der Tag im Monat (1-31)
 * @returns {Date} - Das Datum-Objekt
 */
function erstelleDatumFuerTag(tag) {
    return new Date(aktuellesJahr, aktuellerMonat, tag);
}

/**
 * Löscht ALLE Einträge für einen Tag (Urlaub, Krank, Zeiten)
 * @param {number} tag - Der Tag im Monat (1-31)
 */
function loescheTagKomplett(tag) {
    // Rückfrage
    const datum = erstelleDatumFuerTag(tag);
    const datumFormatiert = datum.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    
    if (!confirm(`Möchten Sie wirklich ALLE Einträge für ${datumFormatiert} löschen?\n\nDies umfasst:\n• Alle Zeiten (Von/Bis)\n• Bemerkungen\n• Urlaubs-/Kranktagsmarkierungen\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`)) {
        return;
    }
    
    // Lösche Urlaub und Krank-Status
    loescheUrlaubUndKrank(datum);
    
    // Lösche alle Zeitdaten aus zeiterfassungDaten
    const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
    if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
        delete zeiterfassungDaten[monatsKey].tage[tag];
    }
    
    // Speichere Änderungen
    speichereDatenInLocalStorage();
    
    // Entferne aus ungespeicherten Tagen
    ungespeicherteTage.delete(tag);
    
    // Lade Monat neu, um die Anzeige zu aktualisieren
    ladeMonat(aktuellesJahr, aktuellerMonat);
    
    zeigeToast(`Alle Einträge für ${datumFormatiert} wurden gelöscht`, 'info');
}
// ============================================================================
// DOM & UI UTILITIES
// ============================================================================

/**
 * Zeigt ein Bootstrap Modal an
 * @param {string} modalId - Die ID des Modal-Elements
 */
function zeigeModal(modalId) {
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

/**
 * Schließt das mobile Menü
 */
function schliesseMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    }
}

/**
 * Holt ein DOM-Element sicher per ID
 * @param {string} id - Die Element-ID
 * @returns {HTMLElement|null} Das Element oder null
 */
function holeElement(id) {
    return document.getElementById(id);
}


// ===================================
// Urlaubskalender Funktionen (müssen vor DOMContentLoaded definiert sein)
// ===================================
// Hilfsfunktion: Beschäftigungsgrad aus Stammdaten laden
function getBeschaeftigungsgrad() {
    try {
        const beschaeftigungsgradInput = document.getElementById('beschaeftigungsgrad');
        if (!beschaeftigungsgradInput || !beschaeftigungsgradInput.value) {
            return 1.0; // Standard: 100%
        }
        
        const bgString = beschaeftigungsgradInput.value.trim();
        
        if (!bgString) {
            return 1.0; // Standard: 100%
        }
        
        // Sanitisierung: Alle nicht-numerischen Zeichen außer Punkt und % entfernen
        const sanitized = bgString.replace(/[^\d.%]/g, '');
        
        // Prüfen ob genau ein % am Ende steht
        if (sanitized.endsWith('%') && sanitized.indexOf('%') === sanitized.length - 1) {
            const value = parseFloat(sanitized.slice(0, -1));
            return isNaN(value) ? 1.0 : value / 100;
        }
        
        // Kein % oder ungültiges Format - als Dezimalwert behandeln
        const bgValue = parseFloat(sanitized);
        if (isNaN(bgValue)) {
            return 1.0; // Standard: 100%
        }
        if (bgValue > 1) {
            return bgValue / 100; // 80 -> 0.8
        } else {
            return bgValue; // 0.8 -> 0.8
        }
    } catch (error) {
        return 1.0; // Standard: 100%
    }
}

// Hilfsfunktion: Berechne tägliche Arbeitsstunden für Urlaub
function berechneTaeglicheUrlaubsstunden() {
    const beschaeftigungsgrad = getBeschaeftigungsgrad();
    const tagesStunden = (wochenstunden * beschaeftigungsgrad) / ARBEITSTAGE_PRO_WOCHE;
    return tagesStunden;
}


// Urlaubstage aus LocalStorage laden
function ladeUrlaubstage() {
    // MIGRATION: Lösche alte Urlaubsperioden aus LocalStorage
    // Das neue System verwendet urlaub_tage_* Einträge
    const gespeichert = localStorage.getItem('urlaubstage');
    if (gespeichert) {
        localStorage.removeItem('urlaubstage');
    }
    
    // Array bleibt leer - wird nicht mehr verwendet
    urlaubstage = [];
    
    // Aktualisiere Liste nur wenn Modal-Elemente existieren
    if (document.getElementById('urlaubsliste')) {
        aktualisiereUrlaubsliste();
    }
}

// Zeige alle urlaub_tage_* Einträge im LocalStorage (für Debugging)
function zeigeAlleUrlaubstageImLocalStorage() {
    const index = holeUrlaubstageIndex();
    index.forEach(datumString => {
        const key = `urlaub_tage_${datumString}`;
        const value = localStorage.getItem(key);
    });
}

// Bereinige Dummy-Einträge (urlaub_tage_* = "0" und krank_* = "false") aus dem vorherigen Monat
function bereinigeDummyEintraege() {
    
    // Berechne vorherigen Monat
    const heute = new Date();
    const vorherigerMonat = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
    const vorherigerMonatsKey = `${vorherigerMonat.getFullYear()}-${String(vorherigerMonat.getMonth() + 1).padStart(2, '0')}`;
    
    let geloescht = 0;
    const index = holeUrlaubstageIndex();
    const zuLoeschende = [];
    
    // Prüfe nur Einträge aus dem Index
    index.forEach(datumString => {
        const monatsKey = datumString.substring(0, 7); // YYYY-MM
        
        // Nur Einträge aus vorherigem Monat prüfen
        if (monatsKey === vorherigerMonatsKey) {
            const urlaubKey = `urlaub_tage_${datumString}`;
            const krankKey = `krank_${datumString}`;
            const urlaubWert = localStorage.getItem(urlaubKey);
            const krankWert = localStorage.getItem(krankKey);
            
            // Lösche Dummy-Einträge (urlaub_tage_* = "0" oder krank_* = "false")
            if (urlaubWert === "0") {
                zuLoeschende.push({ key: urlaubKey, datumString });
            }
            if (krankWert === "false") {
                zuLoeschende.push({ key: krankKey, datumString: null });
            }
        }
    });
    
    // Lösche Dummy-Einträge
    zuLoeschende.forEach(item => {
        localStorage.removeItem(item.key);
        if (item.datumString) {
            index.delete(item.datumString);
        }
        geloescht++;
    });
    
    if (geloescht > 0) {
        speichereUrlaubstageIndex(index);
    }
}

// Bereinige verwaiste krank_* Einträge (ohne zugehörige urlaub_tage_* Einträge)
function bereinigeVerwaisteKranktage() {
    const zuLoeschende = [];
    
    // Durchsuche alle LocalStorage-Keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        // Prüfe ob es ein krank_* Eintrag ist
        if (key && key.startsWith('krank_')) {
            // Extrahiere das Datum
            const datumString = key.replace('krank_', '');
            const urlaubKey = `urlaub_tage_${datumString}`;
            
            // Wenn kein zugehöriger urlaub_tage_* Eintrag existiert oder dieser "0" ist, markiere zum Löschen
            const urlaubWert = localStorage.getItem(urlaubKey);
            if (!urlaubWert || urlaubWert === "0") {
                zuLoeschende.push(key);
            }
        }
    }
    
    // Setze alle verwaisten Einträge auf "false" (statt löschen)
    zuLoeschende.forEach(key => {
        localStorage.setItem(key, "false");
    });
}

// Urlaubstage in LocalStorage speichern (DEPRECATED - wird nicht mehr verwendet)
function speichereUrlaubstage() {
    // Nichts tun - das neue System verwendet urlaub_tage_* Einträge
}
// Berechne Urlaubstage basierend auf eingetragenen Stunden
function berechneUrlaubstageAusStunden(stunden) {
    const tagesStunden = berechneTaeglicheUrlaubsstunden();
    if (tagesStunden === 0) return 0;
    
    // Berechne Anteil: eingetragene Stunden / Tagesstunden
    const anteil = stunden / tagesStunden;
    
    // Runde auf 0.5 Schritte
    return Math.round(anteil * 2) / 2;
}

// Hilfsfunktion: Formatiere Datum als YYYY-MM-DD in lokaler Zeitzone
function formatiereDatumLokal(datum) {
    const jahr = datum.getFullYear();
    const monat = String(datum.getMonth() + 1).padStart(2, '0');
    const tag = String(datum.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
}

// Speichere oder aktualisiere Urlaubstage für ein bestimmtes Datum
function aktualisiereUrlaubstageProTag(datum, urlaubstage, istKrank = false) {
    if (urlaubstage > 0) {
        setzeUrlaubstag(datum, urlaubstage);
        setzeKrankstatus(datum, istKrank);
    } else {
        loescheUrlaubUndKrank(datum);
    }
    
    // Aktualisiere Urlaubskalender-Anzeige
    aktualisiereUrlaubskalenderBadge();
    
    // Aktualisiere auch die Urlaubsliste (für nachträgliche Änderungen)
    if (document.getElementById('urlaubsliste')) {
        aktualisiereUrlaubsliste();
    }
}

// Prüfe ob ein Datum ein Kranktag ist
function istKranktag(datum) {
    return holeKrankstatus(datum);
}

// Aktualisiere Urlaubskalender-Badge mit Gesamtsumme
function aktualisiereUrlaubskalenderBadge() {
    let gesamtTage = 0;
    
    // Summiere alle gespeicherten Urlaubstage (ohne Kranktage) aus dem Index
    const index = holeUrlaubstageIndex();
    index.forEach(datumString => {
        const [jahr, monat, tag] = datumString.split('-').map(Number);
        const datum = new Date(jahr, monat - 1, tag);
        
        // Überspringe Kranktage
        if (!istKranktag(datum)) {
            const key = `urlaub_tage_${datumString}`;
            const tage = parseFloat(localStorage.getItem(key));
            if (!isNaN(tage)) {
                gesamtTage += tage;
            }
        }
    });
    
    // Lade Urlaubstage pro Jahr aus Stammdaten
    const stammdaten = JSON.parse(localStorage.getItem('stammdaten') || '{}');
    const urlaubstageProJahr = parseFloat(stammdaten.urlaubstageProJahr) || 0;
    
    // Berechne verbleibende Tage
    const verbleibendeTage = urlaubstageProJahr - gesamtTage;
    
    // Aktualisiere Badge
    const badge = document.getElementById('urlaubstageGesamt');
    const badgeMobile = document.getElementById('urlaubstageGesamtMobile');
    
    if (urlaubstageProJahr > 0) {
        // Zeige gebraucht / verfügbar
        const badgeText = `${gesamtTage} / ${urlaubstageProJahr} Tage (${verbleibendeTage} frei)`;
        if (badge) badge.textContent = badgeText;
        if (badgeMobile) badgeMobile.textContent = badgeText;
    } else {
        // Nur gebrauchte Tage anzeigen
        if (badge) badge.textContent = `${gesamtTage} Tage`;
        if (badgeMobile) badgeMobile.textContent = `${gesamtTage} Tage`;
    }
}


// Prüfe ob ein Datum ein Urlaubstag ist
function istUrlaubstag(datum) {
    // Prüfe direkt in LocalStorage ob Urlaubstage für dieses Datum gespeichert sind
    return holeUrlaubstag(datum) > 0;
}

// Berechne Anzahl Urlaubstage (ohne Wochenenden und Feiertage)
function berechneUrlaubstage(vonDate, bisDate) {
    // Validierung: vonDate darf nicht nach bisDate liegen
    if (vonDate > bisDate) {
        throw new Error('Ungültiger Datumsbereich');
    }
    
    let tage = 0;
    const current = new Date(vonDate);
    
    while (current <= bisDate) {
        const wochentag = current.getDay();
        
        // Prüfe ob Feiertag (wenn Feature aktiviert)
        let istFeiertagHeute = false;
        if (FEATURES.FEIERTAGE_LADEN) {
            const jahr = current.getFullYear();
            const monat = current.getMonth();
            const tag = current.getDate();
            const cacheKey = `${jahr}-${bundesland}`;
            
            if (feiertageCache[cacheKey]) {
                const monatString = String(monat + 1).padStart(2, '0');
                const tagString = String(tag).padStart(2, '0');
                const datumString = `${jahr}-${monatString}-${tagString}`;
                istFeiertagHeute = feiertageCache[cacheKey].has(datumString);
            }
        }
        
        // Zähle nur Werktage (Mo-Fr) die keine Feiertage sind
        if (wochentag !== 0 && wochentag !== 6 && !istFeiertagHeute) {
            tage++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return tage;
}

// Aktualisiere Urlaubsliste in der UI
function aktualisiereUrlaubsliste() {
    // Desktop-Liste
    const desktopListe = document.getElementById('urlaubsliste');
    
    if (!desktopListe) return; // Element existiert noch nicht
    
    // Sammle alle Tage mit Urlaubsstunden aus LocalStorage
    const urlaubstageMap = new Map(); // datum -> tage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('urlaub_tage_')) {
            const datumString = key.replace('urlaub_tage_', '');
            const tage = parseFloat(localStorage.getItem(key));
            if (!isNaN(tage) && tage > 0) {
                urlaubstageMap.set(datumString, tage);
            }
        }
    }
    
    if (urlaubstageMap.size === 0 && urlaubstage.length === 0) {
        // Leere Nachricht sicher erstellen (XSS-sicher)
        desktopListe.innerHTML = '';
        
        const leerDiv = document.createElement('div');
        leerDiv.className = 'text-muted text-center py-3';
        
        const icon = document.createElement('i');
        icon.className = 'bi bi-calendar-x';
        icon.style.fontSize = '2rem';
        
        const text = document.createElement('p');
        text.className = 'mb-0 mt-2';
        text.textContent = 'Noch keine Urlaubstage geplant';
        
        leerDiv.appendChild(icon);
        leerDiv.appendChild(text);
        desktopListe.appendChild(leerDiv);
        return;
    }
    
    // Erstelle Liste aus gespeicherten Urlaubstagen
    const urlaubseintraege = [];
    
    // Sortiere Daten
    const sortierteDaten = Array.from(urlaubstageMap.keys()).sort();
    
    // Gruppiere aufeinanderfolgende ARBEITSTAGE (überspringt Wochenenden/Feiertage)
    // WICHTIG: Nur Tage mit gleichem Typ (Urlaub/Krank) werden gruppiert!
    let aktuelleGruppe = null;
    sortierteDaten.forEach(datumString => {
        const tage = urlaubstageMap.get(datumString);
        const datum = new Date(datumString + 'T12:00:00'); // Mittag um Zeitzone zu vermeiden
        const istKrank = istKranktag(datum);
        
        if (!aktuelleGruppe) {
            // Neue Gruppe starten
            aktuelleGruppe = {
                von: datumString,
                bis: datumString,
                tage: tage,
                istKrank: istKrank
            };
        } else {
            // Prüfe ob der Typ gleich ist (Urlaub vs. Krank)
            const gleicherTyp = aktuelleGruppe.istKrank === istKrank;
            
            // Prüfe ob aufeinanderfolgend (unter Berücksichtigung von Wochenenden/Feiertagen)
            const letztesDatum = new Date(aktuelleGruppe.bis + 'T12:00:00');
            const diffTage = Math.round((datum - letztesDatum) / (1000 * 60 * 60 * 24));
            
            // Prüfe ob die Tage dazwischen nur Wochenenden/Feiertage sind
            let nurWochenendenDazwischen = true;
            if (diffTage > 1) {
                for (let i = 1; i < diffTage; i++) {
                    const zwischenDatum = new Date(letztesDatum);
                    zwischenDatum.setDate(zwischenDatum.getDate() + i);
                    const wochentag = zwischenDatum.getDay();
                    const istWochenende = (wochentag === 0 || wochentag === 6);
                    const istFeiertag = istDatumFeiertag(zwischenDatum);
                    
                    // Wenn ein Tag dazwischen kein Wochenende und kein Feiertag ist,
                    // dann ist es eine Lücke in den Urlaubstagen
                    if (!istWochenende && !istFeiertag) {
                        nurWochenendenDazwischen = false;
                        break;
                    }
                }
            }
            
            // Erweitere Gruppe nur wenn: gleicher Typ UND (direkt aufeinanderfolgend ODER nur Wochenenden/Feiertage dazwischen)
            if (gleicherTyp && (diffTage === 1 || (diffTage > 1 && nurWochenendenDazwischen))) {
                // Erweitere Gruppe
                aktuelleGruppe.bis = datumString;
                aktuelleGruppe.tage += tage;
            } else {
                // Speichere alte Gruppe und starte neue (unterschiedlicher Typ oder echte Lücke)
                urlaubseintraege.push(aktuelleGruppe);
                aktuelleGruppe = {
                    von: datumString,
                    bis: datumString,
                    tage: tage,
                    istKrank: istKrank
                };
            }
        }
    });
    
    // Letzte Gruppe hinzufügen
    if (aktuelleGruppe) {
        urlaubseintraege.push(aktuelleGruppe);
    }
    
    // Leere die Liste (sicher)
    desktopListe.textContent = '';
    
    // Erstelle DOM-Elemente für jeden Eintrag (XSS-sicher)
    urlaubseintraege.forEach((eintrag, index) => {
        const vonDate = new Date(eintrag.von + 'T12:00:00');
        const bisDate = new Date(eintrag.bis + 'T12:00:00');
        
        const vonFormatiert = vonDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const bisFormatiert = bisDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        // Verwende den gespeicherten Typ aus der Gruppe
        const istKrank = eintrag.istKrank;
        const typ = istKrank ? 'Krank' : 'Urlaub';
        const iconClass = istKrank ? 'bi-heart-pulse text-danger' : 'bi-calendar-event text-success';
        const badgeClass = istKrank ? 'bg-danger' : 'bg-success';
        
        // Zeige tatsächliche Urlaubstage mit besserer Formatierung
        let tageAnzeige;
        if (eintrag.tage === 1) {
            tageAnzeige = `1 Tag (${typ})`;
        } else if (eintrag.tage === 0.5) {
            tageAnzeige = `0.5 Tage (halber Tag, ${typ})`;
        } else if (eintrag.tage % 1 === 0) {
            tageAnzeige = `${eintrag.tage} Tage (${typ})`;
        } else {
            // Zeige Dezimalzahl für halbe Tage
            tageAnzeige = `${eintrag.tage} Tage (${typ})`;
        }
        
        // Erstelle Haupt-Container
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        
        // Erstelle Flex-Container
        const flexContainer = document.createElement('div');
        flexContainer.className = 'd-flex align-items-center';
        
        // Icon-Container
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = 'flex-shrink: 0; margin-right: 8px;';
        const icon = document.createElement('i');
        icon.className = `bi ${iconClass}`;
        iconContainer.appendChild(icon);
        
        // Datums-Container
        const dateContainer = document.createElement('div');
        dateContainer.style.cssText = 'flex: 1; min-width: 0; margin-right: 12px;';
        const vonStrong = document.createElement('strong');
        vonStrong.textContent = vonFormatiert;
        dateContainer.appendChild(vonStrong);
        dateContainer.appendChild(document.createTextNode(' bis '));
        const bisStrong = document.createElement('strong');
        bisStrong.textContent = bisFormatiert;
        dateContainer.appendChild(bisStrong);
        
        // Badge-Container
        const badgeContainer = document.createElement('div');
        badgeContainer.style.cssText = 'flex-shrink: 0; margin-right: 8px;';
        const badge = document.createElement('span');
        badge.className = `badge ${badgeClass}`;
        badge.textContent = tageAnzeige;
        badgeContainer.appendChild(badge);
        
        // Button-Container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'flex-shrink: 0;';
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-outline-danger';
        deleteButton.type = 'button';
        // Sichere Event-Listener statt onclick-Attribut
        deleteButton.addEventListener('click', () => {
            loescheUrlaubseintraege(eintrag.von, eintrag.bis);
        });
        const trashIcon = document.createElement('i');
        trashIcon.className = 'bi bi-trash';
        deleteButton.appendChild(trashIcon);
        buttonContainer.appendChild(deleteButton);
        
        // Füge alle Container zum Flex-Container hinzu
        flexContainer.appendChild(iconContainer);
        flexContainer.appendChild(dateContainer);
        flexContainer.appendChild(badgeContainer);
        flexContainer.appendChild(buttonContainer);
        
        // Füge Flex-Container zum List-Item hinzu
        listItem.appendChild(flexContainer);
        
        // Füge List-Item zur Desktop-Liste hinzu
        desktopListe.appendChild(listItem);
    });
}

// Urlaubsperiode hinzufügen
function fuegeUrlaubHinzu(von, bis, isMobile = false) {
    if (!von) {
        zeigeToast('Bitte mindestens das "Von"-Datum auswählen', 'warning');
        return;
    }
    
    const vonDate = new Date(von + 'T12:00:00'); // Mittag um Zeitzone zu vermeiden
    // Wenn kein "Bis"-Datum angegeben, verwende "Von"-Datum (einzelner Tag)
    const bisDate = bis ? new Date(bis + 'T12:00:00') : new Date(von + 'T12:00:00');
    
    if (vonDate > bisDate) {
        zeigeToast('Start-Datum muss vor End-Datum liegen', 'warning');
        return;
    }
    
    // Prüfe ob "Krank" Checkbox aktiviert ist
    const istKrankCheckbox = document.getElementById('istKrank');
    const istKrank = istKrankCheckbox ? istKrankCheckbox.checked : false;
    
    // Prüfe ob "Halber Tag" Checkbox aktiviert ist (für Urlaub UND Krank)
    const halberTagCheckbox = document.getElementById('halberTag');
    const istHalberTag = halberTagCheckbox ? halberTagCheckbox.checked : false;
    // Halber Tag wird für Urlaub UND Kranktage ausgewertet
    const urlaubstagWert = istHalberTag ? 0.5 : 1.0;
    
    
    // Erstelle urlaub_tage_* Einträge für jeden Arbeitstag in der Periode
    const current = new Date(vonDate);
    let urlaubstageGesamt = 0;
    
    while (current <= bisDate) {
        const wochentag = current.getDay();
        const istWochenende = (wochentag === 0 || wochentag === 6);
        const istFeiertag = istDatumFeiertag(current);
        
        // Nur Werktage (Mo-Fr) die keine Feiertage sind
        if (!istWochenende && !istFeiertag) {
            aktualisiereUrlaubstageProTag(current, urlaubstagWert, istKrank);
            urlaubstageGesamt += urlaubstagWert;
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    // Eingabefelder leeren
    if (isMobile) {
        const vonMobile = document.getElementById('urlaubVonMobile');
        const bisMobile = document.getElementById('urlaubBisMobile');
        if (vonMobile) vonMobile.value = '';
        if (bisMobile) bisMobile.value = '';
    } else {
        const vonDesktop = document.getElementById('urlaubVon');
        const bisDesktop = document.getElementById('urlaubBis');
        if (vonDesktop) vonDesktop.value = '';
        if (bisDesktop) bisDesktop.value = '';
        // Checkboxen zurücksetzen
        if (halberTagCheckbox) halberTagCheckbox.checked = false;
        if (istKrankCheckbox) istKrankCheckbox.checked = false;
    }
    
    // Aktualisiere Listen
    aktualisiereUrlaubsliste();
    aktualisiereUrlaubskalenderBadge();
    
    // Monat neu laden, damit die Kranktage/Urlaubstage korrekt angezeigt werden
    ladeMonat(aktuellesJahr, aktuellerMonat);
    
    // Nachricht anpassen für halbe Tage und Kranktage
    let nachricht;
    const typSingular = istKrank ? 'Kranktag' : 'Urlaubstag';
    const typPlural = istKrank ? 'Kranktage' : 'Urlaubstage';
    
    if (urlaubstageGesamt === 0) {
        nachricht = 'Keine Arbeitstage in der ausgewählten Periode';
    } else if (urlaubstageGesamt === 1) {
        nachricht = `${typSingular} hinzugefügt: 1 Tag`;
    } else if (urlaubstageGesamt === 0.5) {
        nachricht = `${typSingular} hinzugefügt: 0.5 Tage (halber Tag)`;
    } else if (urlaubstageGesamt % 1 === 0) {
        // Ganze Zahl
        nachricht = `${typPlural} hinzugefügt: ${urlaubstageGesamt} Tage`;
    } else {
        // Dezimalzahl (z.B. 2.5 Tage)
        nachricht = `${typPlural} hinzugefügt: ${urlaubstageGesamt} Tage`;
    }
    zeigeToast(nachricht, 'success');
    
    // Aktualisiere Monatsansicht wenn im aktuellen Monat
    const aktuellerMonatStart = new Date(aktuellesJahr, aktuellerMonat, 1);
    const aktuellerMonatEnde = new Date(aktuellesJahr, aktuellerMonat + 1, 0);
    
    if ((vonDate <= aktuellerMonatEnde && bisDate >= aktuellerMonatStart)) {
        ladeMonat(aktuellesJahr, aktuellerMonat);
    }
}

/**
 * Erstellt eine Radio-Button-Gruppe sicher mit DOM-API
 * @param {string} name - Name der Radio-Button-Gruppe
 * @param {Array} buttons - Array von Button-Konfigurationen
 * @returns {HTMLElement} - Die erstellte Button-Gruppe
 */
function createRadioButtonGroup(name, buttons) {
    const group = document.createElement('div');
    group.className = 'btn-group w-100';
    group.setAttribute('role', 'group');
    
    buttons.forEach(btn => {
        const input = document.createElement('input');
        input.type = 'radio';
        input.className = 'btn-check';
        input.name = name;
        input.id = btn.id;
        input.value = btn.value;
        if (btn.checked) input.checked = true;
        
        const label = document.createElement('label');
        label.className = `btn btn-outline-${btn.color} btn-sm`;
        label.setAttribute('for', btn.id);
        
        if (btn.icon) {
            const icon = document.createElement('i');
            icon.className = `bi ${btn.icon}`;
            label.appendChild(icon);
            label.appendChild(document.createTextNode(' '));
        }
        label.appendChild(document.createTextNode(btn.label));
        
        group.appendChild(input);
        group.appendChild(label);
    });
    
    return group;
}

// Zeige Tage-Konfiguration an
function zeigeTageKonfiguration() {
    const von = document.getElementById('urlaubVon').value;
    const bis = document.getElementById('urlaubBis').value || von; // Wenn kein "Bis", verwende "Von"
    
    if (!von) {
        zeigeToast('Bitte mindestens das "Von"-Datum auswählen', 'warning');
        return;
    }
    
    const vonDate = new Date(von + 'T12:00:00');
    const bisDate = new Date(bis + 'T12:00:00');
    
    if (vonDate > bisDate) {
        zeigeToast('Start-Datum muss vor End-Datum liegen', 'warning');
        return;
    }
    
    // Sammle alle Arbeitstage in der Periode
    const arbeitstage = [];
    const current = new Date(vonDate);
    
    while (current <= bisDate) {
        const wochentag = current.getDay();
        const istWochenende = (wochentag === 0 || wochentag === 6);
        const istFeiertag = istDatumFeiertag(current);
        
        // Nur Werktage (Mo-Fr) die keine Feiertage sind
        if (!istWochenende && !istFeiertag) {
            arbeitstage.push(new Date(current));
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    if (arbeitstage.length === 0) {
        zeigeToast('Keine Arbeitstage in der ausgewählten Periode', 'warning');
        return;
    }
    
    // Erstelle die Tage-Liste
    const container = document.getElementById('tageKonfigurationListe');
    container.innerHTML = '';
    
    const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    
    arbeitstage.forEach((datum, index) => {
        const datumString = formatiereDatumLokal(datum);
        const wochentag = wochentage[datum.getDay()];
        const tagNummer = datum.getDate();
        const monat = datum.toLocaleDateString('de-DE', { month: 'long' });
        
        // Erstelle Hauptcontainer mit DOM-API (XSS-sicher)
        const tagDiv = document.createElement('div');
        tagDiv.className = 'card mb-2';
        tagDiv.dataset.datum = datumString;
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body py-2';
        
        const row = document.createElement('div');
        row.className = 'row align-items-center';
        
        // Spalte 1: Datum-Anzeige (textContent ist XSS-sicher)
        const col1 = document.createElement('div');
        col1.className = 'col-md-4';
        const strong = document.createElement('strong');
        strong.textContent = `${wochentag}, ${tagNummer}. ${monat}`;
        col1.appendChild(strong);
        
        // Spalte 2: Typ-Auswahl (Urlaub/Krank)
        const col2 = document.createElement('div');
        col2.className = 'col-md-4';
        const btnGroup1 = createRadioButtonGroup(
            `typ_${index}`,
            [
                { id: `urlaub_${index}`, value: 'urlaub', label: 'Urlaub', icon: 'bi-calendar-check', color: 'success', checked: true },
                { id: `krank_${index}`, value: 'krank', label: 'Krank', icon: 'bi-thermometer-half', color: 'danger' }
            ]
        );
        col2.appendChild(btnGroup1);
        
        // Spalte 3: Dauer-Auswahl (Ganz/Halb)
        const col3 = document.createElement('div');
        col3.className = 'col-md-4';
        const btnGroup2 = createRadioButtonGroup(
            `dauer_${index}`,
            [
                { id: `ganz_${index}`, value: '1.0', label: 'Ganzer Tag', color: 'primary', checked: true },
                { id: `halb_${index}`, value: '0.5', label: 'Halber Tag', color: 'primary' }
            ]
        );
        col3.appendChild(btnGroup2);
        
        // Zusammenbauen der DOM-Struktur
        row.appendChild(col1);
        row.appendChild(col2);
        row.appendChild(col3);
        cardBody.appendChild(row);
        tagDiv.appendChild(cardBody);
        container.appendChild(tagDiv);
    });
    
    // Zeige Konfiguration, verstecke Datumseingabe
    document.getElementById('tageKonfigurationContainer').style.display = 'block';
    document.querySelector('.row.mb-3').style.display = 'none';
}

// Verstecke Tage-Konfiguration
function versteckeTageKonfiguration() {
    document.getElementById('tageKonfigurationContainer').style.display = 'none';
    document.querySelector('.row.mb-3').style.display = 'flex';
    document.getElementById('tageKonfigurationListe').innerHTML = '';
}

// Füge konfigurierte Tage hinzu
function fuegeKonfigurierteTageHinzu() {
    const container = document.getElementById('tageKonfigurationListe');
    const tagDivs = container.querySelectorAll('.card');
    
    if (tagDivs.length === 0) {
        zeigeToast('Keine Tage konfiguriert', 'warning');
        return;
    }
    
    let urlaubstageGesamt = 0;
    let kranktageGesamt = 0;
    
    // Verarbeite jeden Tag
    tagDivs.forEach((tagDiv, index) => {
        const datumString = tagDiv.dataset.datum;
        const datum = new Date(datumString + 'T12:00:00');
        
        // Hole Typ (Urlaub/Krank)
        const typUrlaub = document.getElementById(`urlaub_${index}`);
        const istKrank = !typUrlaub.checked;
        
        // Hole Dauer (Ganz/Halb)
        const dauerGanz = document.getElementById(`ganz_${index}`);
        const urlaubstagWert = dauerGanz.checked ? 1.0 : 0.5;
        
        // Speichere den Tag
        aktualisiereUrlaubstageProTag(datum, urlaubstagWert, istKrank);
        
        if (istKrank) {
            kranktageGesamt += urlaubstagWert;
        } else {
            urlaubstageGesamt += urlaubstagWert;
        }
    });
    
    // Eingabefelder leeren
    document.getElementById('urlaubVon').value = '';
    document.getElementById('urlaubBis').value = '';
    
    // Verstecke Konfiguration
    versteckeTageKonfiguration();
    
    // Aktualisiere Listen
    aktualisiereUrlaubsliste();
    aktualisiereUrlaubskalenderBadge();
    
    // Monat neu laden
    ladeMonat(aktuellesJahr, aktuellerMonat);
    
    // Nachricht erstellen
    let nachricht = '';
    if (urlaubstageGesamt > 0 && kranktageGesamt > 0) {
        nachricht = `${urlaubstageGesamt} Urlaubstag(e) und ${kranktageGesamt} Kranktag(e) hinzugefügt`;
    } else if (urlaubstageGesamt > 0) {
        nachricht = `${urlaubstageGesamt} Urlaubstag(e) hinzugefügt`;
    } else if (kranktageGesamt > 0) {
        nachricht = `${kranktageGesamt} Kranktag(e) hinzugefügt`;
    }
    
    zeigeToast(nachricht, 'success');
}

// Füge einen einzelnen Urlaubstag automatisch hinzu (wenn manuell "Urlaub" eingetragen wird)
function fuegeUrlaubstagAutomatischHinzu(tag) {
    // Aktualisiere nur die visuelle Markierung
    // Desktop: Zeile
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    if (tr) {
        tr.classList.add('urlaub-row');
    }
    
    // Mobile: Card
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    if (card) {
        card.classList.add('urlaub-card');
        const header = card.querySelector('.day-card-header');
        if (header) {
            header.classList.add('urlaub-header');
        }
    }
}

function entferneUrlaubstagAutomatisch(tag) {
    // Erstelle Datum für diesen Tag
    const datum = erstelleDatumFuerTag(tag);
    const datumString = formatiereDatumLokal(datum);
    
    // Prüfe ob es ein Kranktag war
    const warKrank = istKranktag(datum);
    const typ = warKrank ? 'Kranktag' : 'Urlaubstag';
    
    // Entferne Urlaubstag aus Kalender (setzt urlaub_tage_* und krank_* auf 0/false)
    aktualisiereUrlaubstageProTag(datum, 0);
    
    // Lösche Urlaubstag und Krank-Status
    loescheUrlaubUndKrank(datum);
    
    // Lösche den kompletten Tag aus zeiterfassungDaten
    const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
    if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
        delete zeiterfassungDaten[monatsKey].tage[tag];
    }
    
    // Speichere Änderungen
    speichereDatenInLocalStorage();
    
    aktualisiereUrlaubsliste();
    aktualisiereUrlaubskalenderBadge();
    
    // Lade Monat neu, um die Anzeige unter dem Datum zu aktualisieren
    ladeMonat(aktuellesJahr, aktuellerMonat);
    
    zeigeToast(`${typ} entfernt`, 'info');
}

// Lösche Urlaubseinträge für einen Datumsbereich
function loescheUrlaubseintraege(von, bis) {
    const vonDate = new Date(von + 'T12:00:00');
    const bisDate = new Date(bis + 'T12:00:00');
    const current = new Date(vonDate);
    
    // Prüfe den Typ des ersten Tags (alle Tage in einer Periode haben den gleichen Typ)
    const warKrank = istKranktag(vonDate);
    let tageGeloescht = 0;
    
    // Lösche alle Urlaubstage in diesem Bereich
    while (current <= bisDate) {
        const datumString = formatiereDatumLokal(current);
        const key = `urlaub_tage_${datumString}`;
        const krankKey = `krank_${datumString}`;
        
        // Zähle nur wenn der Tag tatsächlich existierte
        if (localStorage.getItem(key)) {
            tageGeloescht++;
        }
        
        // Lösche Urlaubstag und Krank-Status
        loescheUrlaubUndKrank(current);
        
        // Lösche auch gespeicherte Zeitdaten für diesen Tag
        const tag = current.getDate();
        const monat = current.getMonth();
        const jahr = current.getFullYear();
        const monatsKey = getMonatsKey(jahr, monat);
        
        // Lösche den kompletten Tag aus zeiterfassungDaten
        if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
            delete zeiterfassungDaten[monatsKey].tage[tag];
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    // Speichere Änderungen SOFORT in LocalStorage
    speichereDatenInLocalStorage();
    
    // WICHTIG: Lade Daten neu aus LocalStorage, um sicherzustellen dass zeiterfassungDaten synchron ist
    ladeDatenAusLocalStorage();
    
    // Aktualisiere Anzeige
    aktualisiereUrlaubsliste();
    aktualisiereUrlaubskalenderBadge();
    
    // Erstelle passende Nachricht
    const typ = warKrank ? 'Kranktag' : 'Urlaubstag';
    const typPlural = warKrank ? 'Kranktage' : 'Urlaubstage';
    const nachricht = tageGeloescht === 1 ? `${typ} gelöscht` : `${typPlural} gelöscht`;
    zeigeToast(nachricht, 'info');
    
    // Aktualisiere Monatsansicht - dies lädt die Daten neu und zeigt die aktualisierten Werte
    ladeMonat(aktuellesJahr, aktuellerMonat);
}


// Event Listener für Urlaubskalender initialisieren
function initUrlaubskalenderEvents() {
    // Event-Listener für alte Tage-Konfiguration entfernt (vereinfachtes System)
    // Die Funktionen zeigeTageKonfiguration, fuegeKonfigurierteTageHinzu und
    // versteckeTageKonfiguration werden nicht mehr verwendet
    
    // Event-Listener für "Krank" und "Halber Tag" Checkboxen wurden entfernt
    // Beide Optionen können jetzt unabhängig voneinander verwendet werden
    // "Halber Tag" funktioniert für Urlaub UND Kranktage
}
// Event Listener für Optimierungs-Buttons
function initUrlaubsOptimierungEvents() {
    const btnOptimieren = document.getElementById('btnUrlaubOptimieren');
    if (btnOptimieren) {
        btnOptimieren.addEventListener('click', optimiereUrlaub);
    }
    
    const btnOptimierenMobile = document.getElementById('btnUrlaubOptimierenMobile');
    if (btnOptimierenMobile) {
        btnOptimierenMobile.addEventListener('click', optimiereUrlaub);
    }
}

// Urlaubsoptimierung
async function optimiereUrlaub() {
    const jahr = parseInt(document.getElementById('jahrSelect').value);
    
    // Lade Feiertage für das Jahr
    let feiertage = new Set();
    if (FEATURES.FEIERTAGE_LADEN) {
        try {
            feiertage = await ladeFeiertage(jahr);
        } catch (error) {
            zeigeToast('Feiertage konnten nicht geladen werden', 'warning');
            return;
        }
    }
    
    if (feiertage.size === 0) {
        zeigeToast('Keine Feiertage verfügbar für Optimierung', 'warning');
        return;
    }
    
    // Finde alle Brückentage und optimale Perioden
    const optimierungen = findeOptimaleUrlaubsperioden(jahr, feiertage);
    
    // Zeige Ergebnisse im Modal
    zeigeOptimierungsErgebnisse(jahr, optimierungen);
}

// Hilfsfunktion: Prüfe ob ein Datum ein Feiertag ist
function istDatumFeiertag(datum, feiertage = null) {
    const datumString = formatiereDatumLokal(datum);
    
    // Wenn kein feiertage-Parameter übergeben wurde, verwende den Cache
    if (!feiertage) {
        const jahr = datum.getFullYear();
        const cacheKey = `${jahr}-${bundesland}`;
        
        if (feiertageCache[cacheKey]) {
            return feiertageCache[cacheKey].has(datumString);
        }
        return false; // Kein Cache vorhanden
    }
    
    return feiertage.has(datumString);
}

// Finde optimale Urlaubsperioden basierend auf Feiertagen
function findeOptimaleUrlaubsperioden(jahr, feiertage) {
    const perioden = [];
    
    // Konvertiere Set zu Array für einfachere Verarbeitung
    const feiertagsArray = Array.from(feiertage.entries()).map(([datum, name]) => ({
        datum: new Date(datum),
        name: name,
        datumString: datum
    })).sort((a, b) => a.datum - b.datum);
    
    // Analysiere jeden Feiertag
    feiertagsArray.forEach(feiertag => {
        const datum = feiertag.datum;
        const wochentag = datum.getDay();
        
        // Überspringe Wochenend-Feiertage
        if (wochentag === 0 || wochentag === 6) {
            return;
        }
        
        // Brückentag-Szenarien
        let vorschlag = null;
        
        // Montag oder Freitag = 4 Tage frei mit 1 Urlaubstag
        if (wochentag === 1) { // Montag
            const freitagDavor = addDays(datum, -3);
            // Prüfe ob Freitag davor auch ein Feiertag ist
            if (!istDatumFeiertag(freitagDavor, feiertage)) {
                vorschlag = {
                    typ: 'Langes Wochenende',
                    feiertag: feiertag.name,
                    feiertagDatum: feiertag.datumString,
                    urlaubstage: 1,
                    freieTage: 4,
                    von: formatiereDatumLokal(freitagDavor),
                    bis: formatiereDatumLokal(freitagDavor),
                    beschreibung: `1 Urlaubstag am Freitag → 4 Tage frei (Fr-Mo)`
                };
            }
        } else if (wochentag === 5) { // Freitag
            const montagDanach = addDays(datum, 3);
            // Prüfe ob Montag danach auch ein Feiertag ist
            if (!istDatumFeiertag(montagDanach, feiertage)) {
                vorschlag = {
                    typ: 'Langes Wochenende',
                    feiertag: feiertag.name,
                    feiertagDatum: feiertag.datumString,
                    urlaubstage: 1,
                    freieTage: 4,
                    von: formatiereDatumLokal(montagDanach),
                    bis: formatiereDatumLokal(montagDanach),
                    beschreibung: `1 Urlaubstag am Montag → 4 Tage frei (Fr-Mo)`
                };
            }
        }
        // Dienstag = 4 Tage frei mit 1 Urlaubstag
        else if (wochentag === 2) { // Dienstag
            const montagDavor = addDays(datum, -1);
            // Prüfe ob Montag davor auch ein Feiertag ist
            if (!istDatumFeiertag(montagDavor, feiertage)) {
                vorschlag = {
                    typ: 'Brückentag',
                    feiertag: feiertag.name,
                    feiertagDatum: feiertag.datumString,
                    urlaubstage: 1,
                    freieTage: 4,
                    von: formatiereDatumLokal(montagDavor),
                    bis: formatiereDatumLokal(montagDavor),
                    beschreibung: `1 Urlaubstag am Montag → 4 Tage frei (Sa-Di)`
                };
            }
        }
        // Donnerstag = 4 Tage frei mit 1 Urlaubstag
        else if (wochentag === 4) { // Donnerstag
            const freitagDanach = addDays(datum, 1);
            // Prüfe ob Freitag danach auch ein Feiertag ist
            if (!istDatumFeiertag(freitagDanach, feiertage)) {
                vorschlag = {
                    typ: 'Brückentag',
                    feiertag: feiertag.name,
                    feiertagDatum: feiertag.datumString,
                    urlaubstage: 1,
                    freieTage: 4,
                    von: formatiereDatumLokal(freitagDanach),
                    bis: formatiereDatumLokal(freitagDanach),
                    beschreibung: `1 Urlaubstag am Freitag → 4 Tage frei (Do-So)`
                };
            }
        }
        // Mittwoch = 5 Tage frei mit 2 Urlaubstagen
        else if (wochentag === 3) { // Mittwoch
            const dienstagDavor = addDays(datum, -1);
            const donnerstagDanach = addDays(datum, 1);
            // Prüfe ob Dienstag oder Donnerstag auch Feiertage sind
            if (!istDatumFeiertag(dienstagDavor, feiertage) && !istDatumFeiertag(donnerstagDanach, feiertage)) {
                vorschlag = {
                    typ: 'Brückentage',
                    feiertag: feiertag.name,
                    feiertagDatum: feiertag.datumString,
                    urlaubstage: 2,
                    freieTage: 5,
                    von: formatiereDatumLokal(dienstagDavor),
                    bis: formatiereDatumLokal(donnerstagDanach),
                    beschreibung: `2 Urlaubstage (Di+Do) → 5 Tage frei (Sa-Mi)`
                };
            }
        }
        
        if (vorschlag) {
            perioden.push(vorschlag);
        }
    });
    
    // Finde aufeinanderfolgende Feiertage für längere Perioden
    for (let i = 0; i < feiertagsArray.length - 1; i++) {
        const feiertag1 = feiertagsArray[i];
        const feiertag2 = feiertagsArray[i + 1];
        
        const diff = Math.floor((feiertag2.datum - feiertag1.datum) / (1000 * 60 * 60 * 24));
        
        // Wenn Feiertage 2-5 Tage auseinander liegen
        if (diff >= 2 && diff <= 5) {
            const urlaubstage = berechneBenoetigteUrlaubstage(feiertag1.datum, feiertag2.datum);
            const freieTage = berechneFreieTage(feiertag1.datum, feiertag2.datum);
            
            if (urlaubstage > 0 && freieTage > urlaubstage + 2) {
                perioden.push({
                    typ: 'Feiertags-Kombination',
                    feiertag: `${feiertag1.name} + ${feiertag2.name}`,
                    feiertagDatum: feiertag1.datumString,
                    urlaubstage: urlaubstage,
                    freieTage: freieTage,
                    von: formatiereDatumLokal(feiertag1.datum),
                    bis: formatiereDatumLokal(feiertag2.datum),
                    beschreibung: `${urlaubstage} Urlaubstage → ${freieTage} Tage frei`
                });
            }
        }
    }
    
    // Sortiere nach Effizienz (freie Tage pro Urlaubstag)
    perioden.sort((a, b) => {
        const effA = a.freieTage / a.urlaubstage;
        const effB = b.freieTage / b.urlaubstage;
        return effB - effA;
    });
    
    return perioden;
}

// Berechne benötigte Urlaubstage zwischen zwei Daten
function berechneBenoetigteUrlaubstage(von, bis) {
    let tage = 0;
    const current = new Date(von);
    current.setDate(current.getDate() + 1); // Start am Tag nach dem ersten Feiertag
    
    const bisDate = new Date(bis);
    bisDate.setDate(bisDate.getDate() - 1); // Ende am Tag vor dem zweiten Feiertag
    
    while (current <= bisDate) {
        const wochentag = current.getDay();
        if (wochentag !== 0 && wochentag !== 6) {
            tage++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return tage;
}

// Berechne gesamte freie Tage zwischen zwei Daten
function berechneFreieTage(von, bis) {
    const diff = Math.floor((bis - von) / (1000 * 60 * 60 * 24));
    return diff + 1;
}

// Hilfsfunktion: Tage zu Datum addieren
function addDays(date, days) {
    // Validierung: Prüfe auf gültiges Datum und Anzahl Tage
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        throw new Error('Ungültiges Datum');
    }
    if (typeof days !== 'number' || isNaN(days)) {
        throw new Error('Ungültige Anzahl Tage');
    }
    
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Erstellt ein DOM-Element für eine Urlaubsperiode (XSS-sicher)
 * @param {Object} periode - Die Periodendaten
 * @param {number} index - Der Index der Periode
 * @returns {HTMLElement} Das erstellte DOM-Element
 */
function erstellePeriodeElement(periode, index) {
    const effizienz = (periode.freieTage / periode.urlaubstage).toFixed(1);
    
    // Hauptcontainer
    const item = document.createElement('div');
    item.className = 'list-group-item';
    
    // Header-Bereich mit Titel und Effizienz
    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-start mb-2';
    
    // Linke Seite: Titel, Feiertag, Beschreibung
    const leftDiv = document.createElement('div');
    
    const h6 = document.createElement('h6');
    h6.className = 'mb-1';
    
    const indexBadge = document.createElement('span');
    indexBadge.className = 'badge bg-info';
    indexBadge.textContent = `#${index + 1}`;
    h6.appendChild(indexBadge);
    h6.appendChild(document.createTextNode(' ' + periode.typ));
    
    const feiertagP = document.createElement('p');
    feiertagP.className = 'mb-1';
    const feiertagStrong = document.createElement('strong');
    feiertagStrong.textContent = periode.feiertag;
    feiertagP.appendChild(feiertagStrong);
    
    const beschreibungP = document.createElement('p');
    beschreibungP.className = 'mb-1 text-muted small';
    beschreibungP.textContent = periode.beschreibung;
    
    leftDiv.appendChild(h6);
    leftDiv.appendChild(feiertagP);
    leftDiv.appendChild(beschreibungP);
    
    // Rechte Seite: Effizienz-Badge
    const rightDiv = document.createElement('div');
    rightDiv.className = 'text-end';
    const effBadge = document.createElement('span');
    effBadge.className = 'badge bg-success';
    effBadge.style.fontSize = '1rem';
    effBadge.textContent = `${effizienz}x Effizienz`;
    rightDiv.appendChild(effBadge);
    
    header.appendChild(leftDiv);
    header.appendChild(rightDiv);
    
    // Footer-Bereich mit Badges und Button
    const footer = document.createElement('div');
    footer.className = 'd-flex justify-content-between align-items-center';
    
    // Badges für Urlaubstage und freie Tage
    const badgesDiv = document.createElement('div');
    
    const urlaubBadge = document.createElement('span');
    urlaubBadge.className = 'badge bg-primary';
    urlaubBadge.textContent = `${periode.urlaubstage} Urlaubstag(e)`;
    
    const freieBadge = document.createElement('span');
    freieBadge.className = 'badge bg-success';
    freieBadge.textContent = `${periode.freieTage} freie Tage`;
    
    badgesDiv.appendChild(urlaubBadge);
    badgesDiv.appendChild(document.createTextNode(' '));
    badgesDiv.appendChild(freieBadge);
    
    // Übernehmen-Button mit sicherem Event-Listener
    const button = document.createElement('button');
    button.className = 'btn btn-sm btn-outline-success';
    button.type = 'button';
    
    const icon = document.createElement('i');
    icon.className = 'bi bi-plus-circle';
    button.appendChild(icon);
    button.appendChild(document.createTextNode(' Übernehmen'));
    
    // Sicherer Event-Listener statt onclick-Attribut
    button.addEventListener('click', () => {
        uebernehmePeriode(periode.von, periode.bis);
    });
    
    footer.appendChild(badgesDiv);
    footer.appendChild(button);
    
    // Zusammenbauen
    item.appendChild(header);
    item.appendChild(footer);
    
    return item;
}

// Zeige Optimierungsergebnisse im Modal (XSS-sicher refactored)
function zeigeOptimierungsErgebnisse(jahr, perioden) {
    document.getElementById('optimierungJahr').textContent = jahr;
    const container = document.getElementById('optimierungErgebnisse');
    
    // Container leeren
    container.innerHTML = '';
    
    if (perioden.length === 0) {
        // Leere Nachricht erstellen
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning';
        
        const icon = document.createElement('i');
        icon.className = 'bi bi-exclamation-triangle';
        alert.appendChild(icon);
        alert.appendChild(document.createTextNode(' Keine optimalen Urlaubsperioden gefunden.'));
        
        container.appendChild(alert);
    } else {
        // Liste erstellen
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';
        
        perioden.forEach((periode, index) => {
            const item = erstellePeriodeElement(periode, index);
            listGroup.appendChild(item);
        });
        
        container.appendChild(listGroup);
    }
    
    // Zeige Modal
    zeigeModal('urlaubOptimierungModal');
}

// Übernehme Periode in Urlaubskalender
function uebernehmePeriode(von, bis) {
    // Schließe Modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('urlaubOptimierungModal'));
    modal.hide();
    
    // Füge Urlaub hinzu
    const vonDate = new Date(von);
    const bisDate = new Date(bis);
    
    fuegeUrlaubHinzu(von, bis, false);
}


// ===================================
// Initialisierung
// ===================================
document.addEventListener('DOMContentLoaded', async function() {
    // Jahr-Select füllen
    initJahrSelect();
    
    // Aktuellen Monat setzen
    document.getElementById('jahrSelect').value = aktuellesJahr;
    document.getElementById('monatSelect').value = aktuellerMonat;
    
    // Daten aus LocalStorage laden
    ladeDatenAusLocalStorage();
    
    // WICHTIG: Wochenstunden ZUERST laden, bevor Stammdaten geladen werden
    // Dies stellt sicher, dass wochenstunden gesetzt ist, bevor der Monat geladen wird
    const gespeicherteWochenstunden = localStorage.getItem('wochenstunden');
    if (gespeicherteWochenstunden) {
        const parts = gespeicherteWochenstunden.split(':');
        const stunden = parseInt(parts[0]);
        const minuten = parseInt(parts[1]);
        wochenstunden = stunden + (minuten / 60);
    }
    
    // Stammdaten laden (lädt auch Wochenstunden, aber wochenstunden ist bereits gesetzt)
    ladeStammdaten();
    
    // Urlaubstage laden
    ladeUrlaubstage();
    
    // Zeige alle urlaub_tage_* Einträge für Debugging
    zeigeAlleUrlaubstageImLocalStorage();
    
    // Bereinige verwaiste krank_* Einträge
    bereinigeVerwaisteKranktage();
    
    // Bereinige Dummy-Einträge aus vorherigem Monat
    bereinigeDummyEintraege();
    
    // Urlaubskalender-Badge initialisieren
    aktualisiereUrlaubskalenderBadge();
    
    // Event Listener initialisieren
    initEventListeners();
    
    // Resize-Listener für Ansichtswechsel (Desktop <-> Mobile)
    let resizeTimer;
    let letzteBreite = window.innerWidth;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const neueBreite = window.innerWidth;
            const warMobile = letzteBreite < MOBILE_BREAKPOINT;
            const istJetztMobile = neueBreite < MOBILE_BREAKPOINT;
            
            // Nur wenn zwischen Desktop und Mobile gewechselt wurde
            if (warMobile !== istJetztMobile) {
                berechneAlleZeilen();
            }
            
            letzteBreite = neueBreite;
        }, 250); // 250ms Debounce
    });
    
    // Urlaubskalender Events initialisieren
    initUrlaubskalenderEvents();
    
    // Urlaubsoptimierung Events initialisieren
    initUrlaubsOptimierungEvents();
    
    // Monat laden
    await ladeMonat(aktuellesJahr, aktuellerMonat);
});

// ===================================
// Jahr-Select initialisieren
// ===================================
function initJahrSelect() {
    const jahrSelect = document.getElementById('jahrSelect');
    const startJahr = 2020;
    const endJahr = aktuellesJahr + 5;
    
    for (let jahr = startJahr; jahr <= endJahr; jahr++) {
        const option = document.createElement('option');
        option.value = jahr;
        option.textContent = jahr;
        if (jahr === aktuellesJahr) {
            option.selected = true;
        }
        jahrSelect.appendChild(option);
    }
}

// ===================================
// Event Listeners
// ===================================
function initEventListeners() {
    // Automatisches Laden bei Monats- oder Jahresänderung
    document.getElementById('jahrSelect').addEventListener('change', async function() {
        await pruefeUndLadeMonat();
    });
    
    document.getElementById('monatSelect').addEventListener('change', async function() {
        await pruefeUndLadeMonat();
    });
    
    // Button "Monat neu laden"
    document.getElementById('btnMonatNeuLaden').addEventListener('click', async function() {
        await ladeMonat(aktuellesJahr, aktuellerMonat);
        zeigeToast('Monat neu geladen', 'success');
    });
    
    // Stammdaten speichern bei Änderung
    document.getElementById('mitarbeiterName').addEventListener('change', speichereStammdaten);
    document.getElementById('beschaeftigungsgrad').addEventListener('change', function() {
        speichereStammdaten();
        // Stunden pro Tag Anzeige aktualisieren
        aktualisiereStundenProTagAnzeige();
        berechneSollStundenAutomatisch();
    });
    
    // Live-Update der Stunden pro Tag Anzeige bei Eingabe im Beschäftigungsgrad-Feld
    document.getElementById('beschaeftigungsgrad').addEventListener('input', function() {
        aktualisiereStundenProTagAnzeige();
    });
    document.getElementById('urlaubstageProJahr').addEventListener('change', function() {
        speichereStammdaten();
        aktualisiereUrlaubskalenderBadge();
    });
    
    // Urlaubskalender Buttons
    document.getElementById('btnUrlaubskalender')?.addEventListener('click', function() {
        zeigeModal('urlaubskalenderModal');
    });
    
    document.getElementById('btnMobileUrlaubskalender')?.addEventListener('click', function() {
        zeigeModal('urlaubskalenderModal');
        schliesseMobileMenu();
    });
    
    // Bundesland-Auswahl (Desktop und Mobile)
    document.getElementById('bundesland').addEventListener('change', function() {
        speichereBundesland();
    });
    document.getElementById('bundeslandMobile').addEventListener('change', function() {
        speichereBundesland();
    });
    
    // Mobile Schnellzugriff Buttons (oben)
    document.getElementById('btnMobileDruckenTop').addEventListener('click', function() {
        drucken();
    });
    
    document.getElementById('btnMobileBackupTop').addEventListener('click', function() {
        erstelleBackup();
    });
    
    // Mobile Menü Buttons
    document.getElementById('btnMobileSpeichern').addEventListener('click', function() {
        speichereAlleZeilen();
        schliesseMobileMenu();
    });
    
    document.getElementById('btnMobileExportCSV').addEventListener('click', function() {
        exportiereCSV();
        schliesseMobileMenu();
    });
    
    document.getElementById('btnMobileImportCSV').addEventListener('click', function() {
        document.getElementById('csvFileInput').click();
        schliesseMobileMenu();
    });
    
    document.getElementById('btnMobileBackup').addEventListener('click', function() {
        erstelleBackup();
        schliesseMobileMenu();
    });
    
    document.getElementById('btnMobileRestore').addEventListener('click', function() {
        document.getElementById('backupFileInput').click();
        schliesseMobileMenu();
    });
    
    // Wochenstunden speichern (Mobile)
    document.getElementById('btnWochenstundenSpeichernMobile').addEventListener('click', function() {
        speichereWochenstunden();
    });
    
    // Live-Update der Stunden pro Tag Anzeige bei Eingabe (Mobile)
    document.getElementById('wochenstundenMobile').addEventListener('input', function() {
        const wert = this.value;
        const pattern = /^\d+:\d{2}$/;
        if (pattern.test(wert)) {
            const parts = wert.split(':');
            const stunden = parseInt(parts[0]);
            const minuten = parseInt(parts[1]);
            if (!isNaN(stunden) && !isNaN(minuten) && minuten < 60) {
                wochenstunden = stunden + (minuten / 60);
                aktualisiereStundenProTagAnzeige();
            }
        }
    });
    
    document.getElementById('btnMobileDrucken').addEventListener('click', function() {
        drucken();
        schliesseMobileMenu();
    });
    
    // Übertrag Vormonat speichern
    document.getElementById('btnUebertragSpeichern').addEventListener('click', function() {
        speichereUebertragVormonat();
    });
    
    // SOLL-Stunden speichern
    document.getElementById('btnSollSpeichern').addEventListener('click', function() {
        speichereSollStunden();
    });
    
    // Alle speichern
    document.getElementById('btnAlleSpeichern').addEventListener('click', function() {
        speichereAlleZeilen();
    });
    
    // CSV Export
    document.getElementById('btnExportCSV').addEventListener('click', function() {
        exportiereCSV();
    });
    
    // CSV Import
    document.getElementById('btnImportCSV').addEventListener('click', function() {
        document.getElementById('csvFileInput').click();
    });
    
    document.getElementById('csvFileInput').addEventListener('change', importiereCSV);
    
    // Backup/Restore
    document.getElementById('btnBackup').addEventListener('click', function() {
        erstelleBackup();
    });
    
    document.getElementById('btnRestore').addEventListener('click', function() {
        document.getElementById('backupFileInput').click();
    });
    
    // Wochenstunden speichern (Desktop)
    document.getElementById('btnWochenstundenSpeichern').addEventListener('click', function() {
        speichereWochenstunden();
    });
    
    // Live-Update der Stunden pro Tag Anzeige bei Eingabe (Desktop)
    document.getElementById('wochenstunden').addEventListener('input', function() {
        const wert = this.value;
        const pattern = /^\d+:\d{2}$/;
        if (pattern.test(wert)) {
            const parts = wert.split(':');
            const stunden = parseInt(parts[0]);
            const minuten = parseInt(parts[1]);
            if (!isNaN(stunden) && !isNaN(minuten) && minuten < 60) {
                wochenstunden = stunden + (minuten / 60);
                aktualisiereStundenProTagAnzeige();
            }
        }
    });
    
    document.getElementById('backupFileInput').addEventListener('change', function() {
        stelleBackupWiederHer();
    });
    
    // Drucken
    document.getElementById('btnDrucken').addEventListener('click', drucken);
    
    // Monat zurücksetzen
    document.getElementById('btnMonatZuruecksetzen').addEventListener('click', function() {
        if (confirm('Möchten Sie wirklich alle Daten für diesen Monat löschen?')) {
            setzeMonatZurueck();
        }
    });
    
    // Auto-Berechnung bei Eingabe - VEREINFACHT
    document.addEventListener('input', function(e) {
        // Prüfe ob das Element ein Input mit data-field ist
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-field')) {
            const field = e.target.dataset.field;
            const row = e.target.closest('tr') || e.target.closest('.day-card');
            
            if (row && row.dataset && row.dataset.tag) {
                const tag = parseInt(row.dataset.tag);
                
                // Markiere als ungespeichert
                markiereAlsUngespeichert(tag);
                
                // Nur neu berechnen wenn NICHT das Stunden-Feld geändert wurde
                if (field !== FIELDS.STUNDEN) {
                    manuellEditierteStunden.delete(tag);
                    berechneZeile(tag, false);
                    berechneAlleZeilen();
                } else {
                    manuellEditierteStunden.add(tag);
                    
                    // Prüfe ob es ein Urlaubs-/Kranktag ist und passe die Tage an
                    const von1Input = row.querySelector('[data-field="von1"]');
                    if (von1Input) {
                        const von1Value = von1Input.value.trim();
                        if (von1Value === 'Urlaub' || von1Value === 'Krank') {
                            const stundenInput = row.querySelector('[data-field="stunden"]');
                            if (stundenInput) {
                                const stundenWert = parseStundenZuDezimal(stundenInput.value);
                                const tagesStunden = berechneTaeglicheUrlaubsstunden();
                                const datum = erstelleDatumFuerTag(tag);
                                const istKrank = von1Value === 'Krank';
                                
                                // Wenn Stunden ungefähr einem halben Tag entsprechen (±0.5 Stunden Toleranz)
                                if (Math.abs(stundenWert - (tagesStunden / 2)) < 0.5) {
                                    aktualisiereUrlaubstageProTag(datum, 0.5, istKrank);
                                    aktualisiereUrlaubsliste();
                                    aktualisiereUrlaubskalenderBadge();
                                } else if (Math.abs(stundenWert - tagesStunden) < 0.5) {
                                    // Ganzer Tag
                                    aktualisiereUrlaubstageProTag(datum, 1.0, istKrank);
                                    aktualisiereUrlaubsliste();
                                    aktualisiereUrlaubskalenderBadge();
                                }
                            }
                        }
                    }
                    
                    berechneAlleZeilen(true);
                }
            }
        }
    }, true); // useCapture = true für bessere Event-Erfassung
    
    // Zeit-Normalisierung bei Blur (wenn Benutzer Feld verlässt)
/**
 * Entfernt die Urlaubstag-Markierung von einer Zeile/Card und setzt alle Felder zurück
 * @param {HTMLElement} row - Die Zeile (TR) oder Card (DIV) Element
 * @param {boolean} loescheVon1 - Ob das Von1-Feld auch geleert werden soll (nur bei Stunden-Feld-Änderung)
 */
function entferneUrlaubstagMarkierung(row, loescheVon1 = false) {
    if (!row) return;
    
    if (row.tagName === 'TR') {
        // Desktop Tabelle
        row.classList.remove('urlaub-row');
        
        // Setze alle Felder wie bei normalem Arbeitstag zurück (leer)
        const von1Input = row.querySelector(`[data-field="${FIELDS.VON1}"]`);
        const bis1Input = row.querySelector(`[data-field="${FIELDS.BIS1}"]`);
        const von2Input = row.querySelector(`[data-field="${FIELDS.VON2}"]`);
        const bis2Input = row.querySelector(`[data-field="${FIELDS.BIS2}"]`);
        const vornachInput = row.querySelector(`[data-field="${FIELDS.VORNACH}"]`);
        const stundenInput = row.querySelector(`[data-field="${FIELDS.STUNDEN}"]`);
        
        if (loescheVon1 && von1Input && von1Input.value.trim().toLowerCase() === 'urlaub') {
            von1Input.value = '';
        }
        if (bis1Input) bis1Input.value = '';
        if (von2Input) von2Input.value = '';
        if (bis2Input) bis2Input.value = '';
        if (vornachInput) vornachInput.value = '';
        if (stundenInput) stundenInput.value = '0:00';
    } else {
        // Mobile Card
        row.classList.remove('urlaub-card');
        const header = row.querySelector('.day-card-header');
        if (header) {
            header.classList.remove('urlaub-header');
        }
        
        // Setze alle Felder wie bei normalem Arbeitstag zurück (leer)
        const von1Input = row.querySelector('[data-field="von1"]');
        const bis1Input = row.querySelector('[data-field="bis1"]');
        const von2Input = row.querySelector('[data-field="von2"]');
        const bis2Input = row.querySelector('[data-field="bis2"]');
        const vornachInput = row.querySelector('[data-field="vornach"]');
        const stundenInput = row.querySelector('[data-field="stunden"]');
        
        if (loescheVon1 && von1Input && von1Input.value.trim().toLowerCase() === 'urlaub') {
            von1Input.value = '';
        }
        if (bis1Input) bis1Input.value = '';
        if (von2Input) von2Input.value = '';
        if (bis2Input) bis2Input.value = '';
        if (vornachInput) vornachInput.value = '';
        if (stundenInput) stundenInput.value = '0:00';
    }
}

    document.addEventListener('blur', function(e) {
        // Prüfe ob das Element ein time-input ist
        if (e.target && e.target.classList && e.target.classList.contains('time-input')) {
            const field = e.target.dataset.field;
            const originalValue = e.target.value;
            
            // Prüfe ob "Urlaub" im Von1-Feld eingetragen wurde (VOR der Normalisierung!)
            if (field === 'von1') {
                const row = e.target.closest('tr') || e.target.closest('.day-card');
                if (row && row.dataset && row.dataset.tag) {
                    const tag = parseInt(row.dataset.tag);
                    const datum = erstelleDatumFuerTag(tag);
                    const urlaubCheck = originalValue.trim().toLowerCase();
                    
                    if (urlaubCheck === 'urlaub') {
                        // "Urlaub" eingegeben - füge Urlaubstag hinzu
                        fuegeUrlaubstagAutomatischHinzu(tag);
                        return; // Keine weitere Verarbeitung nötig
                    } else if (urlaubCheck === 'krank') {
                        // "Krank" eingegeben - wird von handleUrlaubKrankChange behandelt
                        return; // Keine weitere Verarbeitung nötig
                    } else if (urlaubCheck === '') {
                        // Feld wurde geleert - prüfe ob Urlaubstag gespeichert ist
                        const vorhandeneUrlaubstage = holeUrlaubstag(datum);
                        if (vorhandeneUrlaubstage > 0) {
                            // Urlaubstag war gespeichert, aber Feld wurde geleert - lösche ihn
                            const datumKey = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
                            // Lösche Urlaubstag und Krank-Status
                            loescheUrlaubUndKrank(datum);
                            
                            // Lösche den kompletten Tag aus zeiterfassungDaten
                            const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
                            if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
                                delete zeiterfassungDaten[monatsKey].tage[tag];
                            }
                            
                            // Speichere Änderungen
                            speichereDatenInLocalStorage();
                            
                            // Aktualisiere Listen
                            aktualisiereUrlaubsliste();
                            aktualisiereUrlaubskalenderBadge();
                            
                            // Entferne Urlaub-Markierung von der Zeile/Card
                            const row = e.target.closest('tr') || e.target.closest('.day-card');
                            entferneUrlaubstagMarkierung(row, false);
                            
                            // Berechne alle Zeilen neu
                            berechneAlleZeilen();
                            
                            // Prüfe ob es ein Kranktag war
                            const warKrank = istKranktag(datum);
                            const typ = warKrank ? 'Kranktag' : 'Urlaubstag';
                            zeigeToast(`${typ} entfernt`, 'info');
                            return; // Keine weitere Verarbeitung nach Löschung
                        }
                    }
                }
            }
            
            // Wenn Stunden-Feld manuell geändert wurde, berechne Urlaubstage
            if (field === FIELDS.STUNDEN) {
                const row = e.target.closest('tr') || e.target.closest('.day-card');
                if (row && row.dataset && row.dataset.tag) {
                    const tag = parseInt(row.dataset.tag);
                    const datum = erstelleDatumFuerTag(tag);
                    
                    // Prüfe ob dieser Tag ein Urlaubstag ODER Kranktag ist
                    const istUrlaub = istUrlaubstag(datum);
                    const istKrank = istKranktag(datum);
                    
                    if (istUrlaub || istKrank) {
                        // Parse Stunden
                        const stundenValue = originalValue.trim();
                        
                        // Wenn Stunden leer oder 0:00, lösche Urlaubs-/Kranktag
                        if (!stundenValue || stundenValue === 'XXXXX' || stundenValue === '0:00' || stundenValue === '0') {
                            // Lösche Urlaubs-/Kranktag aus LocalStorage
                            const datumKey = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
                            // Lösche Urlaubstag und Krank-Status
                            loescheUrlaubUndKrank(datum);

                            // Lösche den kompletten Tag aus zeiterfassungDaten
                            const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
                            if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
                                delete zeiterfassungDaten[monatsKey].tage[tag];
                            }
                            
                            // Speichere Änderungen
                            speichereDatenInLocalStorage();

                            // Aktualisiere Listen
                            aktualisiereUrlaubsliste();
                            aktualisiereUrlaubskalenderBadge();
                            
                            // Entferne Urlaub-Markierung von der Zeile/Card
                            entferneUrlaubstagMarkierung(row, true);
                            
                            const typ = istKrank ? 'Kranktag' : 'Urlaubstag';
                            zeigeToast(`${typ} entfernt`, 'info');
                        } else {
                            // Stunden vorhanden - berechne und speichere Urlaubs-/Kranktage
                            const parts = stundenValue.split(':');
                            if (parts.length === 2) {
                                const stunden = parseInt(parts[0]) || 0;
                                const minuten = parseInt(parts[1]) || 0;
                                const gesamtStunden = stunden + (minuten / 60);
                                
                                // Berechne Urlaubstage basierend auf Stunden (funktioniert auch für Kranktage)
                                const tageWert = berechneUrlaubstageAusStunden(gesamtStunden);
                                
                                // Speichere Tage für diesen Tag (behält Krank-Status bei)
                                aktualisiereUrlaubstageProTag(datum, tageWert, istKrank);
                                
                                // Markiere diesen Tag als manuell editiert, damit die Stunden nicht überschrieben werden
                                manuellEditierteStunden.add(tag);
                                
                                // Zeige Feedback
                                const typ = istKrank ? 'Kranktag' : 'Urlaubstag';
                                if (tageWert === 0.5) {
                                    zeigeToast(`${typ} auf halben Tag aktualisiert`, 'info');
                                } else if (tageWert === 1.0) {
                                    zeigeToast(`${typ} auf ganzen Tag aktualisiert`, 'info');
                                }
                            }
                        }
                    }
                }
            }
            
            // Nur für Zeitfelder normalisieren (nicht für berechnete Felder und nicht für "Urlaub")
            if (field && field !== 'stunden' && field !== 'gesamt' && originalValue.toLowerCase() !== 'urlaub') {
                const normalizedValue = normalisiereZeitEingabe(originalValue);
                
                // Wenn sich der Wert geändert hat, aktualisiere das Feld
                if (originalValue !== normalizedValue) {
                    e.target.value = normalizedValue;
                    
                    // Trigger input event um Neuberechnung anzustoßen
                    const inputEvent = new Event('input', { bubbles: true });
                    e.target.dispatchEvent(inputEvent);
                }
            }
        }
    }, true); // useCapture = true für bessere Event-Erfassung
}

/**
 * Erstellt ein Bestätigungs-Modal (XSS-sicher)
 * @param {string} id - Die ID des Modals
 * @param {string} titel - Der Titel des Modals
 * @param {string} nachricht - Die Nachricht im Modal-Body
 * @param {string} abbruchText - Text für Abbrechen-Button
 * @param {string} bestaetigenText - Text für Bestätigen-Button
 * @param {Function} onBestaetigen - Callback-Funktion bei Bestätigung
 * @returns {Object} Das Modal-Element und die Bootstrap-Modal-Instanz
 */
function erstelleBestaetigenModal(id, titel, nachricht, abbruchText, bestaetigenText, onBestaetigen) {
    // Modal-Container
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = id;
    
    // Modal-Dialog
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog modal-dialog-centered';
    
    // Modal-Content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Modal-Header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header bg-warning';
    
    const modalTitle = document.createElement('h5');
    modalTitle.className = 'modal-title';
    
    const icon = document.createElement('i');
    icon.className = 'bi bi-exclamation-triangle';
    modalTitle.appendChild(icon);
    modalTitle.appendChild(document.createTextNode(' ' + titel));
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal-Body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.textContent = nachricht;
    
    // Modal-Footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const abbruchButton = document.createElement('button');
    abbruchButton.type = 'button';
    abbruchButton.className = 'btn btn-secondary';
    abbruchButton.setAttribute('data-bs-dismiss', 'modal');
    
    const abbruchIcon = document.createElement('i');
    abbruchIcon.className = 'bi bi-x-circle';
    abbruchButton.appendChild(abbruchIcon);
    abbruchButton.appendChild(document.createTextNode(' ' + abbruchText));
    
    const bestaetigenButton = document.createElement('button');
    bestaetigenButton.type = 'button';
    bestaetigenButton.className = 'btn btn-primary';
    bestaetigenButton.id = `btn${id}Bestaetigen`;
    
    const bestaetigenIcon = document.createElement('i');
    bestaetigenIcon.className = 'bi bi-arrow-right-circle';
    bestaetigenButton.appendChild(bestaetigenIcon);
    bestaetigenButton.appendChild(document.createTextNode(' ' + bestaetigenText));
    
    modalFooter.appendChild(abbruchButton);
    modalFooter.appendChild(bestaetigenButton);
    
    // Zusammenbauen
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);
    
    // Event-Listener für Bestätigen-Button
    bestaetigenButton.addEventListener('click', onBestaetigen);
    
    return { modal, bestaetigenButton };
}

// ===================================
// Prüfe ungespeicherte Daten und lade Monat (XSS-sicher refactored)
// ===================================
async function pruefeUndLadeMonat() {
    const jahr = parseInt(document.getElementById('jahrSelect').value);
    const monat = parseInt(document.getElementById('monatSelect').value);
    
    // Prüfe ob es ungespeicherte Änderungen gibt
    if (ungespeicherteTage.size > 0) {
        // Erstelle Bestätigungsdialog mit sicherer DOM-Manipulation
        const nachricht = `Es gibt noch ungespeicherte Änderungen für ${ungespeicherteTage.size} Tag(e).\n\nMöchten Sie den Monat wechseln? Ungespeicherte Änderungen gehen verloren.`;
        
        const { modal } = erstelleBestaetigenModal(
            'warningModal',
            'Ungespeicherte Änderungen',
            nachricht,
            'Abbrechen',
            'Monat wechseln',
            async function() {
                // Ungespeicherte Änderungen verwerfen
                ungespeicherteTage.clear();
                bsModal.hide();
                
                // Modal nach dem Schließen entfernen
                modal.addEventListener('hidden.bs.modal', async function() {
                    modal.remove();
                    // Jetzt Monat laden
                    await ladeMonat(jahr, monat);
                });
            }
        );
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        
        
        // Modal nach Abbrechen entfernen
        modal.addEventListener('hidden.bs.modal', function() {
            // Setze Select-Felder zurück auf aktuellen Monat
            document.getElementById('jahrSelect').value = aktuellesJahr;
            document.getElementById('monatSelect').value = aktuellerMonat;
            modal.remove();
        });
        
        bsModal.show();
    } else {
        // Keine ungespeicherten Änderungen, direkt laden
        await ladeMonat(jahr, monat);
    }
}

// ===================================
// Feiertage laden (nur wenn Feature aktiviert)
// ===================================
async function ladeFeiertage(jahr) {
    if (!FEATURES.FEIERTAGE_LADEN) {
        return new Set(); // Feature deaktiviert
    }
    
    // Cache-Key mit Bundesland
    const cacheKey = `${jahr}-${bundesland}`;
    
    // Prüfe Cache
    if (feiertageCache[cacheKey]) {
        return feiertageCache[cacheKey];
    }
    
    try {
        const response = await fetch(`https://feiertage-api.de/api/?jahr=${jahr}&nur_land=${bundesland}`);
        if (!response.ok) {
            throw new Error('Feiertage konnten nicht geladen werden');
        }
        
        const feiertage = await response.json();
        
        // Konvertiere zu Map von Datumsstrings (YYYY-MM-DD) -> Feiertagsname
        const feiertageDaten = new Map();
        for (const [name, feiertagObj] of Object.entries(feiertage)) {
            // API gibt Objekte zurück: {datum: '2026-01-01', hinweis: ''}
            const datum = feiertagObj.datum;
            feiertageDaten.set(datum, name);
        }
        
        // In Cache speichern
        feiertageCache[cacheKey] = feiertageDaten;
        
        return feiertageDaten;
    } catch (error) {
        console.error('Feiertage-API Fehler:', error);
        zeigeToast('Feiertage konnten nicht geladen werden', 'warning');
        return new Map();
    }
}

// Prüfe ob ein Datum ein Feiertag ist und gib den Namen zurück
function istFeiertag(jahr, monat, tag, feiertage) {
    if (!FEATURES.FEIERTAGE_LADEN) {
        return null; // Feature deaktiviert
    }
    
    // Erstelle Datum-Objekt und verwende istDatumFeiertag()
    const datum = new Date(jahr, monat, tag);
    const datumString = formatiereDatumLokal(datum);
    
    // Gib den Namen des Feiertags zurück (oder null)
    return feiertage.get(datumString) || null;
}

/**
 * Hilfsfunktion: Setzt Urlaubstag-Informationen in einem DOM-Element (TR oder Card)
 * @param {HTMLElement} element - Das DOM-Element (TR oder Card)
 * @param {Date} datum - Das Datum des Urlaubstags
 * @param {number} tag - Der Tag im Monat
 * @param {string} abwesenheitsTyp - "Urlaub" oder "Krank"
 */
function setzeUrlaubstagInElement(element, datum, tag, abwesenheitsTyp) {
    if (!element) return;
    
    const von1 = element.querySelector('[data-field="von1"]');
    
    // Setze Von1 auf "Urlaub" oder "Krank"
    // WICHTIG: Lösche KEINE anderen Felder hier, da diese später von ladeDatenFuerMonat() geladen werden
    // Dies verhindert, dass gespeicherte von2/bis2/vornach Werte verloren gehen
    if (von1) von1.value = abwesenheitsTyp;
    
    // WICHTIG: Entferne aus manuellEditierteStunden, damit berechneZeile() funktioniert
    manuellEditierteStunden.delete(tag);
}

// ===================================
// Monat laden
// ===================================
async function ladeMonat(jahr, monat) {
    aktuellesJahr = jahr;
    aktuellerMonat = monat;
    
    // Manuell editierte Stunden zurücksetzen beim Monatswechsel
    manuellEditierteStunden.clear();
    
    // Feiertage für das Jahr laden (mit Fallback bei Fehler)
    let feiertage = new Set();
    if (FEATURES.FEIERTAGE_LADEN) {
        try {
            feiertage = await ladeFeiertage(jahr);
        } catch (error) {
            // Bei Fehler (z.B. CORS, keine Internetverbindung) leeres Set verwenden
            feiertage = new Set();
        }
    }
    
    
    // Titel aktualisieren (beide Ansichten)
    document.getElementById('monatsTitel').textContent =
        `Zeiterfassung ${MONATSNAMEN[monat]} ${jahr}`;
    document.getElementById('monatsTitelMobile').textContent =
        `Zeiterfassung ${MONATSNAMEN[monat]} ${jahr}`;
    
    // Desktop: Tabelle leeren
    const tbody = document.getElementById('zeiterfassungBody');
    tbody.innerHTML = '';
    
    // Mobile: Card Container leeren
    const mobileContainer = document.getElementById('mobileCardContainer');
    if (mobileContainer) {
        mobileContainer.innerHTML = '';
    }
    
    // Anzahl Tage im Monat
    const anzahlTage = new Date(jahr, monat + 1, 0).getDate();
    
    // Zeilen/Cards erstellen
    for (let tag = 1; tag <= anzahlTage; tag++) {
        const datum = new Date(jahr, monat, tag);
        const wochentag = WOCHENTAGE[datum.getDay()];
        const istWochenende = (datum.getDay() === 0 || datum.getDay() === 6);
        const feiertagName = istFeiertag(jahr, monat, tag, feiertage);
        const istUrlaub = istUrlaubstag(datum);
        
        // Wochenende ODER Feiertag
        const istFreierTag = istWochenende || (feiertagName !== null);
        
        // Desktop: Tabellenzeile erstellen
        erstelleZeile(tag, wochentag, istFreierTag, feiertagName, istUrlaub);
        
        // Mobile: Card erstellen
        erstelleMobileCard(tag, wochentag, istFreierTag, feiertagName, istUrlaub);
    }
    
    // Prüfe alle Urlaubstage und stelle sicher, dass sie korrekt befüllt sind
    // WICHTIG: Dies muss VOR ladeDatenFuerMonat() passieren, damit von1="Krank"/"Urlaub" gesetzt ist
    for (let tag = 1; tag <= anzahlTage; tag++) {
        const datum = new Date(jahr, monat, tag);
        const datumString = formatiereDatumLokal(datum);
        if (istUrlaubstag(datum)) {
            const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
            const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
            
            // Setze "Urlaub" oder "Krank" in Von1 (immer, auch wenn Feld bereits gefüllt ist)
            const istKrank = istKranktag(datum);
            const abwesenheitsTyp = istKrank ? 'Krank' : 'Urlaub';
            
            // Desktop: Setze Urlaubstag-Informationen
            setzeUrlaubstagInElement(tr, datum, tag, abwesenheitsTyp);
            
            // Mobile: Setze Urlaubstag-Informationen
            setzeUrlaubstagInElement(card, datum, tag, abwesenheitsTyp);
        }
    }
    
    // Gespeicherte Daten laden (NACH dem Urlaubstage-Loop, damit von1 bereits gesetzt ist)
    ladeDatenFuerMonat(jahr, monat);
    
    // WICHTIG: Speichere Urlaubstage NACH dem Laden der Daten
    // So werden die von2/bis2 Felder nicht überschrieben
    for (let tag = 1; tag <= anzahlTage; tag++) {
        const datum = new Date(jahr, monat, tag);
        if (istUrlaubstag(datum)) {
            const urlaubstageWert = holeUrlaubstag(datum);
            if (urlaubstageWert > 0) {
                speichereZeile(tag, true);
            }
        }
    }
    
    // Übertrag Vormonat laden
    ladeUebertragVormonat(jahr, monat);
    
    // SOLL-Stunden laden
    ladeSollStunden(jahr, monat);
    
    // Berechnungen durchführen
    berechneAlleZeilen();
    
    // Stelle sicher, dass alle Stunden-Felder editierbar sind
    macheStundenFelderEditierbar();
    
    // SOLL-Stunden automatisch berechnen wenn noch nicht vorhanden
    // Die Funktion prüft selbst, ob bereits SOLL-Stunden gespeichert sind
    // und überschreibt diese NICHT. Berechnung erfolgt nur bei neuen Monaten.
    berechneSollStundenAutomatisch();
    
    // Auf mobilen Geräten zum aktuellen Tag scrollen
    scrollZuAktuellemTag();
}

// ===================================
// Scroll zu aktuellem Tag auf mobilen Geräten
// ===================================
function scrollZuAktuellemTag() {
    // Nur auf mobilen Geräten (Bildschirmbreite < 992px)
    if (window.innerWidth >= 992) {
        return;
    }
    
    // Prüfe ob wir im aktuellen Monat sind
    const heute = new Date();
    if (heute.getFullYear() !== aktuellesJahr || heute.getMonth() !== aktuellerMonat) {
        return; // Nicht scrollen wenn nicht aktueller Monat
    }
    
    // Finde die Card für den heutigen Tag
    const heutigerTag = heute.getDate();
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${heutigerTag}"]`);
    
    if (card) {
        // Warte kurz bis alle Elemente gerendert sind
        setTimeout(() => {
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 300);
    }
}

// ===================================
// SOLL-Stunden automatisch berechnen
// ===================================
function berechneSollStundenAutomatisch() {
    const beschaeftigungsgradInput = document.getElementById('beschaeftigungsgrad').value;
    const sollStundenInput = document.getElementById('sollStunden');
    
    // WICHTIG: Nur berechnen wenn SOLL-Stunden noch nicht geladen wurden
    // Dies verhindert, dass bei jedem ladeMonat() die SOLL-Stunden überschrieben werden
    const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
    const monatsDaten = zeiterfassungDaten[monatsKey];
    
    // Wenn bereits SOLL-Stunden für diesen Monat gespeichert sind, nicht überschreiben
    if (monatsDaten && monatsDaten.sollStunden) {
        return; // Bereits gespeicherte SOLL-Stunden nicht überschreiben
    }
    
    // Nur berechnen wenn Beschäftigungsgrad vorhanden
    if (!beschaeftigungsgradInput) {
        return;
    }
    
    // Beschäftigungsgrad parsen (z.B. "80%" oder "0.8" oder "80")
    let beschaeftigungsgrad = 1.0;
    const bgString = beschaeftigungsgradInput.trim();
    
    if (bgString.includes('%')) {
        beschaeftigungsgrad = parseFloat(bgString.replace('%', '')) / 100;
    } else {
        const bgValue = parseFloat(bgString);
        if (bgValue > 1) {
            beschaeftigungsgrad = bgValue / 100; // 80 -> 0.8
        } else {
            beschaeftigungsgrad = bgValue; // 0.8 -> 0.8
        }
    }
    
    if (isNaN(beschaeftigungsgrad) || beschaeftigungsgrad <= 0) {
        return; // Ungültiger Wert
    }
    
    // ===================================
    // WICHTIG: Berechnung der täglichen Arbeitszeit
    // ===================================
    // Formel: (Wochenstunden × Beschäftigungsgrad) ÷ Arbeitstage pro Woche
    // Standard: 39 Stunden/Woche ÷ 5 Tage = 7.8 Stunden/Tag bei 100%
    //
    // ANPASSBAR:
    // - Wochenstunden: Wird aus dem Eingabefeld geladen (Standard: 39:00)
    // - Arbeitstage: Ändern Sie 5 auf Ihre Arbeitstage pro Woche (z.B. 4, 5, 6)
    // ===================================
    // Verwende die globale Konstante ARBEITSTAGE_PRO_WOCHE (definiert am Dateianfang)
    
    // Verwende die globale Variable wochenstunden (wird aus Eingabefeld geladen)
    const stundenProTag = (wochenstunden * beschaeftigungsgrad) / ARBEITSTAGE_PRO_WOCHE;
    
    // Anzahl Arbeitstage im Monat ermitteln (ohne Wochenenden und Feiertage)
    const anzahlTage = new Date(aktuellesJahr, aktuellerMonat + 1, 0).getDate();
    let arbeitstage = 0;
    
    for (let tag = 1; tag <= anzahlTage; tag++) {
        const datum = erstelleDatumFuerTag(tag);
        const istWochenende = (datum.getDay() === 0 || datum.getDay() === 6);
        
        // Prüfe ob Feiertag (wenn Feature aktiviert)
        let istFeiertagHeute = false;
        if (FEATURES.FEIERTAGE_LADEN) {
            const cacheKey = `${aktuellesJahr}-${bundesland}`;
            if (feiertageCache[cacheKey]) {
                const monatString = String(aktuellerMonat + 1).padStart(2, '0');
                const tagString = String(tag).padStart(2, '0');
                const datumString = `${aktuellesJahr}-${monatString}-${tagString}`;
                istFeiertagHeute = feiertageCache[cacheKey].has(datumString);
            }
        }
        
        if (!istWochenende && !istFeiertagHeute) {
            arbeitstage++;
        }
    }
    
    // Gesamtstunden = Arbeitstage * Stunden pro Tag
    const gesamtStunden = arbeitstage * stundenProTag;
    
    // In Stunden:Minuten umwandeln
    const stunden = Math.floor(gesamtStunden);
    const minuten = Math.round((gesamtStunden - stunden) * 60);
    
    const sollStundenFormatiert = `${stunden}:${String(minuten).padStart(2, '0')}`;
    
    // Setze den berechneten Wert
    sollStundenInput.value = sollStundenFormatiert;
    
    // Speichere automatisch
    speichereSollStunden();
}

// ===================================
// Tag kopieren/einfügen Funktionen
// ===================================
function kopiereTag(tag) {
    // Prüfe ob dieser Tag bereits kopiert ist (Toggle-Funktion)
    if (kopierterTag === tag) {
        // Entferne Markierungen
        document.querySelectorAll('.kopiert-markierung').forEach(el => {
            el.classList.remove('kopiert-markierung');
        });
        
        // Lösche Zwischenspeicher
        kopierterTag = null;
        kopierterTagDaten = null;
        
        zeigeToast(`Tag ${tag} Kopie entfernt`);
        return;
    }
    
    // Prüfe welche Ansicht aktiv ist
    const istMobileAnsicht = window.innerWidth < MOBILE_BREAKPOINT;
    
    // Finde die Zeile/Card für diesen Tag in der aktiven Ansicht
    let element;
    if (istMobileAnsicht) {
        element = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    } else {
        element = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    }
    
    if (!element) {
        return;
    }
    
    // Lese die Daten
    const von1Input = element.querySelector('[data-field="von1"]');
    const bis1Input = element.querySelector('[data-field="bis1"]');
    const von2Input = element.querySelector('[data-field="von2"]');
    const bis2Input = element.querySelector('[data-field="bis2"]');
    const vornachInput = element.querySelector('[data-field="vornach"]');
    
    const von1 = von1Input?.value || '';
    const bis1 = bis1Input?.value || '';
    const von2 = von2Input?.value || '';
    const bis2 = bis2Input?.value || '';
    const vornach = vornachInput?.value || '';
    
    // Speichere in Zwischenspeicher
    kopierterTag = tag;
    kopierterTagDaten = { von1, bis1, von2, bis2, vornach };
    
    // Entferne alte Markierungen (in beiden Ansichten)
    document.querySelectorAll('.kopiert-markierung').forEach(el => {
        el.classList.remove('kopiert-markierung');
    });
    
    // Markiere kopierten Tag (in beiden Ansichten)
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    if (tr) tr.classList.add('kopiert-markierung');
    if (card) card.classList.add('kopiert-markierung');
    
    // Feedback mit Datenvorschau
    const datenText = `${von1}-${bis1}${von2 ? ', ' + von2 + '-' + bis2 : ''}${vornach ? ', V/N:' + vornach : ''}`;
    zeigeToast(`Tag ${tag} kopiert: ${datenText}`);
}

function fuegeTagEin(tag) {
    if (!kopierterTagDaten) {
        zeigeToast('Kein Tag kopiert', 'warning');
        return;
    }
    
    // Prüfe welche Ansicht aktiv ist
    const istMobileAnsicht = window.innerWidth < MOBILE_BREAKPOINT;
    
    // Finde die Zeile/Card für diesen Tag in der aktiven Ansicht
    let element;
    if (istMobileAnsicht) {
        element = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    } else {
        element = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    }
    
    if (!element) {
        zeigeToast('Fehler: Tag nicht gefunden', 'warning');
        return;
    }
    
    // Setze die Daten - mit Input Events für Auto-Berechnung
    const von1Input = element.querySelector('[data-field="von1"]');
    const bis1Input = element.querySelector('[data-field="bis1"]');
    const von2Input = element.querySelector('[data-field="von2"]');
    const bis2Input = element.querySelector('[data-field="bis2"]');
    const vornachInput = element.querySelector('[data-field="vornach"]');
    
    if (von1Input) {
        von1Input.value = kopierterTagDaten.von1;
        von1Input.dispatchEvent(new Event('input', { bubbles: true }));
        von1Input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (bis1Input) {
        bis1Input.value = kopierterTagDaten.bis1;
        bis1Input.dispatchEvent(new Event('input', { bubbles: true }));
        bis1Input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (von2Input) {
        von2Input.value = kopierterTagDaten.von2;
        von2Input.dispatchEvent(new Event('input', { bubbles: true }));
        von2Input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (bis2Input) {
        bis2Input.value = kopierterTagDaten.bis2;
        bis2Input.dispatchEvent(new Event('input', { bubbles: true }));
        bis2Input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (vornachInput) {
        vornachInput.value = kopierterTagDaten.vornach;
        vornachInput.dispatchEvent(new Event('input', { bubbles: true }));
        vornachInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Markiere als ungespeichert
    ungespeicherteTage.add(tag);
    
    // Berechne Zeile neu (mit kleiner Verzögerung für Input Events)
    setTimeout(() => {
        berechneZeile(tag);
        berechneAlleZeilen();
    }, 100);
    
    // Feedback
    zeigeToast(`Daten in Tag ${tag} eingefügt`);
}

// ===================================
// Woche Kopieren/Einfügen Funktionen
// ===================================
function kopiereWoche(sonntagTag) {
    // Berechne die 7 Tage der Woche (Montag bis Sonntag)
    // Sonntag ist der letzte Tag, also beginnen wir 6 Tage früher (Montag)
    const wocheTage = [];
    for (let i = -6; i <= 0; i++) {
        wocheTage.push(sonntagTag + i);
    }
    
    // Prüfe ob diese Woche bereits kopiert ist (Toggle-Funktion)
    if (kopierteWoche === sonntagTag) {
        // Entferne Markierungen
        document.querySelectorAll('.kopiert-markierung').forEach(el => {
            el.classList.remove('kopiert-markierung');
        });
        
        // Lösche Zwischenspeicher
        kopierteWoche = null;
        kopierteWocheDaten = null;
        
        zeigeToast(`Woche ${wocheTage[0]}-${wocheTage[wocheTage.length-1]} Kopie entfernt`);
        return;
    }
    
    // Prüfe welche Ansicht aktiv ist
    const istMobileAnsicht = window.innerWidth < 992;
    
    // Sammle Daten für alle 7 Tage
    const wocheDaten = [];
    let erfolgreichKopiert = 0;
    
    for (const tag of wocheTage) {
        // Finde Element für diesen Tag
        let element;
        if (istMobileAnsicht) {
            element = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
        } else {
            element = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
        }
        
        if (!element) {
            // Tag existiert nicht im Monat (z.B. 29-31 in kürzeren Monaten)
            wocheDaten.push(null);
            continue;
        }
        
        // Lese die Daten
        const von1Input = element.querySelector('[data-field="von1"]');
        const bis1Input = element.querySelector('[data-field="bis1"]');
        const von2Input = element.querySelector('[data-field="von2"]');
        const bis2Input = element.querySelector('[data-field="bis2"]');
        const vornachInput = element.querySelector('[data-field="vornach"]');
        
        const tagDaten = {
            von1: von1Input?.value || '',
            bis1: bis1Input?.value || '',
            von2: von2Input?.value || '',
            bis2: bis2Input?.value || '',
            vornach: vornachInput?.value || ''
        };
        
        wocheDaten.push(tagDaten);
        erfolgreichKopiert++;
    }
    
    // Speichere in Zwischenspeicher
    kopierteWoche = sonntagTag;
    kopierteWocheDaten = wocheDaten;
    
    // Entferne alte Markierungen
    document.querySelectorAll('.kopiert-markierung').forEach(el => {
        el.classList.remove('kopiert-markierung');
    });
    
    // Markiere kopierte Woche (in beiden Ansichten)
    for (const tag of wocheTage) {
        const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
        const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
        if (tr) tr.classList.add('kopiert-markierung');
        if (card) card.classList.add('kopiert-markierung');
    }
    
    // Feedback
    zeigeToast(`Woche kopiert: ${erfolgreichKopiert} Tage (${wocheTage[0]}-${wocheTage[wocheTage.length-1]})`);
}

function fuegeWocheEin(zielSonntagTag) {
    if (!kopierteWocheDaten) {
        zeigeToast('Keine Woche kopiert', 'warning');
        return;
    }
    
    // Prüfe welche Ansicht aktiv ist
    const istMobileAnsicht = window.innerWidth < 992;
    
    // Berechne die 7 Tage der Zielwoche (Montag bis Sonntag)
    const zielWocheTage = [];
    for (let i = -6; i <= 0; i++) {
        zielWocheTage.push(zielSonntagTag + i);
    }
    
    let erfolgreichEingefuegt = 0;
    const geaenderteTage = [];
    
    // Füge Daten für jeden Tag ein
    for (let i = 0; i < 7; i++) {
        const zielTag = zielWocheTage[i];
        const quellDaten = kopierteWocheDaten[i];
        
        // Überspringe wenn keine Quelldaten oder Ziel-Tag nicht existiert
        if (!quellDaten) continue;
        
        // Finde Element für Ziel-Tag
        let element;
        if (istMobileAnsicht) {
            element = document.querySelector(`#mobileCardContainer .day-card[data-tag="${zielTag}"]`);
        } else {
            element = document.querySelector(`#zeiterfassungBody tr[data-tag="${zielTag}"]`);
        }
        
        if (!element) continue; // Tag existiert nicht im Monat
        
        // Setze die Daten
        const von1Input = element.querySelector('[data-field="von1"]');
        const bis1Input = element.querySelector('[data-field="bis1"]');
        const von2Input = element.querySelector('[data-field="von2"]');
        const bis2Input = element.querySelector('[data-field="bis2"]');
        const vornachInput = element.querySelector('[data-field="vornach"]');
        
        if (von1Input) {
            von1Input.value = quellDaten.von1;
            von1Input.dispatchEvent(new Event('input', { bubbles: true }));
            von1Input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (bis1Input) {
            bis1Input.value = quellDaten.bis1;
            bis1Input.dispatchEvent(new Event('input', { bubbles: true }));
            bis1Input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (von2Input) {
            von2Input.value = quellDaten.von2;
            von2Input.dispatchEvent(new Event('input', { bubbles: true }));
            von2Input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (bis2Input) {
            bis2Input.value = quellDaten.bis2;
            bis2Input.dispatchEvent(new Event('input', { bubbles: true }));
            bis2Input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (vornachInput) {
            vornachInput.value = quellDaten.vornach;
            vornachInput.dispatchEvent(new Event('input', { bubbles: true }));
            vornachInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Markiere als ungespeichert
        ungespeicherteTage.add(zielTag);
        geaenderteTage.push(zielTag);
        
        erfolgreichEingefuegt++;
    }
    
    // Berechne alle Zeilen neu (mit kleiner Verzögerung für Input Events)
    setTimeout(() => {
        geaenderteTage.forEach(tag => berechneZeile(tag));
        berechneAlleZeilen();
        
        // Markiere geänderte Tage visuell
        markiereGeaenderteWoche(geaenderteTage);
    }, 100);
    
    // Feedback
    zeigeToast(`Woche eingefügt: ${erfolgreichEingefuegt} Tage (${zielWocheTage[0]}-${zielWocheTage[zielWocheTage.length-1]})`);
}

// Markiert die geänderten Tage einer Woche visuell
function markiereGeaenderteWoche(tage) {
    tage.forEach(tag => {
        // Desktop-Zeile markieren
        const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
        if (tr) {
            tr.classList.add('unsaved-changes');
            // Kurz blinken lassen zur Hervorhebung
            tr.style.transition = 'all 0.3s ease';
        }
        
        // Mobile Card markieren
        const card = document.querySelector(`.day-card[data-tag="${tag}"]`);
        if (card) {
            card.classList.add('unsaved-changes');
            card.style.transition = 'all 0.3s ease';
        }
    });
}

// Toast-Benachrichtigung anzeigen
function zeigeToast(nachricht, typ = 'success') {
    // Erstelle Toast-Element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${typ}`;
    toast.textContent = nachricht;
    
    // Bestimme Hintergrundfarbe basierend auf Typ
    let backgroundColor;
    switch(typ) {
        case 'success':
            backgroundColor = '#28a745';
            break;
        case 'warning':
            backgroundColor = '#ffc107';
            break;
        case 'info':
            backgroundColor = '#17a2b8';
            break;
        case 'danger':
            backgroundColor = '#dc3545';
            break;
        default:
            backgroundColor = '#6c757d';
    }
    
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // Nach 2 Sekunden entfernen
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Macht alle Stunden-Felder editierbar (für bereits geladene Monate)
function macheStundenFelderEditierbar() {
    // Desktop Tabelle
    const stundenInputs = document.querySelectorAll('#zeiterfassungBody input[data-field="stunden"]');
    stundenInputs.forEach(input => {
        input.readOnly = false;
    });
    
    // Mobile Cards
    const mobileStundenInputs = document.querySelectorAll('#mobileCardContainer input[data-field="stunden"]');
    mobileStundenInputs.forEach(input => {
        input.readOnly = false;
    });
    
}

// ===================================
// Zeile erstellen (Desktop Tabelle)
// ===================================
function erstelleZeile(tag, wochentag, istWochenende, feiertagName = null, istUrlaub = false) {
    const tbody = document.getElementById('zeiterfassungBody');
    const tr = document.createElement('tr');
    tr.className = istWochenende ? 'weekend-row' : '';
    if (istUrlaub) {
        tr.classList.add('urlaub-row');
    }
    tr.dataset.tag = tag;
    
    // Prüfe ob Kranktag
    const datum = erstelleDatumFuerTag(tag);
    const istKrank = istKranktag(datum);
    
    
    // Tag
    const tdTag = document.createElement('td');
    tdTag.className = 'text-center fw-bold';
    if (istUrlaub) {
        if (istKrank) {
            setElementContentSafe(tdTag, tag, {
                subText: 'Krank',
                subTextColor: '#dc3545'
            });
        } else {
            setElementContentSafe(tdTag, tag, {
                subText: 'Urlaub',
                subTextColor: '#198754'
            });
        }
    } else if (feiertagName) {
        setElementContentSafe(tdTag, tag, {
            subText: feiertagName
        });
    } else {
        tdTag.textContent = tag;
    }
    tr.appendChild(tdTag);
    
    // Wochentag
    const tdWochentag = document.createElement('td');
    tdWochentag.className = 'text-center';
    tdWochentag.textContent = wochentag;
    tr.appendChild(tdWochentag);
    
    if (istWochenende || istUrlaub) {
        // Wochenende oder Urlaub - XXXXX oder "Urlaub"/"Krank" vorbelegen, aber editierbar
        const vorbelegung = istUrlaub ? (istKrank ? 'Krank' : 'Urlaub') : 'XXXXX';
        // Von 1 - Vorbelegung eintragen
        const tdVon1 = document.createElement('td');
        const inputVon1 = document.createElement('input');
        inputVon1.type = 'text';
        inputVon1.className = 'time-input';
        inputVon1.value = vorbelegung;
        inputVon1.placeholder = 'HH:MM';
        inputVon1.dataset.field = 'von1';
        // Speichere den ursprünglichen Wert
        let vorherWert = inputVon1.value;
        
        // Event-Listener für Urlaub hinzufügen/entfernen
        inputVon1.addEventListener('focus', function() {
            vorherWert = inputVon1.value.trim();
        });
        
        const handleUrlaubKrankChange = function() {
            const value = inputVon1.value.trim();
            // Nur reagieren wenn sich der Wert geändert hat
            if (value !== vorherWert) {
                const datum = erstelleDatumFuerTag(tag);
                
                if (value === 'Urlaub' && vorherWert !== 'Urlaub') {
                    // Urlaubstag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, false);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Krank zu Urlaub)
                    if (vorherWert === '') {
                        zeigeToast('Urlaubstag hinzugefügt', 'success');
                    }
                } else if (value === 'Krank' && vorherWert !== 'Krank') {
                    // Kranktag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, true);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Urlaub zu Krank)
                    if (vorherWert === '') {
                        zeigeToast('Kranktag hinzugefügt', 'success');
                    }
                } else if (value === '' && (vorherWert === 'Urlaub' || vorherWert === 'Krank')) {
                    // Urlaub/Krank entfernen - OHNE ladeMonat(), das macht speichereZeile()
                    const typ = vorherWert === 'Krank' ? 'Kranktag' : 'Urlaubstag';
                    aktualisiereUrlaubstageProTag(datum, 0);
                    aktualisiereUrlaubsliste();
                    aktualisiereUrlaubskalenderBadge();
                    zeigeToast(`${typ} entfernt`, 'info');
                }
                vorherWert = value;
            }
        };
        
        inputVon1.addEventListener('blur', handleUrlaubKrankChange);
        inputVon1.addEventListener('change', handleUrlaubKrankChange);
        tdVon1.appendChild(inputVon1);
        tr.appendChild(tdVon1);
        
        // Bis 1 - für Wochenende/Feiertag mit XXXXX vorbelegen, für Urlaub leer
        const tdBis1 = document.createElement('td');
        const inputBis1 = document.createElement('input');
        inputBis1.type = 'text';
        inputBis1.className = 'time-input';
        inputBis1.value = istUrlaub ? '' : 'XXXXX';
        inputBis1.placeholder = 'HH:MM';
        inputBis1.dataset.field = 'bis1';
        tdBis1.appendChild(inputBis1);
        tr.appendChild(tdBis1);
        
        // Von 2 - für Wochenende/Feiertag mit XXXXX vorbelegen, für Urlaub leer
        const tdVon2 = document.createElement('td');
        const inputVon2 = document.createElement('input');
        inputVon2.type = 'text';
        inputVon2.className = 'time-input';
        inputVon2.value = istUrlaub ? '' : 'XXXXX';
        inputVon2.placeholder = 'HH:MM';
        inputVon2.dataset.field = 'von2';
        tdVon2.appendChild(inputVon2);
        tr.appendChild(tdVon2);
        
        // Bis 2 - für Wochenende/Feiertag mit XXXXX vorbelegen, für Urlaub leer
        const tdBis2 = document.createElement('td');
        const inputBis2 = document.createElement('input');
        inputBis2.type = 'text';
        inputBis2.className = 'time-input';
        inputBis2.value = istUrlaub ? '' : 'XXXXX';
        inputBis2.placeholder = 'HH:MM';
        inputBis2.dataset.field = 'bis2';
        tdBis2.appendChild(inputBis2);
        tr.appendChild(tdBis2);
        
        // Vor/Nachbereitung (auch für Wochenenden)
        const tdVorNach = document.createElement('td');
        const inputVorNach = document.createElement('input');
        inputVorNach.type = 'text';
        inputVorNach.className = 'time-input';
        inputVorNach.placeholder = 'HH:MM';
        inputVorNach.dataset.field = 'vornach';
        tdVorNach.appendChild(inputVorNach);
        tr.appendChild(tdVorNach);
        
        // Stunden (berechnet, editierbar)
        const tdStunden = document.createElement('td');
        const inputStunden = document.createElement('input');
        inputStunden.type = 'text';
        inputStunden.className = 'time-input calculated-field';
        // Bei Urlaub: (Wochenstunden * Beschäftigungsgrad) / 5, sonst XXXXX
        if (istUrlaub && wochenstunden > 0) {
            const datum = erstelleDatumFuerTag(tag);
            const urlaubstageWert = holeUrlaubstag(datum);
            const tagesStunden = berechneTaeglicheUrlaubsstunden();
            const urlaubsStunden = tagesStunden * urlaubstageWert;
            const stunden = Math.floor(urlaubsStunden);
            const minuten = Math.round((urlaubsStunden - stunden) * 60);
            inputStunden.value = `${stunden}:${minuten.toString().padStart(2, '0')}`;
        } else {
            inputStunden.value = istUrlaub ? '0:00' : 'XXXXX';
        }
        inputStunden.dataset.field = 'stunden';
        inputStunden.readOnly = false; // Editierbar
        tdStunden.appendChild(inputStunden);
        tr.appendChild(tdStunden);
    } else {
        // Arbeitstag
        // Von 1
        const tdVon1 = document.createElement('td');
        const inputVon1 = document.createElement('input');
        inputVon1.type = 'text';
        inputVon1.className = 'time-input';
        inputVon1.placeholder = 'HH:MM';
        inputVon1.dataset.field = 'von1';
        // Speichere den ursprünglichen Wert
        let vorherWert = '';
        
        // Event-Listener für Urlaub hinzufügen/entfernen
        inputVon1.addEventListener('focus', function() {
            vorherWert = inputVon1.value.trim();
        });
        
        const handleUrlaubKrankChange = function() {
            const value = inputVon1.value.trim();
            // Nur reagieren wenn sich der Wert geändert hat
            if (value !== vorherWert) {
                const datum = erstelleDatumFuerTag(tag);
                
                if (value === 'Urlaub' && vorherWert !== 'Urlaub') {
                    // Urlaubstag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, false);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Krank zu Urlaub)
                    if (vorherWert === '') {
                        zeigeToast('Urlaubstag hinzugefügt', 'success');
                    }
                } else if (value === 'Krank' && vorherWert !== 'Krank') {
                    // Kranktag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, true);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Urlaub zu Krank)
                    if (vorherWert === '') {
                        zeigeToast('Kranktag hinzugefügt', 'success');
                    }
                } else if (value === '' && (vorherWert === 'Urlaub' || vorherWert === 'Krank')) {
                    // Urlaub/Krank entfernen - OHNE ladeMonat(), das macht speichereZeile()
                    const typ = vorherWert === 'Krank' ? 'Kranktag' : 'Urlaubstag';
                    aktualisiereUrlaubstageProTag(datum, 0);
                    aktualisiereUrlaubsliste();
                    aktualisiereUrlaubskalenderBadge();
                    zeigeToast(`${typ} entfernt`, 'info');
                }
                vorherWert = value;
            }
        };
        
        inputVon1.addEventListener('blur', handleUrlaubKrankChange);
        inputVon1.addEventListener('change', handleUrlaubKrankChange);
        tdVon1.appendChild(inputVon1);
        tr.appendChild(tdVon1);
        
        // Bis 1
        const tdBis1 = document.createElement('td');
        const inputBis1 = document.createElement('input');
        inputBis1.type = 'text';
        inputBis1.className = 'time-input';
        inputBis1.placeholder = 'HH:MM';
        inputBis1.dataset.field = 'bis1';
        tdBis1.appendChild(inputBis1);
        tr.appendChild(tdBis1);
        
        // Von 2
        const tdVon2 = document.createElement('td');
        const inputVon2 = document.createElement('input');
        inputVon2.type = 'text';
        inputVon2.className = 'time-input';
        inputVon2.placeholder = 'HH:MM';
        inputVon2.dataset.field = 'von2';
        tdVon2.appendChild(inputVon2);
        tr.appendChild(tdVon2);
        
        // Bis 2
        const tdBis2 = document.createElement('td');
        const inputBis2 = document.createElement('input');
        inputBis2.type = 'text';
        inputBis2.className = 'time-input';
        inputBis2.placeholder = 'HH:MM';
        inputBis2.dataset.field = 'bis2';
        tdBis2.appendChild(inputBis2);
        tr.appendChild(tdBis2);
        
        // Vor/Nachbereitung
        const tdVorNach = document.createElement('td');
        const inputVorNach = document.createElement('input');
        inputVorNach.type = 'text';
        inputVorNach.className = 'time-input';
        inputVorNach.placeholder = 'HH:MM';
        inputVorNach.dataset.field = 'vornach';
        tdVorNach.appendChild(inputVorNach);
        tr.appendChild(tdVorNach);
        
        // Stunden (berechnet, editierbar)
        const tdStunden = document.createElement('td');
        const inputStunden = document.createElement('input');
        inputStunden.type = 'text';
        inputStunden.className = 'time-input calculated-field';
        inputStunden.value = '0:00';
        inputStunden.dataset.field = 'stunden';
        inputStunden.readOnly = false; // Editierbar
        tdStunden.appendChild(inputStunden);
        tr.appendChild(tdStunden);
    }
    
    // Gesamt (kumuliert)
    const tdGesamt = document.createElement('td');
    const inputGesamt = document.createElement('input');
    inputGesamt.type = 'text';
    inputGesamt.className = 'time-input total-field';
    inputGesamt.value = '0:00';
    inputGesamt.dataset.field = 'gesamt';
    inputGesamt.readOnly = true;
    tdGesamt.appendChild(inputGesamt);
    tr.appendChild(tdGesamt);
    
    // Aktion (Kopieren, Einfügen, Speichern Buttons)
    const tdAktion = document.createElement('td');
    tdAktion.className = 'text-center';
    tdAktion.style.padding = '4px';
    
    // Container für gruppierte Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '4px';
    
    // Wenn Sonntag: Woche kopieren/einfügen Buttons (oben)
    if (wochentag === 'So') {
        const wochenButtonRow = document.createElement('div');
        wochenButtonRow.style.display = 'flex';
        wochenButtonRow.style.gap = '4px';
        wochenButtonRow.style.justifyContent = 'center';
        
        // Woche Kopieren Button
        const btnWocheKopieren = document.createElement('button');
        btnWocheKopieren.className = 'btn btn-sm btn-outline-primary';
        const iconWocheKopieren = document.createElement('i');
        iconWocheKopieren.className = 'bi bi-calendar-week';
        btnWocheKopieren.appendChild(iconWocheKopieren);
        btnWocheKopieren.title = 'vergangene Woche kopieren';
        btnWocheKopieren.addEventListener('click', function() {
            kopiereWoche(tag);
        });
        wochenButtonRow.appendChild(btnWocheKopieren);
        
        // Woche Einfügen Button
        const btnWocheEinfuegen = document.createElement('button');
        btnWocheEinfuegen.className = 'btn btn-sm btn-outline-success';
        const iconWocheEinfuegen = document.createElement('i');
        iconWocheEinfuegen.className = 'bi bi-calendar-week-fill';
        btnWocheEinfuegen.appendChild(iconWocheEinfuegen);
        btnWocheEinfuegen.title = 'Woche einfügen';
        btnWocheEinfuegen.addEventListener('click', function() {
            fuegeWocheEin(tag);
        });
        wochenButtonRow.appendChild(btnWocheEinfuegen);
        
        buttonContainer.appendChild(wochenButtonRow);
    }
    
    // Tages-Buttons und Speichern (unten)
    const tagesButtonRow = document.createElement('div');
    tagesButtonRow.style.display = 'flex';
    tagesButtonRow.style.gap = '4px';
    tagesButtonRow.style.justifyContent = 'center';
    
    // Kopieren Button
    const btnKopieren = document.createElement('button');
    btnKopieren.className = 'btn btn-sm btn-outline-secondary';
    const iconKopieren = document.createElement('i');
    iconKopieren.className = 'bi bi-clipboard';
    btnKopieren.appendChild(iconKopieren);
    btnKopieren.title = 'Tag kopieren';
    btnKopieren.addEventListener('click', function() {
        kopiereTag(tag);
    });
    tagesButtonRow.appendChild(btnKopieren);
    
    // Einfügen Button
    const btnEinfuegen = document.createElement('button');
    btnEinfuegen.className = 'btn btn-sm btn-outline-info';
    const iconEinfuegen = document.createElement('i');
    iconEinfuegen.className = 'bi bi-clipboard-check';
    btnEinfuegen.appendChild(iconEinfuegen);
    btnEinfuegen.title = 'Tag einfügen';
    btnEinfuegen.addEventListener('click', function() {
        fuegeTagEin(tag);
    });
    tagesButtonRow.appendChild(btnEinfuegen);
    
    // Speichern Button
    const btnSpeichern = document.createElement('button');
    btnSpeichern.className = 'btn btn-sm btn-outline-secondary card-save-btn-default btn-save-row';
    const iconSpeichern = document.createElement('i');
    iconSpeichern.className = 'bi bi-save';
    btnSpeichern.appendChild(iconSpeichern);
    btnSpeichern.title = 'Zeile speichern';
    btnSpeichern.dataset.tag = tag;
    btnSpeichern.dataset.saveBtn = '';
    btnSpeichern.addEventListener('click', function() {
        speichereZeileMitFeedback(tag);
    });
    tagesButtonRow.appendChild(btnSpeichern);
    
    // Tag komplett löschen Button
    const btnLoeschen = document.createElement('button');
    btnLoeschen.className = 'btn btn-sm btn-outline-danger ms-1';
    const iconLoeschen = document.createElement('i');
    iconLoeschen.className = 'bi bi-trash';
    btnLoeschen.appendChild(iconLoeschen);
    btnLoeschen.title = 'Tag komplett löschen (alle Einträge)';
    btnLoeschen.addEventListener('click', function() {
        loescheTagKomplett(tag);
    });
    tagesButtonRow.appendChild(btnLoeschen);
    
    buttonContainer.appendChild(tagesButtonRow);
    tdAktion.appendChild(buttonContainer);
    
    tr.appendChild(tdAktion);
    
    tbody.appendChild(tr);
    
    // Event-Listener für alle Input-Felder in der Zeile, um Button-Stil zu ändern
    const allInputs = tr.querySelectorAll('.time-input, .hours-input');
    const saveBtn = tr.querySelector('[data-save-btn]');
    
    if (saveBtn && allInputs.length > 0) {
        allInputs.forEach(input => {
            input.addEventListener('input', function() {
                // Wenn Zeile rot ist (unsaved-changes), Button fett machen
                if (tr.classList.contains('unsaved-changes')) {
                    saveBtn.classList.remove('btn-outline-secondary', 'card-save-btn-default');
                    saveBtn.classList.add('btn-primary', 'card-save-btn-changed');
                } else {
                    // Sonst Button hell lassen (auch bei saved-changes)
                    saveBtn.classList.remove('btn-primary', 'card-save-btn-changed');
                    saveBtn.classList.add('btn-outline-secondary', 'card-save-btn-default');
                }
            });
        });
    }
    
    // MutationObserver um Button-Stil zu aktualisieren wenn Zeilen-Klassen sich ändern
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                const saveBtn = tr.querySelector('[data-save-btn]');
                if (saveBtn) {
                    // Wenn Zeile gespeichert oder keine Änderungen hat, Button hell machen
                    if (!tr.classList.contains('unsaved-changes')) {
                        saveBtn.classList.remove('btn-primary', 'card-save-btn-changed');
                        saveBtn.classList.add('btn-outline-secondary', 'card-save-btn-default');
                    }
                }
            }
        });
    });
    
    observer.observe(tr, { attributes: true, attributeFilter: ['class'] });
}

// ===================================
// Mobile Card erstellen
/**
 * Erstellt die Aktions-Buttons für eine Mobile Card (XSS-sicher)
 * @param {number} tag - Der Tag
 * @param {string} wochentag - Der Wochentag
 * @returns {HTMLElement} Das Button-Container-Element
 */
function erstelleMobileCardButtons(tag, wochentag) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';
    actionsDiv.style.cssText = 'display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;';
    
    // Wochenbuttons nur für Sonntag
    if (wochentag === 'So') {
        const btnKopiereWoche = document.createElement('button');
        btnKopiereWoche.className = 'btn btn-sm btn-outline-primary';
        btnKopiereWoche.style.cssText = 'flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;';
        const iconKopWoche = document.createElement('i');
        iconKopWoche.className = 'bi bi-calendar-week';
        btnKopiereWoche.appendChild(iconKopWoche);
        btnKopiereWoche.appendChild(document.createTextNode(' vergangene Woche kopieren'));
        btnKopiereWoche.addEventListener('click', () => kopiereWoche(tag));
        actionsDiv.appendChild(btnKopiereWoche);
        
        const btnFuegeWocheEin = document.createElement('button');
        btnFuegeWocheEin.className = 'btn btn-sm btn-outline-success';
        btnFuegeWocheEin.style.cssText = 'flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;';
        const iconFuegeWoche = document.createElement('i');
        iconFuegeWoche.className = 'bi bi-calendar-week-fill';
        btnFuegeWocheEin.appendChild(iconFuegeWoche);
        btnFuegeWocheEin.appendChild(document.createTextNode(' Woche einfügen'));
        btnFuegeWocheEin.addEventListener('click', () => fuegeWocheEin(tag));
        actionsDiv.appendChild(btnFuegeWocheEin);
    }
    
    // Kopieren Button
    const btnKopieren = document.createElement('button');
    btnKopieren.className = 'btn btn-sm btn-outline-secondary';
    btnKopieren.style.cssText = 'flex: 1; font-size: 0.8rem; padding: 6px 8px;';
    const iconKop = document.createElement('i');
    iconKop.className = 'bi bi-clipboard';
    btnKopieren.appendChild(iconKop);
    btnKopieren.appendChild(document.createTextNode(' Kopieren'));
    btnKopieren.addEventListener('click', () => kopiereTag(tag));
    actionsDiv.appendChild(btnKopieren);
    
    // Einfügen Button
    const btnEinfuegen = document.createElement('button');
    btnEinfuegen.className = 'btn btn-sm btn-outline-info';
    btnEinfuegen.style.cssText = 'flex: 1; font-size: 0.8rem; padding: 6px 8px;';
    const iconEinf = document.createElement('i');
    iconEinf.className = 'bi bi-clipboard-check';
    btnEinfuegen.appendChild(iconEinf);
    btnEinfuegen.appendChild(document.createTextNode(' Einfügen'));
    btnEinfuegen.addEventListener('click', () => fuegeTagEin(tag));
    actionsDiv.appendChild(btnEinfuegen);
    
    // Löschen Button
    const btnLoeschen = document.createElement('button');
    btnLoeschen.className = 'btn btn-sm btn-outline-danger';
    btnLoeschen.style.cssText = 'flex: 1; font-size: 0.8rem; padding: 6px 8px;';
    btnLoeschen.title = 'Tag komplett löschen';
    const iconLoesch = document.createElement('i');
    iconLoesch.className = 'bi bi-trash';
    btnLoeschen.appendChild(iconLoesch);
    btnLoeschen.appendChild(document.createTextNode(' Löschen'));
    btnLoeschen.addEventListener('click', () => loescheTagKomplett(tag));
    actionsDiv.appendChild(btnLoeschen);
    
    // Speichern Button
    const btnSpeichern = document.createElement('button');
    btnSpeichern.className = 'btn btn-sm btn-outline-secondary card-save-btn-default';
    btnSpeichern.style.cssText = 'flex: 1; font-size: 0.8rem; padding: 6px 8px;';
    btnSpeichern.dataset.tag = tag;
    btnSpeichern.dataset.saveBtn = '';
    const iconSpeich = document.createElement('i');
    iconSpeich.className = 'bi bi-save';
    btnSpeichern.appendChild(iconSpeich);
    btnSpeichern.appendChild(document.createTextNode(' Speichern'));
    btnSpeichern.addEventListener('click', () => speichereZeileMitFeedback(tag));
    actionsDiv.appendChild(btnSpeichern);
    
    return actionsDiv;
}

/**
 * Erstellt Zeiterfassungs-Felder für Mobile Card (XSS-sicher)
 * @param {string} von1Value - Wert für Von1-Feld
 * @param {string} bis1Value - Wert für Bis1-Feld
 * @param {string} von2Value - Wert für Von2-Feld
 * @param {string} bis2Value - Wert für Bis2-Feld
 * @param {string} stundenValue - Wert für Stunden-Feld
 * @param {string} gesamtValue - Wert für Gesamt-Feld
 * @param {string} stundenLabel - Label für Stunden-Feld
 * @returns {DocumentFragment} Fragment mit allen Zeitfeldern
 */
function erstelleZeiterfassungsFelder(von1Value, bis1Value, von2Value, bis2Value, stundenValue, gesamtValue, stundenLabel) {
    const fragment = document.createDocumentFragment();
    
    // Arbeitszeit 1
    const timeGroup1 = document.createElement('div');
    timeGroup1.className = 'time-group';
    
    const label1 = document.createElement('label');
    label1.className = 'time-group-label';
    label1.textContent = 'Arbeitszeit 1' + (von1Value === 'XXXXX' ? ' (optional)' : '');
    timeGroup1.appendChild(label1);
    
    const timeRow1 = document.createElement('div');
    timeRow1.className = 'time-row';
    
    const von1Field = document.createElement('div');
    von1Field.className = 'time-field';
    const von1Label = document.createElement('label');
    von1Label.textContent = 'Von';
    const von1Input = document.createElement('input');
    von1Input.type = 'text';
    von1Input.className = 'time-input';
    von1Input.placeholder = 'HH:MM';
    von1Input.dataset.field = 'von1';
    von1Input.value = von1Value;
    von1Field.appendChild(von1Label);
    von1Field.appendChild(von1Input);
    
    const bis1Field = document.createElement('div');
    bis1Field.className = 'time-field';
    const bis1Label = document.createElement('label');
    bis1Label.textContent = 'Bis';
    const bis1Input = document.createElement('input');
    bis1Input.type = 'text';
    bis1Input.className = 'time-input';
    bis1Input.placeholder = 'HH:MM';
    bis1Input.dataset.field = 'bis1';
    bis1Input.value = bis1Value;
    bis1Field.appendChild(bis1Label);
    bis1Field.appendChild(bis1Input);
    
    timeRow1.appendChild(von1Field);
    timeRow1.appendChild(bis1Field);
    timeGroup1.appendChild(timeRow1);
    fragment.appendChild(timeGroup1);
    
    // Arbeitszeit 2
    const timeGroup2 = document.createElement('div');
    timeGroup2.className = 'time-group';
    
    const label2 = document.createElement('label');
    label2.className = 'time-group-label';
    label2.textContent = 'Arbeitszeit 2 (optional)';
    timeGroup2.appendChild(label2);
    
    const timeRow2 = document.createElement('div');
    timeRow2.className = 'time-row';
    
    const von2Field = document.createElement('div');
    von2Field.className = 'time-field';
    const von2Label = document.createElement('label');
    von2Label.textContent = 'Von';
    const von2Input = document.createElement('input');
    von2Input.type = 'text';
    von2Input.className = 'time-input';
    von2Input.placeholder = 'HH:MM';
    von2Input.dataset.field = 'von2';
    von2Input.value = von2Value;
    von2Field.appendChild(von2Label);
    von2Field.appendChild(von2Input);
    
    const bis2Field = document.createElement('div');
    bis2Field.className = 'time-field';
    const bis2Label = document.createElement('label');
    bis2Label.textContent = 'Bis';
    const bis2Input = document.createElement('input');
    bis2Input.type = 'text';
    bis2Input.className = 'time-input';
    bis2Input.placeholder = 'HH:MM';
    bis2Input.dataset.field = 'bis2';
    bis2Input.value = bis2Value;
    bis2Field.appendChild(bis2Label);
    bis2Field.appendChild(bis2Input);
    
    timeRow2.appendChild(von2Field);
    timeRow2.appendChild(bis2Field);
    timeGroup2.appendChild(timeRow2);
    fragment.appendChild(timeGroup2);
    
    // Vor/Nachbereitung
    const timeGroup3 = document.createElement('div');
    timeGroup3.className = 'time-group';
    
    const label3 = document.createElement('label');
    label3.className = 'time-group-label';
    label3.textContent = 'Vor/Nachbereitung/Bemerkung';
    timeGroup3.appendChild(label3);
    
    const vornachField = document.createElement('div');
    vornachField.className = 'time-field';
    const vornachInput = document.createElement('input');
    vornachInput.type = 'text';
    vornachInput.className = 'time-input';
    vornachInput.placeholder = 'HH:MM';
    vornachInput.dataset.field = 'vornach';
    vornachField.appendChild(vornachInput);
    timeGroup3.appendChild(vornachField);
    fragment.appendChild(timeGroup3);
    
    // Stunden
    const timeGroup4 = document.createElement('div');
    timeGroup4.className = 'time-group';
    
    const label4 = document.createElement('label');
    label4.className = 'time-group-label';
    label4.textContent = stundenLabel;
    timeGroup4.appendChild(label4);
    
    const stundenField = document.createElement('div');
    stundenField.className = 'time-field';
    const stundenInput = document.createElement('input');
    stundenInput.type = 'text';
    stundenInput.className = 'time-input calculated-field';
    stundenInput.placeholder = 'HH:MM';
    stundenInput.dataset.field = 'stunden';
    stundenInput.value = stundenValue;
    stundenField.appendChild(stundenInput);
    timeGroup4.appendChild(stundenField);
    fragment.appendChild(timeGroup4);
    
    // Gesamt kumuliert
    const gesamtDisplay = document.createElement('div');
    gesamtDisplay.className = 'calculated-display total-display';
    
    const gesamtLabel = document.createElement('span');
    gesamtLabel.className = 'calculated-label';
    gesamtLabel.textContent = 'Gesamt kumuliert:';
    
    const gesamtValueSpan = document.createElement('span');
    gesamtValueSpan.className = 'calculated-value';
    gesamtValueSpan.dataset.field = 'gesamt';
    gesamtValueSpan.textContent = gesamtValue;
    
    gesamtDisplay.appendChild(gesamtLabel);
    gesamtDisplay.appendChild(gesamtValueSpan);
    fragment.appendChild(gesamtDisplay);
    
    return fragment;
}

// ===================================
// Erstelle Mobile Card (XSS-sicher refactored)
// ===================================
function erstelleMobileCard(tag, wochentag, istWochenende, feiertagName = null, istUrlaub = false) {
    const container = document.getElementById('mobileCardContainer');
    
    if (!container) {
        return;
    }
    
    // Prüfe ob Kranktag
    const datum = erstelleDatumFuerTag(tag);
    const istKrank = istKranktag(datum);
    
    
    // Card erstellen
    const card = document.createElement('div');
    card.className = `day-card ${istWochenende ? 'weekend-card' : ''} ${istUrlaub ? 'urlaub-card' : ''}`;
    card.dataset.tag = tag;
    
    // Card Header - Sicher erstellt
    const header = erstelleMobileCardHeader(tag, wochentag, istUrlaub, istKrank, feiertagName, istWochenende);
    card.appendChild(header);
    
    // Card Body
    const body = document.createElement('div');
    body.className = 'day-card-body';
    
    const vorbelegung = istUrlaub ? 'Urlaub' : 'XXXXX';
    
    // Berechne Stunden-Wert für Urlaub (mit Beschäftigungsgrad und gespeicherten Urlaubstagen)
    let stundenWert = 'XXXXX';
    if (istUrlaub && wochenstunden > 0) {
        const datum = erstelleDatumFuerTag(tag);
        const urlaubstageWert = holeUrlaubstag(datum);
        const tagesStunden = berechneTaeglicheUrlaubsstunden();
        const urlaubsStunden = tagesStunden * urlaubstageWert;
        const stunden = Math.floor(urlaubsStunden);
        const minuten = Math.round((urlaubsStunden - stunden) * 60);
        stundenWert = `${stunden}:${minuten.toString().padStart(2, '0')}`;
    } else if (istUrlaub) {
        stundenWert = '0:00';
    }
    
    if (istWochenende || istUrlaub) {
        // Wochenende oder Urlaub - Von/Bis Felder mit XXXXX vorbelegen (außer bei Urlaub)
        const zeitVorbelegung = istUrlaub ? '' : 'XXXXX';
        // Bei Urlaub: Von1 = "Urlaub", alle anderen Felder leer
        const von1Vorbelegung = istUrlaub ? 'Urlaub' : vorbelegung;
        
        // Sichere DOM-Erstellung statt innerHTML
        const zeitfelder = erstelleZeiterfassungsFelder(
            von1Vorbelegung,
            zeitVorbelegung,
            zeitVorbelegung,
            zeitVorbelegung,
            stundenWert,
            'XXXXX',
            'Stunden (editierbar)'
        );
        body.appendChild(zeitfelder);
        
        // Buttons sicher hinzufügen
        const buttons = erstelleMobileCardButtons(tag, wochentag);
        body.appendChild(buttons);
    } else {
        // Arbeitstag - Vollständige Ansicht
        const zeitfelder = erstelleZeiterfassungsFelder(
            '',
            '',
            '',
            '',
            '0:00',
            '0:00',
            'Stunden heute (editierbar)'
        );
        body.appendChild(zeitfelder);
        
        // Buttons sicher hinzufügen
        const buttons = erstelleMobileCardButtons(tag, wochentag);
        body.appendChild(buttons);
    }
    
    card.appendChild(body);
    container.appendChild(card);
    
    // Event-Listener für Von1-Feld (Urlaub hinzufügen/entfernen)
    const von1Input = card.querySelector('[data-field="von1"]');
    if (von1Input) {
        let vorherWert = von1Input.value.trim();
        
        von1Input.addEventListener('focus', function() {
            vorherWert = von1Input.value.trim();
        });
        
        const handleUrlaubKrankChange = function() {
            const value = von1Input.value.trim();
            // Nur reagieren wenn sich der Wert geändert hat
            if (value !== vorherWert) {
                const datum = erstelleDatumFuerTag(tag);
                
                if (value === 'Urlaub' && vorherWert !== 'Urlaub') {
                    // Urlaubstag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, false);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Krank zu Urlaub)
                    if (vorherWert === '') {
                        zeigeToast('Urlaubstag hinzugefügt', 'success');
                    }
                } else if (value === 'Krank' && vorherWert !== 'Krank') {
                    // Kranktag hinzufügen - OHNE ladeMonat(), das macht speichereZeile()
                    aktualisiereUrlaubstageProTag(datum, 1.0, true);
                    fuegeUrlaubstagAutomatischHinzu(tag);
                    // Nur Toast anzeigen wenn vorher leer war (nicht bei Wechsel von Urlaub zu Krank)
                    if (vorherWert === '') {
                        zeigeToast('Kranktag hinzugefügt', 'success');
                    }
                } else if (value === '' && (vorherWert === 'Urlaub' || vorherWert === 'Krank')) {
                    // Urlaub/Krank entfernen - OHNE ladeMonat(), das macht speichereZeile()
                    const typ = vorherWert === 'Krank' ? 'Kranktag' : 'Urlaubstag';
                    aktualisiereUrlaubstageProTag(datum, 0);
                    aktualisiereUrlaubsliste();
                    aktualisiereUrlaubskalenderBadge();
                    zeigeToast(`${typ} entfernt`, 'info');
                }
                vorherWert = value;
            }
        };
        
        von1Input.addEventListener('blur', handleUrlaubKrankChange);
        von1Input.addEventListener('change', handleUrlaubKrankChange);
    }
    
    // Event-Listener für alle Input-Felder in der Card, um Button-Stil zu ändern
    const allInputs = card.querySelectorAll('.time-input');
    const saveBtn = card.querySelector('[data-save-btn]');
    
    if (saveBtn && allInputs.length > 0) {
        allInputs.forEach(input => {
            input.addEventListener('input', function() {
                // Wenn Card rot ist (unsaved-changes), Button fett machen
                if (card.classList.contains('unsaved-changes')) {
                    saveBtn.classList.remove('btn-outline-secondary', 'card-save-btn-default');
                    saveBtn.classList.add('btn-primary', 'card-save-btn-changed');
                } else {
                    // Sonst Button hell lassen (auch bei saved-changes)
                    saveBtn.classList.remove('btn-primary', 'card-save-btn-changed');
                    saveBtn.classList.add('btn-outline-secondary', 'card-save-btn-default');
                }
            });
        });
    }
    
    // Lade gespeicherte Werte wenn vorhanden
    const gespeicherteZeile = holeZeile(tag);
    if (gespeicherteZeile) {
        const von1Input = card.querySelector('[data-field="von1"]');
        const bis1Input = card.querySelector('[data-field="bis1"]');
        const von2Input = card.querySelector('[data-field="von2"]');
        const bis2Input = card.querySelector('[data-field="bis2"]');
        const vornachInput = card.querySelector('[data-field="vornach"]');
        const stundenInput = card.querySelector('[data-field="stunden"]');
        const gesamtSpan = card.querySelector('[data-field="gesamt"]');
        
        if (von1Input && gespeicherteZeile[FIELDS.VON1] !== undefined) {
            von1Input.value = gespeicherteZeile[FIELDS.VON1];
        }
        if (bis1Input && gespeicherteZeile[FIELDS.BIS1] !== undefined) {
            bis1Input.value = gespeicherteZeile[FIELDS.BIS1];
        }
        if (von2Input && gespeicherteZeile[FIELDS.VON2] !== undefined) {
            von2Input.value = gespeicherteZeile[FIELDS.VON2];
        }
        if (bis2Input && gespeicherteZeile[FIELDS.BIS2] !== undefined) {
            bis2Input.value = gespeicherteZeile[FIELDS.BIS2];
        }
        if (vornachInput && gespeicherteZeile[FIELDS.VORNACH] !== undefined) {
            vornachInput.value = gespeicherteZeile[FIELDS.VORNACH];
        }
        if (stundenInput && gespeicherteZeile[FIELDS.STUNDEN] !== undefined) {
            stundenInput.value = gespeicherteZeile[FIELDS.STUNDEN];
        }
        if (gesamtSpan && gespeicherteZeile[FIELDS.GESAMT] !== undefined) {
            gesamtSpan.textContent = gespeicherteZeile[FIELDS.GESAMT];
        }
    }
}


// ===================================
// Berechnungen
// ===================================
function berechneZeile(tag, skipStundenUpdate = false) {
    
    // Desktop: Tabellenzeile
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    // Mobile: Card
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    
    if (!tr && !card) {
        return;
    }
    
    // Prüfe welche Ansicht aktiv ist (basierend auf Bildschirmbreite)
    const istMobileAnsicht = window.innerWidth < 992;
    
    // Wähle das richtige Element basierend auf der aktiven Ansicht
    let element;
    let elementType;
    
    if (istMobileAnsicht && card) {
        element = card;
        elementType = 'Mobile';
    } else if (tr) {
        element = tr;
        elementType = 'Desktop';
    } else {
        element = card || tr;
        elementType = card ? 'Mobile' : 'Desktop';
    }
    
    
    // WICHTIG: Werte aus beiden Quellen lesen und zusammenführen
    // Wenn ein Wert in der Card vorhanden ist, verwende ihn, sonst den aus der Tabelle
    const getFeldWert = (feldName) => {
        // Zuerst aus dem aktiven Element (wo die Eingabe gemacht wurde)
        const elementFeld = element.querySelector(`[data-field="${feldName}"]`);
        let wert = elementFeld ? (elementFeld.value || elementFeld.textContent || '') : '';
        
        // Wenn leer und ein anderes Element existiert, versuche von dort zu lesen
        if (!wert && element !== tr && tr) {
            const trFeld = tr.querySelector(`[data-field="${feldName}"]`);
            wert = trFeld ? (trFeld.value || '') : '';
        } else if (!wert && element !== card && card) {
            const cardFeld = card.querySelector(`[data-field="${feldName}"]`);
            wert = cardFeld ? (cardFeld.value || cardFeld.textContent || '') : '';
        }
        
        return wert;
    };
    
    const von1 = getFeldWert('von1').trim();
    let bis1 = getFeldWert('bis1');
    let von2 = getFeldWert('von2');
    let bis2 = getFeldWert('bis2');
    const vornachZeit = getFeldWert('vornach');
    
    // Normalisiere Zeiteingaben (z.B. "17" → "17:00")
    bis1 = normalisiereZeitEingabe(bis1);
    von2 = normalisiereZeitEingabe(von2);
    bis2 = normalisiereZeitEingabe(bis2);
    
    if (!von1) {
        return;
    }
    
    
    // Stunden-Element finden aus dem ausgewählten Element
    const stundenElement = element.querySelector('[data-field="stunden"]');
    
    if (!stundenElement) {
        return;
    }
    
    // WICHTIG: Wenn dieses Feld manuell editiert wurde, NICHT überschreiben!
    if (manuellEditierteStunden.has(tag)) {
        return; // Berechnung überspringen für manuell editierte Felder
    }
    
    // NEUE URLAUBSLOGIK:
    // Fall 1: Von1 = "Urlaub" oder "Krank" (ganzer Urlaubstag/Kranktag)
    if (von1 === 'Urlaub' || von1 === 'Krank') {
        const istKrank = von1 === 'Krank';
        const datum = erstelleDatumFuerTag(tag);
        
        // Prüfe ob Von2 und Bis2 ausgefüllt sind UND im korrekten Format HH:MM (halber Urlaubstag + Arbeitszeit)
        const istZeitFormatKorrekt = (zeit) => zeit && /^\d{1,2}:\d{2}$/.test(zeit.trim());
        const hatArbeitszeit = istZeitFormatKorrekt(von2) && istZeitFormatKorrekt(bis2);
        
        // Prüfe ob Bemerkung Stunden enthält (Format HH:MM oder H:MM)
        const hatBemerkungStunden = vornachZeit && vornachZeit !== 'XXXXX' && /^\d{1,2}:\d{2}$/.test(vornachZeit.trim());
        
        if (hatArbeitszeit || hatBemerkungStunden) {
            // Halber Urlaubstag + Arbeitszeit
            let gesamtStunden = 0;
            
            // Halbe Urlaubsstunden
            if (wochenstunden > 0) {
                const tagesStunden = berechneTaeglicheUrlaubsstunden();
                gesamtStunden += tagesStunden / 2;
            }
            
            // Arbeitszeit Von2-Bis2
            if (hatArbeitszeit) {
                const diff2 = berechneZeitdifferenz(von2, bis2);
                if (diff2 >= 0) {
                    gesamtStunden += diff2;
                }
            }
            
            // Vor/Nachbereitung addieren
            if (hatBemerkungStunden) {
                const vornachDezimal = parseStundenZuDezimal(vornachZeit);
                gesamtStunden += vornachDezimal;
            }
            
            // Stunden setzen - BEIDE Ansichten aktualisieren (Desktop UND Mobile)
            const formatted = formatStunden(gesamtStunden);
            if (!skipStundenUpdate) {
                // Desktop
                if (tr) {
                    const trStunden = tr.querySelector('[data-field="stunden"]');
                    if (trStunden && trStunden.tagName === 'INPUT') {
                        trStunden.value = formatted;
                    }
                }
                // Mobile
                if (card) {
                    const cardStunden = card.querySelector('[data-field="stunden"]');
                    if (cardStunden) {
                        cardStunden.textContent = formatted;
                    }
                }
            }
            
            // Halben Urlaubstag im Kalender vermerken
            aktualisiereUrlaubstageProTag(datum, 0.5, istKrank);
            aktualisiereUrlaubsliste();
            aktualisiereUrlaubskalenderBadge();
            
            return formatted; // Rückgabe des berechneten Werts
        } else {
            // Urlaubstag ohne Arbeitszeit - verwende IMMER den gespeicherten Wert aus dem Kalender
            let formatted = '0:00';
            if (wochenstunden > 0) {
                // Hole den gespeicherten Urlaubstag-Wert (kann 0.5 oder 1.0 sein)
                const urlaubstageWert = holeUrlaubstag(datum);
                const tagesStunden = berechneTaeglicheUrlaubsstunden();
                const urlaubsStunden = tagesStunden * urlaubstageWert;
                const stunden = Math.floor(urlaubsStunden);
                const minuten = Math.round((urlaubsStunden - stunden) * 60);
                
                formatted = `${stunden}:${minuten.toString().padStart(2, '0')}`;
                if (!skipStundenUpdate) {
                    // Desktop
                    if (tr) {
                        const trStunden = tr.querySelector('[data-field="stunden"]');
                        if (trStunden && trStunden.tagName === 'INPUT') {
                            trStunden.value = formatted;
                        }
                    }
                    // Mobile
                    if (card) {
                        const cardStunden = card.querySelector('[data-field="stunden"]');
                        if (cardStunden) {
                            cardStunden.textContent = formatted;
                        }
                    }
                }
                
                // WICHTIG: Verwende den bereits gespeicherten Wert, überschreibe ihn NICHT
                // Dies stellt sicher, dass halbe Tage aus dem Kalender erhalten bleiben
                // Nur wenn noch kein Wert gespeichert ist (urlaubstageWert === 0), setze 1.0
                if (urlaubstageWert === 0) {
                    aktualisiereUrlaubstageProTag(datum, 1.0, istKrank);
                    aktualisiereUrlaubsliste();
                    aktualisiereUrlaubskalenderBadge();
                }
            } else if (!skipStundenUpdate) {
                // Desktop
                if (tr) {
                    const trStunden = tr.querySelector('[data-field="stunden"]');
                    if (trStunden && trStunden.tagName === 'INPUT') {
                        trStunden.value = '0:00';
                    }
                }
                // Mobile
                if (card) {
                    const cardStunden = card.querySelector('[data-field="stunden"]');
                    if (cardStunden) {
                        cardStunden.textContent = '0:00';
                    }
                }
            }
            
            return formatted; // Rückgabe des berechneten Werts
        }
    }
    
    // Fall 2: Normale Arbeitstage (kein Urlaub)
    let gesamtStunden = 0;
    
    // Periode 1 - nur berechnen wenn nicht XXXXX
    if (von1 && bis1 && von1 !== 'XXXXX' && bis1 !== 'XXXXX') {
        const diff1 = berechneZeitdifferenz(von1, bis1);
        if (diff1 >= 0) {
            gesamtStunden += diff1;
        }
    }
    
    // Periode 2 - nur berechnen wenn nicht XXXXX
    if (von2 && bis2 && von2 !== 'XXXXX' && bis2 !== 'XXXXX') {
        const diff2 = berechneZeitdifferenz(von2, bis2);
        if (diff2 >= 0) {
            gesamtStunden += diff2;
        }
    }
    
    // Vor/Nachbereitung - IMMER berücksichtigen (auch bei Wochenenden)
    // Konvertiere HH:MM zu Dezimalstunden
    if (vornachZeit && vornachZeit !== 'XXXXX') {
        const vornachDezimal = parseStundenZuDezimal(vornachZeit);
        gesamtStunden += vornachDezimal;
    }
    
    // Stunden formatieren und setzen - NUR wenn nicht manuell editiert wird
    // BEIDE Ansichten aktualisieren (Desktop UND Mobile)
    const formatted = formatStunden(gesamtStunden);
    if (!skipStundenUpdate) {
        // Desktop
        if (tr) {
            const trStunden = tr.querySelector('[data-field="stunden"]');
            if (trStunden && trStunden.tagName === 'INPUT') {
                trStunden.value = formatted;
            }
        }
        // Mobile
        if (card) {
            const cardStunden = card.querySelector('[data-field="stunden"]');
            if (cardStunden) {
                cardStunden.textContent = formatted;
            }
        }
    }
    
    return formatted; // Rückgabe des berechneten Werts
}
function berechneAlleZeilen(skipStundenUpdate = false) {
    
    
    // Desktop Tabelle
    const tbody = document.getElementById('zeiterfassungBody');
    const zeilen = tbody.querySelectorAll('tr');
    
    // Mobile Cards
    const mobileContainer = document.getElementById('mobileCardContainer');
    const cards = mobileContainer.querySelectorAll('.day-card');
    
    let kumuliert = getUebertragVormonatInStunden();
    
    // Anzahl Tage bestimmen
    const anzahlTage = Math.max(zeilen.length, cards.length);
    
    for (let i = 0; i < anzahlTage; i++) {
        const tag = i + 1;
        
        // Zeile/Card berechnen und Stundenwert direkt erhalten
        const stundenWert = berechneZeile(tag, false) || '0:00';
        
        let stundenDezimal = 0;
        if (stundenWert !== 'XXXXX' && stundenWert !== '') {
            stundenDezimal = parseStundenZuDezimal(stundenWert);
        }
        
        // Kumulieren
        kumuliert += stundenDezimal;
        
        // Gesamt aktualisieren (Desktop UND Mobile)
        const formatted = stundenWert === 'XXXXX' ? 'XXXXX' : formatStunden(kumuliert);
        
        // Desktop
        if (zeilen[i]) {
            const gesamtInput = zeilen[i].querySelector('[data-field="gesamt"]');
            if (gesamtInput) {
                gesamtInput.value = formatted;
            }
        }
        
        // Mobile
        if (cards[i]) {
            const gesamtSpan = cards[i].querySelector('[data-field="gesamt"]');
            if (gesamtSpan) {
                gesamtSpan.textContent = formatted;
            }
        }
    }
    
    // Zusammenfassung aktualisieren
    aktualisiereZusammenfassung(kumuliert);
    
    // WICHTIG: Stelle sicher, dass Stunden-Felder editierbar bleiben
    // Aber nur wenn wir nicht gerade manuell editieren
    if (!skipStundenUpdate) {
        macheStundenFelderEditierbar();
    }
}

function berechneZeitdifferenz(von, bis) {
    // Format: HH:MM
    const vonParts = von.split(':');
    const bisParts = bis.split(':');
    
    if (vonParts.length !== 2 || bisParts.length !== 2) return 0;
    
    const vonStunden = parseInt(vonParts[0]);
    const vonMinuten = parseInt(vonParts[1]);
    const bisStunden = parseInt(bisParts[0]);
    const bisMinuten = parseInt(bisParts[1]);
    
    if (isNaN(vonStunden) || isNaN(vonMinuten) || isNaN(bisStunden) || isNaN(bisMinuten)) return 0;
    
    const vonGesamt = vonStunden + vonMinuten / 60;
    const bisGesamt = bisStunden + bisMinuten / 60;
    
    return bisGesamt - vonGesamt;
}

function formatStunden(dezimalStunden) {
    const istNegativ = dezimalStunden < 0;
    const absolutStunden = Math.abs(dezimalStunden);
    
    const stunden = Math.floor(absolutStunden);
    const minuten = Math.round((absolutStunden - stunden) * 60);
    
    const formatted = `${stunden}:${minuten.toString().padStart(2, '0')}`;
    return istNegativ ? `-${formatted}` : formatted;
}

// ===================================
// Zeit-Normalisierung: Einzelne Ziffern zu Stunden konvertieren
// ===================================
function normalisiereZeitEingabe(value) {
    if (!value || value === 'XXXXX') return value;
    
    // Entferne Leerzeichen
    value = value.trim();
    
    // Wenn bereits im Format HH:MM oder H:MM, nicht ändern
    if (value.includes(':')) return value;
    
    // Wenn nur Ziffern (z.B. "2", "13", "8")
    if (/^\d+$/.test(value)) {
        const stunden = parseInt(value);
        // Konvertiere zu HH:MM Format
        return `${stunden}:00`;
    }
    
    return value;
}

function parseStundenZuDezimal(stundenString) {
    if (!stundenString || stundenString === 'XXXXX') return 0;
    
    const istNegativ = stundenString.startsWith('-');
    const cleaned = stundenString.replace('-', '');
    const parts = cleaned.split(':');
    
    if (parts.length !== 2) return 0;
    
    const stunden = parseInt(parts[0]) || 0;
    const minuten = parseInt(parts[1]) || 0;
    
    const dezimal = stunden + minuten / 60;
    return istNegativ ? -dezimal : dezimal;
}

// ===================================
// Zusammenfassung
// ===================================
function aktualisiereZusammenfassung(istStundenDezimal) {
    // SUMME IST-Stunden
    document.getElementById('summeIst').textContent = formatStunden(istStundenDezimal);
    
    // SOLL-Stunden
    const sollInput = document.getElementById('sollStunden');
    const sollStunden = parseStundenZuDezimal(sollInput.value);
    
    // Übertrag berechnen
    const uebertrag = istStundenDezimal - sollStunden;
    const uebertragElement = document.getElementById('uebertrag');
    const uebertragCard = document.getElementById('uebertragCard');
    
    uebertragElement.textContent = formatStunden(uebertrag);
    
    // Farbe anpassen
    uebertragCard.classList.remove('positive', 'negative');
    if (uebertrag > 0) {
        uebertragCard.classList.add('positive');
    } else if (uebertrag < 0) {
        uebertragCard.classList.add('negative');
    }
}

// ===================================
// LocalStorage Funktionen
// ===================================

// Aktuelle Version der Datenstruktur
const DATEN_VERSION = 1;

/**
 * Migriert alte Datenstrukturen auf die aktuelle Version
 * @param {Object} daten - Die zu migrierenden Daten
 * @returns {Object} - Die migrierten Daten
 */
function migriereAlteVersion(daten) {
    const version = daten._version || 0;
    
    if (version === DATEN_VERSION) {
        return daten; // Bereits aktuelle Version
    }
    
    // Migration von Version 0 (keine Version) auf Version 1
    if (version === 0) {
        // Füge Versionsnummer hinzu, Datenstruktur bleibt gleich
        daten._version = 1;
    }
    
    // Hier können zukünftige Migrationen hinzugefügt werden:
    // if (version < 2) { ... }
    // if (version < 3) { ... }
    
    return daten;
}

function ladeDatenAusLocalStorage() {
    const gespeichert = localStorage.getItem('zeiterfassungDaten');
    if (gespeichert) {
        try {
            let daten = JSON.parse(gespeichert);
            
            // Prüfe und migriere Datenversion
            daten = migriereAlteVersion(daten);
            
            zeiterfassungDaten = daten;
        } catch (e) {
            console.error('Fehler beim Parsen:', e);
            zeiterfassungDaten = { _version: DATEN_VERSION };
        }
    } else {
        // Neue Installation: Initialisiere mit aktueller Version
        zeiterfassungDaten = { _version: DATEN_VERSION };
    }
}

/**
 * Prüft den verfügbaren Speicherplatz im LocalStorage
 * Warnt den Benutzer bei Annäherung an das Limit (~5-10MB)
 * @returns {Object} - Objekt mit Speicherinformationen
 */
function pruefeSpeicherplatz() {
    try {
        // Berechne aktuell verwendeten Speicher
        let verwendeterSpeicher = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                verwendeterSpeicher += localStorage[key].length + key.length;
            }
        }
        
        // Geschätztes Limit: 5MB (5 * 1024 * 1024 Bytes)
        const geschaetztesLimit = 5 * 1024 * 1024;
        const verwendetInMB = (verwendeterSpeicher / (1024 * 1024)).toFixed(2);
        const limitInMB = (geschaetztesLimit / (1024 * 1024)).toFixed(2);
        const prozentVerwendet = (verwendeterSpeicher / geschaetztesLimit * 100).toFixed(1);
        
        // Warnung bei >80% Auslastung
        if (prozentVerwendet > 80) {
            zeigeToast(
                `Warnung: LocalStorage zu ${prozentVerwendet}% voll (${verwendetInMB}MB). Bitte erstellen Sie ein Backup und löschen Sie alte Daten.`,
                'warning'
            );
        }
        
        return {
            verwendeterSpeicher,
            geschaetztesLimit,
            prozentVerwendet: parseFloat(prozentVerwendet),
            verwendetInMB: parseFloat(verwendetInMB)
        };
    } catch (error) {
        console.error('Fehler bei Speicherplatzprüfung:', error);
        return null;
    }
}

function speichereDatenInLocalStorage() {
    // Prüfe Speicherplatz vor dem Speichern
    pruefeSpeicherplatz();
    
    // Stelle sicher, dass die Versionsnummer gesetzt ist
    if (!zeiterfassungDaten._version) {
        zeiterfassungDaten._version = DATEN_VERSION;
    }
    
    const jsonString = JSON.stringify(zeiterfassungDaten);
    localStorage.setItem('zeiterfassungDaten', jsonString);
}

function getMonatsKey(jahr, monat) {
    // monat ist 0-basiert (0=Januar, 1=Februar, 2=März, ...)
    // Für den Key brauchen wir 1-basiert (01=Januar, 02=Februar, 03=März, ...)
    const monatEinsBasiert = monat + 1;
    return `${jahr}-${monatEinsBasiert.toString().padStart(2, '0')}`;
}

function ladeDatenFuerMonat(jahr, monat) {
    const key = getMonatsKey(jahr, monat);
    const monatsDaten = zeiterfassungDaten[key];
    
    if (!monatsDaten) return;
    
    // Manuell editierte Stunden laden
    if (monatsDaten.manuellEditierteStunden) {
        manuellEditierteStunden = new Set(monatsDaten.manuellEditierteStunden);
    } else {
        manuellEditierteStunden.clear();
    }
    
    // Tage laden
    if (monatsDaten.tage) {
        Object.keys(monatsDaten.tage).forEach(tag => {
            const tagDaten = monatsDaten.tage[tag];
            
            // Prüfe ob dieser Tag ein Urlaubstag ist
            const datum = new Date(jahr, monat, parseInt(tag));
            const istUrlaub = istUrlaubstag(datum);
            
            // Desktop: Tabellenzeile
            const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
            if (tr) {
                Object.keys(tagDaten).forEach(field => {
                    // Überspringe Gesamt-Feld IMMER - wird immer neu berechnet
                    if (field === 'gesamt') {
                        return;
                    }
                    // Überspringe Stundenfeld für Urlaub/Krank NUR wenn KEINE von2/bis2 Werte vorhanden sind
                    // (bei halben Urlaubstagen mit Arbeitszeit muss das Stundenfeld geladen werden)
                    if (field === 'stunden') {
                        const von1Wert = tagDaten['von1'];
                        if (von1Wert === 'Urlaub' || von1Wert === 'Krank') {
                            // Prüfe ob von2/bis2 vorhanden sind
                            const hatVon2Bis2 = tagDaten['von2'] && tagDaten['bis2'] &&
                                              tagDaten['von2'] !== 'XXXXX' && tagDaten['bis2'] !== 'XXXXX' &&
                                              tagDaten['von2'] !== '' && tagDaten['bis2'] !== '';
                            // Nur überspringen wenn KEINE Arbeitszeit vorhanden ist
                            if (!hatVon2Bis2) {
                                return;
                            }
                        }
                    }
                    // Überspringe Von1-Feld wenn es kein Urlaubstag mehr ist
                    // (verhindert dass "Urlaub"/"Krank" wieder eingetragen wird nach Löschen)
                    if (!istUrlaub && field === 'von1' && (tagDaten[field] === 'Urlaub' || tagDaten[field] === 'Krank')) {
                        return;
                    }
                    const input = tr.querySelector(`[data-field="${field}"]`);
                    if (input) {
                        input.value = tagDaten[field];
                    }
                });
            }
            
            // Mobile: Card
            const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
            if (card) {
                Object.keys(tagDaten).forEach(field => {
                    // Überspringe Gesamt-Feld IMMER - wird immer neu berechnet
                    if (field === 'gesamt') {
                        return;
                    }
                    // Überspringe Stundenfeld für Urlaub/Krank NUR wenn KEINE von2/bis2 Werte vorhanden sind
                    // (bei halben Urlaubstagen mit Arbeitszeit muss das Stundenfeld geladen werden)
                    if (field === 'stunden') {
                        const von1Wert = tagDaten['von1'];
                        if (von1Wert === 'Urlaub' || von1Wert === 'Krank') {
                            // Prüfe ob von2/bis2 vorhanden sind
                            const hatVon2Bis2 = tagDaten['von2'] && tagDaten['bis2'] &&
                                              tagDaten['von2'] !== 'XXXXX' && tagDaten['bis2'] !== 'XXXXX' &&
                                              tagDaten['von2'] !== '' && tagDaten['bis2'] !== '';
                            // Nur überspringen wenn KEINE Arbeitszeit vorhanden ist
                            if (!hatVon2Bis2) {
                                return;
                            }
                        }
                    }
                    // Überspringe Von1-Feld wenn es kein Urlaubstag mehr ist
                    // (verhindert dass "Urlaub"/"Krank" wieder eingetragen wird nach Löschen)
                    if (!istUrlaub && field === 'von1' && (tagDaten[field] === 'Urlaub' || tagDaten[field] === 'Krank')) {
                        return;
                    }
                    const element = card.querySelector(`[data-field="${field}"]`);
                    if (element) {
                        if (element.tagName === 'INPUT') {
                            element.value = tagDaten[field];
                        } else {
                            element.textContent = tagDaten[field];
                        }
                    }
                });
            }
        });
    }
}

function ladeUebertragVormonat(jahr, monat) {
    const key = getMonatsKey(jahr, monat);
    const monatsDaten = zeiterfassungDaten[key];
    
    if (monatsDaten && monatsDaten.uebertragVormonat !== undefined) {
        document.getElementById('uebertragVormonat').value = monatsDaten.uebertragVormonat;
    } else {
        document.getElementById('uebertragVormonat').value = '0:00';
    }
}

function ladeSollStunden(jahr, monat) {
    const key = getMonatsKey(jahr, monat);
    const monatsDaten = zeiterfassungDaten[key];
    
    if (monatsDaten && monatsDaten.sollStunden) {
        document.getElementById('sollStunden').value = monatsDaten.sollStunden;
    } else {
        document.getElementById('sollStunden').value = '';
    }
}

function getUebertragVormonatInStunden() {
    const uebertragString = document.getElementById('uebertragVormonat').value;
    return parseStundenZuDezimal(uebertragString);
}

// ===================================
// Speichern Funktionen
// Hilfsfunktion: Findet das aktive Element (Desktop oder Mobile)
function findeAktivesElement(tag) {
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    const istMobileAnsicht = window.innerWidth < MOBILE_BREAKPOINT;
    
    if (istMobileAnsicht && card) {
        return card;
    } else if (tr) {
        return tr;
    }
    return card || tr;
}

// Hilfsfunktion: Extrahiert Felddaten aus einem Element
function extrahiereFeldDaten(element, istUrlaubOderKrank) {
    const inputs = element.querySelectorAll('input[data-field], span[data-field]');
    const daten = {};
    
    inputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value || input.textContent;
        
        daten[field] = value;
    });
    
    return daten;
}

// Hilfsfunktion: Speichert Felddaten in LocalStorage
function speichereFeldDatenInLocalStorage(tag, daten) {
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    
    if (!zeiterfassungDaten[key]) {
        zeiterfassungDaten[key] = { tage: {} };
    }
    
    if (!zeiterfassungDaten[key].tage[tag]) {
        zeiterfassungDaten[key].tage[tag] = {};
    }
    
    Object.assign(zeiterfassungDaten[key].tage[tag], daten);
    zeiterfassungDaten[key].manuellEditierteStunden = Array.from(manuellEditierteStunden);
    
    try {
        speichereDatenInLocalStorage();
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        if (error.name === 'QuotaExceededError') {
            zeigeToast('Speicher voll! Bitte erstellen Sie ein Backup und löschen Sie alte Daten.', 'error');
        } else {
            zeigeToast('Fehler beim Speichern der Daten', 'error');
        }
        return; // Verhindere weitere Verarbeitung
    }
}

// Hilfsfunktion: Behandelt Änderungen bei Urlaub/Krank
function behandleUrlaubKrankAenderung(tag, von1Value, alterVon1Wert) {
    const hatSichGeaendert = von1Value !== alterVon1Wert;
    
    // Wenn "Urlaub" oder "Krank" neu eingegeben wurde
    if (hatSichGeaendert && (von1Value === 'Urlaub' || von1Value === 'Krank')) {
        const datum = erstelleDatumFuerTag(tag);
        const istKrank = von1Value === 'Krank';
        manuellEditierteStunden.delete(tag);
        
        // Prüfe ob von2/bis2 oder Bemerkung gefüllt sind für halben Tag
        const element = findeAktivesElement(tag);
        if (element) {
            const von2Input = element.querySelector('[data-field="von2"]');
            const bis2Input = element.querySelector('[data-field="bis2"]');
            const vornachInput = element.querySelector('[data-field="vornach"]');
            
            const von2 = von2Input ? von2Input.value : '';
            const bis2 = bis2Input ? bis2Input.value : '';
            const vornach = vornachInput ? vornachInput.value : '';
            
            const hatArbeitszeit = von2 && bis2 && von2 !== 'XXXXX' && bis2 !== 'XXXXX' && von2 !== '' && bis2 !== '';
            const hatBemerkungStunden = vornach && vornach !== 'XXXXX' && /^\d{1,2}:\d{2}$/.test(vornach.trim());
            
            if (hatArbeitszeit || hatBemerkungStunden) {
                // Halber Urlaubstag
                aktualisiereUrlaubstageProTag(datum, 0.5, istKrank);
            } else {
                // Ganzer Urlaubstag
                aktualisiereUrlaubstageProTag(datum, 1.0, istKrank);
            }
        } else {
            // Fallback: Ganzer Tag
            aktualisiereUrlaubstageProTag(datum, 1.0, istKrank);
        }
        
        fuegeUrlaubstagAutomatischHinzu(tag);
        aktualisiereUrlaubsliste();
        aktualisiereUrlaubskalenderBadge();
        
        // WICHTIG: Rufe NICHT ladeMonat() auf, da dies alle Eingabefelder zurücksetzt
        // und der Benutzer möglicherweise noch von2/bis2 eingeben möchte
        // Stattdessen nur die Berechnung aktualisieren
        berechneZeile(tag);
        berechneAlleZeilen();
        
        return false; // Wichtig: false zurückgeben, damit die normale Verarbeitung fortgesetzt wird
    }
    
    // Wenn "Urlaub" oder "Krank" entfernt wurde
    if (hatSichGeaendert && von1Value === '' && (alterVon1Wert === 'Urlaub' || alterVon1Wert === 'Krank')) {
        const datum = erstelleDatumFuerTag(tag);
        aktualisiereUrlaubstageProTag(datum, 0);
        aktualisiereUrlaubsliste();
        aktualisiereUrlaubskalenderBadge();
        
        // BUGFIX: Speichere ALLE ungespeicherten Tage BEVOR ladeMonat() aufgerufen wird.
        // Grund: ladeMonat() lädt alle Daten aus LocalStorage neu und würde dabei
        // ungespeicherte Änderungen in anderen Tagen überschreiben und verlieren.
        // Dies tritt auf, wenn ein Benutzer mehrere Tage bearbeitet und dann
        // einen davon als Urlaub/Krank markiert.
        speichereAlleUngespeichertenTage(tag);
        ladeMonat(aktuellesJahr, aktuellerMonat);
        return true;
    }
    
    return false;
}

/**
 * Speichert alle ungespeicherten Tage außer dem aktuellen Tag.
 *
 * BUGFIX-Funktion: Verhindert Datenverlust, wenn ladeMonat() aufgerufen wird.
 * ladeMonat() lädt alle Daten aus LocalStorage neu und würde dabei ungespeicherte
 * Änderungen in anderen Tagen überschreiben. Dies tritt auf, wenn ein Benutzer
 * mehrere Tage bearbeitet und dann einen davon als Urlaub/Krank markiert.
 *
 * Die Funktion erstellt ein Backup der Daten vor dem Speichern und stellt dieses
 * bei Fehlern automatisch wieder her.
 *
 * @param {number} ausgenommenTag - Der Tag, der NICHT gespeichert werden soll (typischerweise der aktuell bearbeitete Tag)
 * @returns {void}
 */
function speichereAlleUngespeichertenTage(ausgenommenTag) {
    const ungespeicherteTageKopie = new Set(ungespeicherteTage);
    
    // Backup der zeiterfassungDaten erstellen
    const backup = JSON.parse(JSON.stringify(zeiterfassungDaten));
    let fehlerBeiSpeicherung = false;
    
    // Cache DOM-Referenzen vor der Schleife für bessere Performance
    const alleTrs = new Map();
    const alleCards = new Map();
    document.querySelectorAll('#zeiterfassungBody tr[data-tag]').forEach(tr => {
        alleTrs.set(parseInt(tr.dataset.tag), tr);
    });
    document.querySelectorAll('#mobileCardContainer .day-card[data-tag]').forEach(card => {
        alleCards.set(parseInt(card.dataset.tag), card);
    });
    
    ungespeicherteTageKopie.forEach(tag => {
        if (tag !== ausgenommenTag) {
            try {
                const trExists = alleTrs.has(tag);
                const cardExists = alleCards.has(tag);
                
                if (trExists || cardExists) {
                    speichereZeile(tag, true);
                }
            } catch (error) {
                console.error(`Fehler beim Speichern von Tag ${tag}:`, error);
                fehlerBeiSpeicherung = true;
                
                // Bei Fehler: Backup wiederherstellen
                zeiterfassungDaten = backup;
                try {
                    speichereDatenInLocalStorage();
                } catch (restoreError) {
                    console.error('Kritischer Fehler beim Wiederherstellen des Backups:', restoreError);
                }
                
                zeigeToast('Fehler beim Speichern. Änderungen wurden rückgängig gemacht.', 'error');
                return; // Abbruch der Schleife
            }
        }
    });
    
    if (fehlerBeiSpeicherung) {
        zeigeToast('Warnung: Einige Änderungen konnten nicht gespeichert werden', 'warning');
    }
}

// Hilfsfunktion: Aktualisiert visuelle Markierungen für Urlaub
function aktualisiereVisuellMarkierungen(tag, istUrlaub) {
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    
    if (istUrlaub) {
        if (tr) {
            tr.classList.add('urlaub-row');
        }
        if (card) {
            card.classList.add('urlaub-card');
            const header = card.querySelector('.day-card-header');
            if (header) {
                header.classList.add('urlaub-header');
            }
        }
    } else {
        if (tr) {
            tr.classList.remove('urlaub-row');
        }
        if (card) {
            card.classList.remove('urlaub-card');
            const header = card.querySelector('.day-card-header');
            if (header) {
                header.classList.remove('urlaub-header');
            }
        }
    }
}

// ===================================
// Zeile aus Daten holen
// ===================================
function holeZeile(tag) {
    const monatsKey = getMonatsKey(aktuellesJahr, aktuellerMonat);
    if (zeiterfassungDaten[monatsKey] && zeiterfassungDaten[monatsKey].tage && zeiterfassungDaten[monatsKey].tage[tag]) {
        return zeiterfassungDaten[monatsKey].tage[tag];
    }
    return null;
}

// ===================================
function speichereZeile(tag, skipUrlaubKrankCheck = false) {
    // Füge zur Queue hinzu
    speicherQueue.push({ tag, skipUrlaubKrankCheck });
    
    // Starte Queue-Verarbeitung wenn nicht bereits aktiv
    if (!speicherQueueAktiv) {
        verarbeiteSpeicherQueue();
    }
}

async function verarbeiteSpeicherQueue() {
    if (speicherQueueAktiv) {
        return;
    }
    
    speicherQueueAktiv = true;
    
    while (speicherQueue.length > 0) {
        const { tag, skipUrlaubKrankCheck } = speicherQueue.shift();
        
        // Validierung
        if (!Number.isInteger(tag) || tag < 1 || tag > 31) {
            console.error('Ungültiger Tag-Parameter:', tag);
            continue;
        }
        
        // Finde das aktive Element (Desktop oder Mobile)
        const element = findeAktivesElement(tag);
        if (!element) {
            continue;
        }
        
        // Hole den alten Von1-Wert vor dem Überschreiben
        const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
        const alterVon1Wert = zeiterfassungDaten[key]?.tage[tag]?.von1 || '';
        
        // Extrahiere aktuellen Von1-Wert
        const von1Input = element.querySelector('[data-field="von1"]');
        const von1Value = von1Input ? (von1Input.value || von1Input.textContent || '').trim() : '';
        const istUrlaubOderKrank = von1Value === 'Urlaub' || von1Value === 'Krank';
        
        // WICHTIG: Berechne Stunden VOR dem Extrahieren, damit der aktuelle Wert gespeichert wird
        const berechnetesStundenfeld = berechneZeile(tag);
        
        // Extrahiere und speichere Felddaten
        const daten = extrahiereFeldDaten(element, istUrlaubOderKrank);
        
        // Überschreibe das Stundenfeld mit dem berechneten Wert (falls vorhanden)
        // WICHTIG: Immer überschreiben, nicht nur bei Urlaub/Krank, damit beim Löschen
        // von "Urlaub"/"Krank" die Stunden korrekt neu berechnet werden
        if (berechnetesStundenfeld !== undefined && berechnetesStundenfeld !== null) {
            daten.stunden = berechnetesStundenfeld;
        }
        
        speichereFeldDatenInLocalStorage(tag, daten);
        
        // Behandle Urlaub/Krank-Änderungen
        if (!skipUrlaubKrankCheck) {
            const wurdeBehandelt = behandleUrlaubKrankAenderung(tag, von1Value, alterVon1Wert);
            if (wurdeBehandelt) {
                continue; // Nächsten Eintrag verarbeiten, da ladeMonat() alles neu aufbaut
            }
        }
        
        // Aktualisiere visuelle Markierungen
        const istUrlaubEingabe = von1Value.toLowerCase() === 'urlaub';
        aktualisiereVisuellMarkierungen(tag, istUrlaubEingabe);
        
        // Synchronisiere Ansichten und berechne Zeilen
        synchronisiereAnsichten(tag);
        berechneAlleZeilen();
        
        // Kurze Pause zwischen Operationen für UI-Responsiveness
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    speicherQueueAktiv = false;
}

function speichereZeileMitFeedback(tag) {
    speichereZeile(tag);
    // Markiere als gespeichert (grün für 2 Sekunden)
    markiereAlsGespeichert(tag);
}

// Synchronisiert Desktop und Mobile Ansichten
function synchronisiereAnsichten(tag) {
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    const tagDaten = zeiterfassungDaten[key]?.tage[tag];
    
    if (!tagDaten) return;
    
    // Prüfe ob "Urlaub" im Von1-Feld steht
    const istUrlaubEingabe = tagDaten.von1 && tagDaten.von1.trim().toLowerCase() === 'urlaub';
    
    // Desktop Tabelle aktualisieren
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    if (tr) {
        Object.keys(tagDaten).forEach(field => {
            const input = tr.querySelector(`[data-field="${field}"]`);
            if (input && input.tagName === 'INPUT') {
                input.value = tagDaten[field];
            }
        });
        
        // Urlaubstag-Markierung synchronisieren
        if (istUrlaubEingabe) {
            tr.classList.add('urlaub-row');
            
            // Aktualisiere Tag-Spalte mit "Urlaub"-Text (sicher)
            const tdTag = tr.querySelector('td:first-child');
            if (tdTag && !tdTag.innerHTML.includes('Urlaub')) {
                setElementContentSafe(tdTag, tag, {
                    subText: 'Urlaub',
                    subTextColor: '#198754'
                });
            }
        } else {
            tr.classList.remove('urlaub-row');
            
            // Entferne "Urlaub"-Text aus Tag-Spalte
            const tdTag = tr.querySelector('td:first-child');
            if (tdTag && tdTag.innerHTML.includes('Urlaub')) {
                // Prüfe ob es ein Feiertag ist
                const feiertagMatch = tdTag.innerHTML.match(/<small[^>]*>(?!Urlaub)([^<]+)<\/small>/);
                if (feiertagMatch) {
                    // Feiertag beibehalten (sicher)
                    setElementContentSafe(tdTag, tag, {
                        subText: feiertagMatch[1]
                    });
                } else {
                    // Nur Tag-Nummer
                    tdTag.textContent = tag;
                }
            }
        }
    }
    
    // Mobile Card aktualisieren
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    if (card) {
        Object.keys(tagDaten).forEach(field => {
            const element = card.querySelector(`[data-field="${field}"]`);
            if (element) {
                if (element.tagName === 'INPUT') {
                    element.value = tagDaten[field];
                } else {
                    element.textContent = tagDaten[field];
                }
            }
        });
        
        // Urlaubstag-Markierung synchronisieren
        const header = card.querySelector('.day-card-header');
        if (istUrlaubEingabe) {
            card.classList.add('urlaub-card');
            if (header) {
                header.classList.add('urlaub-header');
                
                // Aktualisiere Wochentag-Text mit "Urlaub" (sicher)
                const dayName = header.querySelector('.day-name');
                if (dayName && !dayName.innerHTML.includes('Urlaub')) {
                    const wochentagText = dayName.textContent.split('(')[0].trim();
                    dayName.textContent = wochentagText + ' ';
                    const statusSpan = createElementSafe('span', {
                        text: '(Urlaub)',
                        style: {
                            fontSize: '0.85em',
                            color: '#d4edda'
                        }
                    });
                    dayName.appendChild(statusSpan);
                }
            }
        } else {
            card.classList.remove('urlaub-card');
            if (header) {
                header.classList.remove('urlaub-header');
                
                // Entferne "Urlaub"-Text aus Wochentag (sicher)
                const dayName = header.querySelector('.day-name');
                if (dayName && dayName.innerHTML.includes('Urlaub')) {
                    const wochentagText = dayName.textContent.split('(')[0].trim();
                    // Prüfe ob es ein Feiertag ist
                    const feiertagMatch = dayName.innerHTML.match(/\((?!Urlaub)([^)]+)\)/);
                    if (feiertagMatch) {
                        // Feiertag beibehalten (sicher)
                        dayName.textContent = wochentagText + ' ';
                        const statusSpan = createElementSafe('span', {
                            text: `(${feiertagMatch[1]})`,
                            style: {
                                fontSize: '0.85em'
                            }
                        });
                        dayName.appendChild(statusSpan);
                    } else {
                        // Nur Wochentag
                        dayName.textContent = wochentagText;
                    }
                }
            }
        }
    }
}

function speichereAlleZeilen() {
    const tbody = document.getElementById('zeiterfassungBody');
    const zeilen = tbody.querySelectorAll('tr');
    
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    
    zeilen.forEach(tr => {
        const tag = parseInt(tr.dataset.tag);
        speichereZeileMitFeedback(tag);
    });
    
    alert('Alle Zeilen gespeichert');
}
// ===================================
// Visuelle Indikatoren für ungespeicherte Änderungen
// ===================================
function markiereAlsUngespeichert(tag) {
    ungespeicherteTage.add(tag);
    
    // Desktop-Zeile markieren
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    if (tr) {
        tr.classList.remove('saved-changes');
        tr.classList.add('unsaved-changes');
    }
    
    // Mobile Card markieren
    const card = document.querySelector(`.day-card[data-tag="${tag}"]`);
    if (card) {
        card.classList.remove('saved-changes');
        card.classList.add('unsaved-changes');
    }
}

function markiereAlsGespeichert(tag) {
    ungespeicherteTage.delete(tag);
    
    // Desktop-Zeile markieren
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    if (tr) {
        tr.classList.remove('unsaved-changes');
        tr.classList.add('saved-changes');
        
        // Speichern-Button zurücksetzen auf Standard-Stil
        const saveBtn = tr.querySelector('[data-save-btn]');
        if (saveBtn) {
            // Entferne alle Button-Stil-Klassen
            saveBtn.className = 'btn btn-sm btn-outline-secondary card-save-btn-default btn-save-row';
            saveBtn.dataset.tag = tag;
            saveBtn.dataset.saveBtn = '';
        }
        
        // Nach 2 Sekunden grüne Markierung entfernen
        setTimeout(() => {
            tr.classList.remove('saved-changes');
        }, 2000);
    }
    
    // Mobile Card markieren
    const card = document.querySelector(`.day-card[data-tag="${tag}"]`);
    if (card) {
        card.classList.remove('unsaved-changes');
        card.classList.add('saved-changes');
        
        // Speichern-Button zurücksetzen auf Standard-Stil
        const saveBtn = card.querySelector('[data-save-btn]');
        if (saveBtn) {
            // Entferne alle Button-Stil-Klassen und setze komplett neu
            saveBtn.className = 'btn btn-sm btn-outline-secondary card-save-btn-default';
            saveBtn.dataset.tag = tag;
            saveBtn.dataset.saveBtn = '';
        }
        
        // Nach 2 Sekunden grüne Markierung entfernen
        setTimeout(() => {
            card.classList.remove('saved-changes');
        }, 2000);
    }
}

function speichereUebertragVormonat() {
    const uebertrag = document.getElementById('uebertragVormonat').value;
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    
    if (!zeiterfassungDaten[key]) {
        zeiterfassungDaten[key] = { tage: {} };
    }
    
    zeiterfassungDaten[key].uebertragVormonat = uebertrag;
    // Manuell editierte Stunden-Felder auch speichern
    zeiterfassungDaten[key].manuellEditierteStunden = Array.from(manuellEditierteStunden);
    speichereDatenInLocalStorage();
    berechneAlleZeilen();
    
    alert('Übertrag Vormonat gespeichert');
}

function speichereSollStunden() {
    const soll = document.getElementById('sollStunden').value;
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    
    if (!zeiterfassungDaten[key]) {
        zeiterfassungDaten[key] = { tage: {} };
    }
    
    zeiterfassungDaten[key].sollStunden = soll;
    // Manuell editierte Stunden-Felder auch speichern
    zeiterfassungDaten[key].manuellEditierteStunden = Array.from(manuellEditierteStunden);
    speichereDatenInLocalStorage();
    berechneAlleZeilen();
    
    alert('SOLL-Stunden gespeichert');
}

function setzeMonatZurueck() {
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    delete zeiterfassungDaten[key];
    speichereDatenInLocalStorage();
    ladeMonat(aktuellesJahr, aktuellerMonat);
    
    alert('Monat zurückgesetzt');
}

// ===================================
// Stammdaten Funktionen
// ===================================
function speichereStammdaten() {
    // Sammle alle Urlaubstage aus localStorage
    const urlaubstage = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('urlaub_tage_')) {
            urlaubstage[key] = localStorage.getItem(key);
        }
    }
    
    const stammdaten = {
        mitarbeiterName: document.getElementById('mitarbeiterName').value,
        beschaeftigungsgrad: document.getElementById('beschaeftigungsgrad').value,
        urlaubstageProJahr: document.getElementById('urlaubstageProJahr').value,
        urlaubstage: urlaubstage
    };
    
    localStorage.setItem('stammdaten', JSON.stringify(stammdaten));
}

function ladeStammdaten() {
    const gespeichert = localStorage.getItem('stammdaten');
    
    if (gespeichert) {
        try {
            const stammdaten = JSON.parse(gespeichert);
            document.getElementById('mitarbeiterName').value = stammdaten.mitarbeiterName || '';
            document.getElementById('beschaeftigungsgrad').value = stammdaten.beschaeftigungsgrad || '';
            document.getElementById('urlaubstageProJahr').value = stammdaten.urlaubstageProJahr || '';
            
            // Urlaubstage wiederherstellen (falls vorhanden)
            if (stammdaten.urlaubstage) {
                Object.keys(stammdaten.urlaubstage).forEach(key => {
                    // Nur wiederherstellen wenn noch nicht vorhanden
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, stammdaten.urlaubstage[key]);
                    }
                });
            }
        } catch (e) {
        }
    }
    
    // Wochenstunden laden
    ladeWochenstunden();
}

// ===================================
// Wochenstunden Funktionen
// ===================================
function speichereWochenstunden() {
    const wochenstundenInput = document.getElementById('wochenstunden').value;
    const wochenstundenMobileInput = document.getElementById('wochenstundenMobile').value;
    
    // Verwende den Wert aus dem aktiven Eingabefeld
    let wert = wochenstundenInput || wochenstundenMobileInput;
    
    // Prüfe ob es eine reine Zahl ohne ":" ist
    const nurZahlPattern = /^\d+$/;
    if (nurZahlPattern.test(wert)) {
        // Interpretiere als Stunden und formatiere als HH:00
        const stundenWert = parseInt(wert);
        wert = stundenWert + ':00';
    }
    
    // Validiere Format HH:MM
    const pattern = /^\d+:\d{2}$/;
    if (!pattern.test(wert)) {
        alert('Bitte geben Sie die Wochenstunden im Format HH:MM ein (z.B. 39:00) oder als Zahl (z.B. 39)');
        return;
    }
    
    // Parse zu Dezimalstunden
    const parts = wert.split(':');
    const stunden = parseInt(parts[0]);
    const minuten = parseInt(parts[1]);
    
    if (isNaN(stunden) || isNaN(minuten) || minuten >= 60) {
        alert('Ungültige Eingabe. Minuten müssen zwischen 00 und 59 liegen.');
        return;
    }
    
    // Speichere als Dezimalwert
    wochenstunden = stunden + (minuten / 60);
    
    // Speichere in localStorage
    localStorage.setItem('wochenstunden', wert);
    
    // Synchronisiere beide Eingabefelder mit formatiertem Wert
    document.getElementById('wochenstunden').value = wert;
    document.getElementById('wochenstundenMobile').value = wert;
    
    // Aktualisiere Stunden pro Tag Anzeige
    aktualisiereStundenProTagAnzeige();
    
    // SOLL-Stunden neu berechnen
    berechneSollStundenAutomatisch();
    
    alert('Wochenstunden gespeichert: ' + wert);
}

function ladeWochenstunden() {
    const gespeichert = localStorage.getItem('wochenstunden');
    
    if (gespeichert) {
        // Setze beide Eingabefelder (falls sie existieren)
        const wochenstundenInput = document.getElementById('wochenstunden');
        const wochenstundenMobileInput = document.getElementById('wochenstundenMobile');
        if (wochenstundenInput) wochenstundenInput.value = gespeichert;
        if (wochenstundenMobileInput) wochenstundenMobileInput.value = gespeichert;
        
        // Parse zu Dezimalwert
        const parts = gespeichert.split(':');
        const stunden = parseInt(parts[0]);
        const minuten = parseInt(parts[1]);
        wochenstunden = stunden + (minuten / 60);
    } else {
        // Standardwert 39:00
        const wochenstundenInput = document.getElementById('wochenstunden');
        const wochenstundenMobileInput = document.getElementById('wochenstundenMobile');
        if (wochenstundenInput) wochenstundenInput.value = '39:00';
        if (wochenstundenMobileInput) wochenstundenMobileInput.value = '39:00';
        wochenstunden = 39.0;
    }
    
    // Aktualisiere Stunden pro Tag Anzeige
    aktualisiereStundenProTagAnzeige();
    
    // Bundesland laden
    ladeBundesland();
}

// ===================================
// Stunden pro Tag Anzeige aktualisieren
// ===================================
function aktualisiereStundenProTagAnzeige() {
    // Hole Beschäftigungsgrad
    const beschaeftigungsgrad = getBeschaeftigungsgrad();
    
    // Berechne Stunden pro Tag (Wochenstunden × Beschäftigungsgrad ÷ 5 Arbeitstage)
    const stundenProTag = (wochenstunden * beschaeftigungsgrad) / 5;
    
    // Formatiere als HH:MM
    const stunden = Math.floor(stundenProTag);
    const minuten = Math.round((stundenProTag - stunden) * 60);
    const formatiert = `${stunden}:${String(minuten).padStart(2, '0')}`;
    
    // Aktualisiere beide Anzeigen (Desktop und Mobile)
    const desktopAnzeige = document.getElementById('stundenProTagWertDesktop');
    const mobileAnzeige = document.getElementById('stundenProTagWertMobile');
    
    if (desktopAnzeige) {
        desktopAnzeige.textContent = formatiert;
    }
    if (mobileAnzeige) {
        mobileAnzeige.textContent = formatiert;
    }
}

// ===================================
// Bundesland Funktionen
// ===================================
function speichereBundesland() {
    const bundeslandSelect = document.getElementById('bundesland').value;
    const bundeslandMobileSelect = document.getElementById('bundeslandMobile').value;
    
    // Verwende den Wert aus dem aktiven Select
    const wert = bundeslandSelect || bundeslandMobileSelect;
    
    // Speichere in globaler Variable
    bundesland = wert;
    
    // Speichere in localStorage
    localStorage.setItem('bundesland', wert);
    
    // Synchronisiere beide Select-Felder
    document.getElementById('bundesland').value = wert;
    document.getElementById('bundeslandMobile').value = wert;
    
    // Cache leeren und Monat neu laden (wegen geänderten Feiertagen)
    feiertageCache = {};
    ladeMonat(aktuellesJahr, aktuellerMonat);
}

function ladeBundesland() {
    const gespeichert = localStorage.getItem('bundesland');
    
    if (gespeichert) {
        // Setze beide Select-Felder
        document.getElementById('bundesland').value = gespeichert;
        document.getElementById('bundeslandMobile').value = gespeichert;
        bundesland = gespeichert;
    } else {
        // Standardwert BW (Baden-Württemberg)
        document.getElementById('bundesland').value = 'BW';
        document.getElementById('bundeslandMobile').value = 'BW';
        bundesland = 'BW';
    }
}

// ===================================
// Export Funktionen
// ===================================
function exportiereCSV() {
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    const monatsDaten = zeiterfassungDaten[key];
    
    let csv = 'Tag,Wochentag,Von1,Bis1,Von2,Bis2,Vor/Nach,Stunden,Gesamt\n';
    
    const tbody = document.getElementById('zeiterfassungBody');
    const zeilen = tbody.querySelectorAll('tr');
    
    zeilen.forEach(tr => {
        const tag = tr.dataset.tag;
        const wochentag = tr.children[1].textContent;
        const von1 = tr.querySelector('[data-field="von1"]').value;
        const bis1 = tr.querySelector('[data-field="bis1"]').value;
        const von2 = tr.querySelector('[data-field="von2"]').value;
        const bis2 = tr.querySelector('[data-field="bis2"]').value;
        const vornach = tr.querySelector('[data-field="vornach"]').value;
        const stunden = tr.querySelector('[data-field="stunden"]').value;
        const gesamt = tr.querySelector('[data-field="gesamt"]').value;
        
        csv += `${tag},${wochentag},${von1},${bis1},${von2},${bis2},${vornach},${stunden},${gesamt}\n`;
    });
    
    // CSV Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `zeiterfassung_${MONATSNAMEN[aktuellerMonat]}_${aktuellesJahr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function importiereCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Keine Datei ausgewählt');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const zeilen = csv.split('\n');
            
            // Erste Zeile überspringen (Header)
            let importierteTage = 0;
            
            for (let i = 1; i < zeilen.length; i++) {
                const zeile = zeilen[i].trim();
                if (!zeile) continue; // Leere Zeilen überspringen
                
                const spalten = zeile.split(',');
                if (spalten.length < 9) continue; // Ungültige Zeilen überspringen
                
                const tag = parseInt(spalten[0]);
                const von1 = spalten[2];
                const bis1 = spalten[3];
                const von2 = spalten[4];
                const bis2 = spalten[5];
                const vornach = spalten[6];
                const stunden = spalten[7];
                const gesamt = spalten[8];
                
                // Validierung
                if (isNaN(tag) || tag < 1 || tag > 31) continue;
                
                // Daten in die Tabelle eintragen
                const tbody = document.getElementById('zeiterfassungBody');
                const tr = tbody.querySelector(`tr[data-tag="${tag}"]`);
                
                if (tr) {
                    tr.querySelector('[data-field="von1"]').value = von1;
                    tr.querySelector('[data-field="bis1"]').value = bis1;
                    tr.querySelector('[data-field="von2"]').value = von2;
                    tr.querySelector('[data-field="bis2"]').value = bis2;
                    tr.querySelector('[data-field="vornach"]').value = vornach;
                    tr.querySelector('[data-field="stunden"]').value = stunden;
                    tr.querySelector('[data-field="gesamt"]').value = gesamt;
                    
                    // Wenn Stunden manuell gesetzt wurden, markieren
                    if (stunden && stunden !== '0:00') {
                        manuellEditierteStunden.add(tag);
                    }
                    
                    importierteTage++;
                }
                
                // Auch Mobile Cards aktualisieren
                const card = document.querySelector(`.day-card[data-tag="${tag}"]`);
                if (card) {
                    card.querySelector('[data-field="von1"]').value = von1;
                    card.querySelector('[data-field="bis1"]').value = bis1;
                    card.querySelector('[data-field="von2"]').value = von2;
                    card.querySelector('[data-field="bis2"]').value = bis2;
                    card.querySelector('[data-field="vornach"]').value = vornach;
                    card.querySelector('[data-field="stunden"]').value = stunden;
                    card.querySelector('[data-field="gesamt"]').value = gesamt;
                }
            }
            
            // Alle Zeilen neu berechnen
            berechneAlleZeilen();
            
            // Daten speichern
            speichereAlleZeilen();
            
            // File Input zurücksetzen
            fileInput.value = '';
            
            alert(`✅ CSV-Import erfolgreich!\n${importierteTage} Tage importiert.`);
            
        } catch (error) {
            alert('❌ Fehler beim Importieren der CSV-Datei.\nBitte überprüfen Sie das Dateiformat.');
        }
    };
    
    reader.onerror = function() {
        alert('❌ Fehler beim Lesen der Datei');
    };
    
    reader.readAsText(file);
}

function erstelleBackup() {
    try {
        // Sammle alle Urlaubstage aus localStorage
        const urlaubstage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('urlaub_tage_')) {
                urlaubstage[key] = localStorage.getItem(key);
            }
        }
        
        // Sammle alle Daten aus localStorage
        const backup = {
            version: '1.2',
            timestamp: new Date().toISOString(),
            zeiterfassungDaten: zeiterfassungDaten,
            stammdaten: JSON.parse(localStorage.getItem('stammdaten') || '{}'),
            urlaubstage: urlaubstage,
            wochenstunden: localStorage.getItem('wochenstunden') || '39:00',
            bundesland: localStorage.getItem('bundesland') || 'BW'
        };
        
        // Erstelle JSON-String
        const jsonString = JSON.stringify(backup, null, 2);
        
        // Download als JSON-Datei
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // Dateiname mit Timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `zeiterfassung_backup_${timestamp}.json`;
        
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('✅ Backup erfolgreich erstellt!');

    } catch (error) {
        alert('❌ Fehler beim Erstellen des Backups: ' + error.message);
    }
}

function stelleBackupWiederHer() {
    const fileInput = document.getElementById('backupFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Keine Datei ausgewählt');
        return;
    }
    
    // Sicherheitsabfrage
    if (!confirm('⚠️ WARNUNG: Das Wiederherstellen eines Backups überschreibt ALLE aktuellen Daten!\n\nMöchten Sie fortfahren?')) {
        fileInput.value = '';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            
            // Validierung
            if (!backup.version || !backup.zeiterfassungDaten) {
                throw new Error('Ungültiges Backup-Format');
            }
            
            // Lösche alle alten Urlaubstage aus localStorage
            const keysToDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('urlaub_tage_')) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => localStorage.removeItem(key));
            
            // Daten wiederherstellen
            zeiterfassungDaten = backup.zeiterfassungDaten;
            
            // Stammdaten wiederherstellen
            if (backup.stammdaten) {
                localStorage.setItem('stammdaten', JSON.stringify(backup.stammdaten));
            }
            
            // Urlaubstage wiederherstellen (falls vorhanden)
            if (backup.urlaubstage) {
                Object.keys(backup.urlaubstage).forEach(key => {
                    localStorage.setItem(key, backup.urlaubstage[key]);
                });
            }
            
            // Wochenstunden wiederherstellen (falls vorhanden)
            if (backup.wochenstunden) {
                localStorage.setItem('wochenstunden', backup.wochenstunden);
            }
            
            // Bundesland wiederherstellen (falls vorhanden)
            if (backup.bundesland) {
                localStorage.setItem('bundesland', backup.bundesland);
            }
            
            // In localStorage speichern
            speichereDatenInLocalStorage();
            
            // Stammdaten laden
            ladeStammdaten();
            
            // Urlaubsliste aktualisieren
            aktualisiereUrlaubsliste();
            
            // Aktuellen Monat neu laden
            ladeMonat(aktuellesJahr, aktuellerMonat);
            
            // File Input zurücksetzen
            fileInput.value = '';
            
            alert(`✅ Backup erfolgreich wiederhergestellt!\n\nBackup vom: ${new Date(backup.timestamp).toLocaleString('de-DE')}`);
            
        } catch (error) {
            alert('❌ Fehler beim Wiederherstellen des Backups.\nBitte überprüfen Sie die Backup-Datei.');
            fileInput.value = '';
        }
    };
    
    reader.onerror = function() {
        alert('❌ Fehler beim Lesen der Datei');
        fileInput.value = '';
    };
    
    reader.readAsText(file);
}

async function drucken() {
    try {
        // Sammle alle Daten für die Druckansicht (Werte direkt aus DOM, ohne Neuberechnung)
        // Prüfe welche Ansicht aktiv ist
        const istMobileAnsicht = window.innerWidth < MOBILE_BREAKPOINT;
        
        let zeilen;
        if (istMobileAnsicht) {
            // Mobile: Hole Daten aus Cards
            const mobileContainer = document.getElementById('mobileCardContainer');
            if (!mobileContainer) {
                return;
            }
            zeilen = mobileContainer.querySelectorAll('.day-card');
        } else {
            // Desktop: Hole Daten aus Tabelle
            const tbody = document.getElementById('zeiterfassungBody');
            if (!tbody) {
                return;
            }
            zeilen = tbody.querySelectorAll('tr');
        }
        
        // Zähle Urlaubstage im aktuellen Monat (OHNE Kranktage)
        let urlaubstageImMonat = 0;
        const anzahlTage = new Date(aktuellesJahr, aktuellerMonat + 1, 0).getDate();
        for (let tag = 1; tag <= anzahlTage; tag++) {
            const datum = erstelleDatumFuerTag(tag);
            const urlaubstage = holeUrlaubstag(datum);
            // Nur Urlaubstage zählen, KEINE Kranktage
            if (urlaubstage > 0 && !istKranktag(datum)) {
                urlaubstageImMonat += urlaubstage;
            }
        }
        
        const druckDaten = {
            monat: MONATSNAMEN[aktuellerMonat],
            jahr: aktuellesJahr,
            mitarbeiterName: document.getElementById('mitarbeiterName')?.value || '',
            beschaeftigungsgrad: document.getElementById('beschaeftigungsgrad')?.value || '',
            uebertragVormonat: document.getElementById('uebertragVormonat')?.value || '0:00',
            sollStunden: document.getElementById('sollStunden')?.value || '0:00',
            istStunden: document.getElementById('summeIst')?.textContent || '0:00',
            differenz: document.getElementById('differenz')?.textContent || '0:00',
            uebertrag: document.getElementById('uebertrag')?.textContent || '0:00',
            urlaubstageImMonat: urlaubstageImMonat,
            zeilen: []
        };
        
        
        // Alle Zeilen sammeln und kumulative Summe berechnen
        // Starte mit Übertrag vom Vormonat (in Dezimalstunden)
        let kumuliert = getUebertragVormonatInStunden();
        
        zeilen.forEach(element => {
            const tag = element.dataset.tag;
            
            // Hole Stunden-Wert - unterschiedlich für Desktop (input.value) und Mobile (span.textContent)
            const stundenElement = element.querySelector('[data-field="stunden"]');
            let stundenWert = '';
            if (stundenElement) {
                stundenWert = stundenElement.tagName === 'INPUT'
                    ? (stundenElement.value || '')
                    : (stundenElement.textContent || '');
            }
            
            // Berechne kumulative Summe für Gesamt-Spalte (wie in berechneAlleZeilen)
            let stundenDezimal = 0;
            if (stundenWert !== 'XXXXX' && stundenWert !== '') {
                stundenDezimal = parseStundenZuDezimal(stundenWert);
            }
            
            // Kumulieren
            kumuliert += stundenDezimal;
            
            // Formatiere kumulative Summe
            const gesamtWert = stundenWert === 'XXXXX' ? 'XXXXX' : formatStunden(kumuliert);
            
            // Hilfsfunktion zum Holen von Feldwerten (funktioniert für Desktop und Mobile)
            const getFeldWert = (feldName) => {
                const feld = element.querySelector(`[data-field="${feldName}"]`);
                if (!feld) return '';
                return feld.tagName === 'INPUT' ? (feld.value || '') : (feld.textContent || '');
            };
            
            // Wochentag holen - unterschiedlich für Desktop (tr.children[1]) und Mobile (day-name)
            let wochentag = '';
            if (istMobileAnsicht) {
                // Mobile: Aus dem day-name div im Header
                const dayNameDiv = element.querySelector('.day-name');
                if (dayNameDiv) {
                    // Extrahiere nur den Wochentag-Text (vor dem ersten Leerzeichen oder Klammer)
                    const text = dayNameDiv.textContent.trim();
                    // Entferne Status-Text wie "(Urlaub)" oder "(Krank)"
                    wochentag = text.split(/[\s(]/)[0] || '';
                }
            } else {
                // Desktop: Zweite Spalte (children[1] ist die Wochentag-Spalte)
                const wochentagZelle = element.children[1];
                if (wochentagZelle) {
                    wochentag = wochentagZelle.textContent.trim();
                }
            }
            
            druckDaten.zeilen.push({
                tag: tag,
                wochentag: wochentag,
                von1: getFeldWert('von1'),
                bis1: getFeldWert('bis1'),
                von2: getFeldWert('von2'),
                bis2: getFeldWert('bis2'),
                vornach: getFeldWert('vornach'),
                stunden: stundenWert,
                gesamt: gesamtWert,  // Korrekt berechnete kumulative Summe
                istWochenende: element.classList.contains('weekend-row')
            });
        });
        
        // Daten in sessionStorage speichern
        sessionStorage.setItem('druckDaten', JSON.stringify(druckDaten));
        
        // Öffne die separate Druckansicht-Seite
        const druckFenster = window.open('druckansicht.html', '_blank', 'width=1000,height=800');
        
        if (!druckFenster) {
            alert('Popup wurde blockiert! Bitte erlauben Sie Popups für diese Seite.');
        }

    } catch (error) {
        alert('Fehler beim Öffnen der Druckansicht: ' + error.message);
    }
}

// Made with Bob


// ===================================
// Stundenrechner Funktionen
// ===================================

// Event Listener für Stundenrechner Buttons
document.getElementById('btnStundenrechner')?.addEventListener('click', function() {
    zeigeModal('stundenrechnerModal');
});

document.getElementById('btnMobileStundenrechner')?.addEventListener('click', function() {
    zeigeModal('stundenrechnerModal');
});

// Event Listener für Rechenoperationen
document.querySelectorAll('.calc-op').forEach(button => {
    button.addEventListener('click', function() {
        // Entferne aktive Klasse von allen Buttons
        document.querySelectorAll('.calc-op').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Füge aktive Klasse zum geklickten Button hinzu
        this.classList.add('active');
        
        // Führe Berechnung aus
        berechneZeit(this.dataset.op);
    });
});

// Reset Button
document.getElementById('btnCalcReset')?.addEventListener('click', function() {
    document.getElementById('calcZeit1').value = '';
    document.getElementById('calcZeit2').value = '';
    document.getElementById('calcErgebnis').textContent = '--:--';
    document.querySelectorAll('.calc-op').forEach(btn => {
        btn.classList.remove('active');
    });
});

function berechneZeit(operation) {
    const zeit1Input = document.getElementById('calcZeit1').value.trim();
    const zeit2Input = document.getElementById('calcZeit2').value.trim();
    const ergebnisElement = document.getElementById('calcErgebnis');
    
    // Validierung
    if (!zeit1Input || !zeit2Input) {
        ergebnisElement.textContent = 'Bitte beide Zeiten eingeben';
        ergebnisElement.parentElement.classList.remove('alert-info', 'alert-success');
        ergebnisElement.parentElement.classList.add('alert-warning');
        return;
    }
    
    // Parse Zeiten
    const zeit1 = parseZeitZuMinuten(zeit1Input);
    const zeit2 = parseZeitZuMinuten(zeit2Input);
    
    if (zeit1 === null || zeit2 === null) {
        ergebnisElement.textContent = 'Ungültiges Zeitformat';
        ergebnisElement.parentElement.classList.remove('alert-info', 'alert-success');
        ergebnisElement.parentElement.classList.add('alert-warning');
        return;
    }
    
    let ergebnisMinuten;
    
    // Berechnung basierend auf Operation
    switch(operation) {
        case 'add':
            ergebnisMinuten = zeit1 + zeit2;
            break;
        case 'subtract':
            ergebnisMinuten = zeit1 - zeit2;
            break;
        case 'multiply':
            // Bei Multiplikation: Zeit1 * Faktor (Zeit2 als Dezimalzahl)
            const faktor = zeit2 / 60; // Konvertiere Minuten zu Dezimalstunden
            ergebnisMinuten = Math.round(zeit1 * faktor);
            break;
        case 'divide':
            // Bei Division: Zeit1 / Divisor (Zeit2 als Dezimalzahl)
            if (zeit2 === 0) {
                ergebnisElement.textContent = 'Division durch Null nicht möglich';
                ergebnisElement.parentElement.classList.remove('alert-info', 'alert-success');
                ergebnisElement.parentElement.classList.add('alert-warning');
                return;
            }
            const divisor = zeit2 / 60; // Konvertiere Minuten zu Dezimalstunden
            ergebnisMinuten = Math.round(zeit1 / divisor);
            break;
        default:
            ergebnisElement.textContent = 'Ungültige Operation';
            ergebnisElement.parentElement.classList.remove('alert-info', 'alert-success');
            ergebnisElement.parentElement.classList.add('alert-warning');
            return;
    }
    
    // Formatiere Ergebnis
    const ergebnisText = formatMinutenZuZeit(ergebnisMinuten);
    ergebnisElement.textContent = ergebnisText;
    ergebnisElement.parentElement.classList.remove('alert-warning', 'alert-info');
    ergebnisElement.parentElement.classList.add('alert-success');
}

function parseZeitZuMinuten(zeitString) {
    // Unterstützt Format HH:MM oder H:MM
    const pattern = /^(-?)(\d+):(\d{2})$/;
    const match = zeitString.match(pattern);
    
    if (!match) {
        return null;
    }
    
    const negativ = match[1] === '-';
    const stunden = parseInt(match[2]);
    const minuten = parseInt(match[3]);
    
    if (isNaN(stunden) || isNaN(minuten) || minuten >= 60) {
        return null;
    }
    
    const gesamtMinuten = stunden * 60 + minuten;
    return negativ ? -gesamtMinuten : gesamtMinuten;
}

function formatMinutenZuZeit(minuten) {
    const negativ = minuten < 0;
    const absolutMinuten = Math.abs(minuten);
    
    const stunden = Math.floor(absolutMinuten / 60);
    const restMinuten = absolutMinuten % 60;
    
    const vorzeichen = negativ ? '-' : '';
    return `${vorzeichen}${stunden}:${restMinuten.toString().padStart(2, '0')}`;
}
