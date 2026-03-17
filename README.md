# Zeiterfassung Web App

Eine moderne, responsive Web-Anwendung zur Erfassung von Arbeitszeiten mit umfangreichen Funktionen für die tägliche Zeitverwaltung.

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
- **Druckfunktion**: Professionelle Druckansicht für Monatsübersichten

### Datenverwaltung
- **Lokale Speicherung**: Alle Daten werden lokal im Browser gespeichert
- **CSV Export/Import**: Export und Import von Zeitdaten im CSV-Format
- **Backup-Funktion**: Erstellen und Wiederherstellen von Backups
- **Automatisches Speichern**: Änderungen werden automatisch gespeichert

### Benutzerfreundlichkeit
- **Responsive Design**: Optimiert für Desktop, Tablet und Smartphone
- **Intuitive Bedienung**: Einfache und übersichtliche Benutzeroberfläche
- **Visuelle Rückmeldungen**: Farbliche Kennzeichnung von Wochenenden und Feiertagen
- **Schnellaktionen**: Häufig verwendete Funktionen direkt zugänglich

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

### Installation
1. Laden Sie alle Dateien in ein Verzeichnis
2. Öffnen Sie die `index.html` in einem modernen Webbrowser
3. Keine Installation oder Server erforderlich

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

## Datenschutz

Alle Daten werden ausschließlich lokal im Browser gespeichert. Es erfolgt keine Übertragung an externe Server. Die Daten bleiben vollständig unter Ihrer Kontrolle.

## Version

Aktuelle Version: v17.03.2026 23:17

### Changelog
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

## Autor

**Frank Sommer**  
E-Mail: khsommer@web.de

## Copyright

© 2026 Frank Sommer. Alle Rechte vorbehalten.