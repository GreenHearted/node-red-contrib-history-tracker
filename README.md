# node-red-contrib-history-tracker

A Node-RED node to track and store historical values with automatic time-based aggregation (hour, day, month, year).

## Features

✅ **Automatic time aggregation**: Hour, day, month, and year values  
✅ **Min/Max tracking**: Automatic calculation of minimum and maximum values per period  
✅ **Gap filling**: Missing periods are automatically filled with zero values  
✅ **Flow rate calculation**: Calculates consumption per minute between measurements  
✅ **Goal tracking**: Configurable yearly consumption goal with dynamic per-day/month projection  
✅ **History limits**: Configurable maximum number of entries per period  
✅ **Flexible output**: 4 outputs + 8 configurable output modes  
✅ **Dashboard support**: Output format for both Dashboard 1 and Dashboard 2  
✅ **Human-readable file format**: Plain text storage, backward compatible  
✅ **Ideal for**: Water meters, energy meters, consumption measurements  

## Installation

### Home Assistant Node-RED Addon

See [INSTALL_HOME_ASSISTANT.md](INSTALL_HOME_ASSISTANT.md) for detailed instructions.

**Quick version:**

In the Node-RED addon under the **Configuration** tab:

```yaml
npm_packages:
  - github:GreenHearted/node-red-contrib-history-tracker
```

Save and restart the addon.

### Standard Node-RED Installation

```bash
cd ~/.node-red
npm install github:GreenHearted/node-red-contrib-history-tracker
```

### Via npm (after publishing)

```bash
cd ~/.node-red
npm install node-red-contrib-history-tracker
```

## Configuration

| Property | Description | Default |
|---|---|---|
| **File path** | Path to the history file. If no directory separator is given, the file is placed in the Node-RED `userDir`. | `history.txt` |
| **Value field** | Message field containing the numeric input value | `payload` |
| **Unit** | Unit label used in file and status (e.g. `Liter`, `kWh`) | `Liter` |
| **Output mode** | What data to send on output 4 (see Output Modes below) | `none` |
| **Chart format** | Dashboard version for chart/gauge formatting (`dashboard2` or `dashboard1`) | `dashboard2` |
| **Max flow interval** | Maximum time gap in minutes between measurements for flow rate calculation. Larger gaps produce flow rate = 0. | `60` |
| **Max hour/day/month/year history** | Maximum stored history entries per period type (0 = unlimited). Month history is always at least 24 for goal calculations. | `0` |
| **Yearly goal** | Yearly consumption target value (0 = disabled) | `0` |
| **Goal start/end month** | Month range (1–12) for goal tracking. Can span year boundaries (e.g. Oct–Mar). | `1` / `12` |

## Outputs

The node always sends on all 4 outputs simultaneously.

### Output 1 — Full data object

`msg.payload` contains the complete internal data structure including all current periods, all history arrays, flow rate, and goal configuration. Useful for debugging or custom processing.

```javascript
msg.payload = {
    lastValue:    { value, timestamp, timestampMs },
    flowRate:     1.4,   // unit/min (raw, unrounded)
    currentHour:  { period, value, timestamp, timestampMs },
    hourHistory:  [ { period, value, timestamp, timestampMs }, ... ],
    currentDay:   { period, value, timestamp, timestampMs, goal },
    dayHistory:   [ { period, value, timestamp, timestampMs, min, max, goal }, ... ],
    currentMonth: { period, value, timestamp, timestampMs, goal },
    monthHistory: [ { period, value, timestamp, timestampMs, min, max, goal }, ... ],
    currentYear:  { period, value, timestamp, timestampMs, goal },
    yearHistory:  [ { period, value, timestamp, timestampMs, min, max, goal }, ... ],
    goalConfig:   { yearlyGoal, goalStartMonth, goalEndMonth, totalConsumed, remainingGoal, ... }
}
```

### Output 2 — Current day value + flow rate

`msg.payload` contains a compact object for display widgets:

```javascript
msg.payload = {
    value:    47.2,         // current day consumption
    flowRate: 1.4,          // flow rate in unit/min, 1 decimal place
    period:   "2025-01-12",
    goal:     18.5          // daily goal (only present if goal is configured)
}
```

### Output 3 — Gauge message (current month)

Designed for a Dashboard gauge widget showing current month consumption against its goal.

- `msg.payload` — current month value (number)
- **Dashboard 2:** `msg.ui_update = { max: goalMax }`
- **Dashboard 1:** `msg.ui_control = { max: goalMax }`

### Output 4 — Configurable data output

Content depends on the configured **Output mode** (see below). Output is limited to a fixed number of the most recent entries:

| Mode | Entries sent |
|---|---|
| `hour_history` | Max 24 hours |
| `day_history` | Max 7 days |
| `month_history` | Max 12 months |
| `year_history` | Max 10 years |

## Output Modes (Output 4)

The output mode can be set in the node configuration, or changed at runtime by sending a control message:

```javascript
msg.topic   = 'setOutputMode';
msg.payload = 'month_history';  // any valid mode
```

Valid modes:

| Mode | Description |
|---|---|
| `none` | Nothing sent on output 4 |
| `last` | `msg.payload` = last raw value object; `msg.flowRate` = raw flow rate |
| `current` | `msg.payload` = object with all current period values + flowRate |
| `all` | `msg.payload` = complete data object (same as output 1) |
| `hour_history` | Chart data for the last 24 hours |
| `day_history` | Chart data for the last 7 days (incl. goal) |
| `month_history` | Chart data for the last 12 months (incl. goal) |
| `year_history` | Chart data for the last 10 years (incl. goal) |

### Chart payload format

**Dashboard 2** (`chartFormat = 'dashboard2'`):

```javascript
msg.payload = [
    { label: 'actual', time: '2025-01', val: 142.5 },
    { label: 'goal',   time: '2025-01', val: 160.0 },
    ...
]
```

**Dashboard 1** (`chartFormat = 'dashboard1'`):

```javascript
msg.payload = [{
    series: ['actual', 'goal'],
    data: [[142.5, ...], [160.0, ...]],
    labels: ['2025-01', ...]
}]
```

## File Format

The history file is a human-readable plain text file:

```
# File created by History Tracker version 2.2.1
# Timestamp: 2025-01-12T14:30:00.000Z
#
# Goal Configuration:
#   Goal: 1800.00 Liter
#   Period: Month 1 to Month 12
#   Consumed: 142.50 Liter
#   Remaining: 1657.50 Liter

============================================================
  LAST VALUE
============================================================
T: 2025-01-12T14:30:00  -  V: 15234.50 Liter


============================================================
  CURRENT HOUR
============================================================
T: 2025-01-12T14:30:00  -  P: 2025-01-12_14  -  V: 2.30 Liter


============================================================
  CURRENT DAY
============================================================
T: 2025-01-12T14:30:00  -  P: 2025-01-12  -  V: 47.20 Liter  -  G: 4.93


============================================================
  DAY HISTORY (All past days)
============================================================
T: 2025-01-11T23:59:59  -  P: 2025-01-11  -  V: 125.50 Liter  -  Min: 3.20  -  Max: 8.70  -  G: 4.93
T: 2025-01-10T23:59:59  -  P: 2025-01-10  -  V: 118.30 Liter  -  Min: 2.80  -  Max: 9.10  -  G: 4.93
...
```

**Period key formats:**

| Period | Format | Example |
|---|---|---|
| Hour | `YYYY-MM-DD_HH` | `2025-01-12_14` |
| Day | `YYYY-MM-DD` | `2025-01-12` |
| Month | `YYYY-MM` | `2025-01` |
| Year | `YYYY` | `2025` |

## Goal Tracking

When a **yearly goal** is configured, the node calculates dynamic per-period targets based on remaining budget:

- **goalPerDay** = remaining goal ÷ remaining days in goal period
- **goalPerMonth** = remaining goal ÷ remaining months in goal period
- **goalPerYear** = always the fixed configured yearly goal

Goals are recalculated on every node startup and on every new period rollover (day/month/year).

The goal period can span year boundaries (e.g. start month = 10, end month = 3 tracks Oct–Mar).

## Backward Compatibility

The node is fully compatible with older file versions:

- ✅ Old files **without** Min/Max or goal values are read correctly
- ✅ New Min/Max values are calculated from the next period rollover onward
- ✅ Old entries remain unchanged
- ✅ No manual migration step required

## Similar Packages

- **node-red-contrib-persistent-values**: Stores individual values persistently
- **node-red-contrib-statistics**: Calculates statistical values
- **node-red-contrib-aggregate**: Aggregates values over time

## License

MIT

## Repository

GitHub: [https://github.com/GreenHearted/node-red-contrib-history-tracker](https://github.com/GreenHearted/node-red-contrib-history-tracker)

## Author

GreenHearted

## Contributions

Pull requests are welcome!
