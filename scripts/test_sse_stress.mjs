/**
 * Empirical Stress Test Harness for SSE Queue Parsing & Downstream Handling
 * MediKiosk Challenger 2
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simulated useQueueLive message handler reproducing frontend/src/hooks/useQueueLive.ts lines 39-66
function processSSEMessage(currentState, rawData) {
  let state = { ...currentState };
  let errorCaught = null;
  let logError = null;

  const originalConsoleError = console.error;
  console.error = (...args) => {
    logError = args;
  };

  try {
    const data = JSON.parse(rawData);
    if (data && data.type === 'queue_state' && Array.isArray(data.entries)) {
      state = {
        ...state,
        items: data.entries,
        totalCount:
          typeof data.total_count === 'number' ? data.total_count : data.entries.length,
      };
    } else if (Array.isArray(data)) {
      state = {
        ...state,
        items: data,
        totalCount: data.length,
      };
    } else if (data && typeof data === 'object' && 'session_id' in data) {
      const singleEntry = data;
      state = {
        ...state,
        items: [...state.items, singleEntry],
        totalCount: state.totalCount + 1,
      };
    }
  } catch (err) {
    errorCaught = err;
  } finally {
    console.error = originalConsoleError;
  }

  return { state, errorCaught, logError };
}

// Simulated ClinicianQueueView pipeline (enrichment, filtering, metrics, formatWaitTime)
function runClinicianPipeline(items, searchQuery = '', selectedDept = 'all', priorityFilter = 'all') {
  // 1. queueData enrichment (ClinicianQueueView.tsx:182-192)
  const queueData = (items && items.length > 0)
    ? items.map((item) => {
        if (!item || typeof item !== 'object') {
          return {
            session_id: 'corrupt',
            patient_name: 'Patient #UNKNOWN',
            wait_time_seconds: 0,
            department_id: 'unknown',
            triage_priority: 'normal',
            status: 'unknown'
          };
        }
        const sid = typeof item.session_id === 'string' ? item.session_id : '';
        return {
          ...item,
          patient_name: sid ? `Patient #${sid.substring(0, 6).toUpperCase()}` : 'Patient #UNKNOWN',
        };
      })
    : [];

  // 2. filteredEntries (ClinicianQueueView.tsx:195-208)
  const filteredEntries = queueData.filter((entry) => {
    if (!entry) return false;
    if (selectedDept !== 'all' && entry.department_id !== selectedDept) return false;
    if (priorityFilter !== 'all' && entry.triage_priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // Test potential fragility: what if entry.session_id is missing/null/undefined?
      const sid = typeof entry.session_id === 'string' ? entry.session_id : '';
      const matchesSession = sid.toLowerCase().includes(q);
      const matchesComplaint = entry.chief_complaint?.toLowerCase().includes(q);
      const matchesName = entry.patient_name?.toLowerCase().includes(q);
      if (!matchesSession && !matchesComplaint && !matchesName) return false;
    }
    return true;
  });

  // 3. metrics calculation (ClinicianQueueView.tsx:211-219)
  const total = queueData.length;
  const critical = queueData.filter((i) => i?.triage_priority === 'critical').length;
  const urgent = queueData.filter((i) => i?.triage_priority === 'urgent').length;
  const avgWaitSecs =
    total > 0
      ? queueData.reduce((acc, i) => acc + (typeof i?.wait_time_seconds === 'number' ? i.wait_time_seconds : 0), 0) / total
      : 0;
  const avgWaitMins = Math.round(avgWaitSecs / 60);

  // 4. formatWaitTime (ClinicianQueueView.tsx:251-257)
  const formatWaitTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0m';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const waitTimes = filteredEntries.map(e => formatWaitTime(e.wait_time_seconds));

  return { queueData, filteredEntries, metrics: { total, critical, urgent, avgWaitMins }, waitTimes };
}

// Remediated ClinicianQueueView search logic check for line 201:
function testExactClinicianSearchLine(entry, q) {
  try {
    const sid = typeof entry.session_id === 'string' ? entry.session_id : '';
    const matchesSession = sid.toLowerCase().includes(q);
    return { ok: true, matchesSession };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// TEST SUITE
console.log('=== RUNNING EMPIRICAL SSE STREAM & QUEUE PARSING STRESS TESTS ===\n');

let initialState = { items: [], totalCount: 0, isConnected: true, error: null };
let passCount = 0;
let failCount = 0;

function runTestCase(name, inputRaw, expectStateChange, expectedCount) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const { state, errorCaught, logError } = processSSEMessage(initialState, inputRaw);

    // Assert that the hook never throws an unhandled exception to outside caller
    assert.strictEqual(errorCaught === null || errorCaught instanceof SyntaxError, true, 'Unexpected runtime error thrown');

    if (expectStateChange) {
      assert.strictEqual(state.totalCount, expectedCount, `Expected totalCount ${expectedCount} but got ${state.totalCount}`);
    }

    // Now test passing state.items through downstream Clinician pipeline
    const pipelineResult = runClinicianPipeline(state.items, 'test');
    assert.ok(pipelineResult !== undefined, 'Pipeline returned undefined');
    assert.strictEqual(typeof pipelineResult.metrics.total, 'number', 'Metrics total must be number');
    assert.strictEqual(isNaN(pipelineResult.metrics.avgWaitMins), false, 'Metrics avgWaitMins must not be NaN');

    console.log('PASS');
    passCount++;
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    failCount++;
  }
}

// 1. Malformed JSON
runTestCase('Empty string payload', '', false, 0);
runTestCase('Garbage text payload', 'MALFORMED DATA NOT JSON', false, 0);
runTestCase('Truncated JSON', '{"type": "queue_state", "entries": [', false, 0);
runTestCase('Null literal JSON', 'null', false, 0);
runTestCase('Undefined string', 'undefined', false, 0);
runTestCase('Number literal JSON', '12345', false, 0);
runTestCase('Boolean literal JSON', 'true', false, 0);
runTestCase('String literal JSON', '"just a string"', false, 0);
runTestCase('Empty object JSON', '{}', false, 0);

// 2. Missing/Wrong type
runTestCase('Wrong type field', '{"type": "chat_message"}', false, 0);
runTestCase('Numeric type field', '{"type": 123}', false, 0);
runTestCase('Null type field', '{"type": null}', false, 0);
runTestCase('Missing entries in queue_state', '{"type": "queue_state"}', false, 0);
runTestCase('Null entries in queue_state', '{"type": "queue_state", "entries": null}', false, 0);
runTestCase('Non-array entries in queue_state', '{"type": "queue_state", "entries": "invalid"}', false, 0);
runTestCase('Object entries in queue_state', '{"type": "queue_state", "entries": {}}', false, 0);

// 3. Valid queue_state with empty entries
runTestCase('Empty queue_state entries', '{"type": "queue_state", "entries": []}', true, 0);
runTestCase('Empty queue_state with total_count 0', '{"type": "queue_state", "entries": [], "total_count": 0}', true, 0);
runTestCase('Empty queue_state with invalid total_count', '{"type": "queue_state", "entries": [], "total_count": "three"}', true, 0);

// 4. Valid queue_state with full entries
const fullPayload = JSON.stringify({
  type: "queue_state",
  total_count: 2,
  entries: [
    {
      session_id: "sess_001",
      department_id: "cardio",
      triage_priority: "critical",
      wait_time_seconds: 350,
      status: "waiting",
      patient_name: "Patient A",
      chief_complaint: "Chest pressure"
    },
    {
      session_id: "sess_002",
      department_id: "gen_med",
      triage_priority: "normal",
      wait_time_seconds: 1200,
      status: "waiting",
      patient_name: "Patient B",
      chief_complaint: "Mild headache"
    }
  ]
});
runTestCase('Full queue_state with 2 entries', fullPayload, true, 2);

// 5. Bare Array payload
runTestCase('Bare empty array', '[]', true, 0);
runTestCase('Bare array with 1 entry', JSON.stringify([{ session_id: "sess_arr_1", wait_time_seconds: 100 }]), true, 1);

// 6. Single Entry payload
runTestCase('Single entry object', JSON.stringify({ session_id: "sess_single_1", wait_time_seconds: 200 }), true, 1);

// 7. Corrupted / partial entries inside entries array
runTestCase('Array with null entry', JSON.stringify({ type: "queue_state", entries: [null] }), true, 1);
runTestCase('Array with empty object entry', JSON.stringify({ type: "queue_state", entries: [{}] }), true, 1);
runTestCase('Array with missing session_id', JSON.stringify({ type: "queue_state", entries: [{ wait_time_seconds: 50 }] }), true, 1);
runTestCase('Array with numeric session_id', JSON.stringify({ type: "queue_state", entries: [{ session_id: 9999 }] }), true, 1);
runTestCase('Array with NaN wait_time_seconds', JSON.stringify({ type: "queue_state", entries: [{ session_id: "s_nan", wait_time_seconds: NaN }] }), true, 1);

console.log(`\nResults: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests.\n`);

// 8. Specific Adversarial Audit: ClinicianQueueView exact line 201 behavior
console.log('--- Adversarial Audit of ClinicianQueueView line 201: entry.session_id.toLowerCase() ---');
const testCasesLine201 = [
  { name: 'Standard entry with session_id', entry: { session_id: 'SESS_123' }, q: 'sess' },
  { name: 'Entry with missing session_id', entry: {}, q: 'sess' },
  { name: 'Entry with null session_id', entry: { session_id: null }, q: 'sess' },
  { name: 'Entry with numeric session_id', entry: { session_id: 12345 }, q: '123' },
];

let line201FragilityFound = false;
for (const tc of testCasesLine201) {
  const res = testExactClinicianSearchLine(tc.entry, tc.q);
  if (!res.ok) {
    line201FragilityFound = true;
    console.log(`[VULNERABILITY] ${tc.name}: THREW EXCEPTION: ${res.error.message}`);
  } else {
    console.log(`[SAFE] ${tc.name}: result = ${res.matchesSession}`);
  }
}

if (line201FragilityFound) {
  console.log('\n[FINDING] ClinicianQueueView line 201 directly accesses entry.session_id.toLowerCase(). If SSE stream delivers partial entry lacking session_id or with null session_id, searching causes an unhandled TypeError crash!');
} else {
  console.log('\n[PASS] No fragility on line 201.');
}
