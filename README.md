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
- **Stundenrechner**: Integrierter Rechner für Zeitberechnungen mit vier Grundrechenarten
  - Addition von Zeiten
  - Subtraktion von Zeiten
  - Multiplikation von Zeiten
  - Division von Zeiten
- **Wochenfunktionen**: Kopieren und Einfügen ganzer Wochen
- **Tagfunktionen**: Kopieren und Einfügen einzelner Tage
- **Feiertage**: Automatische Berücksichtigung von Feiertagen nach Bundesland
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

### Zeiterfassung
- **Von/Bis**: Geben Sie Start- und Endzeit ein (Format: HH:MM)
- **Vor/Nach**: Zusätzliche Vor- oder Nachbereitungszeit
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

Aktuelle Version: v16.03.2026 20:43

## Autor

**Frank Sommer**  
E-Mail: khsommer@web.de

## Copyright

© 2026 Frank Sommer. Alle Rechte vorbehalten.