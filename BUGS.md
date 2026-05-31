# Bug Report

Bugs discovered during QA testing and how they were fixed.

---

## Bug 1 — "Play Again" returns to the title screen instead of restarting

**Severity:** Medium (UX)

**Description:**
After winning or losing a game, clicking the "Play Again" button on the victory/defeat overlay returned the player to the cinematic title screen. The player then had to click "Start Campaign" a second time to reach the ship deployment phase. This added unnecessary friction to replaying.

**Root Cause:**
The overlay button's click handler called `resetAll()`, which always transitions to the title screen (`setScreen("title")`). There was no distinction between a full reset (New Game) and a quick restart (Play Again).

**Fix:**
The "Play Again" handler now calls `resetAll()` followed by `startSetup()`, which immediately transitions to the deployment phase, skipping the title screen. The "New Game" header button still returns to the title screen as expected.

**File:** `game.js` (overlay button listener)

---

## Bug 2 — AI loses targeting data when sinking a ship

**Severity:** Medium (Gameplay)

**Description:**
When the AI sank one of the player's ships, all of its targeting state was discarded — including any hits it had accumulated on a *different* ship. This caused the AI to revert to random hunting even when it already knew the location of another vessel, making it noticeably less competent.

**Root Cause:**
The sinking handler executed `ai = makeAi()`, which unconditionally replaced the entire AI state object with a fresh one. Any `ai.hits` entries belonging to other unsunked ships were lost.

**Fix:**
Instead of resetting the full AI state, the fix filters out only the hit entries that belong to the sunk ship (using its cell coordinates). If hits on other ships remain, the AI rebuilds its target queue from those surviving hits and continues in targeting mode. Only when no hits remain does it fall back to a full reset.

**File:** `game.js` (`computerFire` — sunk-ship branch)

---

## Bug 3 — Ship placement preview overflows the grid

**Severity:** Low (Visual)

**Description:**
During the setup phase, hovering near the right or bottom edge of the board with a large ship selected caused the preview sprite to extend visually outside the grid boundary. A code comment indicated the coordinates should be clamped, but no clamping logic was implemented.

**Root Cause:**
The `renderPreview` function constructed a ship sprite anchored at the raw hover cell without adjusting the anchor when the ship would extend past the 10×10 grid.

**Fix:**
Added bounds clamping before creating the preview sprite. If the ship extends past column 10 (horizontal) or row 10 (vertical), the anchor is shifted inward so the preview stays within the grid. The placement validation (`canPlace`) is unchanged — the preview simply stays visually contained while still showing red/green to indicate validity.

**File:** `game.js` (`renderPreview`)
