/*
 * NESTOR ICON FAMILY: STYLE SPEC (final, follow exactly)
 * =====================================================================
 * Drawn for Nestor from the logo mark (src/assets/mark.png): a doorway with
 * an ARCHED opening under a SLANTED roofline, in solid geometric forms.
 * Every icon is a drop-in for the lucide export of the same name.
 *
 * GRID
 * - viewBox 0 0 24 24. Live area 20 x 20: nothing is drawn outside x/y 2..22
 *   (stroke centre lines stay within 2.85..21.15 so the round caps fit).
 * - Tall glyphs span y 3..21, wide glyphs x 3..21. Square-ish glyphs fill
 *   about 18 x 18. Centre the glyph optically on (12, 12).
 * - Snap coordinates to 0.5. Ground lines sit on y = 21 or y = 20.
 *
 * STROKE
 * - fill none, stroke currentColor, strokeWidth 1.7, round caps, round joins.
 *   Never override the stroke width on a single element.
 * - Never hard-code a colour. Colour and size come from the parent className.
 * - "Dots" (calendar days, keyholes, eyes) are zero-length strokes:
 *   d="M8 14h.01". They render as a 1.7 unit round dot. Never a tiny circle.
 * - Minimum gap between two parallel strokes: 2.5 units centre to centre
 *   (3 is better). Below that they fuse at 16px.
 *
 * SIGNATURE 1: THE ARCH (first choice for any container)
 * - A door, window, panel, card, barrel, bottle, lock body, inbox, bed head,
 *   key bow, person's shoulders: draw it as a DOORWAY. Straight sides, flat
 *   bottom, and a top that is a full semicircle whose radius is exactly half
 *   the width:   M x0 yB  V yS  a r r 0 0 1 2r 0  V yB   (yS = spring line).
 *   Width 6 means r 3, width 14 means r 7. Never a flattened or pointed arch.
 * - Bottom corners of a doorway are square (the round join softens them).
 *   A doorway that carries the wash is always CLOSED with Z, so the tint is
 *   bounded by ink on every side. Only an unwashed doorway that stands inside
 *   a larger closed shape (the House door) is left open at the bottom.
 * - A key bow may soften its two feet with 2 unit arcs (KeyRound), so it reads
 *   as a key head and not as a house on a stick.
 *
 * SIGNATURE 2: THE GABLE CUT (for boxes that cannot take an arch)
 * - Documents, calendars, envelopes, cards, tags, shields, clipboards: a
 *   rectangle whose TOP-RIGHT corner is chamfered at 45 degrees.
 *   Cut size: 4 x 4 units on glyphs 14 units wide or more, 3 x 3 on smaller
 *   boxes. The two cut vertices are sharp (no arc); the other three corners
 *   use a 1.5 unit radius arc.
 *   Standard document (x 5..19, y 3..21):
 *     M6.5 3H15l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z
 *   Standard wide card (x 3..21, y 5..19, used by Mail, IdCard, Wallet...):
 *     M4.5 5H17l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z
 *   NEVER draw lucide's folded dog-ear line inside the cut. Inner strokes
 *   that run to the cut end on its midpoint (see the Mail flap).
 * - One cut per glyph, always top-right. The cut box itself never also takes
 *   an arched top. A separate handle or shackle above the box may be an arch
 *   (Lock, Briefcase, Trash2), but it must land at least 2.5 units clear of
 *   the cut so the joint stays clean.
 * - Boxes narrower than 14 units take the 3 x 3 cut (ScrollText, Copy, Tag).
 * - The House glyph alone uses the mark's true roofline: a long straight
 *   slope rising from the left eave to a peak well right of centre (x 14.5,
 *   so the asymmetry survives at 16px), then a rounded right shoulder.
 *   Anything meaning home, listing or property reuses it:
 *     wall  M4 21V12.5L14.5 3c3.5 1.5 5.5 4 5.5 7.5V21Z
 *     door  M9 21v-5a3 3 0 0 1 6 0v5   (width 6, r 3: stays open at 14px)
 *   A tapering form (binocular barrel, bottle, flask) keeps an arched cap.
 *
 * SIGNATURE 3: THE WASH
 * - At most ONE <Wash d="..."/> per icon: a flat tint, fill currentColor at
 *   0.16 opacity, no stroke, evenodd fill rule (so a doorway can be punched
 *   out of a wall, exactly as in the mark). Put it FIRST so strokes sit on top.
 * - The wash marks the MASS of the object: the wall of the house, the header
 *   band of a calendar, the flap of an envelope, the lens of a magnifier,
 *   the bow of a key, the body of a shield. It traces the same centre-line
 *   geometry as the stroke around it; never let it spill past a stroke, and
 *   never let it end on an edge that has no stroke. If the outline is open
 *   (ExternalLink) the icon takes no wash. The one tolerated gap is the
 *   5 unit opening in the UploadCloud base, which the arrow shaft occupies.
 *   One path may contain two sub-shapes when the object is a pair
 *   (binocular lenses), but that is the limit.
 * - Pure line glyphs take NO wash: arrows, chevrons, check, x, plus, minus,
 *   menu, link, refresh, loader. Loader2 is a single 270 degree arc at full
 *   ink on the RefreshCw circle (r 8.5): no faint track, it vanished on
 *   buttons.
 * - Arrow heads: 6.5 unit arms. ArrowUpRight, which is the whole glyph, takes
 *   9 unit arms; an arrow used as a badge on a box (ExternalLink) keeps 6.5.
 * - Works as ink on paper and as white on forest with no changes.
 *
 * PEOPLE
 * - Head radius is half the shoulder radius: solo figure head r 3.25 at
 *   (12, 7.5) over shoulders M5.5 21v-1a6.5 6.5 0 0 1 13 0v1Z; in Users the
 *   front figure is r 3 over r 6, the back one r 2.5 over r 4. Shoulders are
 *   a CLOSED doorway arch and carry the wash. No faces, no necks, no hair.
 *   A second person is a smaller arch behind, standing on the same ground.
 *
 * DOCUMENTS
 * - Gable-cut box x 5..19, y 3..21 (see above). Text is two or three
 *   horizontal lines starting at x 9, spaced 3.5 apart, the last one shorter.
 *   The first line stops 2.5 units before the cut. Wash the whole page only
 *   when there is no other candidate; prefer washing a band or a badge.
 *
 * DO
 * - Keep to five stroked elements plus the wash. Merge sub-paths with M.
 * - Keep conventional meaning first: an arrow points where its name says,
 *   a check is a check. Distinctive is good, unrecognisable is a failure.
 * - Check every icon at 16px on paper and at 20px white on forest.
 *
 * DO NOT
 * - No text, gradients, filters, masks, clip paths, ids, classes, styles.
 * - No pitched-roof-and-chimney house, no four-equal-corner rounded squares,
 *   no lucide path data, no detail under 2 units, no second wash.
 * - No default exports. One icon = one createIcon call under the exact
 *   lucide export name.
 * =====================================================================
 */
import type { JSX, ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/** Builds an icon component with the same calling convention as lucide. */
export function createIcon(displayName: string, children: ReactNode): (props: IconProps) => JSX.Element {
  function Icon(props: IconProps): JSX.Element {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        {children}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/** The single flat tint an icon may carry. Place it before the strokes. */
export function Wash({ d }: { d: string }): JSX.Element {
  return <path d={d} fill="currentColor" fillOpacity={0.16} fillRule="evenodd" stroke="none" />;
}
