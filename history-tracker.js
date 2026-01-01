const fs = require('fs');
const path = require('path');

const VERSION = "2.0.0";

// Exported helper functions for testing
const HistoryTrackerUtils = {
    loadData,
    parseHistoryFile,
    saveData,
    saveValue
};

module.exports = function(RED) {
    
    function HistoryTrackerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration from editor
        const configPath = config.filepath || 'history.txt';
        
        // If filepath contains no directory separators, use userDir as base
        if (configPath.indexOf(path.sep) === -1 && configPath.indexOf('/') === -1) {
            node.filepath = path.join(RED.settings.userDir, configPath);
        } else {
            node.filepath = configPath;
        }
        
        node.valueField = config.valueField || 'payload';
        node.outputMode = config.outputMode || 'none'; // none, last, current, all
        node.unit = config.unit || 'Liter';
        
        // Set status with version
        node.status({fill: "green", shape: "dot", text: `ready (v${VERSION})`});
        node.log(`History Tracker initialized - Version ${VERSION}`);
        
        node.on('input', function(msg) {
            try {
                // Extract value from message
                let value;
                if (node.valueField === 'payload') {
                    value = parseFloat(msg.payload);
                } else {
                    value = parseFloat(msg[node.valueField]);
                }
                
                if (isNaN(value)) {
                    node.error('Invalid value: ' + msg.payload);
                    node.status({fill: "red", shape: "ring", text: "Error: invalid value"});
                    return;
                }
                
                // Process the value
                const data = saveValue(node.filepath, value, node.unit);
                
                // Update status
                node.status({
                    fill: "green", 
                    shape: "dot", 
                    text: `${value.toFixed(2)} ${node.unit} saved`
                });
                
                // Output based on configuration
                if (node.outputMode === 'last') {
                    msg.payload = data.lastValue;
                    node.send(msg);
                } else if (node.outputMode === 'current') {
                    msg.payload = {
                        lastValue: data.lastValue,
                        currentHour: data.currentHour,
                        currentDay: data.currentDay,
                        currentMonth: data.currentMonth,
                        currentYear: data.currentYear
                    };
                    node.send(msg);
                } else if (node.outputMode === 'all') {
                    msg.payload = data;
                    node.send(msg);
                }
                
            } catch (error) {
                node.error('Error saving: ' + error.message);
                node.status({fill: "red", shape: "ring", text: "Error"});
            }
        });
        
        node.on('close', function() {
            node.status({});
        });
    }
    
    RED.nodes.registerType("history-tracker", HistoryTrackerNode);
}

// Helper functions - defined outside module.exports for testability
function saveValue(filepath, value, unit) {
    const now = new Date();
    const timestamp = now.toLocaleString('de-DE');
    
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let data = loadData(filepath);
    
    // Calculate difference to last value
    let difference = 0;
    if (data.lastValue.value !== undefined) {
        difference = value - data.lastValue.value;
        // Negative differences are set to 0
        if (difference < 0) {
            difference = 0;
        }
    }
    
    // Update last value
    data.lastValue = {
        value: value,
        timestamp: timestamp,
        timestampMs: now.getTime()
    };
    
    const hourKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}_${String(currentHour).padStart(2, '0')}`;
    
    if (data.currentHour.period !== hourKey) {
        // New hour - move old hour to history (at the beginning for newest first)
        if (data.currentHour.period) {
            data.hourHistory.unshift({ ...data.currentHour });
        }
        // New hour starts at 0 and adds current difference
        data.currentHour = {
            period: hourKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
    } else {
        // Same hour - add difference
        if (data.currentHour.value === undefined) {
            data.currentHour.value = 0;
        }
        data.currentHour.value += difference;
        data.currentHour.timestamp = timestamp;
        data.currentHour.timestampMs = now.getTime();
    }
    
    const dayKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    
    if (data.currentDay.period !== dayKey) {
        // New day - move old day to history (at the beginning for newest first)
        if (data.currentDay.period) {
            data.dayHistory.unshift({ ...data.currentDay });
        }
        // New day starts at 0 and adds current difference
        data.currentDay = {
            period: dayKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
    } else {
        // Same day - add difference
        if (data.currentDay.value === undefined) {
            data.currentDay.value = 0;
        }
        data.currentDay.value += difference;
        data.currentDay.timestamp = timestamp;
        data.currentDay.timestampMs = now.getTime();
    }
    
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    if (data.currentMonth.period !== monthKey) {
        // New month - move old month to history (at the beginning for newest first)
        if (data.currentMonth.period) {
            data.monthHistory.unshift({ ...data.currentMonth });
        }
        // New month starts at 0 and adds current difference
        data.currentMonth = {
            period: monthKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
    } else {
        // Same month - add difference
        if (data.currentMonth.value === undefined) {
            data.currentMonth.value = 0;
        }
        data.currentMonth.value += difference;
        data.currentMonth.timestamp = timestamp;
        data.currentMonth.timestampMs = now.getTime();
    }
    
    const yearKey = `${currentYear}`;
    
    if (data.currentYear.period !== yearKey) {
        // New year - move old year to history (at the beginning for newest first)
        if (data.currentYear.period) {
            data.yearHistory.unshift({ ...data.currentYear });
        }
        // New year starts at 0 and adds current difference
        data.currentYear = {
            period: yearKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
    } else {
        // Same year - add difference
        if (data.currentYear.value === undefined) {
            data.currentYear.value = 0;
        }
        data.currentYear.value += difference;
        data.currentYear.timestamp = timestamp;
        data.currentYear.timestampMs = now.getTime();
    }
    
    saveData(filepath, data, unit);
    return data;
}

function loadData(filepath) {
    if (!fs.existsSync(filepath)) {
        return {
            lastValue: {},
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: {},
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
    }
    
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        return parseHistoryFile(content);
    } catch (error) {
        return {
            lastValue: {},
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: {},
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
    }
}

function parseHistoryFile(content) {
    const data = {
        lastValue: {},
        currentHour: {},
        hourHistory: [],
        currentDay: {},
        dayHistory: [],
        currentMonth: {},
        monthHistory: [],
        currentYear: {},
        yearHistory: []
    };
    
    const lines = content.split('\n');
    let currentSection = null;
    let sectionFound = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // Detect section headers
        if (line.startsWith('===')) {
            if (!sectionFound) sectionFound = true;
            else sectionFound = false;
            continue;
        }
        
        // Check for section titles
        if (sectionFound) {
            if (line.includes('LAST VALUE')) currentSection = 'lastValue';
            else if (line.includes('CURRENT HOUR')) currentSection = 'currentHour';
            else if (line.includes('HOUR HISTORY')) currentSection = 'hourHistory';
            else if (line.includes('CURRENT DAY')) currentSection = 'currentDay';
            else if (line.includes('DAY HISTORY')) currentSection = 'dayHistory';
            else if (line.includes('CURRENT MONTH')) currentSection = 'currentMonth';
            else if (line.includes('MONTH HISTORY')) currentSection = 'monthHistory';
            else if (line.includes('CURRENT YEAR')) currentSection = 'currentYear';
            else if (line.includes('YEAR HISTORY')) currentSection = 'yearHistory';
            continue;
        }
        
        // Parse compact format: T: timestamp  -  P: period  -  V: value unit
        // For lastValue: T: timestamp  -  V: value unit
        const compactMatch = line.match(/T:\s*(.+?)\s*-\s*(?:P:\s*(.+?)\s*-\s*)?V:\s*([\d.]+)/);
        
        if (compactMatch && currentSection) {
            const timestamp = compactMatch[1].trim();
            const period = compactMatch[2] ? compactMatch[2].trim() : null;
            const value = parseFloat(compactMatch[3]);
            
            if (currentSection === 'hourHistory' || currentSection === 'dayHistory' || currentSection === 'monthHistory' || currentSection === 'yearHistory') {
                data[currentSection].push({
                    period: period,
                    value: value,
                    timestamp: timestamp
                });
            } else if (currentSection === 'lastValue') {
                data[currentSection] = {
                    value: value,
                    timestamp: timestamp
                };
            } else {
                data[currentSection] = {
                    period: period,
                    value: value,
                    timestamp: timestamp
                };
            }
        }
    }
    
    return data;
}

function saveData(filepath, data, unit) {
    let content = '';
    
    content += '='.repeat(60) + '\n';
    content += '  LAST VALUE\n';
    content += '='.repeat(60) + '\n';
    if (data.lastValue.value !== undefined) {
        content += `T: ${data.lastValue.timestamp}  -  V: ${data.lastValue.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT HOUR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentHour.period) {
        content += `T: ${data.currentHour.timestamp}  -  P: ${data.currentHour.period}  -  V: ${data.currentHour.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  HOUR HISTORY (All past hours)\n';
    content += '='.repeat(60) + '\n';
    if (data.hourHistory && data.hourHistory.length > 0) {
        data.hourHistory.forEach((hour) => {
            content += `T: ${hour.timestamp}  -  P: ${hour.period}  -  V: ${hour.value.toFixed(2)} ${unit}\n`;
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT DAY\n';
    content += '='.repeat(60) + '\n';
    if (data.currentDay.period) {
        content += `T: ${data.currentDay.timestamp}  -  P: ${data.currentDay.period}  -  V: ${data.currentDay.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  DAY HISTORY (All past days)\n';
    content += '='.repeat(60) + '\n';
    if (data.dayHistory && data.dayHistory.length > 0) {
        data.dayHistory.forEach((day) => {
            content += `T: ${day.timestamp}  -  P: ${day.period}  -  V: ${day.value.toFixed(2)} ${unit}\n`;
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT MONTH\n';
    content += '='.repeat(60) + '\n';
    if (data.currentMonth.period) {
        content += `T: ${data.currentMonth.timestamp}  -  P: ${data.currentMonth.period}  -  V: ${data.currentMonth.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  MONTH HISTORY (All past months)\n';
    content += '='.repeat(60) + '\n';
    if (data.monthHistory.length > 0) {
        data.monthHistory.forEach((month) => {
            content += `T: ${month.timestamp}  -  P: ${month.period}  -  V: ${month.value.toFixed(2)} ${unit}\n`;
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT YEAR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentYear.period) {
        content += `T: ${data.currentYear.timestamp}  -  P: ${data.currentYear.period}  -  V: ${data.currentYear.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  YEAR HISTORY (All past years)\n';
    content += '='.repeat(60) + '\n';
    if (data.yearHistory.length > 0) {
        data.yearHistory.forEach((year) => {
            content += `T: ${year.timestamp}  -  P: ${year.period}  -  V: ${year.value.toFixed(2)} ${unit}\n`;
        });
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
}

// Export utility functions for testing (when not used as Node-RED module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports.HistoryTrackerUtils = HistoryTrackerUtils;
}
