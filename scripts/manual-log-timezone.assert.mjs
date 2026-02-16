import assert from 'node:assert/strict';
import {
  MANUAL_LOG_TIME_ZONE,
  makeZonedDateTime,
  toDateKeyInTZ,
  formatTimeInTZ,
} from '../src/lib/manualLogDateTime.js';

function fmt(date) {
  return `${toDateKeyInTZ(date, MANUAL_LOG_TIME_ZONE)} ${formatTimeInTZ(date, MANUAL_LOG_TIME_ZONE)}`;
}

const nowCaseA = new Date('2026-02-16T17:57:00+05:00');
const startCaseA = makeZonedDateTime({
  dateKey: '2026-02-16',
  timeStr: '12:15 PM',
  tz: MANUAL_LOG_TIME_ZONE,
});
assert.ok(startCaseA, 'Case A startAt should be constructed');
assert.equal(fmt(startCaseA), '2026-02-16 12:15');
assert.equal(startCaseA.getTime() > nowCaseA.getTime(), false);

const startCaseB = makeZonedDateTime({
  dateKey: '2026-02-16',
  timeStr: '6:04 PM',
  tz: MANUAL_LOG_TIME_ZONE,
});
assert.ok(startCaseB, 'Case B startAt should be constructed');
assert.equal(fmt(startCaseB), '2026-02-16 18:04');

const dateKeyCaseC = toDateKeyInTZ(startCaseB, MANUAL_LOG_TIME_ZONE);
assert.equal(dateKeyCaseC, '2026-02-16');
assert.notEqual(dateKeyCaseC, '2026-02-15');

console.log('Manual log timezone assertions passed');
