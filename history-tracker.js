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
        node.filename = config.filename || 'history.txt';
        node.filepath = config.filepath || path.join(RED.settings.userDir, node.filename);
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
        timestamp: timestamp
    };
    
    const hourKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}_${String(currentHour).padStart(2, '0')}`;
    
    if (data.currentHour.key !== hourKey) {
        // New hour - move old hour to history
        if (data.currentHour.key) {
            data.lastHour = { ...data.currentHour };
        }
        // New hour starts at 0 and adds current difference
        data.currentHour = {
            key: hourKey,
            value: difference,
            timestamp: timestamp
        };
    } else {
        // Same hour - add difference
        if (data.currentHour.value === undefined) {
            data.currentHour.value = 0;
        }
        data.currentHour.value += difference;
        data.currentHour.timestamp = timestamp;
    }
    
    const dayKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    
    if (data.currentDay.key !== dayKey) {
        // New day - move old day to history
        if (data.currentDay.key) {
            data.lastDay = { ...data.currentDay };
        }
        // New day starts at 0 and adds current difference
        data.currentDay = {
            key: dayKey,
            value: difference,
            timestamp: timestamp
        };
    } else {
        // Same day - add difference
        if (data.currentDay.value === undefined) {
            data.currentDay.value = 0;
        }
        data.currentDay.value += difference;
        data.currentDay.timestamp = timestamp;
    }
    
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    if (data.currentMonth.key !== monthKey) {
        // New month - move old month to history
        if (data.currentMonth.key) {
            data.monthHistory.push({ ...data.currentMonth });
        }
        // New month starts at 0 and adds current difference
        data.currentMonth = {
            key: monthKey,
            value: difference,
            timestamp: timestamp
        };
    } else {
        // Same month - add difference
        if (data.currentMonth.value === undefined) {
            data.currentMonth.value = 0;
        }
        data.currentMonth.value += difference;
        data.currentMonth.timestamp = timestamp;
    }
    
    const yearKey = `${currentYear}`;
    
    if (data.currentYear.key !== yearKey) {
        // New year - move old year to history
        if (data.currentYear.key) {
            data.yearHistory.push({ ...data.currentYear });
        }
        // New year starts at 0 and adds current difference
        data.currentYear = {
            key: yearKey,
            value: difference,
            timestamp: timestamp
        };
    } else {
        // Same year - add difference
        if (data.currentYear.value === undefined) {
            data.currentYear.value = 0;
        }
        data.currentYear.value += difference;
        data.currentYear.timestamp = timestamp;
    }
    
    saveData(filepath, data, unit);
    return data;
}

function loadData(filepath) {
    if (!fs.existsSync(filepath)) {
        return {
            lastValue: {},
            currentHour: {},
            lastHour: {},
            currentDay: {},
            lastDay: {},
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
            lastHour: {},
            currentDay: {},
            lastDay: {},
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
        lastHour: {},
        currentDay: {},
        lastDay: {},
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
            else if (line.includes('LAST HOUR')) currentSection = 'lastHour';
            else if (line.includes('CURRENT DAY')) currentSection = 'currentDay';
            else if (line.includes('LAST DAY')) currentSection = 'lastDay';
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
            
            if (currentSection === 'monthHistory' || currentSection === 'yearHistory') {
                data[currentSection].push({
                    key: period,
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
                    key: period,
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
    if (data.currentHour.key) {
        content += `T: ${data.currentHour.timestamp}  -  P: ${data.currentHour.key}  -  V: ${data.currentHour.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  LAST HOUR\n';
    content += '='.repeat(60) + '\n';
    if (data.lastHour.key) {
        content += `T: ${data.lastHour.timestamp}  -  P: ${data.lastHour.key}  -  V: ${data.lastHour.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT DAY\n';
    content += '='.repeat(60) + '\n';
    if (data.currentDay.key) {
        content += `T: ${data.currentDay.timestamp}  -  P: ${data.currentDay.key}  -  V: ${data.currentDay.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  LAST DAY\n';
    content += '='.repeat(60) + '\n';
    if (data.lastDay.key) {
        content += `T: ${data.lastDay.timestamp}  -  P: ${data.lastDay.key}  -  V: ${data.lastDay.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT MONTH\n';
    content += '='.repeat(60) + '\n';
    if (data.currentMonth.key) {
        content += `T: ${data.currentMonth.timestamp}  -  P: ${data.currentMonth.key}  -  V: ${data.currentMonth.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  MONTH HISTORY (All past months)\n';
    content += '='.repeat(60) + '\n';
    if (data.monthHistory.length > 0) {
        data.monthHistory.forEach((month) => {
            content += `T: ${month.timestamp}  -  P: ${month.key}  -  V: ${month.value.toFixed(2)} ${unit}\n`;
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT YEAR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentYear.key) {
        content += `T: ${data.currentYear.timestamp}  -  P: ${data.currentYear.key}  -  V: ${data.currentYear.value.toFixed(2)} ${unit}\n`;
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  YEAR HISTORY (All past years)\n';
    content += '='.repeat(60) + '\n';
    if (data.yearHistory.length > 0) {
        data.yearHistory.forEach((year) => {
            content += `T: ${year.timestamp}  -  P: ${year.key}  -  V: ${year.value.toFixed(2)} ${unit}\n`;
        });
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
}

// Export utility functions for testing (when not used as Node-RED module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports.HistoryTrackerUtils = HistoryTrackerUtils;
}
