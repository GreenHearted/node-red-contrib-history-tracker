const fs = require('fs');
const path = require('path');

// Konfiguration
const HISTORY_FILE = path.join(__dirname, 'wasserverbrauch_history.txt');

/**
 * Speichert einen Wasserverbrauchswert und aktualisiert die History-Datei
 * @param {number} wert - Wasserverbrauch in Litern
 */
function speichereWasserverbrauch(wert) {
    const jetzt = new Date();
    const timestamp = jetzt.toLocaleString('de-DE');
    
    // Zeiteinheiten extrahieren
    const aktuelleStunde = jetzt.getHours();
    const aktuellerTag = jetzt.getDate();
    const aktuellerMonat = jetzt.getMonth() + 1; // 0-basiert
    const aktuellesJahr = jetzt.getFullYear();
    
    // Bestehende Daten laden
    let daten = ladeDaten();
    
    // Letzten Wert aktualisieren
    daten.letzterWert = {
        wert: wert,
        zeitstempel: timestamp
    };
    
    // Stundenwerte aktualisieren
    const stundenKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}-${String(aktuellerTag).padStart(2, '0')}_${String(aktuelleStunde).padStart(2, '0')}`;
    
    if (daten.aktuelleStunde.key !== stundenKey) {
        // Neue Stunde begonnen - alte Stunde wird zur letzten
        if (daten.aktuelleStunde.key) {
            daten.letzteStunde = { ...daten.aktuelleStunde };
        }
        daten.aktuelleStunde = {
            key: stundenKey,
            wert: wert,
            zeitstempel: timestamp
        };
    } else {
        // Stundenwert addieren
        daten.aktuelleStunde.wert += wert;
        daten.aktuelleStunde.zeitstempel = timestamp;
    }
    
    // Tageswerte aktualisieren
    const tagesKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}-${String(aktuellerTag).padStart(2, '0')}`;
    
    if (daten.aktuellerTag.key !== tagesKey) {
        // Neuer Tag begonnen - alter Tag wird zum letzten
        if (daten.aktuellerTag.key) {
            daten.letzterTag = { ...daten.aktuellerTag };
        }
        daten.aktuellerTag = {
            key: tagesKey,
            wert: wert,
            zeitstempel: timestamp
        };
    } else {
        // Tageswert addieren
        daten.aktuellerTag.wert += wert;
        daten.aktuellerTag.zeitstempel = timestamp;
    }
    
    // Monatswerte aktualisieren
    const monatsKey = `${aktuellesJahr}-${String(aktuellerMonat).padStart(2, '0')}`;
    
    if (daten.aktuellerMonat.key !== monatsKey) {
        // Neuer Monat begonnen - alter Monat in History speichern
        if (daten.aktuellerMonat.key) {
            daten.monatsHistory.push({ ...daten.aktuellerMonat });
        }
        daten.aktuellerMonat = {
            key: monatsKey,
            wert: wert,
            zeitstempel: timestamp
        };
    } else {
        // Monatswert addieren
        daten.aktuellerMonat.wert += wert;
        daten.aktuellerMonat.zeitstempel = timestamp;
    }
    
    // Jahreswerte aktualisieren
    const jahresKey = `${aktuellesJahr}`;
    
    if (daten.aktuellesJahr.key !== jahresKey) {
        // Neues Jahr begonnen - altes Jahr in History speichern
        if (daten.aktuellesJahr.key) {
            daten.jahresHistory.push({ ...daten.aktuellesJahr });
        }
        daten.aktuellesJahr = {
            key: jahresKey,
            wert: wert,
            zeitstempel: timestamp
        };
    } else {
        // Jahreswert addieren
        daten.aktuellesJahr.wert += wert;
        daten.aktuellesJahr.zeitstempel = timestamp;
    }
    
    // Daten speichern
    speichereDaten(daten);
    
    console.log(`✓ Wasserverbrauch gespeichert: ${wert} Liter (${timestamp})`);
    return daten;
}

/**
 * Lädt die bestehenden Daten aus der History-Datei
 */
function ladeDaten() {
    if (!fs.existsSync(HISTORY_FILE)) {
        // Initialisiere leere Datenstruktur
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
        const inhalt = fs.readFileSync(HISTORY_FILE, 'utf8');
        return parseHistoryDatei(inhalt);
    } catch (error) {
        console.error('Fehler beim Laden der History-Datei:', error);
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

/**
 * Parst den Inhalt der History-Datei
 */
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
    
    for (let zeile of zeilen) {
        zeile = zeile.trim();
        
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
        
        if (!zeile || zeile.startsWith('---')) continue;
        
        const wertMatch = zeile.match(/Wert:\s*([\d.]+)\s*Liter/);
        const zeitMatch = zeile.match(/Zeitstempel:\s*(.+)/);
        const keyMatch = zeile.match(/Periode:\s*(.+)/);
        
        if (aktuellerBereich === 'monatsHistory' || aktuellerBereich === 'jahresHistory') {
            // Multi-Entry Bereiche
            if (keyMatch) {
                const eintrag = { key: keyMatch[1].trim() };
                const nextWertMatch = zeilen[zeilen.indexOf(zeile) + 1]?.match(/Wert:\s*([\d.]+)\s*Liter/);
                const nextZeitMatch = zeilen[zeilen.indexOf(zeile) + 2]?.match(/Zeitstempel:\s*(.+)/);
                
                if (nextWertMatch) eintrag.wert = parseFloat(nextWertMatch[1]);
                if (nextZeitMatch) eintrag.zeitstempel = nextZeitMatch[1].trim();
                
                if (eintrag.key) {
                    daten[aktuellerBereich].push(eintrag);
                }
            }
        } else if (aktuellerBereich) {
            // Single-Entry Bereiche
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

/**
 * Speichert die Daten in die History-Datei
 */
function speichereDaten(daten) {
    let inhalt = '';
    
    // Letzter Wert
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  LETZTER WERT\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.letzterWert.wert !== undefined) {
        inhalt += `Wert: ${daten.letzterWert.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.letzterWert.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Aktuelle Stunde
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  AKTUELLE STUNDE\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.aktuelleStunde.key) {
        inhalt += `Periode: ${daten.aktuelleStunde.key}\n`;
        inhalt += `Wert: ${daten.aktuelleStunde.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.aktuelleStunde.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Letzte Stunde
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  LETZTE STUNDE\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.letzteStunde.key) {
        inhalt += `Periode: ${daten.letzteStunde.key}\n`;
        inhalt += `Wert: ${daten.letzteStunde.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.letzteStunde.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Aktueller Tag
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  AKTUELLER TAG\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.aktuellerTag.key) {
        inhalt += `Periode: ${daten.aktuellerTag.key}\n`;
        inhalt += `Wert: ${daten.aktuellerTag.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.aktuellerTag.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Letzter Tag
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  LETZTER TAG\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.letzterTag.key) {
        inhalt += `Periode: ${daten.letzterTag.key}\n`;
        inhalt += `Wert: ${daten.letzterTag.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.letzterTag.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Aktueller Monat
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  AKTUELLER MONAT\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.aktuellerMonat.key) {
        inhalt += `Periode: ${daten.aktuellerMonat.key}\n`;
        inhalt += `Wert: ${daten.aktuellerMonat.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.aktuellerMonat.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Monatshistory
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  MONATSHISTORY (Alle vergangenen Monate)\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.monatsHistory.length > 0) {
        daten.monatsHistory.forEach((monat, index) => {
            inhalt += `\nMonat ${index + 1}:\n`;
            inhalt += `Periode: ${monat.key}\n`;
            inhalt += `Wert: ${monat.wert.toFixed(2)} Liter\n`;
            inhalt += `Zeitstempel: ${monat.zeitstempel}\n`;
            inhalt += '-'.repeat(40) + '\n';
        });
    }
    inhalt += '\n';
    
    // Aktuelles Jahr
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  AKTUELLES JAHR\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.aktuellesJahr.key) {
        inhalt += `Periode: ${daten.aktuellesJahr.key}\n`;
        inhalt += `Wert: ${daten.aktuellesJahr.wert.toFixed(2)} Liter\n`;
        inhalt += `Zeitstempel: ${daten.aktuellesJahr.zeitstempel}\n`;
    }
    inhalt += '\n';
    
    // Jahreshistory
    inhalt += '=' .repeat(60) + '\n';
    inhalt += '  JAHRESHISTORY (Alle vergangenen Jahre)\n';
    inhalt += '=' .repeat(60) + '\n';
    if (daten.jahresHistory.length > 0) {
        daten.jahresHistory.forEach((jahr, index) => {
            inhalt += `\nJahr ${index + 1}:\n`;
            inhalt += `Periode: ${jahr.key}\n`;
            inhalt += `Wert: ${jahr.wert.toFixed(2)} Liter\n`;
            inhalt += `Zeitstempel: ${jahr.zeitstempel}\n`;
            inhalt += '-'.repeat(40) + '\n';
        });
    }
    
    fs.writeFileSync(HISTORY_FILE, inhalt, 'utf8');
}

/**
 * Gibt eine formatierte Übersicht der aktuellen Daten aus
 */
function zeigeUebersicht() {
    const daten = ladeDaten();
    
    console.log('\n' + '='.repeat(60));
    console.log('  WASSERVERBRAUCH ÜBERSICHT');
    console.log('='.repeat(60));
    
    if (daten.letzterWert.wert) {
        console.log(`\n📊 Letzter Wert: ${daten.letzterWert.wert.toFixed(2)} L (${daten.letzterWert.zeitstempel})`);
    }
    
    if (daten.aktuelleStunde.wert) {
        console.log(`\n⏰ Aktuelle Stunde: ${daten.aktuelleStunde.wert.toFixed(2)} L`);
    }
    
    if (daten.aktuellerTag.wert) {
        console.log(`📅 Aktueller Tag: ${daten.aktuellerTag.wert.toFixed(2)} L`);
    }
    
    if (daten.aktuellerMonat.wert) {
        console.log(`📆 Aktueller Monat: ${daten.aktuellerMonat.wert.toFixed(2)} L`);
    }
    
    if (daten.aktuellesJahr.wert) {
        console.log(`🗓️  Aktuelles Jahr: ${daten.aktuellesJahr.wert.toFixed(2)} L`);
    }
    
    console.log('\n');
}

// Export für Node-RED oder andere Module
module.exports = {
    speichereWasserverbrauch,
    zeigeUebersicht,
    ladeDaten
};

// Beispiel für direkte Verwendung (auskommentiert)
/*
// Beispielaufrufe
speichereWasserverbrauch(15.5);  // 15.5 Liter
speichereWasserverbrauch(23.2);  // 23.2 Liter
speichereWasserverbrauch(8.7);   // 8.7 Liter

// Übersicht anzeigen
zeigeUebersicht();
*/