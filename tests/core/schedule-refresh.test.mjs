import test from 'node:test';
import assert from 'node:assert/strict';
import { planScheduleRefresh } from '../../.core-dist/lib/ingestion/schedule/refresh.js';

test('schedule refresh enriches fields that were previously missing', () => {
  const plan=planScheduleRefresh(
    {scheduledAt:'2026-08-21T10:00:00',homeAway:'neutral'},
    {scheduledAt:'2026-08-21T10:00:00',homeAway:'neutral',location:'Sioux City, Iowa',result:'L, 0-3'},
  );
  assert.equal(plan.status,'enrich');
  assert.deepEqual(plan.patch,{location:'Sioux City, Iowa',result:'L, 0-3'});
});

test('schedule refresh does not overwrite conflicting canonical values', () => {
  const plan=planScheduleRefresh(
    {scheduledAt:'2026-08-21T10:00:00',homeAway:'neutral',location:'Staff corrected location',result:'W, 3-0'},
    {scheduledAt:'2026-08-21T10:00:00',homeAway:'neutral',location:'Sioux City, Iowa',result:'L, 0-3'},
  );
  assert.equal(plan.status,'conflict');
  assert.deepEqual(plan.conflictingFields,['location','result']);
});

test('identical schedule refresh remains unchanged', () => {
  const state={scheduledAt:'2026-08-21T10:00:00',homeAway:'neutral',location:'Sioux City, Iowa',result:'L, 0-3'};
  assert.deepEqual(planScheduleRefresh(state,state),{status:'unchanged'});
});
