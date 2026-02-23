const fs = require('fs');
const path = require('path');

const VERSION = "2.0.3";

// Exported helper functions for testing
const HistoryTrackerUtils = {
    loadData,
    parseHistoryFile,
    saveData,
    saveValue,
    trimHistory,
    calculateGoalProjection
};

/**
 * Node-RED module export function
 * Registers the history-tracker node type with Node-RED
 * @param {Object} RED - Node-RED runtime object
 */
function NodeREDModule(RED) {
    
    /**
     * History Tracker Node constructor
     * Creates a new history tracker node instance
     * @param {Object} config - Node configuration from Node-RED editor
     */
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
        
        // History limits (0 = unlimited)
        node.maxHourHistory = parseInt(config.maxHourHistory) || 0;
        node.maxDayHistory = parseInt(config.maxDayHistory) || 0;
        // Enforce minimum 24 months for goal projection calculations
        node.maxMonthHistory = Math.max(parseInt(config.maxMonthHistory) || 0, 24);
        node.maxYearHistory = parseInt(config.maxYearHistory) || 0;
        
        // Yearly goal configuration
        node.yearlyGoal = parseFloat(config.yearlyGoal) || 0;
        node.goalStartMonth = parseInt(config.goalStartMonth) || 1;
        node.goalEndMonth = parseInt(config.goalEndMonth) || 12;
        
        // Set status with version
        node.status({fill: "green", shape: "dot", text: `ready (v${VERSION})`});
        node.log(`History Tracker initialized - Version ${VERSION}`);
        
        // On startup: Calculate and update goals for existing current periods if goal is configured
        if (node.yearlyGoal > 0) {
            try {
                const data = loadData(node.filepath);
                const goalConfig = {
                    yearlyGoal: node.yearlyGoal,
                    goalStartMonth: node.goalStartMonth,
                    goalEndMonth: node.goalEndMonth
                };
                const goalProjection = calculateGoalProjection(data, goalConfig);
                
                // Update current periods with new goal calculations
                if (goalProjection.goalPerDay !== null && data.currentDay.period) {
                    data.currentDay.goal = goalProjection.goalPerDay;
                }
                if (goalProjection.goalPerMonth !== null && data.currentMonth.period) {
                    data.currentMonth.goal = goalProjection.goalPerMonth;
                }
                if (goalProjection.goalPerYear !== null && data.currentYear.period) {
                    data.currentYear.goal = goalProjection.goalPerYear;
                }
                
                // Store goal config for file header
                data.goalConfig = goalProjection;
                
                // Save updated data
                saveData(node.filepath, data, node.unit);
                node.log('Goal values updated for current periods on startup');
            } catch (error) {
                node.warn('Could not update goals on startup: ' + error.message);
            }
        }
        
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
                const data = saveValue(node.filepath, value, node.unit, {
                    yearlyGoal: node.yearlyGoal,
                    goalStartMonth: node.goalStartMonth,
                    goalEndMonth: node.goalEndMonth
                });
                
                // Trim history arrays to configured limits
                trimHistory(data, {
                    maxHourHistory: node.maxHourHistory,
                    maxDayHistory: node.maxDayHistory,
                    maxMonthHistory: node.maxMonthHistory,
                    maxYearHistory: node.maxYearHistory
                });
                
                // Save trimmed data
                saveData(node.filepath, data, node.unit);
                
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
                } else if (node.outputMode === 'hour_history') {
                    // Format for Dashboard 2.0 chart: separate series arrays
                    const historyData = [data.currentHour, ...data.hourHistory];
                    msg.payload = {
                        series: ['actual'],
                        data: [
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.value
                            }))
                        ]
                    };
                    node.send(msg);
                } else if (node.outputMode === 'day_history') {
                    // Format for Dashboard 2.0 chart: separate series arrays
                    const historyData = [data.currentDay, ...data.dayHistory];
                    msg.payload = {
                        series: ['actual', 'goal'],
                        data: [
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.value
                            })),
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.goal || null
                            }))
                        ]
                    };
                    node.send(msg);
                } else if (node.outputMode === 'month_history') {
                    // Format for Dashboard 2.0 chart: separate series arrays
                    const historyData = [data.currentMonth, ...data.monthHistory];
                    msg.payload = {
                        series: ['actual', 'goal'],
                        data: [
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.value
                            })),
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.goal || null
                            }))
                        ]
                    };
                    node.send(msg);
                } else if (node.outputMode === 'year_history') {
                    // Format for Dashboard 2.0 chart: separate series arrays
                    const historyData = [data.currentYear, ...data.yearHistory];
                    msg.payload = {
                        series: ['actual', 'goal'],
                        data: [
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.value
                            })),
                            historyData.map(entry => ({
                                x: entry.period,
                                y: entry.goal || null
                            }))
                        ]
                    };
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

// Export for Node-RED
module.exports = NodeREDModule;

// Export utility functions for testing
module.exports.HistoryTrackerUtils = HistoryTrackerUtils;

// Helper functions - defined outside module.exports for testability

/**
 * Fill missing periods with zero values when a gap is detected
 * @param {Object} data - The data object containing history arrays
 * @param {string} historyKey - The key for the history array ('hourHistory', 'dayHistory', etc.)
 * @param {Object} currentPeriod - The current period object to be moved to history
 * @param {number} periodDiff - Number of periods that have passed
 * @param {Function} generateMissingPeriod - Function to generate a missing period entry
 */
function fillPeriodGap(data, historyKey, currentPeriod, periodDiff, generateMissingPeriod) {
    // Save current period to history first
    data[historyKey].unshift({ ...currentPeriod });
    
    // Fill in missing periods (from most recent to oldest)
    for (let i = periodDiff - 1; i >= 1; i--) {
        const missingPeriod = generateMissingPeriod(i);
        data[historyKey].unshift(missingPeriod);
    }
}

/**
 * Save a new value and update history tracking
 * Calculates differences, detects period changes, and fills gaps with zero values
 * @param {string} filepath - Path to the history file
 * @param {number} value - The new value to save
 * @param {string} unit - The unit of measurement (e.g., 'Liter')
 * @param {Object} goalConfig - Optional goal configuration for calculating goal per period
 * @returns {Object} The updated data object with all history information
 */
function saveValue(filepath, value, unit, goalConfig) {
    const now = new Date();
    
    // Create ISO-like timestamp: YYYY-MM-DDTHH:MM:SS
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    
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
        // New hour detected
        if (data.currentHour.period) {
            // Calculate how many hours have passed since last update
            const lastHourMatch = data.currentHour.period.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})/);
            if (lastHourMatch) {
                const [, lastYear, lastMonth, lastDay, lastHour] = lastHourMatch;
                const lastDate = new Date(lastYear, lastMonth - 1, lastDay, lastHour);
                const currentDate = new Date(currentYear, currentMonth - 1, currentDay, currentHour);
                
                // Calculate hours difference
                const hoursDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60));
                
                if (hoursDiff > 1) {
                    // Multiple hours have passed - fill missing hours with zero
                    fillPeriodGap(data, 'hourHistory', data.currentHour, hoursDiff, (i) => {
                        const missingDate = new Date(currentDate.getTime() - (i * 60 * 60 * 1000));
                        const missingYear = missingDate.getFullYear();
                        const missingMonth = String(missingDate.getMonth() + 1).padStart(2, '0');
                        const missingDay = String(missingDate.getDate()).padStart(2, '0');
                        const missingHour = String(missingDate.getHours()).padStart(2, '0');
                        const missingMinutes = String(missingDate.getMinutes()).padStart(2, '0');
                        const missingSeconds = String(missingDate.getSeconds()).padStart(2, '0');
                        
                        const missingHourKey = `${missingYear}-${missingMonth}-${missingDay}_${missingHour}`;
                        const missingTimestamp = `${missingYear}-${missingMonth}-${missingDay}T${missingHour}:${missingMinutes}:${missingSeconds}`;
                        
                        return {
                            period: missingHourKey,
                            value: 0,
                            timestamp: missingTimestamp,
                            timestampMs: missingDate.getTime()
                        };
                    });
                } else {
                    // Only one hour has passed - normal behavior
                    data.hourHistory.unshift({ ...data.currentHour });
                }
            } else {
                // Couldn't parse old period, just add it normally
                data.hourHistory.unshift({ ...data.currentHour });
            }
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
        // New day detected - calculate NEW goal first before moving old day to history
        let newDayGoal = null;
        if (goalConfig && goalConfig.yearlyGoal > 0) {
            const goalProjection = calculateGoalProjection(data, goalConfig);
            newDayGoal = goalProjection.goalPerDay;
        }
        
        if (data.currentDay.period) {
            // Calculate min/max from hour history for this day
            const dayPrefix = data.currentDay.period;
            const dayHours = data.hourHistory.filter(h => h.period && h.period.startsWith(dayPrefix));
            
            if (dayHours.length > 0) {
                const hourValues = dayHours.map(h => h.value);
                data.currentDay.min = Math.min(...hourValues);
                data.currentDay.max = Math.max(...hourValues);
            }
            
            // Calculate how many days have passed since last update
            const lastDayMatch = data.currentDay.period.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (lastDayMatch) {
                const [, lastYear, lastMonth, lastDay] = lastDayMatch;
                const lastDate = new Date(lastYear, lastMonth - 1, lastDay);
                const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
                
                // Calculate days difference
                const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > 1) {
                    // Multiple days have passed - fill missing days with zero
                    fillPeriodGap(data, 'dayHistory', data.currentDay, daysDiff, (i) => {
                        const missingDate = new Date(currentDate.getTime() - (i * 24 * 60 * 60 * 1000));
                        const missingYear = missingDate.getFullYear();
                        const missingMonth = String(missingDate.getMonth() + 1).padStart(2, '0');
                        const missingDay = String(missingDate.getDate()).padStart(2, '0');
                        
                        const missingDayKey = `${missingYear}-${missingMonth}-${missingDay}`;
                        const missingTimestamp = `${missingYear}-${missingMonth}-${missingDay}T23:59:59`;
                        
                        return {
                            period: missingDayKey,
                            value: 0,
                            timestamp: missingTimestamp,
                            timestampMs: missingDate.getTime(),
                            min: 0,
                            max: 0
                        };
                    });
                } else {
                    // Only one day has passed - move current day to history with its goal
                    data.dayHistory.unshift({ ...data.currentDay });
                }
            } else {
                // Couldn't parse old period, just add it normally
                data.dayHistory.unshift({ ...data.currentDay });
            }
        }
        
        // New day starts at 0 and adds current difference with NEW goal
        data.currentDay = {
            period: dayKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
        if (newDayGoal !== null) {
            data.currentDay.goal = newDayGoal;
        }
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
        // New month detected - calculate NEW goal first before moving old month to history
        let newMonthGoal = null;
        if (goalConfig && goalConfig.yearlyGoal > 0) {
            const goalProjection = calculateGoalProjection(data, goalConfig);
            newMonthGoal = goalProjection.goalPerMonth;
        }
        
        if (data.currentMonth.period) {
            // Calculate min/max from day history for this month
            const monthPrefix = data.currentMonth.period;
            const monthDays = data.dayHistory.filter(d => d.period && d.period.startsWith(monthPrefix));
            
            if (monthDays.length > 0) {
                const dayValues = monthDays.map(d => d.value);
                data.currentMonth.min = Math.min(...dayValues);
                data.currentMonth.max = Math.max(...dayValues);
            }
            
            // Calculate how many months have passed since last update
            const lastMonthMatch = data.currentMonth.period.match(/(\d{4})-(\d{2})/);
            if (lastMonthMatch) {
                const [, lastYear, lastMonth] = lastMonthMatch;
                const lastDate = new Date(lastYear, lastMonth - 1, 1);
                const currentDate = new Date(currentYear, currentMonth - 1, 1);
                
                // Calculate months difference
                const monthsDiff = (currentYear - parseInt(lastYear)) * 12 + (currentMonth - parseInt(lastMonth));
                
                if (monthsDiff > 1) {
                    // Multiple months have passed - fill missing months with zero
                    fillPeriodGap(data, 'monthHistory', data.currentMonth, monthsDiff, (i) => {
                        const missingDate = new Date(currentYear, currentMonth - 1 - i, 1);
                        const missingYear = missingDate.getFullYear();
                        const missingMonth = String(missingDate.getMonth() + 1).padStart(2, '0');
                        
                        const missingMonthKey = `${missingYear}-${missingMonth}`;
                        const missingTimestamp = `${missingYear}-${missingMonth}-01T00:00:00`;
                        
                        return {
                            period: missingMonthKey,
                            value: 0,
                            timestamp: missingTimestamp,
                            timestampMs: missingDate.getTime(),
                            min: 0,
                            max: 0
                        };
                    });
                } else {
                    // Only one month has passed - move current month to history with its goal
                    data.monthHistory.unshift({ ...data.currentMonth });
                }
            } else {
                // Couldn't parse old period, just add it normally
                data.monthHistory.unshift({ ...data.currentMonth });
            }
        }
        
        // New month starts at 0 and adds current difference with NEW goal
        data.currentMonth = {
            period: monthKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
        if (newMonthGoal !== null) {
            data.currentMonth.goal = newMonthGoal;
        }
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
        // New year detected - calculate NEW goal first before moving old year to history
        let newYearGoal = null;
        if (goalConfig && goalConfig.yearlyGoal > 0) {
            const goalProjection = calculateGoalProjection(data, goalConfig);
            newYearGoal = goalProjection.goalPerYear;
        }
        
        if (data.currentYear.period) {
            // Calculate min/max from month history for this year
            const yearPrefix = data.currentYear.period;
            const yearMonths = data.monthHistory.filter(m => m.period && m.period.startsWith(yearPrefix));
            
            if (yearMonths.length > 0) {
                const monthValues = yearMonths.map(m => m.value);
                data.currentYear.min = Math.min(...monthValues);
                data.currentYear.max = Math.max(...monthValues);
            }
            
            // Calculate how many years have passed since last update
            const lastYearInt = parseInt(data.currentYear.period);
            const yearsDiff = currentYear - lastYearInt;
            
            if (yearsDiff > 1) {
                // Multiple years have passed - fill missing years with zero
                fillPeriodGap(data, 'yearHistory', data.currentYear, yearsDiff, (i) => {
                    const missingYear = currentYear - i;
                    const missingYearKey = `${missingYear}`;
                    const missingTimestamp = `${missingYear}-01-01T00:00:00`;
                    
                    return {
                        period: missingYearKey,
                        value: 0,
                        timestamp: missingTimestamp,
                        timestampMs: new Date(missingYear, 0, 1).getTime(),
                        min: 0,
                        max: 0
                    };
                });
            } else {
                // Only one year has passed - move current year to history with its goal
                data.yearHistory.unshift({ ...data.currentYear });
            }
        }
        
        // New year starts at 0 and adds current difference with NEW goal
        data.currentYear = {
            period: yearKey,
            value: difference,
            timestamp: timestamp,
            timestampMs: now.getTime()
        };
        if (newYearGoal !== null) {
            data.currentYear.goal = newYearGoal;
        }
    } else {
        // Same year - add difference
        if (data.currentYear.value === undefined) {
            data.currentYear.value = 0;
        }
        data.currentYear.value += difference;
        data.currentYear.timestamp = timestamp;
        data.currentYear.timestampMs = now.getTime();
    }
    
    // Store goal config in data for file header (if configured)
    if (goalConfig && goalConfig.yearlyGoal > 0) {
        const goalProjection = calculateGoalProjection(data, goalConfig);
        data.goalConfig = goalProjection;
    }
    
    saveData(filepath, data, unit);
    return data;
}

/**
 * Load history data from file
 * Returns empty data structure if file doesn't exist or can't be read
 * @param {string} filepath - Path to the history file
 * @returns {Object} Data object containing all history information
 */
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

/**
 * Parse history file content into structured data object
 * Supports both ISO format (YYYY-MM-DDTHH:MM:SS) and legacy German format (DD.MM.YYYY, HH:MM:SS)
 * @param {string} content - The file content to parse
 * @returns {Object} Parsed data object with all history sections
 */
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
        
        // Parse compact format: T: timestamp  -  P: period  -  V: value unit  -  Min: min  -  Max: max  -  G: goal
        // For lastValue: T: timestamp  -  V: value unit
        const compactMatch = line.match(/T:\s*(.+?)\s*-\s*(?:P:\s*(.+?)\s*-\s*)?V:\s*([\d.]+)\s*\w*(?:\s*-\s*Min:\s*([\d.]+)\s*-\s*Max:\s*([\d.]+))?(?:\s*-\s*G:\s*([\d.]+))?/);
        
        if (compactMatch && currentSection) {
            const timestamp = compactMatch[1].trim();
            const period = compactMatch[2] ? compactMatch[2].trim() : null;
            const value = parseFloat(compactMatch[3]);
            const min = compactMatch[4] ? parseFloat(compactMatch[4]) : undefined;
            const max = compactMatch[5] ? parseFloat(compactMatch[5]) : undefined;
            const goal = compactMatch[6] ? parseFloat(compactMatch[6]) : undefined;
            
            // Parse ISO timestamp format to milliseconds
            // Format: "YYYY-MM-DDTHH:MM:SS" or legacy "DD.MM.YYYY, HH:MM:SS"
            let timestampMs = null;
            try {
                // Try ISO format first
                const isoMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                if (isoMatch) {
                    const [, year, month, day, hour, minute, second] = isoMatch;
                    const date = new Date(year, month - 1, day, hour, minute, second);
                    timestampMs = date.getTime();
                } else {
                    // Try legacy German format
                    const germanMatch = timestamp.match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
                    if (germanMatch) {
                        const [, day, month, year, hour, minute, second] = germanMatch;
                        const date = new Date(year, month - 1, day, hour, minute, second);
                        timestampMs = date.getTime();
                    }
                }
            } catch (e) {
                // If parsing fails, timestampMs remains null
            }
            
            if (currentSection === 'hourHistory' || currentSection === 'dayHistory' || currentSection === 'monthHistory' || currentSection === 'yearHistory') {
                const entry = {
                    period: period,
                    value: value,
                    timestamp: timestamp,
                    timestampMs: timestampMs
                };
                if (min !== undefined) entry.min = min;
                if (max !== undefined) entry.max = max;
                if (goal !== undefined) entry.goal = goal;
                data[currentSection].push(entry);
            } else if (currentSection === 'lastValue') {
                data[currentSection] = {
                    value: value,
                    timestamp: timestamp,
                    timestampMs: timestampMs
                };
            } else {
                const entry = {
                    period: period,
                    value: value,
                    timestamp: timestamp,
                    timestampMs: timestampMs
                };
                if (min !== undefined) entry.min = min;
                if (max !== undefined) entry.max = max;
                if (goal !== undefined) entry.goal = goal;
                data[currentSection] = entry;
            }
        }
    }
    
    return data;
}

/**
 * Save data to history file in human-readable format
 * Creates structured sections for last value, current periods, and history arrays
 * @param {string} filepath - Path to the history file
 * @param {Object} data - The data object to save
 * @param {string} unit - The unit of measurement (e.g., 'Liter')
 */
function saveData(filepath, data, unit) {
    let content = '';
    
    // Add version header
    content += '# File created by History Tracker version ' + VERSION + '\n';
    content += '# Timestamp: ' + new Date().toISOString() + '\n';
    
    // Add goal configuration if present
    if (data.goalConfig) {
        content += '#\n';
        content += '# Goal Configuration:\n';
        content += `#   Goal: ${data.goalConfig.yearlyGoal.toFixed(2)} ${unit}\n`;
        content += `#   Period: Month ${data.goalConfig.goalStartMonth} to Month ${data.goalConfig.goalEndMonth}\n`;
        content += `#   Consumed: ${data.goalConfig.totalConsumed.toFixed(2)} ${unit}\n`;
        content += `#   Remaining: ${data.goalConfig.remainingGoal.toFixed(2)} ${unit}\n`;
    }
    
    content += '\n';
    
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
        content += `T: ${data.currentDay.timestamp}  -  P: ${data.currentDay.period}  -  V: ${data.currentDay.value.toFixed(2)} ${unit}`;
        if (data.currentDay.min !== undefined && data.currentDay.max !== undefined) {
            content += `  -  Min: ${data.currentDay.min.toFixed(2)}  -  Max: ${data.currentDay.max.toFixed(2)}`;
        }
        if (data.currentDay.goal !== undefined) {
            content += `  -  G: ${data.currentDay.goal.toFixed(2)}`;
        }
        content += '\n';
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  DAY HISTORY (All past days)\n';
    content += '='.repeat(60) + '\n';
    if (data.dayHistory && data.dayHistory.length > 0) {
        data.dayHistory.forEach((day) => {
            content += `T: ${day.timestamp}  -  P: ${day.period}  -  V: ${day.value.toFixed(2)} ${unit}`;
            if (day.min !== undefined && day.max !== undefined) {
                content += `  -  Min: ${day.min.toFixed(2)}  -  Max: ${day.max.toFixed(2)}`;
            }
            if (day.goal !== undefined) {
                content += `  -  G: ${day.goal.toFixed(2)}`;
            }
            content += '\n';
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT MONTH\n';
    content += '='.repeat(60) + '\n';
    if (data.currentMonth.period) {
        content += `T: ${data.currentMonth.timestamp}  -  P: ${data.currentMonth.period}  -  V: ${data.currentMonth.value.toFixed(2)} ${unit}`;
        if (data.currentMonth.min !== undefined && data.currentMonth.max !== undefined) {
            content += `  -  Min: ${data.currentMonth.min.toFixed(2)}  -  Max: ${data.currentMonth.max.toFixed(2)}`;
        }
        if (data.currentMonth.goal !== undefined) {
            content += `  -  G: ${data.currentMonth.goal.toFixed(2)}`;
        }
        content += '\n';
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  MONTH HISTORY (All past months)\n';
    content += '='.repeat(60) + '\n';
    if (data.monthHistory.length > 0) {
        data.monthHistory.forEach((month) => {
            content += `T: ${month.timestamp}  -  P: ${month.period}  -  V: ${month.value.toFixed(2)} ${unit}`;
            if (month.min !== undefined && month.max !== undefined) {
                content += `  -  Min: ${month.min.toFixed(2)}  -  Max: ${month.max.toFixed(2)}`;
            }
            if (month.goal !== undefined) {
                content += `  -  G: ${month.goal.toFixed(2)}`;
            }
            content += '\n';
        });
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  CURRENT YEAR\n';
    content += '='.repeat(60) + '\n';
    if (data.currentYear.period) {
        content += `T: ${data.currentYear.timestamp}  -  P: ${data.currentYear.period}  -  V: ${data.currentYear.value.toFixed(2)} ${unit}`;
        if (data.currentYear.min !== undefined && data.currentYear.max !== undefined) {
            content += `  -  Min: ${data.currentYear.min.toFixed(2)}  -  Max: ${data.currentYear.max.toFixed(2)}`;
        }
        if (data.currentYear.goal !== undefined) {
            content += `  -  G: ${data.currentYear.goal.toFixed(2)}`;
        }
        content += '\n';
    }
    content += '\n\n';
    
    content += '='.repeat(60) + '\n';
    content += '  YEAR HISTORY (All past years)\n';
    content += '='.repeat(60) + '\n';
    if (data.yearHistory.length > 0) {
        data.yearHistory.forEach((year) => {
            content += `T: ${year.timestamp}  -  P: ${year.period}  -  V: ${year.value.toFixed(2)} ${unit}`;
            if (year.min !== undefined && year.max !== undefined) {
                content += `  -  Min: ${year.min.toFixed(2)}  -  Max: ${year.max.toFixed(2)}`;
            }
            if (year.goal !== undefined) {
                content += `  -  G: ${year.goal.toFixed(2)}`;
            }
            content += '\n';
        });
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
}

/**
 * Trim history arrays to configured maximum lengths
 * Keeps the newest entries (at the beginning of the array) and removes older ones
 * @param {Object} data - The data object containing history arrays
 * @param {Object} limits - Object containing max limits for each history type
 * @param {number} limits.maxHourHistory - Maximum number of hour history entries (0 = unlimited)
 * @param {number} limits.maxDayHistory - Maximum number of day history entries (0 = unlimited)
 * @param {number} limits.maxMonthHistory - Maximum number of month history entries (0 = unlimited)
 * @param {number} limits.maxYearHistory - Maximum number of year history entries (0 = unlimited)
 */
function trimHistory(data, limits) {
    // Trim hour history
    if (limits.maxHourHistory > 0 && data.hourHistory.length > limits.maxHourHistory) {
        data.hourHistory = data.hourHistory.slice(0, limits.maxHourHistory);
    }
    
    // Trim day history
    if (limits.maxDayHistory > 0 && data.dayHistory.length > limits.maxDayHistory) {
        data.dayHistory = data.dayHistory.slice(0, limits.maxDayHistory);
    }
    
    // Trim month history
    if (limits.maxMonthHistory > 0 && data.monthHistory.length > limits.maxMonthHistory) {
        data.monthHistory = data.monthHistory.slice(0, limits.maxMonthHistory);
    }
    
    // Trim year history
    if (limits.maxYearHistory > 0 && data.yearHistory.length > limits.maxYearHistory) {
        data.yearHistory = data.yearHistory.slice(0, limits.maxYearHistory);
    }
}

/**
 * Calculate goal projection values for day, month, and year periods
 * Uses ONLY month-level data (monthHistory + currentMonth) to calculate consumption
 * Distributes the remaining goal evenly across remaining periods in the goal timeframe
 * @param {Object} data - The data object containing history arrays
 * @param {Object} goalConfig - Goal configuration object
 * @param {number} goalConfig.yearlyGoal - The yearly goal value
 * @param {number} goalConfig.goalStartMonth - Start month (1-12)
 * @param {number} goalConfig.goalEndMonth - End month (1-12)
 * @returns {Object} Object containing goal values for each period type and configuration info
 */
function calculateGoalProjection(data, goalConfig) {
    let { yearlyGoal, goalStartMonth, goalEndMonth } = goalConfig;
    
    // Validate inputs
    if (!yearlyGoal || yearlyGoal <= 0) {
        return {
            goalPerDay: null,
            goalPerMonth: null,
            goalPerYear: null,
            yearlyGoal: 0,
            goalStartMonth: goalStartMonth,
            goalEndMonth: goalEndMonth,
            totalConsumed: 0,
            remainingGoal: 0
        };
    }
    
    // Ensure goal months are numbers (they might come as strings from config)
    goalStartMonth = parseInt(goalStartMonth);
    goalEndMonth = parseInt(goalEndMonth);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Determine if we're in a goal period that spans year boundaries
    const spansYears = goalStartMonth > goalEndMonth;
    
    // Calculate which goal period we're currently in
    let goalPeriodYear;
    if (spansYears) {
        // Goal period spans years (e.g., Oct to Mar)
        if (currentMonth >= goalStartMonth) {
            goalPeriodYear = currentYear; // Current year's start
        } else {
            goalPeriodYear = currentYear - 1; // Started last year
        }
    } else {
        goalPeriodYear = currentYear;
    }
    
    // Helper to check if a MONTH period is within goal timeframe
    const isMonthInGoalPeriod = (period) => {
        const match = period.match(/(\d{4})-(\d{2})/);
        if (!match) return false;
        const [, year, month] = match;
        const y = parseInt(year);
        const m = parseInt(month);
        
        if (spansYears) {
            // Goal period spans years (e.g., Oct to Mar)
            if (y === goalPeriodYear && m >= goalStartMonth) return true;
            if (y === goalPeriodYear + 1 && m <= goalEndMonth) return true;
        } else {
            // Same year goal period
            if (y === goalPeriodYear && m >= goalStartMonth && m <= goalEndMonth) return true;
        }
        return false;
    };
    
    // Calculate total consumed in current goal period using ONLY month data
    let totalConsumed = 0;
    
    // Add current month if in goal period
    if (data.currentMonth && data.currentMonth.period && isMonthInGoalPeriod(data.currentMonth.period)) {
        totalConsumed += data.currentMonth.value || 0;
    }
    
    // Add month history entries in goal period
    for (const entry of data.monthHistory) {
        if (entry.period && isMonthInGoalPeriod(entry.period)) {
            totalConsumed += entry.value || 0;
        }
    }
    
    // Calculate remaining goal
    const remainingGoal = Math.max(0, yearlyGoal - totalConsumed);
    
    // Check if we're in the goal period
    const inGoalPeriod = spansYears 
        ? (currentMonth >= goalStartMonth || currentMonth <= goalEndMonth)
        : (currentMonth >= goalStartMonth && currentMonth <= goalEndMonth);
    
    if (!inGoalPeriod) {
        // Outside goal period - no projections
        return {
            goalPerDay: null,
            goalPerMonth: null,
            goalPerYear: null,
            yearlyGoal: yearlyGoal,
            goalStartMonth: goalStartMonth,
            goalEndMonth: goalEndMonth,
            totalConsumed: totalConsumed,
            remainingGoal: remainingGoal
        };
    }
    
    // Calculate remaining months in goal period
    let remainingMonths;
    if (spansYears) {
        const goalEndYear = goalPeriodYear + 1;
        const endDate = new Date(goalEndYear, goalEndMonth - 1, 1);
        const currentDate = new Date(currentYear, currentMonth - 1, 1);
        remainingMonths = (endDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                       (endDate.getMonth() - currentDate.getMonth()) + 1;
    } else {
        remainingMonths = goalEndMonth - currentMonth + 1;
    }
    remainingMonths = Math.max(1, remainingMonths);
    
    // Calculate remaining days in goal period
    let endDate;
    if (spansYears) {
        endDate = new Date(goalPeriodYear + 1, goalEndMonth, 0); // Last day of end month
    } else {
        endDate = new Date(goalPeriodYear, goalEndMonth, 0); // Last day of end month
    }
    const currentDate = new Date(currentYear, currentMonth - 1, now.getDate());
    const remainingDays = Math.max(1, Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)));
    
    // Calculate goal per period
    const goalPerDay = remainingGoal / remainingDays;
    const goalPerMonth = remainingGoal / remainingMonths;
    const goalPerYear = yearlyGoal; // Always use the configured yearly goal, not the remaining amount
    
    return {
        goalPerDay: goalPerDay,
        goalPerMonth: goalPerMonth,
        goalPerYear: goalPerYear,
        yearlyGoal: yearlyGoal,
        goalStartMonth: goalStartMonth,
        goalEndMonth: goalEndMonth,
        totalConsumed: totalConsumed,
        remainingGoal: remainingGoal
    };
}
