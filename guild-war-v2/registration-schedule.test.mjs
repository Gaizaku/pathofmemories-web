import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRegistrationRounds} from '../src/GuildWarRegistrationSchedule.ts';

test('restoring League merges its saved selection while preserving unsaved changes to visible Rank rounds',()=>{
  assert.deepEqual(reconcileRegistrationRounds(['rank2'],['rank2','rank3'],['league','rank2','rank3'],['league','rank2','rank3']),['league','rank2']);
});

test('hiding a round removes it without replacing the member’s other pending selections',()=>{
  assert.deepEqual(reconcileRegistrationRounds(['league','rank3'],['league','rank2','rank3'],['rank2','rank3'],['rank2']),['rank3']);
});
