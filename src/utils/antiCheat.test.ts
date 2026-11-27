import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCheatEventToLogs,
  isFullscreenActive,
  shouldFlagAiUsage,
  summarizeStudentCheatLogs,
} from './antiCheat';

test('applyCheatEventToLogs records per-unit fullscreen exits and flags AI suspicion accurately', () => {
  const firstExit = applyCheatEventToLogs(
    [],
    {
      unitNumber: 5,
      unitTitle: 'Prefixes',
      eventType: 'fullscreen_exit',
    },
    '2026-11-27T10:00:00.000Z',
  );
  assert.equal(firstExit.length, 1);
  assert.equal(firstExit[0].unitNumber, 5);
  assert.equal(firstExit[0].exitCount, 1);
  assert.equal(firstExit[0].aiSuspected, false);

  // Returning after 10 seconds outside fullscreen flags AI usage suspicion
  const delayedReturn = applyCheatEventToLogs(
    firstExit,
    {
      unitNumber: 5,
      unitTitle: 'Prefixes',
      eventType: 'away_return',
      awaySeconds: 10,
    },
    '2026-11-27T10:00:10.000Z',
  );
  assert.equal(delayedReturn[0].totalAwaySeconds, 10);
  assert.equal(delayedReturn[0].aiSuspected, true);

  // Switching tab on another unit immediately flags AI suspicion on that unit
  const secondUnit = applyCheatEventToLogs(
    delayedReturn,
    {
      unitNumber: 12,
      unitTitle: 'Countable and uncountable',
      eventType: 'tab_switch',
    },
    '2026-11-27T10:05:00.000Z',
  );
  assert.equal(secondUnit.length, 2);
  assert.equal(secondUnit[0].unitNumber, 12);
  assert.equal(secondUnit[0].tabSwitchCount, 1);
  assert.equal(secondUnit[0].aiSuspected, true);

  const overview = summarizeStudentCheatLogs(secondUnit);
  assert.equal(overview.totalExits, 1);
  assert.equal(overview.totalTabSwitches, 1);
  assert.equal(overview.totalAwaySeconds, 10);
  assert.equal(overview.flaggedUnitsCount, 2);
  assert.equal(overview.aiSuspected, true);
});

test('shouldFlagAiUsage triggers on repeated exits, tab switches, or prolonged absence', () => {
  assert.equal(
    shouldFlagAiUsage({ exitCount: 1, tabSwitchCount: 0, totalAwaySeconds: 2 }),
    false,
  );
  assert.equal(
    shouldFlagAiUsage({ exitCount: 2, tabSwitchCount: 0, totalAwaySeconds: 2 }),
    true,
  );
  assert.equal(
    shouldFlagAiUsage({ exitCount: 0, tabSwitchCount: 1, totalAwaySeconds: 1 }),
    true,
  );
  assert.equal(
    shouldFlagAiUsage({ exitCount: 1, tabSwitchCount: 0, totalAwaySeconds: 8 }),
    true,
  );
});

test('isFullscreenActive checks standard and webkit fullscreenElement', () => {
  assert.equal(isFullscreenActive({ fullscreenElement: null } as Document), false);
  assert.equal(
    isFullscreenActive({ fullscreenElement: {} as Element } as Document),
    true,
  );
  assert.equal(
    isFullscreenActive({
      fullscreenElement: null,
      webkitFullscreenElement: {} as Element,
    } as unknown as Document),
    true,
  );
});
