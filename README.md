# PARENTING

Cute 2D pixel-art web game: you are a dad or mom keeping the family happy from 6:00 morning to midnight.

## Play
- Live now: https://brave-apples-relate.loca.lt (public tunnel while the dev session runs)
- Local: serve this folder (`python3 -m http.server 8001`) and open http://localhost:8001/
- Self-contained single-file build: `publish.html` in the dev folder (drag into this repo for a permanent one-file page)

## Controls
- Arrows: move  |  A: grab item at a station / deliver to a requester / dismiss chat  |  S: drop item
- Pick DAD or MOM on the title screen (click the card or use <-/-> + A)

## Rules
- Baby and (from 18:00) spouse show icon bubbles with expiring timers; the house shows a mess pile (broom).
- Fulfill before the timer ends: +happiness. Miss: -happiness. Happiness 0 = game over.
- Survive to 24:00 = win: evening routine (bath, dinner, clean, bedtime), one baby wake-up at 23:30, ending photo + confetti.
- The window shows the real time of day: sun by day, moon + stars by night.

## Files
- `index.html`, `game.js`, `game_content.js` — game (needs `spr_sheet.png`, `family_web.jpeg`, `spr_*.png` alongside for assets)
- Assets are AI-generated (image model) from the family photo; see the dev folder `tools/` for the generation pipeline.