# Modularisierungs-Plan für app-v3.js

## Übersicht
Die Datei `app-v3.js` (ca. 5900 Zeilen) soll in sinnvolle, wartbare Module aufgeteilt werden.

## Ziel-Struktur

```
js/
├── constants.js          ✅ ERSTELLT - Konstanten und globale Variablen
├── utils.js             🔄 IN ARBEIT - Utility-Funktionen
├── urlaubskalender.js   ⏳ AUSSTEHEND - Urlaubsverwaltung
├── zeiterfassung.js     ⏳ AUSSTEHEND - Zeiterfassung & Berechnungen
├── storage.js           ⏳ AUSSTEHEND - LocalStorage Funktionen
├── export.js            ⏳ AUSSTEHEND - Export/Import
├── stundenrechner.js    ⏳ AUSSTEHEND - Stundenrechner
├── main.js              ⏳ AUSSTEHEND - Initialisierung & Events
└── app-v3.js            🗑️ WIRD ERSETZT
```

## Detaillierte Modul-Beschreibungen

### 1. constants.js ✅ ERSTELLT
**Zeilen in app-v3.js:** 1-56  
**Größe:** ~63 Zeilen  
**Status:** Fertig

**Inhalt:**
- Feature Flags (FEATURES)
- Konstanten (DEFAULT_WOCHENSTUNDEN, MOBILE_BREAKPOINT, etc.)
- Feldnamen (FIELDS)
- Monatsnamen und Wochentage
- Globale Variablen (aktuellesJahr, aktuellerMonat, etc.)
- DATEN_VERSION

**Abhängigkeiten:** Keine

---

### 2. utils.js 🔄 IN ARBEIT
**Zeilen in app-v3.js:** 56-490  
**Geschätzte Größe:** ~500 Zeilen  
**Status:** In Arbeit

**Inhalt:**
- **Sicherheitsfunktionen:**
  - `escapeHtml()` - XSS-Schutz
  - `sanitizeInput()` - Input-Validierung
  - `createElementSafe()` - Sichere DOM-Erstellung
  - `createElementWithChildren()` - Element mit Kindern
  - `setElementContentSafe()` - Sicherer Content-Setter
  
- **Mobile Card Helpers:**
  - `erstelleMobileCardHeader()` - Card-Header erstellen
  - `erstelleMobileInputFeld()` - Input-Feld erstellen
  
- **LocalStorage Utilities:**
  - `holeUrlaubstageIndex()` - Index holen
  - `speichereUrlaubstageIndex()` - Index speichern
  - `setzeUrlaubstag()` - Urlaubstag setzen
  - `holeUrlaubstag()` - Urlaubstag holen
  - `setzeKrankstatus()` - Krankstatus setzen
  - `holeKrankstatus()` - Krankstatus holen
  - `loescheUrlaubUndKrank()` - Löschen
  - `erstelleDatumFuerTag()` - Datum erstellen
  - `loescheTagKomplett()` - Tag komplett löschen
  
- **UI Utilities:**
  - `zeigeToast()` - Toast-Benachrichtigungen
  - `formatiereDatumLokal()` - Datum formatieren
  - `addDays()` - Tage addieren

**Abhängigkeiten:** constants.js

---

### 3. urlaubskalender.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 490-1820  
**Geschätzte Größe:** ~1330 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **Urlaubsverwaltung:**
  - `getBeschaeftigungsgrad()` - Beschäftigungsgrad holen
  - `berechneTaeglicheUrlaubsstunden()` - Tägliche Stunden berechnen
  - `ladeUrlaubstage()` - Urlaubstage laden
  - `zeigeAlleUrlaubstageImLocalStorage()` - Debug-Funktion
  - `bereinigeDummyEintraege()` - Cleanup
  - `bereinigeVerwaisteKranktage()` - Cleanup
  - `speichereUrlaubstage()` - DEPRECATED
  - `berechneUrlaubstageAusStunden()` - Berechnung
  - `aktualisiereUrlaubstageProTag()` - Update
  - `istKranktag()` - Prüfung
  - `aktualisiereUrlaubskalenderBadge()` - Badge aktualisieren
  - `istUrlaubstag()` - Prüfung
  - `berechneUrlaubstage()` - Berechnung
  - `aktualisiereUrlaubsliste()` - Liste aktualisieren
  - `fuegeUrlaubHinzu()` - Urlaub hinzufügen
  - `zeigeTageKonfiguration()` - Konfiguration anzeigen
  - `versteckeTageKonfiguration()` - Konfiguration verstecken
  - `fuegeKonfigurierteTageHinzu()` - Konfigurierte Tage hinzufügen
  - `fuegeUrlaubstagAutomatischHinzu()` - Automatisch hinzufügen
  - `loescheUrlaubseintraege()` - Einträge löschen
  - `initUrlaubskalenderEvents()` - Event-Listener
  - `initUrlaubsOptimierungEvents()` - Optimierungs-Events
  
- **Urlaubsoptimierung:**
  - `optimiereUrlaub()` - Hauptfunktion
  - `istDatumFeiertag()` - Feiertag prüfen
  - `findeOptimaleUrlaubsperioden()` - Perioden finden
  - `berechneBenoetigteUrlaubstage()` - Berechnung
  - `berechneFreieTage()` - Berechnung
  - `zeigeOptimierungsErgebnisse()` - Ergebnisse anzeigen

**Abhängigkeiten:** constants.js, utils.js

---

### 4. zeiterfassung.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 2573-4460  
**Geschätzte Größe:** ~1900 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **Monatsverwaltung:**
  - `ladeMonat()` - Monat laden
  - `scrollZuAktuellemTag()` - Scroll-Funktion
  - `berechneSollStundenAutomatisch()` - SOLL-Stunden berechnen
  
- **Tag/Woche Kopieren:**
  - `kopiereTag()` - Tag kopieren
  - `fuegeTagEin()` - Tag einfügen
  - `kopiereWoche()` - Woche kopieren
  - `fuegeWocheEin()` - Woche einfügen
  - `markiereGeaenderteWoche()` - Markierung
  
- **Zeilen/Cards erstellen:**
  - `macheStundenFelderEditierbar()` - Editierbar machen
  - `erstelleZeile()` - Desktop-Zeile erstellen
  - `erstelleMobileCard()` - Mobile-Card erstellen
  - `erstelleZeiterfassungsFelder()` - Zeitfelder erstellen
  - `erstelleMobileCardButtons()` - Buttons erstellen
  
- **Berechnungen:**
  - `berechneZeile()` - Zeile berechnen
  - `berechneAlleZeilen()` - Alle Zeilen berechnen
  - `parseStundenZuDezimal()` - Parsing
  - `formatStunden()` - Formatierung
  - `normalisiereZeitEingabe()` - Normalisierung
  - `aktualisiereZusammenfassung()` - Zusammenfassung

**Abhängigkeiten:** constants.js, utils.js, urlaubskalender.js

---

### 5. storage.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 4460-5290  
**Geschätzte Größe:** ~830 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **LocalStorage Funktionen:**
  - `getMonatsKey()` - Monats-Key generieren
  - `ladeDatenAusLocalStorage()` - Daten laden
  - `speichereDatenInLocalStorage()` - Daten speichern
  - `ladeDatenFuerMonat()` - Monatsdaten laden
  - `ladeUebertragVormonat()` - Übertrag laden
  - `speichereUebertragVormonat()` - Übertrag speichern
  - `ladeSollStunden()` - SOLL-Stunden laden
  - `speichereSollStunden()` - SOLL-Stunden speichern
  
- **Zeilen-Speicherung:**
  - `findeAktivesElement()` - Element finden
  - `extrahiereFeldDaten()` - Daten extrahieren
  - `speichereFeldDatenInLocalStorage()` - Felder speichern
  - `behandleUrlaubKrankAenderung()` - Urlaub/Krank behandeln
  - `aktualisiereVisuellMarkierungen()` - Markierungen
  - `holeZeile()` - Zeile holen
  - `speichereZeile()` - Zeile speichern
  - `synchronisiereAnsichten()` - Sync Desktop/Mobile
  - `markiereAlsUngespeichert()` - Markierung
  - `entferneUngespeichertMarkierung()` - Markierung entfernen
  
- **Stammdaten:**
  - `speichereStammdaten()` - Stammdaten speichern
  - `ladeStammdaten()` - Stammdaten laden
  - `speichereWochenstunden()` - Wochenstunden speichern
  - `ladeWochenstunden()` - Wochenstunden laden
  - `aktualisiereStundenProTagAnzeige()` - Anzeige aktualisieren
  - `speichereBundesland()` - Bundesland speichern
  - `ladeBundesland()` - Bundesland laden

**Abhängigkeiten:** constants.js, utils.js

---

### 6. export.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 5490-5895  
**Geschätzte Größe:** ~405 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **Export-Funktionen:**
  - `exportiereCSV()` - CSV-Export
  - `drucken()` - Druckansicht
  
- **Import-Funktionen:**
  - `importiereCSV()` - CSV-Import
  - `verarbeiteCSVDatei()` - CSV verarbeiten

**Abhängigkeiten:** constants.js, utils.js, storage.js

---

### 7. stundenrechner.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 5900-5950  
**Geschätzte Größe:** ~50 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **Stundenrechner:**
  - Event-Listener für Stundenrechner-Buttons
  - Rechenoperationen (Addition, Subtraktion, Multiplikation, Division)
  - Reset-Funktion

**Abhängigkeiten:** constants.js, utils.js

---

### 8. main.js ⏳ AUSSTEHEND
**Zeilen in app-v3.js:** 1820-2495, 1910-2442  
**Geschätzte Größe:** ~1200 Zeilen  
**Status:** Ausstehend

**Inhalt:**
- **Initialisierung:**
  - `DOMContentLoaded` Event-Handler
  - `initJahrSelect()` - Jahr-Select initialisieren
  - `initEventListeners()` - Event-Listener initialisieren
  - `pruefeUndLadeMonat()` - Monat laden mit Prüfung
  
- **Feiertage:**
  - `ladeFeiertage()` - Feiertage laden
  - `istFeiertag()` - Feiertag prüfen
  
- **Event-Handler:**
  - Monatswechsel
  - Jahreswechsel
  - Stammdaten-Änderungen
  - Button-Klicks
  - Input-Änderungen
  - Responsive-Handling

**Abhängigkeiten:** Alle anderen Module

---

## Migrations-Reihenfolge

### Phase 1: Basis-Module ✅
1. ✅ `constants.js` - Erstellt
2. 🔄 `utils.js` - In Arbeit

### Phase 2: Kern-Funktionalität
3. ⏳ `storage.js` - LocalStorage-Funktionen (wichtig für alle anderen)
4. ⏳ `urlaubskalender.js` - Urlaubsverwaltung

### Phase 3: Hauptfunktionen
5. ⏳ `zeiterfassung.js` - Zeiterfassung und Berechnungen

### Phase 4: Zusatz-Module
6. ⏳ `export.js` - Export/Import
7. ⏳ `stundenrechner.js` - Stundenrechner

### Phase 5: Integration
8. ⏳ `main.js` - Initialisierung und Event-Listener
9. ⏳ `index.html` - Script-Tags aktualisieren

### Phase 6: Testing & Cleanup
10. ⏳ Tests durchführen
11. ⏳ `app-v3.js` umbenennen zu `app-v3.js.backup`
12. ⏳ Git-Commit

---

## Script-Lade-Reihenfolge in index.html

```html
<!-- Basis-Module (keine Abhängigkeiten) -->
<script src="js/constants.js?v=20260325c"></script>
<script src="js/utils.js?v=20260325c"></script>

<!-- Kern-Module (abhängig von Basis) -->
<script src="js/storage.js?v=20260325c"></script>
<script src="js/urlaubskalender.js?v=20260325c"></script>

<!-- Haupt-Module (abhängig von Kern) -->
<script src="js/zeiterfassung.js?v=20260325c"></script>

<!-- Zusatz-Module -->
<script src="js/export.js?v=20260325c"></script>
<script src="js/stundenrechner.js?v=20260325c"></script>

<!-- Initialisierung (muss zuletzt geladen werden) -->
<script src="js/main.js?v=20260325c"></script>
```

---

## Abhängigkeits-Graph

```
constants.js (keine Abhängigkeiten)
    ↓
utils.js (benötigt: constants.js)
    ↓
    ├─→ storage.js (benötigt: constants.js, utils.js)
    ├─→ urlaubskalender.js (benötigt: constants.js, utils.js)
    ├─→ stundenrechner.js (benötigt: constants.js, utils.js)
    └─→ export.js (benötigt: constants.js, utils.js, storage.js)
         ↓
zeiterfassung.js (benötigt: constants.js, utils.js, urlaubskalender.js, storage.js)
    ↓
main.js (benötigt: ALLE Module)
```

---

## Test-Checkliste nach jeder Phase

- [ ] Seite lädt ohne JavaScript-Fehler
- [ ] Monatswechsel funktioniert
- [ ] Zeiterfassung funktioniert (Von/Bis Eingabe)
- [ ] Berechnungen sind korrekt
- [ ] Urlaubskalender funktioniert
- [ ] Urlaubstage werden korrekt angezeigt
- [ ] Kopieren/Einfügen funktioniert
- [ ] Export/Import funktioniert
- [ ] Druckansicht funktioniert
- [ ] Mobile-Ansicht funktioniert
- [ ] Stundenrechner funktioniert
- [ ] LocalStorage speichert korrekt
- [ ] Keine Konsolen-Fehler

---

## Risiken & Mitigation

### Risiko 1: Globale Variablen
**Problem:** Viele Funktionen greifen auf globale Variablen zu  
**Lösung:** Globale Variablen bleiben in constants.js, alle Module greifen darauf zu

### Risiko 2: Zirkuläre Abhängigkeiten
**Problem:** Module könnten sich gegenseitig benötigen  
**Lösung:** Klare Hierarchie, main.js als letztes laden

### Risiko 3: Event-Listener
**Problem:** Event-Listener könnten vor DOM-Elementen registriert werden  
**Lösung:** Alle Event-Listener in main.js nach DOMContentLoaded

### Risiko 4: Funktions-Reihenfolge
**Problem:** Funktionen könnten vor ihrer Definition aufgerufen werden  
**Lösung:** Strikte Lade-Reihenfolge in index.html

---

## Nächste Schritte

1. ✅ constants.js erstellt
2. 🔄 utils.js fertigstellen
3. ⏳ storage.js erstellen
4. ⏳ urlaubskalender.js erstellen
5. ⏳ zeiterfassung.js erstellen
6. ⏳ export.js erstellen
7. ⏳ stundenrechner.js erstellen
8. ⏳ main.js erstellen
9. ⏳ index.html aktualisieren
10. ⏳ Testen

---

## Zeitschätzung

- **Phase 1 (Basis):** 30 Min ✅ 50% fertig
- **Phase 2 (Kern):** 1 Stunde
- **Phase 3 (Haupt):** 1.5 Stunden
- **Phase 4 (Zusatz):** 30 Min
- **Phase 5 (Integration):** 30 Min
- **Phase 6 (Testing):** 1 Stunde

**Gesamt:** ~5 Stunden

---

## Backup-Strategie

1. Vor jeder Phase: Git-Commit
2. `app-v3.js` wird NICHT gelöscht, sondern umbenannt
3. Bei Problemen: Zurück zu app-v3.js
4. Erst nach erfolgreichen Tests: app-v3.js löschen

---

**Erstellt:** 25.03.2026  
**Status:** In Arbeit  
**Nächster Schritt:** utils.js fertigstellen