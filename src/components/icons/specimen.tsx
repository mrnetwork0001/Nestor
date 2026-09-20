// Dev-only specimen sheet for the Nestor icon family, served by the Vite dev
// server at /dev/icons.html. It is not imported by the app, so it never ships.
// Optional query: ?q=substring filters by name, ?mark=1 shows the logo mark.
import { createRoot } from "react-dom/client";
import type { IconProps } from "./base";
import markUrl from "../../assets/mark.png";
import "../../index.css";

type IconComponent = ((props: IconProps) => React.JSX.Element) & { displayName?: string };

const modules = import.meta.glob<Record<string, unknown>>("./*.tsx", { eager: true });

const icons: Array<{ name: string; Icon: IconComponent }> = [];
for (const [path, mod] of Object.entries(modules)) {
  if (path.endsWith("/base.tsx") || path.endsWith("/specimen.tsx")) continue;
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value !== "function" || !/^[A-Z]/.test(name)) continue;
    if (typeof (value as IconComponent).displayName !== "string") continue;
    icons.push({ name, Icon: value as IconComponent });
  }
}

const params = new URLSearchParams(window.location.search);
const query = (params.get("q") ?? "").toLowerCase();
const showMark = params.get("mark") === "1";
const shown = icons
  .filter(({ name }) => name.toLowerCase().includes(query))
  .sort((a, b) => a.name.localeCompare(b.name));

const SIZES = [16, 20, 24, 40];

// Inline styles on purpose: the sheet must not depend on which utility
// classes Tailwind happens to have generated for the app.
const INK = "var(--color-ink)";

function Specimen() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-paper)", color: INK, padding: 28 }}>
      <header style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        {showMark && <img src={markUrl} alt="Nestor mark" style={{ height: 64, width: "auto" }} />}
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-forest-deep)" }}>
            Nestor icons
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
            {shown.length} glyphs at 16, 20, 24 and 40px on paper, and 20px on forest.
          </p>
        </div>
      </header>
      <div
        id="icon-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}
      >
        {shown.map(({ name, Icon }) => (
          <figure
            key={name}
            style={{
              margin: 0,
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--color-line)",
              background: "var(--color-paper)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, height: 44 }}>
              {SIZES.map((size) => (
                <Icon key={size} style={{ width: size, height: size, flexShrink: 0, color: INK }} />
              ))}
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  background: "var(--color-forest)",
                }}
              >
                <Icon style={{ width: 20, height: 20, color: "#fff" }} />
              </span>
            </div>
            <figcaption style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: "var(--color-ink-soft)" }}>
              {name}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Specimen />);
