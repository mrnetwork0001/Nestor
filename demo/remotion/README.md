# The Nestor demo video

How `nestor-demo.mp4` was made. It is 2 min 42 s, and every app shot in it is
real screen capture of the live deployment: no mockups, no re-creations, no
stock footage.

```
npm install
npm run studio          # preview the film in Remotion Studio
npm run render          # 1080p master -> out/nestor-demo.mp4
npm run render:4k       # 4K master    -> out/nestor-demo-4k.mp4
npm run thumb           # three thumbnails, all under YouTube's 2 MB limit
```

Both render scripts chain `scripts/finish.mjs`, which sets the loudness and the
colour tags without re-encoding a single video frame, so one command produces a
finished deliverable.

## What is in here

| | |
|---|---|
| `src/Nestor.tsx` | The twelve scenes, one per section of narration. |
| `src/ui.tsx` | The design system: palette, type, `BrowserFrame` and its camera. |
| `scripts/capture.mjs` | Films the live app through the Chrome DevTools screencast. |
| `scripts/mask-take2.py` | Blurs the Passport token and the demo account's address out of the footage. |
| `scripts/finish.mjs` | Loudness and colour tags, audio only. |
| `vo-gen.js` | Generates the narration from the script it contains. |
| `public/vo/` | The generated narration and its measured lengths. |
| `public/extras/` | The two provider dashboards shown as receipts at the end. |

The footage itself (`public/clips/*.mp4`, about 110 MB) and the rendered
masters are not in the repository.

## Filming

`capture.mjs` drives a real browser against a real deployment and keeps the
frames the screencast delivers, each with its own timestamp, rather than
recording a video stream. Text stays sharp and marks land on exact frames.

```
node scripts/capture.mjs <beat>                     # the dev server
DPR=2 TARGET=prod node scripts/capture.mjs <beat>   # production, at 3200x1800
node scripts/capture.mjs recut <beat>               # rebuild a clip, no browser
```

`DPR=2` needs Chrome's `--force-device-scale-factor` as well as the context's
`deviceScaleFactor`. Setting only the latter looks like it works and is not:
Chrome renders at 2x but hands the screencast a frame downscaled to the CSS
viewport, and ffmpeg then upscales it back into a file that reports 3200x1800
and holds no extra detail. `cut()` now measures the delivered frame and warns if
it disagrees with the clip being written.

A pointer and click rings are drawn into the page, the mouse travels an eased
arc before each click, scrolling is an eased glide, and long waits are declared
as ranges so they can be compressed on the cut with the marks mapped through the
same function. Anything compressed carries a "Sped up" label in the film.

`meta.json` records, per clip, what it shows, the time of each moment, the
compressed ranges with their real durations, and regions the camera can push
into, in CSS pixels of a 1600x900 viewport whatever the clip's pixel size.

## Masking

The first email quotes the renter's Passport link, and the sign-in form shows
the demo account's address. Both are blurred out of the footage before it is
ever rendered.

The page scrolls while those shots run, so a fixed box does not hold.
`track-token.py` follows the text down the page frame by frame and its output
drives both the crop and the overlay, so the blur sits on the text in every
frame and nowhere else. `check-mask.py` then proves it: it reduces the box to
one value per row and measures the spread, which collapses wherever glyphs are
gone.

```
npm run mask
python3 scripts/check-mask.py <clip.mp4> <w> <h> <x> <yexpr-file> <lo> <hi>
```

`mask-take2.py` reads `clips/tmp/take2-unmasked/` and writes `public/clips/`, so
it is re-runnable and never consumes a take. Its coordinates are measured
against the current footage: **re-film and they must be re-derived before it is
run again.**

## Timing

Scene lengths come from the narration, not the other way round: each scene is 8
lead frames, then the measured length of its `.mp3`, then a breath. The film is
4868 frames at 30 fps. Re-generating the narration changes the lengths in
`public/vo/durations.json` and so the length of the film.

`vo-gen.js` reads its API key from an env file outside this repository, so no
key is ever written here.
