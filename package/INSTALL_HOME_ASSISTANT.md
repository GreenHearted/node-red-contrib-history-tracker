# Installation im Home Assistant Node-RED Addon

## Schritt 1: GitHub Repository erstellen ✅

### Repository Setup

1. Gehe zu **GitHub.com** und erstelle ein neues **öffentliches** Repository
   - ✅ **Bereits erstellt:** `https://github.com/GreenHearted/node-red-contrib-history-tracker`
2. Lade folgende Dateien in den **Repository Root** hoch:
   - `package.json`
   - `history-tracker.js`
   - `history-tracker.html`
   - `README.md` (optional)

**WICHTIG:** Alle Dateien müssen direkt im Root liegen, nicht in einem Unterordner!

---

## Schritt 2: In Home Assistant installieren 🏠

### Node-RED Addon konfigurieren

1. Gehe zu **Settings → Add-ons → Node-RED**
2. Klicke auf den **Configuration** Tab
3. Füge unter `npm_packages` dein GitHub Repository hinzu:

```yaml
credential_secret: ''
system_packages: []
npm_packages:
  - github:GreenHearted/node-red-contrib-history-tracker
init_commands: []
```

**Für dieses Repository:**
```yaml
npm_packages:
  - github:GreenHearted/node-red-contrib-history-tracker
```

4. Klicke **Save**
5. Klicke **Restart**

---

## Schritt 3: Verifizierung ✓

Nach dem Neustart (ca. 1-2 Minuten):

1. **Logs prüfen:**
   - Node-RED Addon → **Log** Tab
   - Suche nach: `npm install github:...`
   - Sollte zeigen: `added 1 package`

2. **Node-RED öffnen:**
   - Öffne die Node-RED UI
   - In der **linken Palette** unter **"storage"**
   - Sollte der Node **"history tracker"** erscheinen

3. **Test-Flow erstellen:**
   ```json
   [{"id":"inject1","type":"inject","payload":"15.5","payloadType":"num","repeat":"","crontab":"","once":false,"topic":"","x":150,"y":100,"wires":[["history1"]]},{"id":"history1","type":"history-tracker","name":"Wasser","filename":"wasserverbrauch.txt","filepath":"","outputMode":"current","x":350,"y":100,"wires":[["debug1"]]},{"id":"debug1","type":"debug","name":"","active":true,"console":"false","complete":"payload","x":550,"y":100,"wires":[]}]
   ```

---

## Alternative: Offizielles npm Package 📦

Falls du das Package später offiziell veröffentlichen möchtest:

1. **Auf npm veröffentlichen:**
   ```bash
   npm login
   npm publish
   ```

2. **Dann im Palette Manager installieren:**
   - **☰ Menu → Manage palette → Install**
   - Suchen: `node-red-contrib-history-tracker`
   - **Install** klicken

**Hinweis:** Name muss mit `node-red-contrib-` beginnen und darf noch nicht existieren!

---

## Wichtige Hinweise 📝

### GitHub Repository Anforderungen

✅ **Muss erfüllt sein:**
- Repository ist **PUBLIC** (nicht private)
- Alle Dateien sind im **Root** (nicht in Unterordnern)
- `package.json` enthält korrektes `node-red.nodes` Objekt
- Installation-Syntax: `github:username/repo-name`

❌ **Häufige Fehler:**
- Private Repository ohne Access Token
- Dateien in Unterordner verschoben
- Falsche Syntax: `https://github.com/...` oder `username/repo`

### Palette Manager Limitierung

⚠️ Der **Manage palette** Dialog zeigt nur offizielle npm Packages!

- GitHub Packages erscheinen **NICHT** im Palette Manager
- Sie sind trotzdem installiert und funktionsfähig
- Prüfe die Installation in der **linken Node-Palette** (nicht im Manager)

### Updates durchführen

Wenn du Änderungen am Code pushst:

1. Ändere die `version` in `package.json` (z.B. `1.0.0` → `1.0.1`)
2. Pushe zu GitHub
3. Node-RED Addon **Restart** (npm holt automatisch die neue Version)

---

## Troubleshooting 🔧

### ❌ "Could not install github:username/repo"

**Ursache:** Repository ist privat oder Name ist falsch

**Lösung:**
1. Prüfe dass Repository **PUBLIC** ist (nicht private)
2. Prüfe Username und Repository-Namen
3. GitHub-URL: `https://github.com/username/repo` → Syntax: `github:username/repo`

### ❌ Node erscheint nicht in der Palette

**Prüfe die Logs:**
```
Settings → Add-ons → Node-RED → Log Tab
```

Suche nach Fehlern wie:
- `npm ERR!` - Installation fehlgeschlagen
- `Cannot find module` - package.json falsch
- `Unexpected token` - JSON Syntaxfehler

**Prüfe die Installation:**
```bash
# Via SSH auf Home Assistant
ls -la /addon_configs/a0d7b954_nodered/node_modules/
```

Sollte Ordner `node-red-contrib-history-tracker` enthalten.

### ❌ "Unexpected token in JSON"

**Ursache:** Syntaxfehler in `package.json`

**Lösung:**
- Validiere JSON mit https://jsonlint.com
- Prüfe dass alle Kommas, Klammern, Anführungszeichen korrekt sind

### ✅ Node ist installiert, aber nicht sichtbar

1. **Hard Refresh im Browser:** `Ctrl + Shift + R` (Windows) oder `Cmd + Shift + R` (Mac)
2. **Cache leeren:** Browser-Cache löschen
3. **Neustart:** Node-RED Addon komplett neu starten

---

## Dateipfade und Speicherorte 📁

### Wo werden History-Dateien gespeichert?

**Standard (ohne filepath):**
```
/addon_configs/a0d7b954_nodered/wasserverbrauch_history.txt
```

**Custom filepath im Node:**
- Leer lassen → Verwendet Node-RED User Directory
- `/config/` → Im Container User Directory
- Absoluter Pfad → Eigener Pfad (muss existieren!)

### Zugriff auf History-Dateien

**Via File Editor:**
1. Öffne **Studio Code Server** oder **File Editor** Addon
2. Navigiere zu `/addon_configs/a0d7b954_nodered/`
3. Finde `wasserverbrauch_history.txt`

**Via SSH:**
```bash
cat /addon_configs/a0d7b954_nodered/wasserverbrauch_history.txt
```

---

## Support & Weiterführende Infos 📚

**Weitere Dokumentation:**
- Siehe `GITHUB_INSTALLATION.md` für GitHub-Checkliste
- Siehe `README.md` für Package-Verwendung
- Siehe Node-RED Logs für Debug-Informationen

**GitHub Repository prüfen:**
```
https://github.com/GreenHearted/node-red-contrib-history-tracker
```
Alle 3 Dateien sollten direkt sichtbar sein (nicht in Unterordnern)!
