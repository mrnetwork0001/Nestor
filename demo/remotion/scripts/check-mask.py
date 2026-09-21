#!/usr/bin/env python3
"""
Prove the blur landed on the text, in every frame, not just the ones sampled.

For each frame it reduces the mask box to one byte per row (the row means) and
reports the spread of those rows. Sharp text gives dark rows against light ones
and so a wide spread; a box blurred until the glyphs are gone is nearly flat.
Run it against the unmasked take and the masked clip and compare: the masked
spread has to collapse everywhere the text was, or the box missed.

  check-mask.py <clip.mp4> <w> <h> <x> <yexpr-file> <lo> <hi>

yexpr-file is the tracker's own output, so the box follows the text exactly as
the mask does.
"""
import subprocess
import sys


def main():
    path, w, h, x, runs_file, lo, hi = (
        sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]),
        sys.argv[5], int(sys.argv[6]), int(sys.argv[7]))

    runs = []
    for line in open(runs_file):
        a, b, y = line.split()[:3]
        runs.append((int(a), int(b), int(y)))

    H = int(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
         'stream=height', '-of', 'csv=p=0', path],
        stdout=subprocess.PIPE, check=True).stdout.strip())

    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-vf',
         f'crop={w}:{H}:{x}:0,scale=1:{H}:flags=area,format=gray',
         '-f', 'rawvideo', '-'], stdout=subprocess.PIPE, check=True).stdout
    frames = [raw[i:i + H] for i in range(0, len(raw) - H + 1, H)]

    worst, worstn = 0.0, None
    for a, b, y in runs:
        for n in range(max(a, lo), min(b, hi) + 1):
            if n >= len(frames):
                break
            band = frames[n][y - 2:y - 2 + h]
            if not band:
                continue
            spread = max(band) - min(band)
            if spread > worst:
                worst, worstn = spread, n
    print(f'{path}: widest row spread inside the box = {worst} '
          f'(frame {worstn}) over frames {lo}-{hi}')


main()
