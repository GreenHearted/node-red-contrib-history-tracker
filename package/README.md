# node-red-contrib-history-tracker

Ein Node-RED Node zum Speichern und Verfolgen von historischen Werten mit automatischer zeitbasierter Aggregation.

## Features

✅ **Automatische Zeitaggregation**: Stunden-, Tages-, Monats- und Jahreswerte  
✅ **History-Speicherung**: Alle vergangenen Monate und Jahre werden aufbewahrt  
✅ **Flexible Ausgabe**: Verschiedene Output-Modi wählbar  
✅ **Textdatei-Format**: Menschenlesbare Speicherung  
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

...
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
