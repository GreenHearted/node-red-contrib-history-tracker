const fs = require('fs');
const path = require('path');

module.exports = function(RED) {
    
    function HistoryTrackerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Konfiguration aus dem Editor
        node.filename = config.filename || 'history.txt';
        node.filepath = config.filepath || path.join(RED.settings.userDir, node.filename);
        node.valueField = config.valueField || 'payload';
        node.outputMode = config.outputMode || 'none'; // none, last, current, all
        node.unit = config.unit || 'Liter';
        
        // Status setzen
        node.status({fill: "green", shape: "dot", text: "bereit"});
        
        node.on('input', function(msg) {
            try {
                // Wert aus der Nachricht extrahieren
                let wert;
                if (node.valueField === 'payload') {
                    wert = parseFloat(msg.payload);
                } else {
                    wert = parseFloat(msg[node.valueField]);
                }
                
                if (isNaN(wert)) {
                    node.error('Ungültiger Wert: ' + msg.payload);
                    node.status({fill: "red", shape: "ring", text: "Fehler: ungültiger Wert"});
                    return;
                }
                
                // Verarbeite den Wert
                const daten = speichereWert(node.filepath, wert, node.unit);
                
                // Status aktualisieren
                node.status({
                    fill: "green", 
                    shape: "dot", 
                    text: `${wert.toFixed(2)} ${node.unit} gespeichert`
                });
                
                // Output basierend auf Konfiguration
                if (node.outputMode === 'last') {
                    msg.payload = daten.letzterWert;
                    node.send(msg);
                } else if (node.outputMode === 'current') {
                    msg.payload = {
                        letzterWert: daten.letzterWert,
                        aktuelleStunde: daten.aktuelleStunde,
                        aktuellerTag: daten.aktuellerTag,
                        aktuellerMonat: daten.aktuellerMonat,
                        aktuellesJahr: daten.aktuellesJahr
                    };
                    node.send(msg);
                } else if (node.outputMode === 'all') {
                    msg.payload = daten;
                    node.send(msg);
                }
                
            } catch (error) {
                node.error('Fehler beim Speichern: ' + error.message);
                node.status({fill: "red", shape: "ring", text: "Fehler"});
            }
        });
        
        node.on('close', function() {
            node.status({});
        });
    }
    
    // Hilfsfunktionen
    function speichereWert(filepath, wert, unit) {
        const jetzt = new Date();
        const timestamp = jetzt.toLocaleString('de-DE');
        
        const aktuelleStunde = jetzt.getHours();
        const aktuellerTag = jetzt.getDate();
        const aktuellerMonat = jetzt.getMonth() + 1;
        const aktuellesJahr = jetzt.getFullYear();
        
        let daten = ladeDaten(filepath);
        
        // Berechne Differenz zum letzten Wert
        let differenz = 0;
        if (daten.letzterWert.wert !== undefined) {
            differenz = wert - daten.letzterWert.wert;
            // Negative Differenzen werden auf 0 gesetzt
            if (differenz < 0) {
                differenz = 0;
            }
        }
        
        // Aktualisiere letzten Wert
        daten.letzterWert = {
            wert: wert,
            zeitstempel: timestamp
        };
        
        const stundenKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}-${String(aktuellerTag).padStart(2, '0')}_${String(aktuelleStunde).padStart(2, '0')}`;
        
        if (daten.aktuelleStunde.key !== stundenKey) {
            // Neue Stunde - alte Stunde in Historie verschieben
            if (daten.aktuelleStunde.key) {
                daten.letzteStunde = { ...daten.aktuelleStunde };
            }
            // Neue Stunde beginnt bei 0
            daten.aktuelleStunde = {
                key: stundenKey,
                wert: differenz,
                zeitstempel: timestamp
            };
        } else {
            // Gleiche Stunde - Differenz hinzuaddieren
            daten.aktuelleStunde.wert += differenz;
            daten.aktuelleStunde.zeitstempel = timestamp;
        }
        
        const tagesKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}-${String(aktuellerTag).padStart(2, '0')}`;
        
        if (daten.aktuellerTag.key !== tagesKey) {
            // Neuer Tag - alten Tag in Historie verschieben
            if (daten.aktuellerTag.key) {
                daten.letzterTag = { ...daten.aktuellerTag };
            }
            // Neuer Tag beginnt bei 0
            daten.aktuellerTag = {
                key: tagesKey,
                wert: differenz,
                zeitstempel: timestamp
            };
        } else {
            // Gleicher Tag - Differenz hinzuaddieren
            daten.aktuellerTag.wert += differenz;
            daten.aktuellerTag.zeitstempel = timestamp;
        }
        
        const monatsKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}`;
        
        if (daten.aktuellerMonat.key !== monatsKey) {
            // Neuer Monat - alten Monat in Historie verschieben
            if (daten.aktuellerMonat.key) {
                daten.monatsHistory.push({ ...daten.aktuellerMonat });
            }
            // Neuer Monat beginnt bei 0
            daten.aktuellerMonat = {
                key: monatsKey,
                wert: differenz,
                zeitstempel: timestamp
            };
        } else {
            // Gleicher Monat - Differenz hinzuaddieren
            daten.aktuellerMonat.wert += differenz;
            daten.aktuellerMonat.zeitstempel = timestamp;
        }
        
        const jahresKey = `${aktuellesJahr}`;
        
        if (daten.aktuellesJahr.key !== jahresKey) {
            // Neues Jahr - altes Jahr in Historie verschieben
            if (daten.aktuellesJahr.key) {
                daten.jahresHistory.push({ ...daten.aktuellesJahr });
            }
            // Neues Jahr beginnt bei 0
            daten.aktuellesJahr = {
                key: jahresKey,
                wert: differenz,
                zeitstempel: timestamp
            };
        } else {
            // Gleiches Jahr - Differenz hinzuaddieren
            daten.aktuellesJahr.wert += differenz;
            daten.aktuellesJahr.zeitstempel = timestamp;
        }
        
        speichereDaten(filepath, daten, unit);
        return daten;
    }
    
    function ladeDaten(filepath) {
        if (!fs.existsSync(filepath)) {
            return {
                letzterWert: {},
                aktuelleStunde: {},
                letzteStunde: {},
                aktuellerTag: {},
                letzterTag: {},
                aktuellerMonat: {},
                monatsHistory: [],
                aktuellesJahr: {},
                jahresHistory: []
            };
        }
        
        try {
            const inhalt = fs.readFileSync(filepath, 'utf8');
            return parseHistoryDatei(inhalt);
        } catch (error) {
            return {
                letzterWert: {},
                aktuelleStunde: {},
                letzteStunde: {},
                aktuellerTag: {},
                letzterTag: {},
                aktuellerMonat: {},
                monatsHistory: [],
                aktuellesJahr: {},
                jahresHistory: []
            };
        }
    }
    
    function parseHistoryDatei(inhalt) {
        const daten = {
            letzterWert: {},
            aktuelleStunde: {},
            letzteStunde: {},
            aktuellerTag: {},
            letzterTag: {},
            aktuellerMonat: {},
            monatsHistory: [],
            aktuellesJahr: {},
            jahresHistory: []
        };
        
        const zeilen = inhalt.split('\n');
        let aktuellerBereich = null;
        
        for (let i = 0; i < zeilen.length; i++) {
            let zeile = zeilen[i].trim();
            
            if (zeile.startsWith('===')) {
                if (zeile.includes('LETZTER WERT')) aktuellerBereich = 'letzterWert';
                else if (zeile.includes('AKTUELLE STUNDE')) aktuellerBereich = 'aktuelleStunde';
                else if (zeile.includes('LETZTE STUNDE')) aktuellerBereich = 'letzteStunde';
                else if (zeile.includes('AKTUELLER TAG')) aktuellerBereich = 'aktuellerTag';
                else if (zeile.includes('LETZTER TAG')) aktuellerBereich = 'letzterTag';
                else if (zeile.includes('AKTUELLER MONAT')) aktuellerBereich = 'aktuellerMonat';
                else if (zeile.includes('MONATSHISTORY')) aktuellerBereich = 'monatsHistory';
                else if (zeile.includes('AKTUELLES JAHR')) aktuellerBereich = 'aktuellesJahr';
                else if (zeile.includes('JAHRESHISTORY')) aktuellerBereich = 'jahresHistory';
                continue;
            }
            
            if (!zeile || zeile.startsWith('---') || zeile.startsWith('Monat') || zeile.startsWith('Jahr')) continue;
            
            const wertMatch = zeile.match(/Wert:\s*([\d.]+)/);
            const zeitMatch = zeile.match(/Zeitstempel:\s*(.+)/);
            const keyMatch = zeile.match(/Periode:\s*(.+)/);
            
            if (aktuellerBereich === 'monatsHistory' || aktuellerBereich === 'jahresHistory') {
                if (keyMatch) {
                    const eintrag = { key: keyMatch[1].trim() };
                    
                    if (i + 1 < zeilen.length) {
                        const nextWertMatch = zeilen[i + 1].match(/Wert:\s*([\d.]+)/);
                        if (nextWertMatch) eintrag.wert = parseFloat(nextWertMatch[1]);
                    }
                    if (i + 2 < zeilen.length) {
                        const nextZeitMatch = zeilen[i + 2].match(/Zeitstempel:\s*(.+)/);
                        if (nextZeitMatch) eintrag.zeitstempel = nextZeitMatch[1].trim();
                    }
                    
                    if (eintrag.key && eintrag.wert) {
                        daten[aktuellerBereich].push(eintrag);
                    }
                }
            } else if (aktuellerBereich) {
                if (keyMatch && !daten[aktuellerBereich].key) {
                    daten[aktuellerBereich].key = keyMatch[1].trim();
                }
                if (wertMatch) {
                    daten[aktuellerBereich].wert = parseFloat(wertMatch[1]);
                }
                if (zeitMatch) {
                    daten[aktuellerBereich].zeitstempel = zeitMatch[1].trim();
                }
            }
        }
        
        return daten;
    }
    
    function speichereDaten(filepath, daten, unit) {
        let inhalt = '';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  LETZTER WERT\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.letzterWert.wert !== undefined) {
            inhalt += `Wert: ${daten.letzterWert.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.letzterWert.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  AKTUELLE STUNDE\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.aktuelleStunde.key) {
            inhalt += `Periode: ${daten.aktuelleStunde.key}\n`;
            inhalt += `Wert: ${daten.aktuelleStunde.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.aktuelleStunde.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  LETZTE STUNDE\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.letzteStunde.key) {
            inhalt += `Periode: ${daten.letzteStunde.key}\n`;
            inhalt += `Wert: ${daten.letzteStunde.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.letzteStunde.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  AKTUELLER TAG\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.aktuellerTag.key) {
            inhalt += `Periode: ${daten.aktuellerTag.key}\n`;
            inhalt += `Wert: ${daten.aktuellerTag.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.aktuellerTag.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  LETZTER TAG\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.letzterTag.key) {
            inhalt += `Periode: ${daten.letzterTag.key}\n`;
            inhalt += `Wert: ${daten.letzterTag.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.letzterTag.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  AKTUELLER MONAT\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.aktuellerMonat.key) {
            inhalt += `Periode: ${daten.aktuellerMonat.key}\n`;
            inhalt += `Wert: ${daten.aktuellerMonat.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.aktuellerMonat.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  MONATSHISTORY (Alle vergangenen Monate)\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.monatsHistory.length > 0) {
            daten.monatsHistory.forEach((monat, index) => {
                inhalt += `\nMonat ${index + 1}:\n`;
                inhalt += `Periode: ${monat.key}\n`;
                inhalt += `Wert: ${monat.wert.toFixed(2)} ${unit}\n`;
                inhalt += `Zeitstempel: ${monat.zeitstempel}\n`;
                inhalt += '-'.repeat(40) + '\n';
            });
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  AKTUELLES JAHR\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.aktuellesJahr.key) {
            inhalt += `Periode: ${daten.aktuellesJahr.key}\n`;
            inhalt += `Wert: ${daten.aktuellesJahr.wert.toFixed(2)} ${unit}\n`;
            inhalt += `Zeitstempel: ${daten.aktuellesJahr.zeitstempel}\n`;
        }
        inhalt += '\n';
        
        inhalt += '='.repeat(60) + '\n';
        inhalt += '  JAHRESHISTORY (Alle vergangenen Jahre)\n';
        inhalt += '='.repeat(60) + '\n';
        if (daten.jahresHistory.length > 0) {
            daten.jahresHistory.forEach((jahr, index) => {
                inhalt += `\nJahr ${index + 1}:\n`;
                inhalt += `Periode: ${jahr.key}\n`;
                inhalt += `Wert: ${jahr.wert.toFixed(2)} ${unit}\n`;
                inhalt += `Zeitstempel: ${jahr.zeitstempel}\n`;
                inhalt += '-'.repeat(40) + '\n';
            });
        }
        
        fs.writeFileSync(filepath, inhalt, 'utf8');
    }
    
    RED.nodes.registerType("history-tracker", HistoryTrackerNode);
}
