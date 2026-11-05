# PARENTING

Cute 2D pixel-art web game: you are a dad or mom keeping the family happy from 6:00 morning to midnight.
Baby Haebyol and your spouse make requests (food, diaper, bath, toy, groceries, talk, cleaning...); grab items
from stations and deliver them before their timers run out. Happiness 0 = game over; survive to 24:00 = win
(family photo + confetti + Korean message).

## Play (permanent, GitHub Pages)
https://youngjinbak-mistral.github.io/parenting-game/

## Controls
- Desktop: arrows move, A grabs/delivers/dismisses, S drops. Click a parent card (or <-/-> + A) to choose.
- Phone: tap-to-move / tap-to-act (tap a station or family member to go and act; a small S button drops the carried item).

## Run locally
Serve this folder with any static server (e.g. `python3 -m http.server 8001`) and open index.html.

## Files
- `index.html`, `game.js`, `game_content.js` — game code and content
- `sprites.js`, `photo.js` — sprite sheet and family photo as base64 JS globals (all-text repo, CDN-safe)
- Characters were AI-generated (image model) from a family photo; request text by LLM agents.
