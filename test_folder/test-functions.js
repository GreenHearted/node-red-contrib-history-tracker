const fs = require('fs');
const path = require('path');
const { HistoryTrackerUtils } = require('../history-tracker.js');

// Test configuration
const TEST_DIR = path.join(__dirname, 'test-data');
const TEST_FILE = path.join(TEST_DIR, 'test-history.txt');

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Helper function to clean up test files
function cleanupTestFiles() {
    if (fs.existsSync(TEST_FILE)) {
        fs.unlinkSync(TEST_FILE);
    }
}

// Helper function to print test results
function printTestResult(testName, passed, details = '') {
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${testName}`);
    if (details) {
        console.log(`  ${details}`);
    }
    console.log('');
}

// ============================================================================
// TEST 1: parseHistoryFile - Parse valid history file content
// ============================================================================
function testParseHistoryFile() {
    console.log('=== TEST 1: parseHistoryFile ===');
    
    const sampleContent = `============================================================
  LAST VALUE
============================================================
T: 2024-01-01T10:30:00  -  V: 123.45 Liter


============================================================
  CURRENT HOUR
============================================================
T: 2024-01-01T10:30:00  -  P: 2024-01-01_10  -  V: 5.50 Liter


============================================================
  CURRENT DAY
============================================================
T: 2024-01-01T10:30:00  -  P: 2024-01-01  -  V: 25.75 Liter


============================================================
  CURRENT MONTH
============================================================
T: 2024-01-01T10:30:00  -  P: 2024-01  -  V: 100.00 Liter


============================================================
  CURRENT YEAR
============================================================
T: 2024-01-01T10:30:00  -  P: 2024  -  V: 100.00 Liter
`;

    const result = HistoryTrackerUtils.parseHistoryFile(sampleContent);
    
    const passed = 
        result.lastValue.value === 123.45 &&
        result.currentHour.value === 5.50 &&
        result.currentDay.value === 25.75 &&
        result.currentMonth.value === 100.00;
    
    printTestResult(
        'parseHistoryFile should parse all sections correctly',
        passed,
        passed ? 'All values parsed correctly' : `Got: ${JSON.stringify(result, null, 2)}`
    );
    
    return passed;
}

// ============================================================================
// TEST 2: loadData - Load data from non-existent file
// ============================================================================
function testLoadDataEmpty() {
    console.log('=== TEST 2: loadData (empty file) ===');
    
    cleanupTestFiles();
    
    const result = HistoryTrackerUtils.loadData(TEST_FILE);
    
    const passed = 
        Object.keys(result.lastValue).length === 0 &&
        Object.keys(result.currentHour).length === 0 &&
        Array.isArray(result.monthHistory) &&
        result.monthHistory.length === 0;
    
    printTestResult(
        'loadData should return empty structure for non-existent file',
        passed,
        passed ? 'Empty data structure returned' : `Got: ${JSON.stringify(result)}`
    );
    
    return passed;
}

// ============================================================================
// TEST 3: saveData - Save data to file
// ============================================================================
function testSaveData() {
    console.log('=== TEST 3: saveData ===');
    
    cleanupTestFiles();
    
    const testData = {
        lastValue: { value: 50.00, timestamp: '2024-01-01T12:00:00' },
        currentHour: { period: '2024-01-01_12', value: 2.50, timestamp: '2024-01-01T12:00:00' },
        hourHistory: [],
        currentDay: { period: '2024-01-01', value: 10.00, timestamp: '2024-01-01T12:00:00' },
        dayHistory: [],
        currentMonth: { period: '2024-01', value: 50.00, timestamp: '2024-01-01T12:00:00' },
        monthHistory: [],
        currentYear: { period: '2024', value: 50.00, timestamp: '2024-01-01T12:00:00' },
        yearHistory: []
    };
    
    try {
        HistoryTrackerUtils.saveData(TEST_FILE, testData, 'Liter');
        
        const fileExists = fs.existsSync(TEST_FILE);
        const content = fileExists ? fs.readFileSync(TEST_FILE, 'utf8') : '';
        const containsLastValue = content.includes('V: 50.00 Liter');
        const containsCurrentHour = content.includes('2024-01-01_12');
        
        const passed = fileExists && containsLastValue && containsCurrentHour;
        
        printTestResult(
            'saveData should create file with correct content',
            passed,
            passed ? 'File created successfully' : 'File not created or content incorrect'
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveData should create file with correct content', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 4: saveData + loadData - Round-trip test
// ============================================================================
function testSaveAndLoadRoundtrip() {
    console.log('=== TEST 4: saveData + loadData (round-trip) ===');
    
    cleanupTestFiles();
    
    const originalData = {
        lastValue: { value: 75.25, timestamp: '2024-01-01T15:00:00' },
        currentHour: { period: '2024-01-01_15', value: 3.75, timestamp: '2024-01-01T15:00:00' },
        hourHistory: [
            { period: '2024-01-01_14', value: 5.00, timestamp: '2024-01-01T14:59:59' }
        ],
        currentDay: { period: '2024-01-01', value: 20.50, timestamp: '2024-01-01T15:00:00' },
        dayHistory: [],
        currentMonth: { period: '2024-01', value: 75.25, timestamp: '2024-01-01T15:00:00' },
        monthHistory: [
            { period: '2023-12', value: 150.00, timestamp: '2023-12-31T23:59:59' }
        ],
        currentYear: { period: '2024', value: 75.25, timestamp: '2024-01-01T15:00:00' },
        yearHistory: [
            { period: '2023', value: 500.00, timestamp: '2023-12-31T23:59:59' }
        ]
    };
    
    try {
        // Save the data
        HistoryTrackerUtils.saveData(TEST_FILE, originalData, 'Liter');
        
        // Load it back
        const loadedData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        const passed = 
            loadedData.lastValue.value === 75.25 &&
            loadedData.currentHour.value === 3.75 &&
            loadedData.hourHistory.length === 1 &&
            loadedData.hourHistory[0].value === 5.00 &&
            loadedData.monthHistory.length === 1 &&
            loadedData.monthHistory[0].value === 150.00 &&
            loadedData.yearHistory.length === 1 &&
            loadedData.yearHistory[0].value === 500.00;
        
        printTestResult(
            'saveData + loadData should preserve all data',
            passed,
            passed ? 'All data preserved correctly' : `Mismatch in data: ${JSON.stringify(loadedData, null, 2)}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveData + loadData should preserve all data', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 5: saveValue - First value (no previous data)
// ============================================================================
function testSaveValueFirst() {
    console.log('=== TEST 5: saveValue (first value) ===');
    
    cleanupTestFiles();
    
    try {
        const result = HistoryTrackerUtils.saveValue(TEST_FILE, 100.00, 'Liter');
        
        const passed = 
            result.lastValue.value === 100.00 &&
            result.currentHour.value === 0 &&  // First value, no difference
            result.currentDay.value === 0 &&
            result.currentMonth.value === 0 &&
            result.currentYear.value === 0;
        
        printTestResult(
            'saveValue should handle first value correctly (difference = 0)',
            passed,
            passed ? 'First value saved with zero differences' : `Got: ${JSON.stringify(result, null, 2)}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveValue should handle first value correctly', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 6: saveValue - Second value (positive difference)
// ============================================================================
function testSaveValueSecond() {
    console.log('=== TEST 6: saveValue (second value, positive difference) ===');
    
    cleanupTestFiles();
    
    try {
        // First value
        HistoryTrackerUtils.saveValue(TEST_FILE, 100.00, 'Liter');
        
        // Second value (same hour/day/month)
        const result = HistoryTrackerUtils.saveValue(TEST_FILE, 110.00, 'Liter');
        
        const passed = 
            result.lastValue.value === 110.00 &&
            result.currentHour.value === 10.00 &&  // Difference added
            result.currentDay.value === 10.00 &&
            result.currentMonth.value === 10.00 &&
            result.currentYear.value === 10.00;
        
        printTestResult(
            'saveValue should calculate positive difference correctly',
            passed,
            passed ? 'Difference calculated and added correctly' : `Got: ${JSON.stringify(result, null, 2)}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveValue should calculate positive difference correctly', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 7: saveValue - Negative difference (should be treated as 0)
// ============================================================================
function testSaveValueNegative() {
    console.log('=== TEST 7: saveValue (negative difference) ===');
    
    cleanupTestFiles();
    
    try {
        // First value
        HistoryTrackerUtils.saveValue(TEST_FILE, 100.00, 'Liter');
        
        // Second value (lower than first - counter reset scenario)
        const result = HistoryTrackerUtils.saveValue(TEST_FILE, 90.00, 'Liter');
        
        const passed = 
            result.lastValue.value === 90.00 &&
            result.currentHour.value === 0 &&  // Negative difference set to 0
            result.currentDay.value === 0;
        
        printTestResult(
            'saveValue should treat negative difference as 0',
            passed,
            passed ? 'Negative difference correctly set to 0' : `Got: ${JSON.stringify(result, null, 2)}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveValue should treat negative difference as 0', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 8: parseHistoryFile - With month and year history
// ============================================================================
function testParseHistoryFileWithHistory() {
    console.log('=== TEST 8: parseHistoryFile (with history) ===');
    
    const sampleContent = `============================================================
  LAST VALUE
============================================================
T: 2024-02-01T10:00:00  -  V: 200.00 Liter


============================================================
  MONTH HISTORY (All past months)
============================================================
T: 2024-01-31T23:59:59  -  P: 2024-01  -  V: 150.00 Liter  -  Min: 120.00  -  Max: 180.00
T: 2023-12-31T23:59:59  -  P: 2023-12  -  V: 180.00 Liter  -  Min: 150.00  -  Max: 200.00


============================================================
  YEAR HISTORY (All past years)
============================================================
T: 2023-12-31T23:59:59  -  P: 2023  -  V: 1200.00 Liter  -  Min: 1000.00  -  Max: 1500.00
`;

    const result = HistoryTrackerUtils.parseHistoryFile(sampleContent);
    
    const passed = 
        result.lastValue.value === 200.00 &&
        result.monthHistory.length === 2 &&
        result.monthHistory[0].period === '2024-01' &&
        result.monthHistory[0].value === 150.00 &&
        result.monthHistory[0].min === 120.00 &&
        result.monthHistory[0].max === 180.00 &&
        result.monthHistory[1].period === '2023-12' &&
        result.monthHistory[1].value === 180.00 &&
        result.monthHistory[1].min === 150.00 &&
        result.monthHistory[1].max === 200.00 &&
        result.yearHistory.length === 1 &&
        result.yearHistory[0].value === 1200.00 &&
        result.yearHistory[0].min === 1000.00 &&
        result.yearHistory[0].max === 1500.00;
    
    let details = '';
    if (!passed) {
        details = `Month[0]: ${JSON.stringify(result.monthHistory[0])}, Year[0]: ${JSON.stringify(result.yearHistory[0])}`;
    } else {
        details = 'History arrays parsed correctly with min/max';
    }
    
    printTestResult(
        'parseHistoryFile should parse history arrays correctly',
        passed,
        details
    );
    
    return passed;
}

// ============================================================================
// TEST 9: History ordering - newest first (unshift behavior)
// ============================================================================
function testHistoryOrdering() {
    console.log('=== TEST 9: History ordering (newest first) ===');
    
    cleanupTestFiles();
    
    try {
        // Create initial data with existing hour and month history (oldest entries)
        const initialData = {
            lastValue: { value: 50.00, timestamp: '2024-01-01T10:00:00' },
            currentHour: { period: '2024-01-01_10', value: 10.00, timestamp: '2024-01-01T10:30:00' },
            hourHistory: [
                { period: '2024-01-01_09', value: 15.00, timestamp: '2024-01-01T09:59:59' },
                { period: '2024-01-01_08', value: 12.00, timestamp: '2024-01-01T08:59:59' }
            ],
            currentDay: { period: '2024-01-01', value: 37.00, timestamp: '2024-01-01T10:30:00' },
            dayHistory: [],
            currentMonth: { period: '2024-01', value: 100.00, timestamp: '2024-01-01T10:30:00' },
            monthHistory: [
                { period: '2023-12', value: 250.00, timestamp: '2023-12-31T23:59:59' },
                { period: '2023-11', value: 220.00, timestamp: '2023-11-30T23:59:59' }
            ],
            currentYear: { period: '2024', value: 100.00, timestamp: '2024-01-01T10:30:00' },
            yearHistory: []
        };
        
        // Save and load to simulate the data structure
        HistoryTrackerUtils.saveData(TEST_FILE, initialData, 'Liter');
        const loadedData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        // Now simulate a new hour by modifying the data
        // In real scenario, saveValue would do unshift to add newest hour at position 0
        loadedData.hourHistory.unshift(loadedData.currentHour);
        loadedData.currentHour = { period: '2024-01-01_11', value: 8.00, timestamp: '2024-01-01T11:30:00' };
        
        // Simulate a new month
        loadedData.monthHistory.unshift(loadedData.currentMonth);
        loadedData.currentMonth = { period: '2024-02', value: 50.00, timestamp: '2024-02-01T10:00:00' };
        
        // Save the updated data
        HistoryTrackerUtils.saveData(TEST_FILE, loadedData, 'Liter');
        const finalData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        // Verify hour history ordering (newest first)
        const hourOrderCorrect = 
            finalData.hourHistory.length === 3 &&
            finalData.hourHistory[0].period === '2024-01-01_10' &&  // Most recent (was currentHour)
            finalData.hourHistory[1].period === '2024-01-01_09' &&  // Second most recent
            finalData.hourHistory[2].period === '2024-01-01_08';    // Oldest
        
        // Verify month history ordering (newest first)
        const monthOrderCorrect = 
            finalData.monthHistory.length === 3 &&
            finalData.monthHistory[0].period === '2024-01' &&       // Most recent (was currentMonth)
            finalData.monthHistory[1].period === '2023-12' &&       // Second most recent
            finalData.monthHistory[2].period === '2023-11';         // Oldest
        
        const passed = hourOrderCorrect && monthOrderCorrect;
        
        let details = '';
        if (!passed) {
            details = `Hour history: ${JSON.stringify(finalData.hourHistory.map(h => h.period))}, `;
            details += `Month history: ${JSON.stringify(finalData.monthHistory.map(m => m.period))}`;
        } else {
            details = 'Hour and month history correctly ordered (newest first)';
        }
        
        printTestResult(
            'History arrays should maintain newest-first ordering',
            passed,
            details
        );
        
        return passed;
    } catch (error) {
        printTestResult('History arrays should maintain newest-first ordering', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 10: timestampMs calculation - Verify millisecond timestamps
// ============================================================================
function testTimestampMsCalculation() {
    console.log('=== TEST 10: timestampMs calculation ===');
    
    cleanupTestFiles();
    
    const sampleContent = `============================================================
  LAST VALUE
============================================================
T: 2024-01-01T10:30:00  -  V: 123.45 Liter


============================================================
  CURRENT HOUR
============================================================
T: 2024-01-01T10:30:00  -  P: 2024-01-01_10  -  V: 5.50 Liter


============================================================
  HOUR HISTORY (All past hours)
============================================================
T: 2024-01-01T09:30:00  -  P: 2024-01-01_09  -  V: 3.25 Liter


============================================================
  MONTH HISTORY (All past months)
============================================================
T: 2023-12-31T23:59:59  -  P: 2023-12  -  V: 150.00 Liter
`;

    try {
        const result = HistoryTrackerUtils.parseHistoryFile(sampleContent);
        
        // Expected millisecond values for the timestamps
        const expectedLastValueMs = new Date(2024, 0, 1, 10, 30, 0).getTime();
        const expectedCurrentHourMs = new Date(2024, 0, 1, 10, 30, 0).getTime();
        const expectedHourHistoryMs = new Date(2024, 0, 1, 9, 30, 0).getTime();
        const expectedMonthHistoryMs = new Date(2023, 11, 31, 23, 59, 59).getTime();
        
        const passed = 
            result.lastValue.timestampMs === expectedLastValueMs &&
            result.currentHour.timestampMs === expectedCurrentHourMs &&
            result.hourHistory[0].timestampMs === expectedHourHistoryMs &&
            result.monthHistory[0].timestampMs === expectedMonthHistoryMs &&
            result.lastValue.timestamp === '2024-01-01T10:30:00' &&
            result.currentHour.timestamp === '2024-01-01T10:30:00';
        
        printTestResult(
            'timestampMs should be correctly calculated from timestamp string',
            passed,
            passed ? 'All timestampMs values calculated correctly' : 
                `Expected: ${expectedLastValueMs}, Got: ${result.lastValue.timestampMs}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('timestampMs should be correctly calculated', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 11: trimHistory - Verify history trimming to max limits
// ============================================================================
function testTrimHistory() {
    console.log('=== TEST 11: trimHistory ===');
    
    try {
        // Create test data with more entries than limits
        const testData = {
            lastValue: { value: 100.00, timestamp: '2024-01-01T12:00:00' },
            currentHour: { period: '2024-01-01_12', value: 5.00, timestamp: '2024-01-01T12:00:00' },
            hourHistory: [
                { period: '2024-01-01_11', value: 5.00, timestamp: '2024-01-01T11:00:00' },
                { period: '2024-01-01_10', value: 4.00, timestamp: '2024-01-01T10:00:00' },
                { period: '2024-01-01_09', value: 3.00, timestamp: '2024-01-01T09:00:00' },
                { period: '2024-01-01_08', value: 2.00, timestamp: '2024-01-01T08:00:00' },
                { period: '2024-01-01_07', value: 1.00, timestamp: '2024-01-01T07:00:00' }
            ],
            currentDay: { period: '2024-01-01', value: 10.00, timestamp: '2024-01-01T12:00:00' },
            dayHistory: [
                { period: '2023-12-31', value: 20.00, timestamp: '2023-12-31T23:59:59', min: 18.00, max: 22.00 },
                { period: '2023-12-30', value: 19.00, timestamp: '2023-12-30T23:59:59', min: 17.00, max: 21.00 },
                { period: '2023-12-29', value: 18.00, timestamp: '2023-12-29T23:59:59', min: 16.00, max: 20.00 },
                { period: '2023-12-28', value: 17.00, timestamp: '2023-12-28T23:59:59', min: 15.00, max: 19.00 }
            ],
            currentMonth: { period: '2024-01', value: 50.00, timestamp: '2024-01-01T12:00:00' },
            monthHistory: [
                { period: '2023-12', value: 150.00, timestamp: '2023-12-31T23:59:59', min: 140.00, max: 160.00 },
                { period: '2023-11', value: 140.00, timestamp: '2023-11-30T23:59:59', min: 130.00, max: 150.00 },
                { period: '2023-10', value: 130.00, timestamp: '2023-10-31T23:59:59', min: 120.00, max: 140.00 },
                { period: '2023-09', value: 120.00, timestamp: '2023-09-30T23:59:59', min: 110.00, max: 130.00 }
            ],
            currentYear: { period: '2024', value: 200.00, timestamp: '2024-01-01T12:00:00' },
            yearHistory: [
                { period: '2023', value: 1000.00, timestamp: '2023-12-31T23:59:59', min: 900.00, max: 1100.00 },
                { period: '2022', value: 900.00, timestamp: '2022-12-31T23:59:59', min: 800.00, max: 1000.00 },
                { period: '2021', value: 800.00, timestamp: '2021-12-31T23:59:59', min: 700.00, max: 900.00 },
                { period: '2020', value: 700.00, timestamp: '2020-12-31T23:59:59', min: 600.00, max: 800.00 }
            ]
        };
        
        // Set limits
        const limits = {
            maxHourHistory: 3,
            maxDayHistory: 2,
            maxMonthHistory: 2,
            maxYearHistory: 2
        };
        
        // Trim history
        HistoryTrackerUtils.trimHistory(testData, limits);
        
        // Verify trimming
        const hourTrimmed = testData.hourHistory.length === 3 &&
                           testData.hourHistory[0].period === '2024-01-01_11' &&
                           testData.hourHistory[2].period === '2024-01-01_09';
        
        const dayTrimmed = testData.dayHistory.length === 2 &&
                          testData.dayHistory[0].period === '2023-12-31' &&
                          testData.dayHistory[0].min === 18.00 &&
                          testData.dayHistory[0].max === 22.00 &&
                          testData.dayHistory[1].period === '2023-12-30';
        
        const monthTrimmed = testData.monthHistory.length === 2 &&
                            testData.monthHistory[0].period === '2023-12' &&
                            testData.monthHistory[0].min === 140.00 &&
                            testData.monthHistory[0].max === 160.00 &&
                            testData.monthHistory[1].period === '2023-11';
        
        const yearTrimmed = testData.yearHistory.length === 2 &&
                           testData.yearHistory[0].period === '2023' &&
                           testData.yearHistory[0].min === 900.00 &&
                           testData.yearHistory[0].max === 1100.00 &&
                           testData.yearHistory[1].period === '2022';
        
        const passed = hourTrimmed && dayTrimmed && monthTrimmed && yearTrimmed;
        
        let details = '';
        if (!passed) {
            details = `Hour: ${testData.hourHistory.length} (expected 3), `;
            details += `Day: ${testData.dayHistory.length} (expected 2), `;
            details += `Month: ${testData.monthHistory.length} (expected 2), `;
            details += `Year: ${testData.yearHistory.length} (expected 2)`;
        } else {
            details = 'All history arrays correctly trimmed to limits, keeping newest entries';
        }
        
        printTestResult(
            'trimHistory should limit arrays to max entries (newest first)',
            passed,
            details
        );
        
        return passed;
    } catch (error) {
        printTestResult('trimHistory should limit arrays correctly', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 12: trimHistory - Zero limit should not trim (unlimited)
// ============================================================================
function testTrimHistoryUnlimited() {
    console.log('=== TEST 12: trimHistory (unlimited) ===');
    
    try {
        const testData = {
            lastValue: {},
            currentHour: {},
            hourHistory: [
                { period: '2024-01-01_11', value: 5.00 },
                { period: '2024-01-01_10', value: 4.00 },
                { period: '2024-01-01_09', value: 3.00 }
            ],
            currentDay: {},
            dayHistory: [],
            currentMonth: {},
            monthHistory: [
                { period: '2023-12', value: 150.00 },
                { period: '2023-11', value: 140.00 }
            ],
            currentYear: {},
            yearHistory: []
        };
        
        // Set limits to 0 (unlimited)
        const limits = {
            maxHourHistory: 0,
            maxDayHistory: 0,
            maxMonthHistory: 0,
            maxYearHistory: 0
        };
        
        // Store original lengths
        const originalHourLength = testData.hourHistory.length;
        const originalMonthLength = testData.monthHistory.length;
        
        // Trim history (should not trim anything)
        HistoryTrackerUtils.trimHistory(testData, limits);
        
        const passed = 
            testData.hourHistory.length === originalHourLength &&
            testData.monthHistory.length === originalMonthLength;
        
        printTestResult(
            'trimHistory with limit 0 should keep all entries (unlimited)',
            passed,
            passed ? 'All entries preserved with unlimited limit' : 
                `Hour: ${testData.hourHistory.length} (expected ${originalHourLength}), Month: ${testData.monthHistory.length} (expected ${originalMonthLength})`
        );
        
        return passed;
    } catch (error) {
        printTestResult('trimHistory with unlimited should not trim', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 13: Backwards compatibility - Parse old format without min/max
// ============================================================================
function testBackwardsCompatibility() {
    console.log('=== TEST 13: Backwards compatibility (old format without min/max) ===');
    
    const oldFormatContent = `============================================================
  LAST VALUE
============================================================
T: 2024-01-01T10:00:00  -  V: 100.00 Liter


============================================================
  CURRENT DAY
============================================================
T: 2024-01-01T10:00:00  -  P: 2024-01-01  -  V: 50.00 Liter


============================================================
  DAY HISTORY (All past days)
============================================================
T: 2023-12-31T23:59:59  -  P: 2023-12-31  -  V: 45.00 Liter
T: 2023-12-30T23:59:59  -  P: 2023-12-30  -  V: 40.00 Liter


============================================================
  CURRENT MONTH
============================================================
T: 2024-01-01T10:00:00  -  P: 2024-01  -  V: 50.00 Liter


============================================================
  MONTH HISTORY (All past months)
============================================================
T: 2023-12-31T23:59:59  -  P: 2023-12  -  V: 200.00 Liter
T: 2023-11-30T23:59:59  -  P: 2023-11  -  V: 180.00 Liter


============================================================
  CURRENT YEAR
============================================================
T: 2024-01-01T10:00:00  -  P: 2024  -  V: 50.00 Liter


============================================================
  YEAR HISTORY (All past years)
============================================================
T: 2023-12-31T23:59:59  -  P: 2023  -  V: 1500.00 Liter
`;

    try {
        const result = HistoryTrackerUtils.parseHistoryFile(oldFormatContent);
        
        // Verify that old format is parsed correctly
        const parseCorrect = 
            result.lastValue.value === 100.00 &&
            result.currentDay.value === 50.00 &&
            result.dayHistory.length === 2 &&
            result.dayHistory[0].value === 45.00 &&
            result.dayHistory[0].min === undefined &&
            result.dayHistory[0].max === undefined &&
            result.monthHistory.length === 2 &&
            result.monthHistory[0].value === 200.00 &&
            result.monthHistory[0].min === undefined &&
            result.monthHistory[0].max === undefined &&
            result.yearHistory.length === 1 &&
            result.yearHistory[0].value === 1500.00 &&
            result.yearHistory[0].min === undefined &&
            result.yearHistory[0].max === undefined;
        
        if (!parseCorrect) {
            printTestResult(
                'Backwards compatibility should parse old format without min/max',
                false,
                `Parse failed: ${JSON.stringify({
                    dayHistory0: result.dayHistory[0],
                    monthHistory0: result.monthHistory[0],
                    yearHistory0: result.yearHistory[0]
                }, null, 2)}`
            );
            return false;
        }
        
        // Now save the parsed data to a new file
        cleanupTestFiles();
        HistoryTrackerUtils.saveData(TEST_FILE, result, 'Liter');
        
        // Load it back and verify it's still correct
        const reloadedData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        const reloadCorrect = 
            reloadedData.lastValue.value === 100.00 &&
            reloadedData.dayHistory.length === 2 &&
            reloadedData.dayHistory[0].value === 45.00 &&
            reloadedData.monthHistory.length === 2 &&
            reloadedData.yearHistory.length === 1;
        
        const passed = parseCorrect && reloadCorrect;
        
        printTestResult(
            'Backwards compatibility should parse old format without min/max',
            passed,
            passed ? 'Old format parsed and saved correctly (min/max undefined for old entries)' : 
                'Failed to reload data correctly'
        );
        
        return passed;
    } catch (error) {
        printTestResult('Backwards compatibility test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 14: saveValue - Gap filling for missing hours (using real saveValue)
// ============================================================================
function testSaveValueHourGapFilling() {
    console.log('=== TEST 14: saveValue (hour gap filling - using REAL saveValue) ===');
    
    cleanupTestFiles();
    
    try {
        // Get current time
        const now = new Date();
        const currentHour = now.getHours();
        
        // Calculate what hour was 3 hours ago
        const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        const oldHour = threeHoursAgo.getHours();
        const oldYear = threeHoursAgo.getFullYear();
        const oldMonth = String(threeHoursAgo.getMonth() + 1).padStart(2, '0');
        const oldDay = String(threeHoursAgo.getDate()).padStart(2, '0');
        const oldHourStr = String(oldHour).padStart(2, '0');
        const oldTimestamp = `${oldYear}-${oldMonth}-${oldDay}T${oldHourStr}:59:59`;
        
        // Create old data as if the last update was 3 hours ago
        const oldHourData = {
            lastValue: { value: 100.00, timestamp: oldTimestamp, timestampMs: threeHoursAgo.getTime() },
            currentHour: { period: `${oldYear}-${oldMonth}-${oldDay}_${oldHourStr}`, value: 5.00, timestamp: oldTimestamp, timestampMs: threeHoursAgo.getTime() },
            hourHistory: [],
            currentDay: { period: `${oldYear}-${oldMonth}-${oldDay}`, value: 5.00, timestamp: oldTimestamp, timestampMs: threeHoursAgo.getTime() },
            dayHistory: [],
            currentMonth: { period: `${oldYear}-${oldMonth}`, value: 5.00, timestamp: oldTimestamp, timestampMs: threeHoursAgo.getTime() },
            monthHistory: [],
            currentYear: { period: `${oldYear}`, value: 5.00, timestamp: oldTimestamp, timestampMs: threeHoursAgo.getTime() },
            yearHistory: []
        };
        
        // Save this old data to file
        HistoryTrackerUtils.saveData(TEST_FILE, oldHourData, 'Liter');
        
        // NOW USE THE REAL saveValue FUNCTION - it will use current time and detect the gap!
        const result = HistoryTrackerUtils.saveValue(TEST_FILE, 110.00, 'Liter');
        
        // Calculate expected number of gap hours
        // If old hour was X and current hour is Y, gap = Y - X - 1
        let expectedGapCount = currentHour - oldHour - 1;
        // Handle day wrap-around (e.g., from 23:00 to 02:00)
        if (expectedGapCount < 0) {
            expectedGapCount = 24 + expectedGapCount;
        }
        
        // Expected total history length = 1 (old hour) + gap hours
        const expectedHistoryLength = 1 + expectedGapCount;
        
        // Verify the results
        const historyLengthCorrect = result.hourHistory.length === expectedHistoryLength;
        
        // Old hour should be at the END of the array (last position) because gap hours are unshifted to the front
        const oldHourIndex = result.hourHistory.length - 1;
        const oldHourPreserved = result.hourHistory[oldHourIndex].period === `${oldYear}-${oldMonth}-${oldDay}_${oldHourStr}` &&
                                 result.hourHistory[oldHourIndex].value === 5.00;
        
        // Check that gap hours (all except the last entry) have value 0
        let gapHoursCorrect = true;
        for (let i = 0; i < result.hourHistory.length - 1; i++) {
            if (result.hourHistory[i].value !== 0) {
                gapHoursCorrect = false;
                break;
            }
        }
        
        const passed = historyLengthCorrect && oldHourPreserved && gapHoursCorrect;
        
        let details = '';
        if (!passed) {
            details = `Hour history length: ${result.hourHistory.length} (expected ${expectedHistoryLength})\n`;
            details += `  Gap hours expected: ${expectedGapCount}\n`;
            details += `  History entries:\n`;
            result.hourHistory.forEach((h, idx) => {
                details += `    [${idx}] period: ${h.period}, value: ${h.value}\n`;
            });
            details += `  Current hour: period: ${result.currentHour.period}, value: ${result.currentHour.value}`;
        } else {
            details = `Real saveValue() detected ${expectedGapCount} missing hours and filled them with 0, preserved old hour`;
        }
        
        printTestResult(
            'saveValue (REAL FUNCTION) should fill missing hours with zero values',
            passed,
            details
        );
        
        return passed;
    } catch (error) {
        printTestResult('saveValue gap filling test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 15: calculateGoalProjection - Month history with goal
// ============================================================================
function testCalculateGoalProjectionMonth() {
    console.log('=== TEST 15: calculateGoalProjection (month history) ===');
    
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        
        // Create test data with month history from CURRENT YEAR only (within goal period)
        const testData = {
            lastValue: { value: 500.00, timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00` },
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: { 
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, 
                value: 100.00, 
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00`,
                timestampMs: now.getTime()
            },
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
        
        // Add previous months from current year if we're not in January
        if (currentMonth > 1) {
            testData.monthHistory.push({ 
                period: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`, 
                value: 150.00, 
                timestamp: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-28T23:59:59`,
                timestampMs: new Date(currentYear, currentMonth - 2, 28).getTime()
            });
        }
        if (currentMonth > 2) {
            testData.monthHistory.push({ 
                period: `${currentYear}-${String(currentMonth - 2).padStart(2, '0')}`, 
                value: 120.00, 
                timestamp: `${currentYear}-${String(currentMonth - 2).padStart(2, '0')}-28T23:59:59`,
                timestampMs: new Date(currentYear, currentMonth - 3, 28).getTime()
            });
        }
        
        // Goal configuration: 1200 Liter from Jan to Dec of current year
        const goalConfig = {
            yearlyGoal: 1200.00,
            goalStartMonth: 1,
            goalEndMonth: 12
        };
        
        // Calculate goal projection
        const goalProjection = HistoryTrackerUtils.calculateGoalProjection(testData, goalConfig);
        
        // Calculate total consumed (only current year months in goal period)
        let totalConsumed = 100.00; // current month
        if (currentMonth > 1) totalConsumed += 150.00;
        if (currentMonth > 2) totalConsumed += 120.00;
        
        const remainingGoal = 1200.00 - totalConsumed;
        const remainingMonths = 12 - currentMonth + 1; // Months left in year including current
        const expectedGoalPerMonth = remainingGoal / remainingMonths;
        
        // Verify returned object structure
        const isObject = typeof goalProjection === 'object' && !Array.isArray(goalProjection);
        const hasGoalPerMonth = goalProjection.goalPerMonth !== undefined && goalProjection.goalPerMonth !== null;
        const correctGoalValue = hasGoalPerMonth && Math.abs(goalProjection.goalPerMonth - expectedGoalPerMonth) < 0.01;
        const hasMetadata = goalProjection.yearlyGoal === 1200.00 && 
                           goalProjection.totalConsumed === totalConsumed &&
                           goalProjection.remainingGoal === remainingGoal;
        
        const passed = isObject && hasGoalPerMonth && correctGoalValue && hasMetadata;
        
        let details = '';
        if (!passed) {
            details = `Return type: ${Array.isArray(goalProjection) ? 'Array' : typeof goalProjection}, `;
            details += `Goal per month: ${goalProjection.goalPerMonth?.toFixed(2)} (expected ${expectedGoalPerMonth.toFixed(2)}), `;
            details += `Consumed: ${goalProjection.totalConsumed?.toFixed(2)} (expected ${totalConsumed.toFixed(2)}), Remaining: ${remainingGoal.toFixed(2)}, Months left: ${remainingMonths}`;
        } else {
            details = `Goal calculated correctly: ${expectedGoalPerMonth.toFixed(2)} per month for ${remainingMonths} remaining months (consumed: ${totalConsumed.toFixed(2)})`;
        }
        
        printTestResult(
            'calculateGoalProjection should return object with goalPerMonth value',
            passed,
            details
        );
        
        return passed;
    } catch (error) {
        printTestResult('calculateGoalProjection month test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 16: calculateGoalProjection - Goal period spanning years
// ============================================================================
function testCalculateGoalProjectionSpanningYears() {
    console.log('=== TEST 16: calculateGoalProjection (spanning years: Oct-Mar) ===');
    
    try {
        // Get the REAL current date that the function will use
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // This is what the function actually sees!
        
        // Skip this test if we're not in the right timeframe (Oct-Mar)
        // For Oct-Dec: we're in the start year of the goal period
        // For Jan-Mar: we're in the end year of the goal period
        if (currentMonth < 1 || (currentMonth > 3 && currentMonth < 10)) {
            console.log(`  SKIPPED: Current month (${currentMonth}) is outside Oct-Mar goal period`);
            return true; // Count as passed since we can't test this month
        }
        
        // Create test data based on current real month
        const testData = {
            lastValue: { value: 400.00, timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00` },
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: { 
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, 
                value: 50.00, 
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00`,
                timestampMs: now.getTime()
            },
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
        
        // Add history for months in the current goal period
        let goalPeriodYear;
        if (currentMonth >= 10) {
            // We're in Oct-Dec, so goal period started this year
            goalPeriodYear = currentYear;
            // Add months from October to current month (excluding current)
            for (let m = 10; m < currentMonth; m++) {
                testData.monthHistory.push({
                    period: `${currentYear}-${String(m).padStart(2, '0')}`,
                    value: 50.00 + (m - 10) * 10,
                    timestamp: `${currentYear}-${String(m).padStart(2, '0')}-28T23:59:59`,
                    timestampMs: new Date(currentYear, m - 1, 28).getTime()
                });
            }
        } else {
            // We're in Jan-Mar, so goal period started last year
            goalPeriodYear = currentYear - 1;
            // Add months from last October to last December
            for (let m = 10; m <= 12; m++) {
                testData.monthHistory.push({
                    period: `${currentYear - 1}-${String(m).padStart(2, '0')}`,
                    value: 50.00 + (m - 10) * 10,
                    timestamp: `${currentYear - 1}-${String(m).padStart(2, '0')}-28T23:59:59`,
                    timestampMs: new Date(currentYear - 1, m - 1, 28).getTime()
                });
            }
            // Add months from January to current month (excluding current)
            for (let m = 1; m < currentMonth; m++) {
                testData.monthHistory.push({
                    period: `${currentYear}-${String(m).padStart(2, '0')}`,
                    value: 50.00 + (m + 2) * 10,
                    timestamp: `${currentYear}-${String(m).padStart(2, '0')}-28T23:59:59`,
                    timestampMs: new Date(currentYear, m - 1, 28).getTime()
                });
            }
        }
        
        // Goal configuration: 600 Liter from October to March (spans years)
        const goalConfig = {
            yearlyGoal: 600.00,
            goalStartMonth: 10, // October
            goalEndMonth: 3     // March
        };
        
        const goalProjection = HistoryTrackerUtils.calculateGoalProjection(testData, goalConfig);
        
        // Calculate total consumed (current month + all history in goal period)
        let totalConsumed = 50.00; // current month
        testData.monthHistory.forEach(m => {
            totalConsumed += m.value;
        });
        
        const remainingGoal = 600.00 - totalConsumed;
        
        // Calculate remaining months from current to end of goal period
        let remainingMonths;
        if (currentMonth >= 10) {
            // Oct-Dec: remaining = months until March next year
            remainingMonths = (12 - currentMonth + 1) + 3; // Rest of this year + Jan-Mar
        } else if (currentMonth <= 3) {
            // Jan-Mar: remaining = months until March this year
            remainingMonths = 3 - currentMonth + 1;
        }
        
        const expectedGoalPerMonth = remainingGoal / remainingMonths;
        
        // Verify returned object
        const isObject = typeof goalProjection === 'object' && !Array.isArray(goalProjection);
        const hasGoalPerMonth = goalProjection.goalPerMonth !== undefined && goalProjection.goalPerMonth !== null;
        const correctGoalValue = hasGoalPerMonth && Math.abs(goalProjection.goalPerMonth - expectedGoalPerMonth) < 0.01;
        
        const passed = isObject && hasGoalPerMonth && correctGoalValue;
        
        let details = '';
        if (!passed) {
            details = `Type: ${Array.isArray(goalProjection) ? 'Array' : typeof goalProjection}, `;
            details += `Goal per month: ${goalProjection.goalPerMonth?.toFixed(2)} (expected ${expectedGoalPerMonth.toFixed(2)}), `;
            details += `Consumed: ${totalConsumed.toFixed(2)}, Remaining: ${remainingGoal.toFixed(2)}, Months left: ${remainingMonths}, Current month: ${currentMonth}`;
        } else {
            details = `Goal spanning years handled correctly: ${expectedGoalPerMonth.toFixed(2)} per month (current month: ${currentMonth})`;
        }
        
        printTestResult(
            'calculateGoalProjection should handle goal periods spanning years',
            passed,
            details
        );
        
        return passed;
    } catch (error) {
        printTestResult('calculateGoalProjection spanning years test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 17: calculateGoalProjection - Goal already exceeded
// ============================================================================
function testCalculateGoalProjectionExceeded() {
    console.log('=== TEST 17: calculateGoalProjection (goal exceeded) ===');
    
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        // Create test data where consumption IN CURRENT YEAR exceeds goal
        const testData = {
            lastValue: { value: 1500.00, timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00` },
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: { 
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, 
                value: 600.00, 
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00`,
                timestampMs: Date.now()
            },
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
        
        // Add previous month from CURRENT YEAR if not January
        if (currentMonth > 1) {
            testData.monthHistory.push({ 
                period: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`, 
                value: 500.00, 
                timestamp: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-28T23:59:59`,
                timestampMs: new Date(currentYear, currentMonth - 2, 28).getTime()
            });
        }
        
        // Goal is only 1000, but we've consumed 600 (current month) + 500 (prev month if exists) = 1100 or 600
        const goalConfig = {
            yearlyGoal: 1000.00,
            goalStartMonth: 1,
            goalEndMonth: 12
        };
        
        const goalProjection = HistoryTrackerUtils.calculateGoalProjection(testData, goalConfig);
        
        // Calculate consumed and remaining based on current month
        const totalConsumed = currentMonth > 1 ? 1100.00 : 600.00;
        const remainingGoal = Math.max(0, 1000.00 - totalConsumed);
        const remainingMonths = 12 - currentMonth + 1;
        const expectedGoalPerMonth = remainingGoal / remainingMonths;
        
        // Verify returned object structure
        const isObject = typeof goalProjection === 'object' && !Array.isArray(goalProjection);
        const hasGoalPerMonth = goalProjection.goalPerMonth !== undefined && goalProjection.goalPerMonth !== null;
        const correctGoalValue = hasGoalPerMonth && Math.abs(goalProjection.goalPerMonth - expectedGoalPerMonth) < 0.01;
        
        const passed = isObject && hasGoalPerMonth && correctGoalValue;
        
        printTestResult(
            'calculateGoalProjection should distribute remaining goal (or 0 if exceeded)',
            passed,
            passed ? `Goal distributed correctly: ${expectedGoalPerMonth.toFixed(2)} per month (consumed: ${totalConsumed.toFixed(2)})` : 
                `Goal per month: ${goalProjection.goalPerMonth?.toFixed(2)} (expected ${expectedGoalPerMonth.toFixed(2)})`
        );
        
        return passed;
    } catch (error) {
        printTestResult('calculateGoalProjection exceeded test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 18: calculateGoalProjection - No goal set (disabled)
// ============================================================================
function testCalculateGoalProjectionDisabled() {
    console.log('=== TEST 18: calculateGoalProjection (disabled, goal = 0) ===');
    
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        const testData = {
            lastValue: { value: 500.00, timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00` },
            currentHour: {},
            hourHistory: [],
            currentDay: {},
            dayHistory: [],
            currentMonth: { 
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, 
                value: 100.00, 
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15T12:00:00`,
                timestampMs: Date.now()
            },
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
        
        // Goal is 0 (disabled)
        const goalConfig = {
            yearlyGoal: 0,
            goalStartMonth: 1,
            goalEndMonth: 12
        };
        
        const goalProjection = HistoryTrackerUtils.calculateGoalProjection(testData, goalConfig);
        
        // Should return object with null values
        const passed = typeof goalProjection === 'object' && 
                      goalProjection.goalPerDay === null &&
                      goalProjection.goalPerMonth === null &&
                      goalProjection.goalPerYear === null;
        
        printTestResult(
            'calculateGoalProjection should return object with null values when goal = 0',
            passed,
            passed ? 'Object with null goal values returned when goal disabled' : 
                `Got: ${JSON.stringify(goalProjection)}`
        );
        
        return passed;
    } catch (error) {
        printTestResult('calculateGoalProjection disabled test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// TEST 19: calculateGoalProjection - Day history
// ============================================================================
function testCalculateGoalProjectionDay() {
    console.log('=== TEST 19: calculateGoalProjection (day history) ===');
    
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        
        // Create test data with day history AND month data for consumption calculation
        const testData = {
            lastValue: { value: 50.00, timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}T12:00:00` },
            currentHour: {},
            hourHistory: [],
            currentDay: { 
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`, 
                value: 10.00, 
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}T12:00:00`,
                timestampMs: now.getTime()
            },
            dayHistory: [
                { 
                    period: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay - 1).padStart(2, '0')}`, 
                    value: 15.00, 
                    timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay - 1).padStart(2, '0')}T23:59:59`,
                    timestampMs: new Date(currentYear, currentMonth - 1, currentDay - 1).getTime()
                }
            ],
            // Add month data - this is what's used for consumption calculation!
            currentMonth: {
                period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
                value: 100.00, // Total consumed this month
                timestamp: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}T12:00:00`,
                timestampMs: now.getTime()
            },
            monthHistory: [],
            currentYear: {},
            yearHistory: []
        };
        
        // Add previous month if not January
        if (currentMonth > 1) {
            testData.monthHistory.push({
                period: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`,
                value: 150.00,
                timestamp: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-28T23:59:59`,
                timestampMs: new Date(currentYear, currentMonth - 2, 28).getTime()
            });
        }
        
        // Goal configuration
        const goalConfig = {
            yearlyGoal: 1200.00,
            goalStartMonth: 1,
            goalEndMonth: 12
        };
        
        const goalProjection = HistoryTrackerUtils.calculateGoalProjection(testData, goalConfig);
        
        // Calculate consumption using MONTH data (not day data)
        let totalConsumed = 100.00; // current month
        if (currentMonth > 1) totalConsumed += 150.00; // previous month
        
        const remainingGoal = 1200.00 - totalConsumed;
        
        // For day projection, calculate remaining days
        const lastDayOfGoalPeriod = new Date(currentYear, 12, 0); // Last day of December
        const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
        const remainingDays = Math.max(1, Math.ceil((lastDayOfGoalPeriod - currentDate) / (1000 * 60 * 60 * 24)));
        
        const expectedGoalPerDay = remainingGoal / remainingDays;
        
        // Verify returned object has goalPerDay
        const isObject = typeof goalProjection === 'object' && !Array.isArray(goalProjection);
        const hasGoalPerDay = goalProjection.goalPerDay !== undefined && goalProjection.goalPerDay !== null;
        const correctGoalValue = hasGoalPerDay && Math.abs(goalProjection.goalPerDay - expectedGoalPerDay) < 0.01;
        
        const passed = isObject && hasGoalPerDay && correctGoalValue;
        
        printTestResult(
            'calculateGoalProjection should return object with goalPerDay value',
            passed,
            passed ? `Day projection calculated: ${expectedGoalPerDay.toFixed(2)} per day for ${remainingDays} remaining days (consumed: ${totalConsumed.toFixed(2)} from month data)` : 
                `Type: ${Array.isArray(goalProjection) ? 'Array' : typeof goalProjection}, Goal/day: ${goalProjection.goalPerDay?.toFixed(2)} (expected ${expectedGoalPerDay.toFixed(2)})`
        );
        
        return passed;
    } catch (error) {
        printTestResult('calculateGoalProjection day test', false, `Error: ${error.message}`);
        return false;
    }
}

// ============================================================================
// Run all tests
// ============================================================================
function runAllTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         HISTORY TRACKER FUNCTION TESTS                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    const results = [];
    
    results.push(testParseHistoryFile());
    results.push(testLoadDataEmpty());
    results.push(testSaveData());
    results.push(testSaveAndLoadRoundtrip());
    results.push(testSaveValueFirst());
    results.push(testSaveValueSecond());
    results.push(testSaveValueNegative());
    results.push(testParseHistoryFileWithHistory());
    results.push(testHistoryOrdering());
    results.push(testTimestampMsCalculation());
    results.push(testTrimHistory());
    results.push(testTrimHistoryUnlimited());
    results.push(testBackwardsCompatibility());
    results.push(testSaveValueHourGapFilling());
    results.push(testCalculateGoalProjectionMonth());
    results.push(testCalculateGoalProjectionSpanningYears());
    results.push(testCalculateGoalProjectionExceeded());
    results.push(testCalculateGoalProjectionDisabled());
    results.push(testCalculateGoalProjectionDay());
    
    // Cleanup
    cleanupTestFiles();
    
    // Summary
    const passed = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    const total = results.length;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TEST SUMMARY: ${passed}/${total} tests passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n');
    
    if (failed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Please review the output above.');
    }
    
    return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
}

module.exports = { runAllTests };
