import type { ReactNode } from "react";

const guildWarUrl =
  "https://script.google.com/macros/s/AKfycbzIFk8_ZNRQ5OiZ_n8pdAQKFfXu7S60iwrXlYvgvucrtY_KQ4LCb3fwzmsjI1-uizq9/exec";

type LinkItem = {
  label: string;
  detail: string;
  href: string;
  external?: boolean;
};

const whereWindsMeetTools: LinkItem[] = [
  {
    label: "GVG Planner",
    detail: "Interactive battle map, timeline, and key timings",
    href: "/games/where-winds-meet/gvg-planner/",
  },
  {
    label: "Guild War Manager",
    detail: "Register for war and prepare teams",
    href: guildWarUrl,
    external: true,
  },
];

function ExternalMark() {
  return <span className="external-mark" aria-hidden="true">↗</span>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Path of Memories home">
          <span className="brand-mark">P</span>
          <span>Path of Memories</span>
        </a>
        <div className="top-links">
          <a href="/games">Games</a>
          <a href={guildWarUrl} target="_blank" rel="noreferrer">Guild War <ExternalMark /></a>
        </div>
      </nav>
      {children}
      <footer>Made for the Path of Memories guild · <span>pathofmemories.com</span></footer>
    </main>
  );
}

function HomePage() {
  return (
    <Shell>
      <section className="hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <p className="eyebrow">PATH OF MEMORIES · EST. 2026</p>
          <h1 id="welcome-heading">Play together.<br /><em>Keep the memories.</em></h1>
          <p className="intro">A shared home for our guild to plan battles, explore game tools, and make the next session easier to join.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/games/where-winds-meet/">Explore Where Winds Meet <span aria-hidden="true">→</span></a>
            <a className="secondary-button" href={guildWarUrl} target="_blank" rel="noreferrer">Guild War Manager <ExternalMark /></a>
          </div>
          <p className="login-hint">No account is required for the current guild tools.</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="moon" /><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="lantern"><span /></div><div className="spark spark-one" /><div className="spark spark-two" /><div className="spark spark-three" /></div>
      </section>
      <section className="section-heading" aria-labelledby="games-heading">
        <div><p className="eyebrow">PLAY SPACES</p><h2 id="games-heading">Choose a game.</h2></div>
        <p>Each game can have its own planners, guides, builds, and guild tools.</p>
      </section>
      <section className="game-grid" aria-label="Games">
        <a className="game-card game-card-active" href="/games/where-winds-meet/">
          <span className="game-card-kicker">ACTIVE GAME</span>
          <h3>Where Winds Meet</h3>
          <p>Guild War planning, team preparation, and shared knowledge.</p>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="game-card game-card-soon" aria-label="More games coming soon">
          <span className="game-card-kicker">COMING LATER</span>
          <h3>More paths</h3>
          <p>New games can be added without changing the guild hub.</p>
          <span className="card-arrow" aria-hidden="true">＋</span>
        </div>
      </section>
    </Shell>
  );
}

function GamesPage() {
  return (
    <Shell>
      <section className="page-intro">
        <p className="eyebrow">GAME HUB</p>
        <h1>Choose your<br /><em>path.</em></h1>
        <p className="intro">Tools and knowledge are grouped by game, so the guild can grow without making the home page complicated.</p>
      </section>
      <section className="game-grid game-grid-wide" aria-label="Games">
        <a className="game-card game-card-active" href="/games/where-winds-meet/">
          <span className="game-card-kicker">ACTIVE GAME</span>
          <h3>Where Winds Meet</h3>
          <p>GVG Planner, Guild War registration, builds, and guides.</p>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="game-card game-card-soon">
          <span className="game-card-kicker">COMING LATER</span>
          <h3>Another game</h3>
          <p>This slot is ready for the next game our guild plays together.</p>
          <span className="card-arrow" aria-hidden="true">＋</span>
        </div>
      </section>
    </Shell>
  );
}

function WhereWindsMeetPage() {
  return (
    <Shell>
      <section className="page-intro game-page-intro">
        <a className="back-link" href="/games">← All games</a>
        <p className="eyebrow">WHERE WINDS MEET · GUILD TOOLS</p>
        <h1>Where Winds<br /><em>Meet.</em></h1>
        <p className="intro">Everything the guild uses for GVG preparation, from the interactive plan to weekly registration.</p>
      </section>
      <section className="tool-list" aria-label="Where Winds Meet tools">
        {whereWindsMeetTools.map((tool) => (
          <a className="tool-row" key={tool.label} href={tool.href} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noreferrer" : undefined}>
            <span className="tool-icon" aria-hidden="true">✦</span>
            <span className="tool-copy"><strong>{tool.label}</strong><small>{tool.detail}</small></span>
            <span className="tool-arrow" aria-hidden="true">{tool.external ? "↗" : "→"}</span>
          </a>
        ))}
      </section>
      <section className="future-note">
        <p className="eyebrow">READY FOR MORE</p>
        <h2>Guides and builds will live here next.</h2>
        <p>The shared Tune, Mystic Skill, EX Skill, Command Skill, and battlefield notes can be cleaned up into searchable guides without changing this game structure.</p>
      </section>
    </Shell>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/games") return <GamesPage />;
  if (path === "/games/where-winds-meet") return <WhereWindsMeetPage />;
  return <HomePage />;
}
