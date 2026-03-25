# Zeiterfassung Web App

Eine moderne, responsive Web-Anwendung zur Erfassung von Arbeitszeiten mit umfangreichen Funktionen für die tägliche Zeitverwaltung. Vollständig offline nutzbar, alle Daten bleiben lokal im Browser.

## Funktionen

### Kernfunktionen
- **Monatliche Zeiterfassung**: Erfassen Sie Ihre Arbeitszeiten für jeden Tag des Monats
- **Flexible Zeiterfassung**: Bis zu zwei Arbeitszeiten pro Tag (z.B. Vormittag und Nachmittag)
- **Automatische Berechnungen**: Automatische Berechnung von Tages- und Gesamtstunden
- **SOLL-IST-Vergleich**: Vergleich zwischen Soll-Stunden und tatsächlich geleisteten Stunden
- **Übertragsfunktion**: Übertrag von Mehr- oder Minderstunden in den Folgemonat

### Erweiterte Funktionen
- **Urlaubskalender**: Integrierte Urlaubsverwaltung
  - Urlaubsperioden hinzufügen und verwalten
  - Automatische Berechnung von Urlaubstagen (ohne Wochenenden und Feiertage)
  - Unterstützung für halbe Urlaubstage (0.5 Tage bei 4h Arbeit)
  - **Urlaubsoptimierung**: Intelligente Vorschläge für optimale Urlaubsplanung
    - Findet Brückentage und lange Wochenenden
    - Zeigt Effizienz (freie Tage pro Urlaubstag)
    - Berücksichtigt Feiertage des gewählten Bundeslandes
    - Sortiert nach Effizienz
  - Urlaubstage werden automatisch im Monatsblatt eingetragen
  - Übersichtliche Liste aller geplanten Urlaubstage
  - Verfügbar in Desktop- und Mobile-Ansicht
- **Stundenrechner**: Integrierter Rechner für Zeitberechnungen mit vier Grundrechenarten
  - Addition von Zeiten
  - Subtraktion von Zeiten
  - Multiplikation von Zeiten
  - Division von Zeiten
- **Wochenfunktionen**: Kopieren und Einfügen ganzer Wochen
- **Tagfunktionen**: Kopieren und Einfügen einzelner Tage
- **Feiertage**: Automatische Berücksichtigung von Feiertagen nach Bundesland
  - Feiertagsnamen werden in Spalte 1 angezeigt (z.B. "Ostermontag", "Karfreitag")
  - Feiertage werden automatisch als freie Tage markiert
- **Kranktage**: Separate Erfassung von Krankheitstagen
  - Kranktage werden wie Urlaubstage erfasst, aber separat gezählt
  - Eingabe durch "Krank" im Von1-Feld
  - Automatische Berechnung der Arbeitsstunden basierend auf Beschäftigungsgrad
- **Druckfunktion**: Professionelle Druckansicht für Monatsübersichten
  - Optimiert für A4-Format
  - Zeigt alle relevanten Informationen (Wochentag, Zeiten, Stunden, Gesamt)
  - Funktioniert sowohl aus Desktop- als auch Mobile-Ansicht
  - Urlaubstage werden in der Zusammenfassung angezeigt

### Datenverwaltung
- **Lokale Speicherung**: Alle Daten werden lokal im Browser gespeichert
- **CSV Export/Import**: Export und Import von Zeitdaten im CSV-Format
- **Backup-Funktion**: Erstellen und Wiederherstellen von Backups
- **Automatisches Speichern**: Änderungen werden automatisch gespeichert

### Benutzerfreundlichkeit
- **Responsive Design**: Optimiert für Desktop, Tablet und Smartphone
  - Desktop: Tabellenansicht mit allen Funktionen
  - Mobile: Card-basierte Ansicht für bessere Touch-Bedienung
  - Automatischer Wechsel bei Bildschirmbreite < 992px
- **Intuitive Bedienung**: Einfache und übersichtliche Benutzeroberfläche
- **Visuelle Rückmeldungen**: Farbliche Kennzeichnung von Wochenenden, Feiertagen, Urlaubs- und Kranktagen
- **Schnellaktionen**: Häufig verwendete Funktionen direkt zugänglich
- **Toast-Benachrichtigungen**: Visuelle Bestätigung bei Aktionen
- **Editierbare Stunden-Felder**: Manuelle Korrektur von automatisch berechneten Stunden möglich

## Technische Details

### Technologien
- HTML5
- CSS3 (Bootstrap 5)
- JavaScript (Vanilla JS)
- Bootstrap Icons
- LocalStorage API

### Browser-Kompatibilität
- Chrome/Edge (empfohlen)
- Firefox
- Safari
- Opera

### Systemanforderungen
- Moderner Webbrowser mit JavaScript-Unterstützung
- LocalStorage-Unterstützung (für Datenspeicherung)
- Mindestens 1024x768 Bildschirmauflösung empfohlen
- Internetverbindung nur für Bootstrap CDN erforderlich (optional)

### Installation
1. Laden Sie alle Dateien in ein Verzeichnis
2. Öffnen Sie die `index.html` in einem modernen Webbrowser
3. Keine Installation oder Server erforderlich
4. Die App funktioniert vollständig offline (nach erstem Laden)

**Hinweis für Feiertage:**
- Bei Verwendung mit `file://` Protokoll: Nur Wochenenden werden markiert
- Bei Verwendung mit Webserver (http/https): Feiertage werden automatisch geladen
- Feature-Flag in `js/app-v3.js` kann angepasst werden: `FEATURES.FEIERTAGE_LADEN`

## Verwendung

### Erste Schritte
1. Geben Sie Ihren Namen und Beschäftigungsgrad ein
2. Wählen Sie Jahr und Monat aus
3. Geben Sie die SOLL-Stunden für den Monat ein
4. Erfassen Sie Ihre täglichen Arbeitszeiten
5. Die Berechnungen erfolgen automatisch

### Urlaubsverwaltung
1. Öffnen Sie den Urlaubskalender (oberhalb der Zeiterfassungstabelle)
2. Wählen Sie das Start- und End-Datum Ihres Urlaubs
3. Klicken Sie auf "Urlaub hinzufügen"
4. Die Urlaubstage werden automatisch berechnet (nur Werktage, ohne Wochenenden und Feiertage)
5. Beim Einrichten des Monatsblatts werden Urlaubstage automatisch mit "Urlaub" vorbelegt
6. Urlaubstage können jederzeit gelöscht werden

**Hinweis:** Die Berechnung berücksichtigt automatisch das eingestellte Bundesland für Feiertage.

**Halbe Urlaubstage:** Wenn Sie an einem Urlaubstag nur 4 Stunden arbeiten, wird automatisch 0.5 Urlaubstage berechnet.

### Urlaubsoptimierung
1. Klicken Sie auf "Optimieren" im Urlaubskalender
2. Das System analysiert alle Feiertage des gewählten Jahres
3. Sie erhalten Vorschläge für:
   - Brückentage (1 Urlaubstag → 4 Tage frei)
   - Lange Wochenenden
   - Feiertags-Kombinationen
4. Jeder Vorschlag zeigt:
   - Benötigte Urlaubstage
   - Gesamte freie Tage
   - Effizienz-Faktor
5. Klicken Sie auf "Übernehmen" um den Urlaub direkt einzutragen

**Beispiel:** Fällt ein Feiertag auf einen Donnerstag, schlägt das System vor, den Freitag als Brückentag zu nehmen → 4 Tage frei mit nur 1 Urlaubstag (Effizienz: 4.0x)

### Zeiterfassung
- **Von/Bis**: Geben Sie Start- und Endzeit ein (Format: HH:MM)
- **Vor/Nach/Bem**: Zusätzliche Vor- oder Nachbereitungszeit oder Bemerkungen
- **Stunden**: Werden automatisch berechnet
- **Gesamt**: Kumulierte Stunden bis zum aktuellen Tag

### Stundenrechner
1. Klicken Sie auf "Stundenrechner" in den Schnellaktionen
2. Geben Sie zwei Zeiten ein (Format: HH:MM)
3. Wählen Sie eine Rechenoperation (Addition, Subtraktion, Multiplikation, Division)
4. Das Ergebnis wird sofort angezeigt

### Wochenstunden-Eingabe
- Geben Sie Wochenstunden bei 100% ein
- Akzeptiert Format HH:MM (z.B. 39:00) oder nur Zahlen (z.B. 40)
- Zahlen ohne ":" werden automatisch als Stunden interpretiert und als HH:00 gespeichert

### Kranktage erfassen
1. Geben Sie "Krank" im Von1-Feld ein
2. Die Stunden werden automatisch basierend auf Ihrem Beschäftigungsgrad berechnet
3. Kranktage werden separat von Urlaubstagen gezählt
4. Kranktage erscheinen nicht in der Urlaubstage-Summe

### Tipps & Tricks
- **Schnelles Kopieren**: Nutzen Sie die Kopieren/Einfügen-Funktionen für wiederkehrende Arbeitszeiten
- **Wochenkopie**: Kopieren Sie eine ganze Woche und fügen Sie sie in einer anderen Woche ein
- **Manuelle Korrektur**: Klicken Sie auf das Stunden-Feld um automatische Berechnungen zu überschreiben
- **Urlaubsoptimierung**: Nutzen Sie die Optimierungsfunktion für effiziente Urlaubsplanung
- **Drucken**: Die Druckansicht funktioniert sowohl aus Desktop- als auch Mobile-Ansicht

## Datenschutz & Datensicherheit

### Lokale Datenspeicherung
- Alle Daten werden ausschließlich lokal im Browser gespeichert (LocalStorage)
- Es erfolgt keine Übertragung an externe Server
- Die Daten bleiben vollständig unter Ihrer Kontrolle
- Keine Cookies, keine Tracking-Mechanismen

### Backup-Empfehlungen
- Erstellen Sie regelmäßig Backups über die Export-Funktion
- Backups können als CSV-Dateien gespeichert werden
- Bei Browser-Datenlöschung gehen LocalStorage-Daten verloren
- Backups ermöglichen Wiederherstellung auf anderen Geräten

### Datenstruktur
Die App speichert folgende Daten im LocalStorage:
- `zeiterfassung_YYYY_MM`: Zeiterfassungsdaten pro Monat
- `mitarbeiterName`: Name des Mitarbeiters
- `beschaeftigungsgrad`: Beschäftigungsgrad in Prozent
- `wochenstunden`: Wochenstunden bei 100%
- `bundesland`: Gewähltes Bundesland für Feiertage
- `urlaubstage_index`: Index aller Urlaubstage
- `uebertrag_YYYY_MM`: Übertrag vom Vormonat
- `sollStunden_YYYY_MM`: SOLL-Stunden pro Monat

## Sicherheit

Die Anwendung implementiert mehrere Sicherheitsmaßnahmen:
- **XSS-Schutz**: Alle Benutzereingaben werden escaped und sanitisiert
- **Input-Validierung**: Strikte Validierung aller Eingaben (Zeitformate, Zahlen, etc.)
- **Sichere DOM-Manipulation**: Verwendung von `textContent` statt `innerHTML` wo möglich
- **CSS-Injection-Schutz**: Validierung von CSS-Klassennamen und Attributen
- **Keine externen Abhängigkeiten**: Nur Bootstrap und Bootstrap Icons von CDN

## Version

Aktuelle Version: v25.03.2026 08:17

### Changelog
- **v25.03.2026 08:17**:
  - **Bugfix**: Wochentag wird jetzt korrekt in der Druckansicht angezeigt
  - Verbesserte Extraktion des Wochentags aus Desktop- und Mobile-Ansicht
  - Cache-Buster aktualisiert für sofortiges Laden der neuen Version
- **v24.03.2026**:
  - Umfangreiches Refactoring (app-v3.js)
  - Verbesserte Code-Struktur und Wartbarkeit
  - Eliminierung von Code-Redundanzen
  - Sicherheitsverbesserungen (XSS-Schutz, Input-Validierung)
- **v17.03.2026 23:17**:
  - Text-Umbruch in Druckansicht optimiert
  - Alle Debug-Logs entfernt
  - Code-Optimierungen
- **v17.03.2026**:
  - Urlaubskalender integriert mit Feiertagsberücksichtigung
  - Urlaubsoptimierung: Intelligente Vorschläge für Brückentage und optimale Urlaubsplanung
  - Unterstützung für halbe Urlaubstage (0.5 Tage)
  - Lokale Berechnung ohne externe APIs
  - Spalte "Vor/Nach" umbenannt zu "Vor/Nach/Bem"
- **v16.03.2026 20:32**: Feiertagsnamen werden jetzt in Spalte 1 angezeigt

## Bekannte Einschränkungen

- **Feiertage**: Bei Verwendung mit `file://` Protokoll werden keine Feiertage geladen (nur Wochenenden)
- **Browser-Kompatibilität**: LocalStorage muss aktiviert sein
- **Datenübertragung**: Keine automatische Synchronisation zwischen Geräten
- **Druckansicht**: Optimiert für A4-Format, andere Formate können abweichen

## Fehlerbehebung

### Daten werden nicht gespeichert
- Prüfen Sie, ob LocalStorage im Browser aktiviert ist
- Prüfen Sie, ob genügend Speicherplatz verfügbar ist
- Löschen Sie den Browser-Cache und laden Sie die Seite neu

### Feiertage werden nicht angezeigt
- Stellen Sie sicher, dass die App über einen Webserver (http/https) läuft
- Bei `file://` Protokoll: Setzen Sie `FEATURES.FEIERTAGE_LADEN = false` in `js/app-v3.js`

### Druckansicht zeigt keine Daten
- Laden Sie die Seite neu (Strg+F5 / Cmd+Shift+R)
- Prüfen Sie, ob Popups für die Seite erlaubt sind
- Öffnen Sie die Druckansicht über den Drucken-Button in der Hauptansicht

## Support & Kontakt

Bei Fragen oder Problemen:
- **E-Mail**: khsommer@web.de
- **Autor**: Frank Sommer

## Lizenz & Copyright

© 2026 Frank Sommer. Alle Rechte vorbehalten.

Diese Software wird "wie besehen" zur Verfügung gestellt, ohne jegliche ausdrückliche oder stillschweigende Gewährleistung.