#!/usr/bin/env python3
"""
Blur the live Passport token, and the demo account's Gmail address, out of the
take-2 (3200 px) footage.

Why this exists instead of mask-token.sh: that script reads clips/tmp/orig,
which still holds the 1600 px take-1 clips. Running it now would overwrite the
re-filmed 3200 px clips with old footage at timings that no longer match the
cut. This one reads clips/tmp/take2-unmasked (a copy of the re-film taken
before any masking) and writes public/clips, so it is re-runnable and never
destroys a take.

The page scrolls, so a fixed box does not hold. track-token.py follows the text
down the page frame by frame; the runs it prints become one piecewise
expression driving both the crop and the overlay, so the blur sits exactly on
the text in every frame and nowhere else.

  python3 scripts/mask-take2.py [clip ...]     (default: all four)
"""
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'clips', 'tmp', 'take2-unmasked')
DST = os.path.join(ROOT, 'public', 'clips')
TRACK = os.path.join(ROOT, 'scripts', 'track-token.py')

# Radius must stay under half the box's shortest side, and under half that
# again on the chroma planes, so each box carries its own.
BLUR_BIG = 'boxblur=18:4:8:4'      # the 44-50px token boxes on the 3200px takes
BLUR_SMALL = 'boxblur=9:4:4:4'     # the 30px email field on the 1600px take

# Each entry: the x-band the tracker measures, the frame and row it learns the
# text from, and the box to blur (width, height, x, and the tracked y plus an
# offset). Measured at native 3200x1800 off the clips themselves.
# `window` is the span of frames over which the text is actually on screen,
# checked by eye on the source. The tracker is good inside it and will happily
# lock onto some other line of the page outside it, so every pass is pinned.
TRACKED = {
    'draft': [
        # the Passport token in the draft editor, wrapped onto its own line.
        # The body first renders at frame 274, not 281 as this once said: the
        # window started at 275 and left frame 274 carrying the whole token in
        # the clear. It is out of shot in the cut, so no render was affected,
        # but the clip on disk was not clean. Start early and leave margin.
        dict(band=(2148, 504), ref=(330, 862, 42), box=(516, 44, 2142, -2),
             window=(268, 839), blur=BLUR_BIG),
    ],
    'send-reply': [
        # the same line, while the draft is still on screen
        dict(band=(2148, 504), ref=(0, 896, 42), box=(516, 44, 2142, -2),
             window=(0, 91), blur=BLUR_BIG),
        # and again as the underlined link in the sent email, which the
        # cross-fade brings in high on the card before it settles
        dict(band=(1865, 520), ref=(120, 822, 46), box=(532, 50, 1858, -2),
             window=(94, 349), blur=BLUR_BIG),
    ],
    'delivery': [
        # the same underlined link, in the record above the delivery details
        dict(band=(1865, 520), ref=(20, 224, 46), box=(532, 50, 1858, -2),
             window=(0, 214), blur=BLUR_BIG),
    ],
}

# The sign-in form does not scroll and the field never moves: one box, one span.
# Frames are 1600x900 here, so the numbers are in that space.
FIXED = {
    # The body renders first on frame 274, not 281 as this once assumed, and
    # the page is still settling: the tracker matched 230px above the real
    # text and left the whole token readable for that one frame. The cut runs
    # past it at 1.9x with the camera framed elsewhere, so no render showed
    # it, but the clip on disk did. Keep the box tight to where the line
    # actually sits while it settles -- a taller one reaches the Approve
    # button a few frames later, which the cut does show.
    'draft': [dict(box=(516, 120, 2142, 1536), frames=(270, 276), blur=BLUR_BIG)],
    # Two frames in the middle of the cross-fade carry both layouts at once,
    # each half-faded, so neither tracker owns them. One box over both
    # positions covers it; at 0.72x it is three frames of the cut.
    'send-reply': [dict(box=(802, 96, 1858, 896), frames=(92, 93), blur=BLUR_BIG)],
    'signup': [dict(box=(186, 30, 948, 498), frames=(210, 393), blur=BLUR_SMALL)],  # 7.0-13.1s
}


def runs_for(clip, spec):
    bx, bw = spec['band']
    rf, ry, rh = spec['ref']
    out = subprocess.run(
        [sys.executable, TRACK, os.path.join(SRC, clip + '.mp4'),
         str(bx), str(bw), str(rf), str(ry), str(rh)],
        stdout=subprocess.PIPE, check=True).stdout.decode()
    rs = [(int(a), int(b), int(y)) for a, b, y, _ in
          (line.split() for line in out.splitlines())]
    lo, hi = spec['window']
    return [(max(a, lo), min(b, hi), y) for a, b, y in rs if b >= lo and a <= hi]


FPS = 30


def span(a, b):
    """A frame range as a time range, with half-frame margins so that each
    frame's own timestamp falls in exactly one run."""
    return f'between(t\\,{(a - 0.25) / FPS:.5f}\\,{(b + 0.25) / FPS:.5f})'


def piecewise(runs, off):
    """A nested if() over time giving the box's top row.

    Time, not frame number: `overlay` only advances its frame counter on the
    frames its `enable` lets through, so an expression written in `n` silently
    slips by however many frames it sat out. `t` is the same clock everywhere.
    """
    expr = str(runs[-1][2] + off)
    for a, b, y in reversed(runs[:-1]):
        expr = f'if({span(a, b)}\\,{y + off}\\,{expr})'
    return expr


def chain(i, prev, w, h, x, yexpr, enable, blur):
    """split -> crop the box -> blur it -> lay it back down in the same place."""
    return (f'[{prev}]split[a{i}][b{i}];'
            f'[b{i}]crop={w}:{h}:{x}:\'{yexpr}\',{blur}[c{i}];'
            f'[a{i}][c{i}]overlay={x}:\'{yexpr}\':enable=\'{enable}\'[o{i}]')


def build(clip):
    parts, prev, i = [], '0:v', 0
    for spec in TRACKED.get(clip, []):
        runs = runs_for(clip, spec)
        if not runs:
            print(f'  {clip}: nothing tracked for band {spec["band"]}', file=sys.stderr)
            continue
        w, h, x, off = spec['box']
        ranges = '+'.join(span(a, b) for a, b, _ in runs)
        parts.append(chain(i, prev, w, h, x, piecewise(runs, off), ranges, spec['blur']))
        print(f'  {clip}: {len(runs)} tracked runs, frames {runs[0][0]}-{runs[-1][1]}')
        prev, i = f'o{i}', i + 1
    for spec in FIXED.get(clip, []):
        w, h, x, y = spec['box']
        a, b = spec['frames']
        parts.append(chain(i, prev, w, h, x, str(y), span(a, b), spec['blur']))
        print(f'  {clip}: fixed box, frames {a}-{b}')
        prev, i = f'o{i}', i + 1
    return ';'.join(parts), prev


def main():
    clips = sys.argv[1:] or ['draft', 'send-reply', 'delivery', 'signup']
    for clip in clips:
        src = os.path.join(SRC, clip + '.mp4')
        if not os.path.exists(src):
            sys.exit(f'missing source {src} -- copy the unmasked take there first')
        print(f'{clip}:')
        fc, last = build(clip)
        if not fc:
            print(f'  {clip}: no boxes, left alone')
            continue
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', fc,
             '-map', f'[{last}]', '-an', '-c:v', 'libx264', '-preset', 'medium',
             '-crf', '12', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart',
             '-color_range', 'tv', '-colorspace', 'bt709',
             '-color_primaries', 'bt709', '-color_trc', 'bt709',
             os.path.join(DST, clip + '.mp4')], check=True)
        print(f'  -> public/clips/{clip}.mp4')


main()
