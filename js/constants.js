// ===================================
// Zeiterfassung Web App - Konstanten
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

// Deutsche Monatsnamen
const MONATSNAMEN = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Deutsche Wochentage (kurz)
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Aktuelle Version der Datenstruktur
const DATEN_VERSION = 1;

// ===================================
// GLOBALE VARIABLEN
// ===================================
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

// Made with Bob
