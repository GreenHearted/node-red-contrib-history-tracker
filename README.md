# node-red-contrib-history-tracker

Ein Node-RED Node zum Speichern und Verfolgen von historischen Werten mit automatischer zeitbasierter Aggregation.

## Features

✅ **Automatische Zeitaggregation**: Stunden-, Tages-, Monats- und Jahreswerte  
✅ **Min/Max Tracking**: Automatische Berechnung von Minimum- und Maximum-Werten  
✅ **History-Speicherung**: Alle vergangenen Monate und Jahre werden aufbewahrt  
✅ **History-Limits**: Konfigurierbare maximale Anzahl von Einträgen pro Periode  
✅ **Flexible Ausgabe**: Verschiedene Output-Modi wählbar  
✅ **Textdatei-Format**: Menschenlesbare Speicherung  
✅ **Abwärtskompatibilität**: Liest alte Dateiformate ohne Min/Max  
✅ **Ideal für**: Wasserzähler, Stromzähler, Verbrauchsmessungen  

## Installation

### Home Assistant Node-RED Addon

Siehe [INSTALL_HOME_ASSISTANT.md](INSTALL_HOME_ASSISTANT.md) für detaillierte Anleitung.

**Kurzversion:**

Im Node-RED Addon unter **Configuration** Tab:

```yaml
npm_packages:
  - github:GreenHearted/node-red-contrib-history-tracker
```

Speichern und Addon neu starten.

### Standard Node-RED Installation

```bash
cd ~/.node-red
npm install github:GreenHearted/node-red-contrib-history-tracker
```

### Per npm (nach Veröffentlichung)

```bash
cd ~/.node-red
npm install node-red-contrib-history-tracker
```

## Verwendung

### Im Flow

1. Füge den "history tracker" Node zu deinem Flow hinzu
2. Konfiguriere:
   - **Dateiname**: Name der History-Datei (z.B. `wasserverbrauch.txt`)
   - **Pfad**: Optional - vollständiger Pfad zur Datei
   - **Wertfeld**: Feld mit dem Wert (Standard: `payload`)
   - **Output**: Welche Daten sollen ausgegeben werden

3. Verbinde einen Input-Node, der numerische Werte sendet

### Beispiel Flow

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "payload": "15.5",
        "payloadType": "num"
    },
    {
        "id": "history1",
        "type": "history-tracker",
        "filename": "wasserverbrauch.txt",
        "outputMode": "current"
    },
    {
        "id": "debug1",
        "type": "debug"
    }
]
```

### Programmatische Verwendung

⚠️ **Hinweis:** Die standalone Version (`history_file.js`) ist nicht im Package enthalten.

Verwendung über Node-RED Node wird empfohlen.

## Output-Modi

### Kein Output
Node gibt keine Nachricht aus (nur Speicherung)

### Nur letzter Wert
```javascript
msg.payload = {
    wert: 15.5,
    zeitstempel: "12.01.2025, 14:30:00"
}
```

### Aktuelle Werte
```javascript
msg.payload = {
    letzterWert: {...},
    aktuelleStunde: {...},
    aktuellerTag: {...},
    aktuellerMonat: {...},
    aktuellesJahr: {...}
}
```

### Alle Daten
Gibt die komplette Datenstruktur inkl. History zurück

## Dateiformat

Die History-Datei ist eine lesbare Textdatei:

```
============================================================
  LETZTER WERT
============================================================
Wert: 15.50 Liter
Zeitstempel: 12.01.2025, 14:30:00

============================================================
  AKTUELLE STUNDE
============================================================
Periode: 2025-01-12_14
Wert: 47.20 Liter
Zeitstempel: 12.01.2025, 14:45:00

============================================================
  TAG HISTORIE (Alle vergangenen Tage)
============================================================
T: 2025-01-11T23:59:59  -  P: 2025-01-11  -  V: 125.50 Liter  -  Min: 3.20  -  Max: 8.70
T: 2025-01-10T23:59:59  -  P: 2025-01-10  -  V: 118.30 Liter  -  Min: 2.80  -  Max: 9.10

...
```

**Min/Max-Werte:**
- Werden automatisch beim Periodenwechsel berechnet
- Tag-Historie: Min/Max der Stundenwerte dieses Tages
- Monats-Historie: Min/Max der Tageswerte dieses Monats
- Jahres-Historie: Min/Max der Monatswerte dieses Jahres

## Abwärtskompatibilität

Der Node ist vollständig kompatibel mit älteren Dateiversionen:

- ✅ Alte Dateien **ohne** Min/Max-Werte werden korrekt gelesen
- ✅ Neue Min/Max-Werte werden ab dem nächsten Periodenwechsel berechnet
- ✅ Alte Einträge bleiben unverändert (kein Min/Max)
- ✅ Neue Einträge erhalten automatisch Min/Max-Werte
- ✅ Kein manueller Migrations-Schritt erforderlich

**Beispiel gemischter Inhalt:**
```
# Alter Eintrag (ohne Min/Max)
T: 2024-12-31T23:59:59  -  P: 2024-12  -  V: 150.00 Liter

# Neuer Eintrag (mit Min/Max)
T: 2025-01-31T23:59:59  -  P: 2025-01  -  V: 160.00 Liter  -  Min: 140.00  -  Max: 180.00
```

## Ähnliche Packages

- **node-red-contrib-persistent-values**: Speichert einzelne Werte persistent
- **node-red-contrib-statistics**: Berechnet statistische Werte
- **node-red-contrib-aggregate**: Aggregiert Werte über Zeit

## Lizenz

MIT

## Repository

GitHub: [https://github.com/GreenHearted/node-red-contrib-history-tracker](https://github.com/GreenHearted/node-red-contrib-history-tracker)

## Autor

GreenHearted

## Beiträge

Pull Requests sind willkommen!
