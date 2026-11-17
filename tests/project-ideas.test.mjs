import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, reduce, restore, resumeView} from '../src/model.mjs';
import {projectIdeaLink} from '../src/project-ideas.mjs';

const now = Date.parse('2026-10-24T10:00:00Z');
const id = 'c5a4d84a-1d6a-42c5-8c77-741456be5337';

test('an existing Notes draft and destination survive adding and reopening project ideas', () => {
 const legacy = initialState(now);
 delete legacy.projectIdeas;
 legacy.lastView = 'dump';
 legacy.brainDump = 'Keep the existing notes draft.';
 const restored = restore(legacy, now);
 assert.deepEqual(restored.projectIdeas, []);
 assert.equal(resumeView(restored), 'dump');

 const added = reduce(restored, {type:'saveProjectIdea', idea:{
  id, title:'  Window garden  ', notes:'First step\nSketch a prototype',
  links:['example.com/reference', 'https://example.com/reference'],
 }}, now);
 const selected = reduce(added, {type:'view', view:'ideas'}, now);
 const roundTrip = restore(JSON.parse(JSON.stringify(selected)), now);
 assert.equal(roundTrip.brainDump, legacy.brainDump);
 assert.equal(resumeView(roundTrip), 'ideas');
 assert.deepEqual(roundTrip.projectIdeas, [{
  id, title:'Window garden', notes:'First step\nSketch a prototype',
  links:['https://example.com/reference'], created:now, updated:now,
 }]);
});

test('editing and undoing removal keep idea identity and its reference links', () => {
 const saved = reduce(initialState(now), {type:'saveProjectIdea', idea:{
  id, title:'Window garden', notes:'Start small', links:['https://example.com/'],
 }}, now);
 const edited = reduce(saved, {type:'saveProjectIdea', idea:{
  ...saved.projectIdeas[0], notes:'Try cardboard first',
 }}, now+1000);
 const deleted = reduce(edited, {type:'deleteProjectIdea', id}, now+1000);
 assert.deepEqual(deleted.projectIdeas, []);
 const restored = reduce(deleted, {type:'restoreProjectIdea', idea:edited.projectIdeas[0], index:0}, now+1000);
 assert.deepEqual(restored.projectIdeas, [{
  id, title:'Window garden', notes:'Try cardboard first', links:['https://example.com/'],
  created:now, updated:now+1000,
 }]);
});

test('idea references accept web URLs but reject local files, commands and credentials', () => {
 assert.equal(projectIdeaLink('example.com/path#sketch'), 'https://example.com/path#sketch');
 for(const input of ['file:///Users/example/private.txt', 'javascript:alert(1)',
   'https://name:pass@example.com/', 'https://' + 'x'.repeat(2000)]) {
  assert.equal(projectIdeaLink(input), null);
 }
 const saved = reduce(initialState(now), {type:'saveProjectIdea', idea:{
  id, title:'Window garden', notes:'', links:['javascript:alert(1)'],
 }}, now);
 assert.deepEqual(saved.projectIdeas, []);
});
