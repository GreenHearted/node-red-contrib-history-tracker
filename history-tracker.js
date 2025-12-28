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
        
        // Skip empty lines and separators
        if (!line || line.startsWith('---') || line.startsWith('Month') || line.startsWith('Year')) continue;
        
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
        
        const valueMatch = line.match(/Value:\s*([\d.]+)/);
        const timeMatch = line.match(/Timestamp:\s*(.+)/);
        const keyMatch = line.match(/Period:\s*(.+)/);
        
        if (currentSection === 'monthHistory' || currentSection === 'yearHistory') {
            if (keyMatch) {
                const entry = { key: keyMatch[1].trim() };
                
                if (i + 1 < lines.length) {
                    const nextValueMatch = lines[i + 1].match(/Value:\s*([\d.]+)/);
                    if (nextValueMatch) entry.value = parseFloat(nextValueMatch[1]);
                }
                if (i + 2 < lines.length) {
                    const nextTimeMatch = lines[i + 2].match(/Timestamp:\s*(.+)/);
                    if (nextTimeMatch) entry.timestamp = nextTimeMatch[1].trim();
                }
                
                if (entry.key && entry.value !== undefined) {
                    data[currentSection].push(entry);
                }
            }
        } else if (currentSection) {
            // For lastValue there is no period, only value and timestamp
            if (currentSection === 'lastValue') {
                if (valueMatch && data[currentSection].value === undefined) {
                    data[currentSection].value = parseFloat(valueMatch[1]);
                }
                if (timeMatch && !data[currentSection].timestamp) {
                    data[currentSection].timestamp = timeMatch[1].trim();
                }
            } else {
                // For other sections: period, value and timestamp
                if (keyMatch && !data[currentSection].key) {
                    data[currentSection].key = keyMatch[1].trim();
                }
                if (valueMatch && data[currentSection].value === undefined) {
                    data[currentSection].value = parseFloat(valueMatch[1]);
                }
                if (timeMatch && !data[currentSection].timestamp) {
                    data[currentSection].timestamp = timeMatch[1].trim();
                }
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
        content += `Value: ${data.lastValue.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.lastValue.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT HOUR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentHour.key) {
        content += `Period: ${data.currentHour.key}\n`;
        content += `Value: ${data.currentHour.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.currentHour.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  LAST HOUR\n';
    content += '='.repeat(60) + '\n';
    if (data.lastHour.key) {
        content += `Period: ${data.lastHour.key}\n`;
        content += `Value: ${data.lastHour.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.lastHour.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT DAY\n';
    content += '='.repeat(60) + '\n';
    if (data.currentDay.key) {
        content += `Period: ${data.currentDay.key}\n`;
        content += `Value: ${data.currentDay.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.currentDay.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  LAST DAY\n';
    content += '='.repeat(60) + '\n';
    if (data.lastDay.key) {
        content += `Period: ${data.lastDay.key}\n`;
        content += `Value: ${data.lastDay.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.lastDay.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT MONTH\n';
    content += '='.repeat(60) + '\n';
    if (data.currentMonth.key) {
        content += `Period: ${data.currentMonth.key}\n`;
        content += `Value: ${data.currentMonth.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.currentMonth.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  MONTH HISTORY (All past months)\n';
    content += '='.repeat(60) + '\n';
    if (data.monthHistory.length > 0) {
        data.monthHistory.forEach((month, index) => {
            content += `\nMonth ${index + 1}:\n`;
            content += `Period: ${month.key}\n`;
            content += `Value: ${month.value.toFixed(2)} ${unit}\n`;
            content += `Timestamp: ${month.timestamp}\n`;
            content += '-'.repeat(40) + '\n';
        });
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT YEAR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentYear.key) {
        content += `Period: ${data.currentYear.key}\n`;
        content += `Value: ${data.currentYear.value.toFixed(2)} ${unit}\n`;
        content += `Timestamp: ${data.currentYear.timestamp}\n`;
    }
    content += '\n';
    
    content += '='.repeat(60) + '\n';
    content += '  YEAR HISTORY (All past years)\n';
    content += '='.repeat(60) + '\n';
    if (data.yearHistory.length > 0) {
        data.yearHistory.forEach((year, index) => {
            content += `\nYear ${index + 1}:\n`;
            content += `Period: ${year.key}\n`;
            content += `Value: ${year.value.toFixed(2)} ${unit}\n`;
            content += `Timestamp: ${year.timestamp}\n`;
            content += '-'.repeat(40) + '\n';
        });
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
}

// Export utility functions for testing (when not used as Node-RED module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports.HistoryTrackerUtils = HistoryTrackerUtils;
}
