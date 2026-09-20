// The twelve reference glyphs of the Nestor icon family. Read base.tsx first:
// every other icon file matches the hand shown here.
import { createIcon, Wash } from "./base";

const HOUSE = (
  <>
    <Wash d="M4 21V12.5L14.5 3c3.5 1.5 5.5 4 5.5 7.5V21ZM9 21h6v-5a3 3 0 0 0-6 0Z" />
    <path d="M4 21V12.5L14.5 3c3.5 1.5 5.5 4 5.5 7.5V21Z" />
    <path d="M9 21v-5a3 3 0 0 1 6 0v5" />
  </>
);

/** The mark itself: slanted roofline, rounded shoulder, arched doorway. */
export const House = createIcon("House", HOUSE);
export const Home = createIcon("Home", HOUSE);

export const FileText = createIcon(
  "FileText",
  <>
    <Wash d="M6.5 3H15l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z" />
    <path d="M6.5 3H15l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z" />
    <path d="M9 10h6M9 13.5h6M9 17h3.5" />
  </>,
);

export const CalendarDays = createIcon(
  "CalendarDays",
  <>
    <Wash d="M5 5h11.5l4 4v1h-17V6.5A1.5 1.5 0 0 1 5 5Z" />
    <path d="M5 5h11.5l4 4v10.5A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5Z" />
    <path d="M3.5 10h17M8 3v4M13.5 3v4" />
    <path d="M8 15.5h.01M12 15.5h.01M16 15.5h.01" />
  </>,
);

export const Mail = createIcon(
  "Mail",
  <>
    <Wash d="M4.5 5H17l2.5 2.5L12 13 3.5 6.5A1.5 1.5 0 0 1 4.5 5Z" />
    <path d="M4.5 5H17l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" />
    <path d="M3.5 6.5 12 13l7.5-5.5" />
  </>,
);

export const Search = createIcon(
  "Search",
  <>
    <Wash d="M17.5 10.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="m15.5 15.5 5.5 5.5" />
  </>,
);

export const Check = createIcon("Check", <path d="m4.5 12.5 5 5 10-11" />);

export const ArrowRight = createIcon("ArrowRight", <path d="M4 12h16M13.5 5.5 20 12l-6.5 6.5" />);

const KEY_BOW = "M3 15.5V10a4.5 4.5 0 0 1 9 0v5.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z";

/** A key lying flat, as in the landing motif: the bow is the Nestor doorway with softened feet. */
export const KeyRound = createIcon(
  "KeyRound",
  <>
    <Wash d={KEY_BOW} />
    <path d={KEY_BOW} />
    <path d="M12 12.5h9v4M17 12.5v3" />
    <path d="M7.5 10.5h.01" />
  </>,
);

export const ShieldCheck = createIcon(
  "ShieldCheck",
  <>
    <Wash d="M6.5 3H15l4 4v5c0 4.5-2.9 7.6-7 9-4.1-1.4-7-4.5-7-9V4.5A1.5 1.5 0 0 1 6.5 3Z" />
    <path d="M6.5 3H15l4 4v5c0 4.5-2.9 7.6-7 9-4.1-1.4-7-4.5-7-9V4.5A1.5 1.5 0 0 1 6.5 3Z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);

/** Two flaring barrels with arched eyepieces, a hinge between them, and the lens rings as the wash. */
export const Binoculars = createIcon(
  "Binoculars",
  <>
    <Wash d="M10.5 16.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM21 16.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    <path d="M3 16.5 5 6a2 2 0 0 1 4 0l1.5 10.5M13.5 16.5 15 6a2 2 0 0 1 4 0l2 10.5" />
    <circle cx="6.75" cy="16.75" r="3.75" />
    <circle cx="17.25" cy="16.75" r="3.75" />
    <path d="M9.5 9h5M10 12h4" />
  </>,
);

/** A three-quarter open arc at full ink, on the RefreshCw circle. Spin it with animate-spin. */
export const Loader2 = createIcon("Loader2", <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />);
