const fs = require('fs');
const path = require('path');
const { HistoryTrackerUtils } = require('./history-tracker.js');

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
T: 01.01.2024, 10:30:00  -  V: 123.45 Liter


============================================================
  CURRENT HOUR
============================================================
T: 01.01.2024, 10:30:00  -  P: 2024-01-01_10  -  V: 5.50 Liter


============================================================
  CURRENT DAY
============================================================
T: 01.01.2024, 10:30:00  -  P: 2024-01-01  -  V: 25.75 Liter


============================================================
  CURRENT MONTH
============================================================
T: 01.01.2024, 10:30:00  -  P: 2024-01  -  V: 100.00 Liter


============================================================
  CURRENT YEAR
============================================================
T: 01.01.2024, 10:30:00  -  P: 2024  -  V: 100.00 Liter
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
        lastValue: { value: 50.00, timestamp: '01.01.2024, 12:00:00' },
        currentHour: { key: '2024-01-01_12', value: 2.50, timestamp: '01.01.2024, 12:00:00' },
        hourHistory: [],
        currentDay: { key: '2024-01-01', value: 10.00, timestamp: '01.01.2024, 12:00:00' },
        lastDay: {},
        currentMonth: { key: '2024-01', value: 50.00, timestamp: '01.01.2024, 12:00:00' },
        monthHistory: [],
        currentYear: { key: '2024', value: 50.00, timestamp: '01.01.2024, 12:00:00' },
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
        lastValue: { value: 75.25, timestamp: '01.01.2024, 15:00:00' },
        currentHour: { key: '2024-01-01_15', value: 3.75, timestamp: '01.01.2024, 15:00:00' },
        hourHistory: [
            { key: '2024-01-01_14', value: 5.00, timestamp: '01.01.2024, 14:59:59' }
        ],
        currentDay: { key: '2024-01-01', value: 20.50, timestamp: '01.01.2024, 15:00:00' },
        lastDay: {},
        currentMonth: { key: '2024-01', value: 75.25, timestamp: '01.01.2024, 15:00:00' },
        monthHistory: [
            { key: '2023-12', value: 150.00, timestamp: '31.12.2023, 23:59:59' }
        ],
        currentYear: { key: '2024', value: 75.25, timestamp: '01.01.2024, 15:00:00' },
        yearHistory: [
            { key: '2023', value: 500.00, timestamp: '31.12.2023, 23:59:59' }
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
T: 01.02.2024, 10:00:00  -  V: 200.00 Liter


============================================================
  MONTH HISTORY (All past months)
============================================================
T: 31.01.2024, 23:59:59  -  P: 2024-01  -  V: 150.00 Liter
T: 31.12.2023, 23:59:59  -  P: 2023-12  -  V: 180.00 Liter


============================================================
  YEAR HISTORY (All past years)
============================================================
T: 31.12.2023, 23:59:59  -  P: 2023  -  V: 1200.00 Liter
`;

    const result = HistoryTrackerUtils.parseHistoryFile(sampleContent);
    
    const passed = 
        result.lastValue.value === 200.00 &&
        result.monthHistory.length === 2 &&
        result.monthHistory[0].key === '2024-01' &&
        result.monthHistory[0].value === 150.00 &&
        result.monthHistory[1].key === '2023-12' &&
        result.yearHistory.length === 1 &&
        result.yearHistory[0].value === 1200.00;
    
    printTestResult(
        'parseHistoryFile should parse history arrays correctly',
        passed,
        passed ? 'History arrays parsed correctly' : `Got: ${JSON.stringify(result, null, 2)}`
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
            lastValue: { value: 50.00, timestamp: '01.01.2024, 10:00:00' },
            currentHour: { key: '2024-01-01_10', value: 10.00, timestamp: '01.01.2024, 10:30:00' },
            hourHistory: [
                { key: '2024-01-01_09', value: 15.00, timestamp: '01.01.2024, 09:59:59' },
                { key: '2024-01-01_08', value: 12.00, timestamp: '01.01.2024, 08:59:59' }
            ],
            currentDay: { key: '2024-01-01', value: 37.00, timestamp: '01.01.2024, 10:30:00' },
            lastDay: {},
            currentMonth: { key: '2024-01', value: 100.00, timestamp: '01.01.2024, 10:30:00' },
            monthHistory: [
                { key: '2023-12', value: 250.00, timestamp: '31.12.2023, 23:59:59' },
                { key: '2023-11', value: 220.00, timestamp: '30.11.2023, 23:59:59' }
            ],
            currentYear: { key: '2024', value: 100.00, timestamp: '01.01.2024, 10:30:00' },
            yearHistory: []
        };
        
        // Save and load to simulate the data structure
        HistoryTrackerUtils.saveData(TEST_FILE, initialData, 'Liter');
        const loadedData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        // Now simulate a new hour by modifying the data
        // In real scenario, saveValue would do unshift to add newest hour at position 0
        loadedData.hourHistory.unshift(loadedData.currentHour);
        loadedData.currentHour = { key: '2024-01-01_11', value: 8.00, timestamp: '01.01.2024, 11:30:00' };
        
        // Simulate a new month
        loadedData.monthHistory.unshift(loadedData.currentMonth);
        loadedData.currentMonth = { key: '2024-02', value: 50.00, timestamp: '01.02.2024, 10:00:00' };
        
        // Save the updated data
        HistoryTrackerUtils.saveData(TEST_FILE, loadedData, 'Liter');
        const finalData = HistoryTrackerUtils.loadData(TEST_FILE);
        
        // Verify hour history ordering (newest first)
        const hourOrderCorrect = 
            finalData.hourHistory.length === 3 &&
            finalData.hourHistory[0].key === '2024-01-01_10' &&  // Most recent (was currentHour)
            finalData.hourHistory[1].key === '2024-01-01_09' &&  // Second most recent
            finalData.hourHistory[2].key === '2024-01-01_08';    // Oldest
        
        // Verify month history ordering (newest first)
        const monthOrderCorrect = 
            finalData.monthHistory.length === 3 &&
            finalData.monthHistory[0].key === '2024-01' &&       // Most recent (was currentMonth)
            finalData.monthHistory[1].key === '2023-12' &&       // Second most recent
            finalData.monthHistory[2].key === '2023-11';         // Oldest
        
        const passed = hourOrderCorrect && monthOrderCorrect;
        
        let details = '';
        if (!passed) {
            details = `Hour history: ${JSON.stringify(finalData.hourHistory.map(h => h.key))}, `;
            details += `Month history: ${JSON.stringify(finalData.monthHistory.map(m => m.key))}`;
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
