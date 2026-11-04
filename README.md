# PARENTING

Cute 2D pixel-art web game: you are a dad or mom keeping the family happy from 6:00 morning to midnight.
Baby Haebyol and your spouse make requests (food, diaper, bath, toy, groceries, talk, cleaning...); grab items from stations and deliver them before their timers run out. Happiness 0 = game over; survive to 24:00 = win (family photo + confetti).

## Play online (permanent)
https://cdn.jsdelivr.net/gh/youngjinbak-mistral/parenting-game@main/index.html

## Controls
- Desktop: arrows move, A grabs/delivers/dismisses, S drops. Click a parent card (or <-/-> + A) to choose.
- Phone: on-screen D-pad + A/S buttons.

## Run locally
Serve this folder with any static server (e.g. `python3 -m http.server 8001`) and open index.html.

## Files
- `index.html`, `game.js`, `game_content.js` — game code and content
- `sprites.js`, `photo.js` — sprite sheet and family photo as base64 JS globals (so the repo is fully text and works over a CDN)
- Characters were AI-generated (image model) from a family photo; request text by LLM agents. See the dev folder for the pipeline.
