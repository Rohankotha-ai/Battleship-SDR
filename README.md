# Battleship

A single-player Battleship game playable in the browser against an AI opponent ("Captain Ironbeard"). Built with vanilla HTML, CSS, and JavaScript — no frameworks or build tools required.

## Play Online

**[Play the game here](https://battleship-sdr.netlify.app)**

## Features

- **Cinematic UI** — animated ocean backdrop, ship silhouettes, smoke, and sound effects
- **Ship deployment** — drag-and-place your fleet manually or use Auto-Place for quick setup; press **R** to rotate
- **AI opponent** — hunt-and-target strategy with parity-biased hunting and smart targeting after hits
- **Real-time feedback** — projectile arcs, explosions, screen shake, hit/miss/sunk markers
- **Battle log & chat** — timestamped shot log and in-character taunts from Captain Ironbeard
- **Procedural audio** — all sound effects generated with the Web Audio API (no external files)
- **Fully client-side** — no server, no dependencies, runs entirely in the browser

## How to Play

1. **Deploy your fleet** — select a ship from the picker, then click a cell on your board to place it. Press **R** or click **Rotate** to switch between horizontal and vertical. Click **Auto-Place** to randomize.
2. **Start the battle** — once all 5 ships are placed, click **Start Battle**.
3. **Fire at enemy waters** — click cells on the enemy board to fire. Hits are marked red, misses blue.
4. **Sink all enemy ships** to win. The AI will fire back each turn.

### Fleet

| Ship       | Size |
|------------|------|
| Carrier    | 5    |
| Battleship | 4    |
| Cruiser    | 3    |
| Submarine  | 3    |
| Destroyer  | 2    |

## Running Locally

No build step needed. Serve the project root with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Project Structure

```
├── index.html      # Page structure and layout
├── styles.css      # All styling, animations, and responsive layout
├── game.js         # Game logic, AI, rendering, audio, and effects
├── BUGS.md         # Bug documentation (found during QA)
├── netlify.toml    # Netlify deployment config
└── .gitignore
```

## Bug Documentation

See [BUGS.md](BUGS.md) for a description of bugs found during testing and how they were fixed.

## Tech Stack

- HTML5 / CSS3 / JavaScript (ES6+)
- Web Audio API (procedural sound effects)
- SVG (ship sprites and captain avatar)
- No external dependencies
