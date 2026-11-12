import test from 'node:test';
import assert from 'node:assert/strict';
import {durationConfig,questionGroups,createSession,restoreSession,remaining,updateSession,formatTime,counts} from '../session-core.mjs';

const paper={
  id:'paper-2027',duration:'3 hours',readingMinutes:10,workingMinutes:180,questions:27,
  sections:[{label:'Section I',start:1,end:10,format:'Multiple choice'},
            {label:'Section II',start:11,end:27,format:'Extended response'}]
};
const cfg=durationConfig(paper);
const at=Date.UTC(2026,10,12,11,0,0);

test('duration and section metadata match the real examination',()=>{
  assert.deepEqual(cfg,{readingMinutes:10,workingMinutes:180});
  assert.deepEqual(questionGroups(paper).map(x=>[x.start,x.end]),[[1,10],[11,27]]);
  assert.equal(questionGroups({...paper,sections:[]})[0].end,27);
  assert.equal(questionGroups({...paper,sections:[{label:'Broken',start:1,end:29}]}).length,1);
  assert.equal(durationConfig({duration:'2 hours',questions:20}).workingMinutes,120);
});
test('reading session persists exact time and transitions to ready',()=>{
  const idle=createSession(paper);
  const reading=updateSession(idle,{type:'BEGIN_READING'},cfg,at);
  assert.equal(reading.phase,'reading');
  assert.equal(reading.deadline,at+600_000);
  assert.equal(formatTime(remaining(reading,at+1000,cfg)),'00:09:59');
  assert.equal(updateSession(reading,{type:'TICK'},cfg,at+599_999).phase,'reading');
  const ready=updateSession(reading,{type:'TICK'},cfg,at+600_000);
  assert.equal(ready.phase,'ready');
  assert.equal(ready.running,false);
  assert.equal(remaining(ready,at+600_000,cfg),10_800_000);
});
test('working session pause, resume, finish and no accidental restart',()=>{
  const idle=createSession(paper);
  const work=updateSession(idle,{type:'BEGIN_WORKING'},cfg,at);
  assert.equal(work.deadline,at+10_800_000);
  const paused=updateSession(work,{type:'PAUSE'},cfg,at+30_000);
  assert.equal(paused.running,false);
  assert.equal(paused.remainingMs,10_770_000);
  assert.equal(remaining(paused,at+100_000,cfg),10_770_000);
  const resumed=updateSession(paused,{type:'RESUME'},cfg,at+100_000);
  assert.equal(resumed.deadline,at+100_000+10_770_000);
  assert.equal(updateSession(resumed,{type:'TICK'},cfg,resumed.deadline).phase,'finished');
  const finished=updateSession(resumed,{type:'FINISH'},cfg,at+200_000);
  assert.equal(finished.phase,'finished');
  assert.equal(updateSession(finished,{type:'BEGIN_WORKING'},cfg,at+300_000),finished);
});
test('a zero-reading-time paper begins directly with working time',()=>{
  const generic={...paper,readingMinutes:0};
  const state=updateSession(createSession(generic),{type:'BEGIN_READING'},durationConfig(generic),at);
  assert.equal(state.phase,'working');
});
test('question progress and notes are accurate, isolated and resettable',()=>{
  let s=createSession(paper);
  s=updateSession(s,{type:'SET_STATUS',question:1,status:'done'},cfg,at);
  s=updateSession(s,{type:'SET_STATUS',question:2,status:'flagged'},cfg,at);
  s=updateSession(s,{type:'SELECT',question:2,total:27},cfg,at);
  s=updateSession(s,{type:'SAVE_NOTE',question:2,text:'I need to revisit the argument.'},cfg,at);
  assert.deepEqual(counts(s,27),{done:1,flagged:1,unseen:25});
  assert.equal(s.notes[2],'I need to revisit the argument.');
  s=updateSession(s,{type:'SET_STATUS',question:1,status:'done'},cfg,at);
  assert.equal(counts(s,27).done,0);
  s=updateSession(s,{type:'RESET'},cfg,at);
  assert.deepEqual(counts(s,27),{done:0,flagged:0,unseen:27});
  assert.deepEqual(s.notes,{});
});
test('restores valid sessions, ignores invalid or out-of-range stored data',()=>{
  let raw={...createSession(paper),phase:'reading',running:true,deadline:at+70000,selected:99,
    statuses:{1:'done',2:'flagged',99:'done',3:'invalid'},notes:{2:'ok',45:'not in exam'}};
  let s=restoreSession(raw,paper);
  assert.equal(s.selected,27);
  assert.deepEqual(s.statuses,{1:'done',2:'flagged'});
  assert.deepEqual(s.notes,{2:'ok'});
  assert.equal(s.deadline,at+70000);
  assert.equal(restoreSession({...raw,version:999},paper).phase,'idle');
  assert.equal(restoreSession(null,paper).phase,'idle');
});
test('formatTime rounds conservatively to the displayed second',()=>{
  assert.equal(formatTime(3*60*60*1000),'03:00:00');
  assert.equal(formatTime(1001),'00:00:02');
  assert.equal(formatTime(0),'00:00:00');
  assert.equal(formatTime(-5),'00:00:00');
});
