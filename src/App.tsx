const destinations = [
  { label: "Guild War", detail: "Plan rosters and match preparation", icon: "⚔" },
  { label: "Members", detail: "A private space for the guild", icon: "✦" },
  { label: "Games", detail: "Guides, builds, and shared knowledge", icon: "◈" },
];

export default function App() {
  return <main className="page-shell">
    <nav className="topbar" aria-label="Primary navigation">
      <a className="brand" href="/" aria-label="Path of Memories home"><span className="brand-mark">P</span><span>Path of Memories</span></a>
      <span className="access-note">Private guild hub</span>
    </nav>
    <section className="hero" aria-labelledby="welcome-heading">
      <div className="hero-copy">
        <p className="eyebrow">PATH OF MEMORIES · EST. 2026</p>
        <h1 id="welcome-heading">Play together.<br /><em>Keep the memories.</em></h1>
        <p className="intro">A private home for our guild to organize battles, share builds, and make the next session easier to join.</p>
        <button className="primary-button" type="button" disabled>Discord login coming soon <span aria-hidden="true">→</span></button>
        <p className="login-hint">Access will be limited to verified Path of Memories members.</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="moon" /><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="lantern"><span /></div><div className="spark spark-one" /><div className="spark spark-two" /><div className="spark spark-three" /></div>
    </section>
    <section className="destinations" aria-label="Planned guild areas">
      {destinations.map((destination) => <article className="destination-card" key={destination.label}><span className="card-icon" aria-hidden="true">{destination.icon}</span><div><h2>{destination.label}</h2><p>{destination.detail}</p></div><span className="card-arrow" aria-hidden="true">↗</span></article>)}
    </section>
    <footer>Made for the Path of Memories guild · <span>pathofmemories.com</span></footer>
  </main>;
}
