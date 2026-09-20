// Nestor icons: mail, files, search variants, calendar variants and time.
// Follows the style spec in base.tsx and the hand shown in exemplars.tsx.
import { createIcon, Wash } from "./base";

/** The exemplar Mail with its lower right corner opened for a check. */
export const MailCheck = createIcon(
  "MailCheck",
  <>
    <Wash d="M4.5 5H17l2.5 2.5L12 13 3.5 6.5A1.5 1.5 0 0 1 4.5 5Z" />
    <path d="M10.5 19h-6A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5H17l4 4v2.5" />
    <path d="M3.5 6.5 12 13l7.5-5.5" />
    <path d="m13.5 17.5 2.5 2.5 5-5.5" />
  </>,
);

/** The Mail card holding a tray: wider than tall, so it never reads as the House. The tray is the wash. */
export const Inbox = createIcon(
  "Inbox",
  <>
    <Wash d="M3 12h5l1.5 3h5l1.5-3h5v5.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
    <path d="M4.5 5H17l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" />
    <path d="M3 12h5l1.5 3h5l1.5-3h5" />
  </>,
);

/** Paper plane heading up and to the right; the far wing is the wash. */
export const Send = createIcon(
  "Send",
  <>
    <Wash d="M21 3 10 14l3.5 7Z" />
    <path d="M21 3 3 10.5l7 3.5 3.5 7Z" />
    <path d="M10 14 21 3" />
  </>,
);

export const AtSign = createIcon(
  "AtSign",
  <>
    <Wash d="M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M15.5 8.5v5a2.75 2.75 0 0 0 5.5 0V12a9 9 0 1 0-3.6 7.2" />
  </>,
);

// Built on circles centred (21, 3): back r 18, pads r 10.5, grip r 14.5. Every outer corner is a 1.5 arc.
const HANDSET =
  "M4.6 4.7 9.1 4.3a1.5 1.5 0 0 1 1.7 1.3 10.5 10.5 0 0 0 .9 2.3 1.5 1.5 0 0 1-.4 2.2l-2 1.4a14.5 14.5 0 0 0 3.2 3.2l1.4-2a1.5 1.5 0 0 1 2.2-.4 10.5 10.5 0 0 0 2.3.9 1.5 1.5 0 0 1 1.3 1.7l-.4 4.5a1.5 1.5 0 0 1-1.7 1.3A18 18 0 0 1 3.3 6.4a1.5 1.5 0 0 1 1.3-1.7Z";

/** A classic handset: a quarter-ring grip between two soft pads. */
export const Phone = createIcon(
  "Phone",
  <>
    <Wash d={HANDSET} />
    <path d={HANDSET} />
  </>,
);

/** The FileText page, opened at the lower right for the Search lens. */
export const FileSearch = createIcon(
  "FileSearch",
  <>
    <Wash d="M18 15a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
    <path d="M11 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H15l4 4v3" />
    <circle cx="14.5" cy="15" r="3.5" />
    <path d="m17 17.5 3.5 3.5M9 8.5h3.5" />
  </>,
);

/** The gable-cut page curling into a roll at the foot; the roll is the wash. */
export const ScrollText = createIcon(
  "ScrollText",
  <>
    <Wash d="M9 16h9.5a2.5 2.5 0 0 1 0 5h-12A2.5 2.5 0 0 0 9 18.5Z" />
    <path d="M16.5 16V6l-3-3h-8A1.5 1.5 0 0 0 4 4.5v14a2.5 2.5 0 0 0 5 0V16h9.5a2.5 2.5 0 0 1 0 5h-12" />
    <path d="M7.5 8.5h6M7.5 12h3.5" />
  </>,
);

/** Scan frame whose top right bracket takes the gable cut, around the lens. */
export const ScanSearch = createIcon(
  "ScanSearch",
  <>
    <Wash d="M15.5 11.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    <path d="M3 7.5v-3A1.5 1.5 0 0 1 4.5 3h3M16.5 3H18l3 3v1.5M21 16.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M7.5 21h-3A1.5 1.5 0 0 1 3 19.5v-3" />
    <circle cx="11.5" cy="11.5" r="4" />
    <path d="m14.5 14.5 3 3" />
  </>,
);

export const SearchX = createIcon(
  "SearchX",
  <>
    <Wash d="M17.5 10.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="m15.5 15.5 5.5 5.5M8 8l5 5M13 8l-5 5" />
  </>,
);

const CLOUD = "h-3a3.25 3.25 0 0 1 0-6.5 5.5 5.5 0 0 1 11 0 3.25 3.25 0 0 1 0 6.5h-3";

/** A cloud of three true semicircle arches on a flat base, which opens for the rising arrow. */
export const UploadCloud = createIcon(
  "UploadCloud",
  <>
    <Wash d={`M9.5 16.5${CLOUD}Z`} />
    <path d={`M9.5 16.5${CLOUD}`} />
    <path d="M12 21v-9.5M9 14.5l3-3 3 3" />
  </>,
);

/** The sheet feeding in at the top carries the gable cut. */
export const Printer = createIcon(
  "Printer",
  <>
    <Wash d="M4.5 8h15A1.5 1.5 0 0 1 21 9.5v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-6A1.5 1.5 0 0 1 4.5 8ZM7 13.5h10V17H7Z" />
    <path d="M7 8V4.5A1.5 1.5 0 0 1 8.5 3H14l3 3v2" />
    <path d="M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-6A1.5 1.5 0 0 1 4.5 8h15A1.5 1.5 0 0 1 21 9.5v6a1.5 1.5 0 0 1-1.5 1.5H17" />
    <path d="M7 13.5h10V21H7Z" />
    <path d="M17.5 11h.01" />
  </>,
);

export const CalendarCheck = createIcon(
  "CalendarCheck",
  <>
    <Wash d="M5 5h11.5l4 4v1h-17V6.5A1.5 1.5 0 0 1 5 5Z" />
    <path d="M5 5h11.5l4 4v10.5A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5Z" />
    <path d="M3.5 10h17M8 3v4M13.5 3v4" />
    <path d="m8.5 15.5 2.5 2.5 4.5-5" />
  </>,
);

export const CalendarClock = createIcon(
  "CalendarClock",
  <>
    <Wash d="M5 5h11.5l4 4v1h-17V6.5A1.5 1.5 0 0 1 5 5Z" />
    <path d="M10 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5h11.5l4 4v1" />
    <path d="M3.5 10h17M8 3v4M13.5 3v4" />
    <circle cx="16.5" cy="16.5" r="4.5" />
    <path d="M16.5 14v2.5l1.75 1" />
  </>,
);

export const CalendarPlus = createIcon(
  "CalendarPlus",
  <>
    <Wash d="M5 5h11.5l4 4v1h-17V6.5A1.5 1.5 0 0 1 5 5Z" />
    <path d="M5 5h11.5l4 4v10.5A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5Z" />
    <path d="M3.5 10h17M8 3v4M13.5 3v4" />
    <path d="M12 12.5v6M9 15.5h6" />
  </>,
);

/** Two doorway arches meeting at the neck; the settled sand is the wash. */
export const Hourglass = createIcon(
  "Hourglass",
  <>
    <Wash d="M6 21v-3a6 6 0 0 1 12 0v3Z" />
    <path d="M5 3h14M5 21h14" />
    <path d="M6 3v3a6 6 0 0 0 12 0V3M6 21v-3a6 6 0 0 1 12 0v3" />
  </>,
);
