// Controls: arrows, chevrons, close, add, remove, menu, links, copy, refresh.
// Read base.tsx first. Arrow heads match the exemplar ArrowRight: 6.5 unit
// arms at 45 degrees on a 16 unit shaft. Pure line glyphs carry no wash.
import { createIcon, Wash } from "./base";

export const ArrowDown = createIcon("ArrowDown", <path d="M12 4v16M5.5 13.5 12 20l6.5-6.5" />);

export const ArrowLeft = createIcon("ArrowLeft", <path d="M20 12H4M10.5 5.5 4 12l6.5 6.5" />);

/** The ArrowRight turned 45 degrees: same shaft length, same head arms. */
export const ArrowUpRight = createIcon("ArrowUpRight", <path d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9" />);

export const ChevronDown = createIcon("ChevronDown", <path d="M5.5 9 12 15.5 18.5 9" />);

export const ChevronsLeft = createIcon("ChevronsLeft", <path d="M11.5 6.5 6 12l5.5 5.5M18 6.5 12.5 12l5.5 5.5" />);

export const ChevronsRight = createIcon("ChevronsRight", <path d="M12.5 6.5 18 12l-5.5 5.5M6 6.5l5.5 5.5L6 17.5" />);

export const X = createIcon("X", <path d="M6 6l12 12M18 6 6 18" />);

export const Plus = createIcon("Plus", <path d="M12 4.5v15M4.5 12h15" />);

export const Minus = createIcon("Minus", <path d="M4.5 12h15" />);

/** Three rules set like the text lines of a Nestor document: the last runs short. */
export const Menu = createIcon("Menu", <path d="M4 6.5h16M4 12h16M4 17.5h10" />);

/** A card left open where the gable cut would be; the arrow leaves through it. No wash: nothing bounds one. */
export const ExternalLink = createIcon(
  "ExternalLink",
  <>
    <path d="M13 7H4.5A1.5 1.5 0 0 0 3 8.5v11A1.5 1.5 0 0 0 4.5 21h11a1.5 1.5 0 0 0 1.5-1.5V11" />
    <path d="M10 14 21 3M14.5 3H21v6.5" />
  </>,
);

/** Link2 laid on the rising diagonal: two facing arches with true semicircle ends, pinned by one bar. */
export const Link = createIcon(
  "Link",
  <g transform="rotate(-45 12 12)">
    <path d="M9 8.5H6.5a3.5 3.5 0 0 0 0 7H9M15 8.5h2.5a3.5 3.5 0 0 1 0 7H15M8 12h8" />
  </g>,
);

/** One link seen flat: two sideways arches joined by a bar. */
export const Link2 = createIcon(
  "Link2",
  <path d="M9.5 7.5H8a4.5 4.5 0 0 0 0 9h1.5M14.5 7.5H16a4.5 4.5 0 0 1 0 9h-1.5M8.5 12h7" />,
);

/** Two sheets. The front one takes the gable cut and the wash; the back one stays plain (one cut per glyph). */
export const Copy = createIcon(
  "Copy",
  <>
    <Wash d="M10.5 9H18l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 9 19.5v-9A1.5 1.5 0 0 1 10.5 9Z" />
    <path d="M10.5 9H18l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 9 19.5v-9A1.5 1.5 0 0 1 10.5 9Z" />
    <path d="M6 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V6" />
  </>,
);

/** Two clockwise arcs on the Loader2 circle, each ending in a corner head. */
export const RefreshCw = createIcon(
  "RefreshCw",
  <>
    <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6l2.5 2.5M20.5 3.5v5h-5" />
    <path d="M20.5 12a8.5 8.5 0 0 1-14.5 6l-2.5-2.5M3.5 20.5v-5h5" />
  </>,
);
