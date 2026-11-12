import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questions, transfer, createJourney, reduceJourney, STEP_COUNT } from '../learning.js';

test('journey walks forward and back within bounds', () => {
  let s = createJourney();
  assert.equal(s.step, 0);
  s = reduceJourney(s, { type: 'back' });
  assert.equal(s.step, 0, 'back at start stays');
  s = reduceJourney(s, { type: 'start' });
  assert.equal(s.step, 1);
  for (let i = 0; i < 20; i++) s = reduceJourney(s, { type: 'next' });
  assert.equal(s.step, STEP_COUNT - 1, 'next clamps at the end');
  for (let i = 0; i < 20; i++) s = reduceJourney(s, { type: 'back' });
  assert.equal(s.step, 0);
});

test('answers are recorded per question and reset clears them', () => {
  let s = createJourney();
  s = reduceJourney(s, { type: 'answer', question: 'drop', choice: 2 });
  assert.equal(s.answers.drop, 2);
  assert.equal(s.feedbackFor, 'drop');
  s = reduceJourney(s, { type: 'answer', question: 'drop', choice: 0 });
  assert.equal(s.answers.drop, 0, 're-answering updates');
  s = reduceJourney(s, { type: 'reset' });
  assert.deepEqual(s.answers, {});
});

test('invalid answers are ignored', () => {
  let s = createJourney();
  for (const a of [
    { type: 'answer', question: 'nope', choice: 0 },
    { type: 'answer', question: 'drop', choice: -1 },
    { type: 'answer', question: 'drop', choice: 9 },
    { type: 'answer', question: 'drop', choice: 1.5 },
    { type: 'mystery' },
  ]) s = reduceJourney(s, a);
  assert.deepEqual(s, createJourney());
});

test('transfer records, feedback shows, teachback flips', () => {
  let s = createJourney();
  s = reduceJourney(s, { type: 'answerTransfer', choice: transfer.answer });
  assert.equal(s.transferChoice, transfer.answer);
  assert.equal(s.transferFeedback, true);
  s = reduceJourney(s, { type: 'teachback' });
  assert.equal(s.taughtBack, true);
});

test('acted marks a step action done and survives answers', () => {
  let s = createJourney();
  assert.equal(s.acted.drop, undefined);
  s = reduceJourney(s, { type: 'acted', step: 'drop' });
  assert.equal(s.acted.drop, true);
  s = reduceJourney(s, { type: 'answer', question: 'drop', choice: 0 });
  assert.equal(s.acted.drop, true);
  s = reduceJourney(s, { type: 'reset' });
  assert.deepEqual(s.acted, {});
});

test('every question has an answer and one why per choice', () => {
  for (const q of Object.values(questions)) {
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
    assert.equal(q.why.length, q.choices.length);
    for (const w of q.why) assert(w.length > 30, 'feedback must explain');
  }
  assert.equal(transfer.why.length, transfer.choices.length);
});
