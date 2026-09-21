#!/usr/bin/env python3
"""
Find where a fixed piece of text sits in every frame of a screencast that scrolls.

The page never moves sideways and never reflows, so the text only travels in y.
That makes this a 1-D search: reduce each frame to one byte per row (the mean
darkness across the text's own x-band, via ffmpeg's area scaler), then slide a
reference profile of the text's rows over the neighbourhood of where it was last
frame and take the best fit. A fit worse than THRESH means the text is not on
screen, and nothing is masked there.

Prints one "start end y" run per line, in frame numbers, y quantised to QSTEP.

  track-token.py <clip.mp4> <bandx> <bandw> <refframe> <refy> <refh>
"""
import subprocess
import sys

QSTEP = 3       # quantise y so tiny jitter does not split a run
SEARCH = 200    # rows either side of the last known position
THRESH = 0.5    # normalised mean abs error above which we call it "not on screen"


def profiles(path, bx, bw, h):
    """One byte per row per frame: the row means inside the x-band."""
    cmd = ['ffmpeg', '-v', 'error', '-i', path,
           '-vf', f'crop={bw}:{h}:{bx}:0,scale=1:{h}:flags=area,format=gray',
           '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    return [raw[i:i + h] for i in range(0, len(raw) - h + 1, h)]


def main():
    path, bx, bw, ref, refy, refh = sys.argv[1], *map(int, sys.argv[2:7])
    h = int(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=height', '-of', 'csv=p=0', path],
        stdout=subprocess.PIPE, check=True).stdout.strip())

    frames = profiles(path, bx, bw, h)
    tpl = list(frames[ref][refy:refy + refh])

    # Match the shape of the profile, not its level or its contrast. The card
    # behind the text changes colour and fades as the draft turns into the sent
    # email, which moves every row by a common offset and scales the spread;
    # neither changes where the text is. Normalising both out leaves a score
    # that means the same thing in every frame.
    def norm(vals):
        m = sum(vals) / len(vals)
        c = [v - m for v in vals]
        s = sum(abs(v) for v in c) / len(c)
        return [v / s for v in c] if s > 0.5 else None

    tpl = norm(tpl)
    if tpl is None:
        sys.exit('the reference rows carry no text -- check refframe/refy')

    runs, last = [], refy
    for n, fr in enumerate(frames):
        lo, hi = max(0, last - SEARCH), min(h - refh, last + SEARCH)
        best, besty = None, None
        for y in range(lo, hi + 1):
            w = norm(fr[y:y + refh])
            if w is None:
                continue                  # a flat band: no text to match
            err = 0
            for i in range(refh):
                d = w[i] - tpl[i]
                err += d if d > 0 else -d
                if best is not None and err > best:
                    break
            if best is None or err < best:
                best, besty = err, y
        if best is None:
            continue
        err = best / refh
        if err > THRESH:
            continue                      # text is not on screen in this frame
        last = besty
        q = (besty // QSTEP) * QSTEP
        if runs and runs[-1][2] == q and n - runs[-1][1] <= 2:
            runs[-1][1] = n               # extend, tolerating a dropped frame
            runs[-1][3] = max(runs[-1][3], err)
        else:
            runs.append([n, n, q, err])
    for a, b, y, e in runs:
        print(a, b, y, round(e, 1))


main()
