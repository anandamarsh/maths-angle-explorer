# Angle Explorer

> An arcade-style maths game where learners rotate a cannon, read angle values, and solve angle questions by aiming and firing.

## What It Is

Angle Explorer is an interactive maths game built as a Progressive Web App. A cannon rotates from a fixed base, and the player uses dragging and keypad input to aim at targets while learning how different angles behave.

The game is designed to move from visual intuition to calculation:
- Level 1 focuses on recognising and targeting angle types by sight.
- Level 2 focuses on missing-angle reasoning in 90°, 180°, and 360° sector problems.
- Level 3 is planned as a less scaffolded angle-reasoning mode.

## Objective

The objective is to aim correctly, answer the angle prompt, and clear the level by building enough progress to survive the Monster Round. Correct shots collect stars, wrong answers break momentum, and the final challenge rewards fluency rather than guessing.

## What It Teaches

| Level | Skill |
|---|---|
| **Level 1** | Recognising acute, right, obtuse, straight, and reflex angles |
| **Level 2** | Solving missing-angle questions using totals of 90°, 180°, and 360° |
| **Level 3** | Angle reasoning with less visual scaffolding |

## How to Play

1. Read the question prompt.
2. Drag the cannon to aim or type the angle on the keypad.
3. Fire at the target.
4. Correct answers collect stars and push the run forward.
5. Collect enough stars to trigger the Monster Round.
6. Clear the Monster Round to complete the level.

## Design Notes

- The live angle readout helps learners connect movement to angle measure.
- Snapping at landmark values like 90° and 180° reinforces core angle relationships.
- Sector-based missing-angle questions push learners to subtract from a known total instead of adding everything they see.
- The Monster Round increases pressure without changing the underlying maths, which makes it a fluency test rather than a different game.

## Tech

- React
- TypeScript
- Vite
- Tailwind CSS
- SVG
