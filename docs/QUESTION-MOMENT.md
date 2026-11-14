# The Question Moment - expert analysis (Nov 14 2026, from Rajesh's note)

## His observation
"Answer the question first" and the visual fight for attention; on a phone the
fight itself is the clutter. If something is not interactable, it should be
absent or grayed with a clear moment - not explained in copy.

## What the masters do
1. Sweller's split-attention effect: two co-present visual sources that must be
   integrated impose real cognitive cost; worst on small screens. The fix is
   never "label the conflict" - it is removing one source from the moment.
2. One-thing-at-a-time staging: Brilliant (full-screen question cards),
   Duolingo (one prompt per screen), Bret Victor's Explorable Explanations
   (text and picture interleaved, never competing in the same beat),
   Nintendo's introduce-then-test loop. Masters sequence attention; they do
   not divide it.
3. Disabled-with-explanation ("Answer the question first") is a symptom of
   showing everything at once. Intentional UX replaces instruction with
   ABSENCE-THEN-ARRIVAL: what you cannot use yet is not there; it arrives at
   the moment it becomes usable. Arrival itself is the cue - no copy needed.

## The trap in the naive fix
Full-screen question with no picture forces RECALL where the pedagogy wants
OBSERVE-AND-COMPARE (his ground rule). A 9-10 year old answering "what did the
ball do?" must be able to glance back. Pure separation trades the attention
problem for a memory problem.

## The master pattern: separation with spatial continuity
The sheet-with-peek: the question takes the stage; the scene collapses to a
small persistent thumbnail strip that keeps the spatial mental model alive;
one tap restores the scene with state intact (map apps' bottom sheet, Apple
onboarding sheets). Both problems solved: one thing at a time, context one
glance away.

## THE PICK - "Question moment" v1 (lane pattern)
1. SCENE PHASE: visual + dock + copy only. No question, no Next, no hints of
   either. The dock action is the single cue.
2. ARRIVAL: when the interaction completes, the question arrives (soft ease,
   instant under reduced motion). On <=560px the scene collapses to a slim
   tappable thumbnail strip; on wide viewports both stay but the question only
   exists after the interaction.
3. PEEK-BACK: tapping the strip restores the full scene with state preserved;
   tap again (or answer) to return. Observe-and-compare survives.
4. ANSWERED: correct answer -> feedback in place, THEN Next appears with the
   spring ease. No gating copy anywhere in the app: locked things are absent,
   not labeled.
Evidence gate: before/after at 390 and 320 real Chromium; suite rewrites its
gating assertions from "disabled with text" to "absent until earned".
