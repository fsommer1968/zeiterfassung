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
let wochenstunden = 39.0; // Standard-Wochenstunden bei 100%
let bundesland = 'BW'; // Standard-Bundesland für Feiertage

// Deutsche Monatsnamen
const MONATSNAMEN = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Deutsche Wochentage (kurz)
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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
    
    // Stammdaten laden
    ladeStammdaten();
    
    // Event Listener initialisieren
    initEventListeners();
    
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
    
    // Stammdaten speichern bei Änderung
    document.getElementById('mitarbeiterName').addEventListener('change', speichereStammdaten);
    document.getElementById('beschaeftigungsgrad').addEventListener('change', function() {
        speichereStammdaten();
        berechneSollStundenAutomatisch();
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
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    });
    
    document.getElementById('btnMobileExportCSV').addEventListener('click', function() {
        exportiereCSV();
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    });
    
    document.getElementById('btnMobileImportCSV').addEventListener('click', function() {
        document.getElementById('csvFileInput').click();
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    });
    
    document.getElementById('btnMobileBackup').addEventListener('click', function() {
        erstelleBackup();
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    });
    
    document.getElementById('btnMobileRestore').addEventListener('click', function() {
        document.getElementById('backupFileInput').click();
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
    });
    
    // Wochenstunden speichern (Mobile)
    document.getElementById('btnWochenstundenSpeichernMobile').addEventListener('click', function() {
        speichereWochenstunden();
    });
    
    document.getElementById('btnMobileDrucken').addEventListener('click', function() {
        drucken();
        // Menü schließen
        const mobileMenu = document.getElementById('mobileMenu');
        const bsCollapse = new bootstrap.Collapse(mobileMenu, { toggle: false });
        bsCollapse.hide();
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
                if (field !== 'stunden') {
                    manuellEditierteStunden.delete(tag);
                    berechneZeile(tag, false);
                    berechneAlleZeilen();
                } else {
                    manuellEditierteStunden.add(tag);
                    berechneAlleZeilen(true);
                }
            }
        }
    }, true); // useCapture = true für bessere Event-Erfassung
    
    // Zeit-Normalisierung bei Blur (wenn Benutzer Feld verlässt)
    document.addEventListener('blur', function(e) {
        // Prüfe ob das Element ein time-input ist
        if (e.target && e.target.classList && e.target.classList.contains('time-input')) {
            const field = e.target.dataset.field;
            
            // Nur für Zeitfelder normalisieren (nicht für berechnete Felder)
            if (field && field !== 'stunden' && field !== 'gesamt') {
                const originalValue = e.target.value;
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

// ===================================
// Prüfe ungespeicherte Daten und lade Monat
// ===================================
async function pruefeUndLadeMonat() {
    const jahr = parseInt(document.getElementById('jahrSelect').value);
    const monat = parseInt(document.getElementById('monatSelect').value);
    
    // Prüfe ob es ungespeicherte Änderungen gibt
    if (ungespeicherteTage.size > 0) {
        // Zeige Bestätigungsdialog
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'warningModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">
                            <i class="bi bi-exclamation-triangle"></i> Ungespeicherte Änderungen
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Es gibt noch ungespeicherte Änderungen für ${ungespeicherteTage.size} Tag(e).</p>
                        <p>Möchten Sie den Monat wechseln? Ungespeicherte Änderungen gehen verloren.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle"></i> Abbrechen
                        </button>
                        <button type="button" class="btn btn-primary" id="btnMonatWechseln">
                            <i class="bi bi-arrow-right-circle"></i> Monat wechseln
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        
        // Event Listener für "Monat wechseln" Button
        document.getElementById('btnMonatWechseln').addEventListener('click', async function() {
            // Ungespeicherte Änderungen verwerfen
            ungespeicherteTage.clear();
            bsModal.hide();
            
            // Modal nach dem Schließen entfernen
            modal.addEventListener('hidden.bs.modal', async function() {
                modal.remove();
                // Jetzt Monat laden
                await ladeMonat(jahr, monat);
            });
        });
        
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
        // Bei Fehler leere Map zurückgeben
        return new Map();
    }
}

// Prüfe ob ein Datum ein Feiertag ist und gib den Namen zurück
function istFeiertag(jahr, monat, tag, feiertage) {
    if (!FEATURES.FEIERTAGE_LADEN) {
        return null; // Feature deaktiviert
    }
    
    // Formatiere Datum als YYYY-MM-DD ohne Zeitzone-Probleme
    const monatString = String(monat + 1).padStart(2, '0');
    const tagString = String(tag).padStart(2, '0');
    const datumString = `${jahr}-${monatString}-${tagString}`;
    
    return feiertage.get(datumString) || null;
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
        
        // Wochenende ODER Feiertag
        const istFreierTag = istWochenende || (feiertagName !== null);
        
        // Desktop: Tabellenzeile erstellen
        erstelleZeile(tag, wochentag, istFreierTag, feiertagName);
        
        // Mobile: Card erstellen
        erstelleMobileCard(tag, wochentag, istFreierTag, feiertagName);
    }
    
    
    // Gespeicherte Daten laden
    ladeDatenFuerMonat(jahr, monat);
    
    // Übertrag Vormonat laden
    ladeUebertragVormonat(jahr, monat);
    
    // SOLL-Stunden laden
    ladeSollStunden(jahr, monat);
    
    // Berechnungen durchführen
    berechneAlleZeilen();
    
    // Stelle sicher, dass alle Stunden-Felder editierbar sind
    macheStundenFelderEditierbar();
    
    // SOLL-Stunden automatisch berechnen
    berechneSollStundenAutomatisch();
}

// ===================================
// SOLL-Stunden automatisch berechnen
// ===================================
function berechneSollStundenAutomatisch() {
    const beschaeftigungsgradInput = document.getElementById('beschaeftigungsgrad').value;
    const sollStundenInput = document.getElementById('sollStunden');
    
    // Nur berechnen wenn Beschäftigungsgrad vorhanden und SOLL-Stunden leer oder 0:00
    if (!beschaeftigungsgradInput || (sollStundenInput.value && sollStundenInput.value !== '0:00' && sollStundenInput.value !== '')) {
        return; // Nicht überschreiben wenn bereits ein Wert vorhanden ist
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
    const ARBEITSTAGE_PRO_WOCHE = 5; // ← HIER ANPASSEN: Arbeitstage pro Woche
    
    // Verwende die globale Variable wochenstunden (wird aus Eingabefeld geladen)
    const stundenProTag = (wochenstunden * beschaeftigungsgrad) / ARBEITSTAGE_PRO_WOCHE;
    
    // Anzahl Arbeitstage im Monat ermitteln (ohne Wochenenden und Feiertage)
    const anzahlTage = new Date(aktuellesJahr, aktuellerMonat + 1, 0).getDate();
    let arbeitstage = 0;
    
    for (let tag = 1; tag <= anzahlTage; tag++) {
        const datum = new Date(aktuellesJahr, aktuellerMonat, tag);
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
    const istMobileAnsicht = window.innerWidth < 992;
    
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
    const istMobileAnsicht = window.innerWidth < 992;
    
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
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${typ === 'success' ? '#28a745' : '#ffc107'};
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
function erstelleZeile(tag, wochentag, istWochenende, feiertagName = null) {
    const tbody = document.getElementById('zeiterfassungBody');
    const tr = document.createElement('tr');
    tr.className = istWochenende ? 'weekend-row' : '';
    tr.dataset.tag = tag;
    
    // Tag
    const tdTag = document.createElement('td');
    tdTag.className = 'text-center fw-bold';
    if (feiertagName) {
        tdTag.innerHTML = `${tag}<br><small style="font-weight: normal; font-size: 0.8em;">${feiertagName}</small>`;
    } else {
        tdTag.textContent = tag;
    }
    tr.appendChild(tdTag);
    
    // Wochentag
    const tdWochentag = document.createElement('td');
    tdWochentag.className = 'text-center';
    tdWochentag.textContent = wochentag;
    tr.appendChild(tdWochentag);
    
    if (istWochenende) {
        // Wochenende - XXXXX vorbelegen, aber editierbar
        // Von 1
        const tdVon1 = document.createElement('td');
        const inputVon1 = document.createElement('input');
        inputVon1.type = 'text';
        inputVon1.className = 'time-input';
        inputVon1.value = 'XXXXX';
        inputVon1.dataset.field = 'von1';
        tdVon1.appendChild(inputVon1);
        tr.appendChild(tdVon1);
        
        // Bis 1
        const tdBis1 = document.createElement('td');
        const inputBis1 = document.createElement('input');
        inputBis1.type = 'text';
        inputBis1.className = 'time-input';
        inputBis1.value = 'XXXXX';
        inputBis1.dataset.field = 'bis1';
        tdBis1.appendChild(inputBis1);
        tr.appendChild(tdBis1);
        
        // Von 2
        const tdVon2 = document.createElement('td');
        const inputVon2 = document.createElement('input');
        inputVon2.type = 'text';
        inputVon2.className = 'time-input';
        inputVon2.value = 'XXXXX';
        inputVon2.dataset.field = 'von2';
        tdVon2.appendChild(inputVon2);
        tr.appendChild(tdVon2);
        
        // Bis 2
        const tdBis2 = document.createElement('td');
        const inputBis2 = document.createElement('input');
        inputBis2.type = 'text';
        inputBis2.className = 'time-input';
        inputBis2.value = 'XXXXX';
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
        inputStunden.value = 'XXXXX';
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
        btnWocheKopieren.innerHTML = '<i class="bi bi-calendar-week"></i>';
        btnWocheKopieren.title = 'vergangene Woche kopieren';
        btnWocheKopieren.addEventListener('click', function() {
            kopiereWoche(tag);
        });
        wochenButtonRow.appendChild(btnWocheKopieren);
        
        // Woche Einfügen Button
        const btnWocheEinfuegen = document.createElement('button');
        btnWocheEinfuegen.className = 'btn btn-sm btn-outline-success';
        btnWocheEinfuegen.innerHTML = '<i class="bi bi-calendar-week-fill"></i>';
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
    btnKopieren.innerHTML = '<i class="bi bi-clipboard"></i>';
    btnKopieren.title = 'Tag kopieren';
    btnKopieren.addEventListener('click', function() {
        kopiereTag(tag);
    });
    tagesButtonRow.appendChild(btnKopieren);
    
    // Einfügen Button
    const btnEinfuegen = document.createElement('button');
    btnEinfuegen.className = 'btn btn-sm btn-outline-info';
    btnEinfuegen.innerHTML = '<i class="bi bi-clipboard-check"></i>';
    btnEinfuegen.title = 'Tag einfügen';
    btnEinfuegen.addEventListener('click', function() {
        fuegeTagEin(tag);
    });
    tagesButtonRow.appendChild(btnEinfuegen);
    
    // Speichern Button
    const btnSpeichern = document.createElement('button');
    btnSpeichern.className = 'btn btn-sm btn-primary btn-save-row';
    btnSpeichern.innerHTML = '<i class="bi bi-save"></i>';
    btnSpeichern.title = 'Zeile speichern';
    btnSpeichern.addEventListener('click', function() {
        speichereZeileMitFeedback(tag);
    });
    tagesButtonRow.appendChild(btnSpeichern);
    
    buttonContainer.appendChild(tagesButtonRow);
    tdAktion.appendChild(buttonContainer);
    
    tr.appendChild(tdAktion);
    
    tbody.appendChild(tr);
}

// ===================================
// Mobile Card erstellen
// ===================================
function erstelleMobileCard(tag, wochentag, istWochenende, feiertagName = null) {
    const container = document.getElementById('mobileCardContainer');
    
    if (!container) {
        return;
    }
    
    // Card erstellen
    const card = document.createElement('div');
    card.className = `day-card ${istWochenende ? 'weekend-card' : ''}`;
    card.dataset.tag = tag;
    
    // Card Header
    const header = document.createElement('div');
    header.className = `day-card-header ${istWochenende ? 'weekend-header' : ''}`;
    const feiertagText = feiertagName ? `<div class="day-holiday" style="font-size: 0.85em; margin-top: 2px;">${feiertagName}</div>` : '';
    header.innerHTML = `
        <div>
            <div class="day-number">${tag}</div>
            <div class="day-name">${wochentag}</div>
            ${feiertagText}
        </div>
        <div>
            <i class="bi bi-${istWochenende ? 'moon' : 'sun'}"></i>
        </div>
    `;
    card.appendChild(header);
    
    // Card Body
    const body = document.createElement('div');
    body.className = 'day-card-body';
    
    if (istWochenende) {
        // Wochenende - Mit allen Feldern wie VBA
        body.innerHTML = `
            <div class="time-group">
                <label class="time-group-label">Arbeitszeit 1 (optional)</label>
                <div class="time-row">
                    <div class="time-field">
                        <label>Von</label>
                        <input type="text" class="time-input" placeholder="HH:MM"
                               data-field="von1" value="XXXXX">
                    </div>
                    <div class="time-field">
                        <label>Bis</label>
                        <input type="text" class="time-input" placeholder="HH:MM"
                               data-field="bis1" value="XXXXX">
                    </div>
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Arbeitszeit 2 (optional)</label>
                <div class="time-row">
                    <div class="time-field">
                        <label>Von</label>
                        <input type="text" class="time-input" placeholder="HH:MM"
                               data-field="von2" value="XXXXX">
                    </div>
                    <div class="time-field">
                        <label>Bis</label>
                        <input type="text" class="time-input" placeholder="HH:MM"
                               data-field="bis2" value="XXXXX">
                    </div>
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Vor/Nachbereitung</label>
                <div class="time-field">
                    <input type="text" class="time-input" placeholder="HH:MM"
                           data-field="vornach">
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Stunden (editierbar)</label>
                <div class="time-field">
                    <input type="text" class="time-input calculated-field" placeholder="HH:MM"
                           data-field="stunden" value="XXXXX">
                </div>
            </div>
            
            <div class="calculated-display total-display">
                <span class="calculated-label">Gesamt kumuliert:</span>
                <span class="calculated-value" data-field="gesamt">XXXXX</span>
            </div>
            
            <div class="card-actions" style="display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;">
                ${wochentag === 'So' ? `
                <button class="btn btn-sm btn-outline-primary" onclick="kopiereWoche(${tag})" style="flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;">
                    <i class="bi bi-calendar-week"></i> vergangene Woche kopieren
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="fuegeWocheEin(${tag})" style="flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;">
                    <i class="bi bi-calendar-week-fill"></i> Woche einfügen
                </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-secondary" onclick="kopiereTag(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-clipboard"></i> Kopieren
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="fuegeTagEin(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-clipboard-check"></i> Einfügen
                </button>
                <button class="btn btn-sm btn-primary" onclick="speichereZeileMitFeedback(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-save"></i> Speichern
                </button>
            </div>
        `;
    } else {
        // Arbeitstag - Vollständige Ansicht
        body.innerHTML = `
            <div class="time-group">
                <label class="time-group-label">Arbeitszeit 1</label>
                <div class="time-row">
                    <div class="time-field">
                        <label>Von</label>
                        <input type="text" class="time-input" placeholder="HH:MM" data-field="von1">
                    </div>
                    <div class="time-field">
                        <label>Bis</label>
                        <input type="text" class="time-input" placeholder="HH:MM" data-field="bis1">
                    </div>
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Arbeitszeit 2 (optional)</label>
                <div class="time-row">
                    <div class="time-field">
                        <label>Von</label>
                        <input type="text" class="time-input" placeholder="HH:MM" data-field="von2">
                    </div>
                    <div class="time-field">
                        <label>Bis</label>
                        <input type="text" class="time-input" placeholder="HH:MM" data-field="bis2">
                    </div>
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Vor/Nachbereitung</label>
                <div class="time-field">
                    <input type="text" class="time-input" placeholder="HH:MM"
                           data-field="vornach">
                </div>
            </div>
            
            <div class="time-group">
                <label class="time-group-label">Stunden heute (editierbar)</label>
                <div class="time-field">
                    <input type="text" class="time-input calculated-field" placeholder="HH:MM"
                           data-field="stunden" value="0:00">
                </div>
            </div>
            
            <div class="calculated-display total-display">
                <span class="calculated-label">Gesamt kumuliert:</span>
                <span class="calculated-value" data-field="gesamt">0:00</span>
            </div>
            
            <div class="card-actions" style="display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;">
                ${wochentag === 'So' ? `
                <button class="btn btn-sm btn-outline-primary" onclick="kopiereWoche(${tag})" style="flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;">
                    <i class="bi bi-calendar-week"></i> vergangene Woche kopieren
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="fuegeWocheEin(${tag})" style="flex: 1 1 45%; font-size: 0.75rem; padding: 6px 8px;">
                    <i class="bi bi-calendar-week-fill"></i> Woche einfügen
                </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-secondary" onclick="kopiereTag(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-clipboard"></i> Kopieren
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="fuegeTagEin(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-clipboard-check"></i> Einfügen
                </button>
                <button class="btn btn-sm btn-primary" onclick="speichereZeileMitFeedback(${tag})" style="flex: 1; font-size: 0.8rem; padding: 6px 8px;">
                    <i class="bi bi-save"></i> Speichern
                </button>
            </div>
        `;
    }
    
    card.appendChild(body);
    container.appendChild(card);
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
    
    
    const von1Input = element.querySelector('[data-field="von1"]');
    const bis1Input = element.querySelector('[data-field="bis1"]');
    const von2Input = element.querySelector('[data-field="von2"]');
    const bis2Input = element.querySelector('[data-field="bis2"]');
    const vornachInput = element.querySelector('[data-field="vornach"]');
    
    if (!von1Input) {
        return;
    }
    
    const von1 = von1Input.value;
    const bis1 = bis1Input.value;
    const von2 = von2Input ? von2Input.value : '';
    const bis2 = bis2Input ? bis2Input.value : '';
    const vornachZeit = vornachInput ? vornachInput.value : '';
    
    
    // Stunden-Element finden aus dem ausgewählten Element
    const stundenElement = element.querySelector('[data-field="stunden"]');
    
    if (!stundenElement) {
        return;
    }
    
    // WICHTIG: Wenn dieses Feld manuell editiert wurde, NICHT überschreiben!
    if (manuellEditierteStunden.has(tag)) {
        return; // Berechnung überspringen für manuell editierte Felder
    }
    
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
    if (!skipStundenUpdate) {
        const formatted = formatStunden(gesamtStunden);
        
        if (stundenElement.tagName === 'INPUT') {
            stundenElement.value = formatted;
        } else {
            stundenElement.textContent = formatted;
        }
    }
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
        
        // Zeile/Card berechnen - mit skipStundenUpdate Parameter
        berechneZeile(tag, skipStundenUpdate);
        
        // Stunden dieser Zeile holen (Desktop oder Mobile)
        let stundenWert = '0:00';
        
        if (zeilen[i]) {
            const stundenInput = zeilen[i].querySelector('[data-field="stunden"]');
            stundenWert = stundenInput.value;
        } else if (cards[i]) {
            const stundenInput = cards[i].querySelector('[data-field="stunden"]');
            if (stundenInput) {
                stundenWert = stundenInput.value;
            }
        }
        
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
            gesamtInput.value = formatted;
        }
        
        // Mobile
        if (cards[i]) {
            const gesamtSpan = cards[i].querySelector('[data-field="gesamt"]');
            gesamtSpan.textContent = formatted;
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
function ladeDatenAusLocalStorage() {
    const gespeichert = localStorage.getItem('zeiterfassungDaten');
    if (gespeichert) {
        try {
            zeiterfassungDaten = JSON.parse(gespeichert);
        } catch (e) {
            zeiterfassungDaten = {};
        }
    }
}

function speichereDatenInLocalStorage() {
    localStorage.setItem('zeiterfassungDaten', JSON.stringify(zeiterfassungDaten));
}

function getMonatsKey(jahr, monat) {
    return `${jahr}-${monat.toString().padStart(2, '0')}`;
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
            
            // Desktop: Tabellenzeile
            const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
            if (tr) {
                Object.keys(tagDaten).forEach(field => {
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
// ===================================
function speichereZeile(tag) {
    
    // Desktop: Tabellenzeile
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    // Mobile: Card
    const card = document.querySelector(`#mobileCardContainer .day-card[data-tag="${tag}"]`);
    
    // Prüfe welche Ansicht aktiv ist (basierend auf Bildschirmbreite)
    const istMobileAnsicht = window.innerWidth < 992;
    
    // Wähle das richtige Element basierend auf der aktiven Ansicht
    let element;
    if (istMobileAnsicht && card) {
        element = card;
    } else if (tr) {
        element = tr;
    } else {
        element = card || tr;
    }

    if (!element) {
        return;
    }
    
    const key = getMonatsKey(aktuellesJahr, aktuellerMonat);
    
    if (!zeiterfassungDaten[key]) {
        zeiterfassungDaten[key] = { tage: {} };
    }
    
    if (!zeiterfassungDaten[key].tage[tag]) {
        zeiterfassungDaten[key].tage[tag] = {};
    }
    
    // Alle Felder speichern (inputs und spans)
    const inputs = element.querySelectorAll('input[data-field], span[data-field]');
    inputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value || input.textContent;
        zeiterfassungDaten[key].tage[tag][field] = value;
    });
    
    // Manuell editierte Stunden-Felder speichern
    zeiterfassungDaten[key].manuellEditierteStunden = Array.from(manuellEditierteStunden);
    
    speichereDatenInLocalStorage();
    
    // Synchronisiere die andere Ansicht (Desktop <-> Mobile)
    synchronisiereAnsichten(tag);
    
    berechneAlleZeilen();
    
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
    
    // Desktop Tabelle aktualisieren
    const tr = document.querySelector(`#zeiterfassungBody tr[data-tag="${tag}"]`);
    if (tr) {
        Object.keys(tagDaten).forEach(field => {
            const input = tr.querySelector(`[data-field="${field}"]`);
            if (input && input.tagName === 'INPUT') {
                input.value = tagDaten[field];
            }
        });
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
    const stammdaten = {
        mitarbeiterName: document.getElementById('mitarbeiterName').value,
        beschaeftigungsgrad: document.getElementById('beschaeftigungsgrad').value
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
    
    // SOLL-Stunden neu berechnen
    berechneSollStundenAutomatisch();
    
    alert('Wochenstunden gespeichert: ' + wert);
}

function ladeWochenstunden() {
    const gespeichert = localStorage.getItem('wochenstunden');
    
    if (gespeichert) {
        // Setze beide Eingabefelder
        document.getElementById('wochenstunden').value = gespeichert;
        document.getElementById('wochenstundenMobile').value = gespeichert;
        
        // Parse zu Dezimalwert
        const parts = gespeichert.split(':');
        const stunden = parseInt(parts[0]);
        const minuten = parseInt(parts[1]);
        wochenstunden = stunden + (minuten / 60);
    } else {
        // Standardwert 39:00
        document.getElementById('wochenstunden').value = '39:00';
        document.getElementById('wochenstundenMobile').value = '39:00';
        wochenstunden = 39.0;
    }
    
    // Bundesland laden
    ladeBundesland();
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
        // Sammle alle Daten aus localStorage
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            zeiterfassungDaten: zeiterfassungDaten,
            stammdaten: JSON.parse(localStorage.getItem('stammdaten') || '{}')
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
            
            // Daten wiederherstellen
            zeiterfassungDaten = backup.zeiterfassungDaten;
            
            // Stammdaten wiederherstellen
            if (backup.stammdaten) {
                localStorage.setItem('stammdaten', JSON.stringify(backup.stammdaten));
            }
            
            // In localStorage speichern
            speichereDatenInLocalStorage();
            
            // Stammdaten laden
            ladeStammdaten();
            
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

function drucken() {
    try {
        // Sammle alle Daten für die Druckansicht
        const tbody = document.getElementById('zeiterfassungBody');
        if (!tbody) {
            return;
        }
        
        const zeilen = tbody.querySelectorAll('tr');
        
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
            zeilen: []
        };
        
        
        // Alle Zeilen sammeln
        zeilen.forEach(tr => {
            druckDaten.zeilen.push({
                tag: tr.dataset.tag,
                wochentag: tr.children[1].textContent,
                von1: tr.querySelector('[data-field="von1"]').value || '',
                bis1: tr.querySelector('[data-field="bis1"]').value || '',
                von2: tr.querySelector('[data-field="von2"]').value || '',
                bis2: tr.querySelector('[data-field="bis2"]').value || '',
                vornach: tr.querySelector('[data-field="vornach"]').value || '',
                stunden: tr.querySelector('[data-field="stunden"]').value || '',
                gesamt: tr.querySelector('[data-field="gesamt"]').value || '',
                istWochenende: tr.classList.contains('weekend-row')
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
    const modal = new bootstrap.Modal(document.getElementById('stundenrechnerModal'));
    modal.show();
});

document.getElementById('btnMobileStundenrechner')?.addEventListener('click', function() {
    const modal = new bootstrap.Modal(document.getElementById('stundenrechnerModal'));
    modal.show();
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
