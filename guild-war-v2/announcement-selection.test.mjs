import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementRoundsForDay} from '../src/GuildWarAnnouncementSelection.ts';

const rounds=[
  {id:'sat2',starts_at:'2026-10-24T20:00:00+07:00',local_date:'2026-10-24'},
  {id:'sat3',starts_at:'2026-10-24T20:30:00+07:00',local_date:'2026-10-24'},
  {id:'sat4',starts_at:'2026-10-24T21:00:00+07:00',local_date:'2026-10-24'},
  {id:'sun2',starts_at:'2026-10-25T20:00:00+07:00',local_date:'2026-10-25'},
  {id:'sun3',starts_at:'2026-10-25T20:30:00+07:00',local_date:'2026-10-25'},
  {id:'sun4',starts_at:'2026-10-25T21:00:00+07:00',local_date:'2026-10-25'},
];

test('a three-round announcement defaults to the selected day without including the other day',()=>{
  assert.deepEqual(announcementRoundsForDay(rounds,'sat3'),['sat2','sat3','sat4']);
  assert.deepEqual(announcementRoundsForDay(rounds,'sun3'),['sun2','sun3','sun4']);
});
test('announcement selection preserves four-round days and handles an empty schedule',()=>{
  const normal=[{id:'sat1',starts_at:'2026-10-24T19:30:00+07:00',local_date:'2026-10-24'},...rounds];
  assert.deepEqual(announcementRoundsForDay(normal,'sat3'),['sat1','sat2','sat3','sat4']);
  assert.deepEqual(announcementRoundsForDay([],'missing'),[]);
  assert.deepEqual(announcementRoundsForDay(rounds,'missing'),['sat2','sat3','sat4']);
});
test('announcement selection uses Bangkok dates when local_date is absent',()=>{
  const legacy=rounds.map(({local_date,...round})=>round);
  assert.deepEqual(announcementRoundsForDay(legacy,'sun4'),['sun2','sun3','sun4']);
});
