import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { whereWindsMeetGuides } from "./content/where-winds-meet-guides";

type Language = "th" | "en";

const guildWarUrl =
  "https://script.google.com/macros/s/AKfycbzIFk8_ZNRQ5OiZ_n8pdAQKFfXu7S60iwrXlYvgvucrtY_KQ4LCb3fwzmsjI1-uizq9/exec";
const languageKey = "pom-language";

const copy = {
  th: {
    games: "Games",
    guildWar: "Guild War",
    playTogether: "เล่นด้วยกัน.",
    keepMemories: "เก็บความทรงจำไว้.",
    intro: "ศูนย์กลางของกิลด์สำหรับวางแผนการรบ ใช้เครื่องมือของเกม และเตรียมตัวให้พร้อมสำหรับการเล่นครั้งถัดไป",
    explore: "ไปที่ Where Winds Meet",
    manager: "เปิด Guild War Manager",
    noAccount: "เครื่องมือของกิลด์ในปัจจุบันยังไม่จำเป็นต้องมีบัญชี",
    playSpaces: "พื้นที่สำหรับการเล่น",
    chooseGame: "เลือกเกม",
    chooseGameHint: "แต่ละเกมจะมี Planner, Guides, Builds และเครื่องมือของกิลด์แยกเป็นของตัวเอง",
    activeGame: "เกมที่ใช้งานอยู่",
    gameCard: "วางแผน Guild War เตรียมทีม และแบ่งปันความรู้ร่วมกัน",
    comingLater: "เพิ่มภายหลัง",
    morePaths: "เส้นทางใหม่",
    morePathsHint: "สามารถเพิ่มเกมใหม่ได้โดยไม่ต้องเปลี่ยนโครงสร้างเว็บหลัก",
    gameHub: "ศูนย์รวมเกม",
    choosePath: "เลือกเส้นทางของคุณ",
    choosePathHint: "รวมเครื่องมือและความรู้แยกตามเกม เพื่อให้กิลด์ขยายต่อได้โดยไม่ทำให้หน้าเว็บยุ่งยาก",
    allGames: "เกมทั้งหมด",
    gameTools: "เครื่องมือของกิลด์",
    whereMeetHint: "รวมทุกอย่างที่กิลด์ใช้เตรียมตัวสำหรับ GVG ตั้งแต่แผนการรบแบบ Interactive ไปจนถึงการลงทะเบียนประจำสัปดาห์",
    planner: "แผนการรบแบบ Interactive, Timeline และช่วงเวลาสำคัญ",
    registration: "ลงทะเบียน War และเตรียมทีม",
    guildWarIntro: "ศูนย์รวมการลงทะเบียนและเตรียมทีมสำหรับรอบ War ปัจจุบัน",
    openRegister: "เปิดหน้าลงทะเบียน",
    openBuilder: "เปิด Team Builder",
    managerNote: "ยังไม่ต้อง login เพื่อเริ่มใช้งาน",
    nextRound: "รอบถัดไป",
    statusReady: "ระบบพร้อมใช้งาน",
    guidesPageTitle: "ความรู้ของกิลด์",
    guidesPageIntro: "รวมแนวทาง Tune และ Skill ที่คัดไว้สำหรับการเตรียมตัว GVG",
    searchGuides: "ค้นหา Guide...",
    reviewed: "ตัวอย่างที่คัดไว้",
    readyForMore: "พร้อมสำหรับเนื้อหาเพิ่มเติม",
    guidesTitle: "Guides และ Builds จะอยู่ที่นี่ในลำดับถัดไป",
    guidesHint: "ข้อมูล Tune, Mystic Skill, EX Skill, Command Skill และ Battlefield ที่ช่วยกันรวบรวมไว้ สามารถจัดระเบียบเป็น Guides ที่ค้นหาได้ โดยไม่ต้องเปลี่ยนโครงสร้างของเกมนี้",
    footer: "สร้างเพื่อกิลด์ Path of Memories",
    language: "ภาษา",
  },
  en: {
    games: "Games",
    guildWar: "Guild War",
    playTogether: "Play together.",
    keepMemories: "Keep the memories.",
    intro: "A shared home for our guild to plan battles, explore game tools, and make the next session easier to join.",
    explore: "Explore Where Winds Meet",
    manager: "Open Guild War Manager",
    noAccount: "No account is required for the current guild tools.",
    playSpaces: "PLAY SPACES",
    chooseGame: "Choose a game.",
    chooseGameHint: "Each game can have its own planners, guides, builds, and guild tools.",
    activeGame: "ACTIVE GAME",
    gameCard: "Guild War planning, team preparation, and shared knowledge.",
    comingLater: "COMING LATER",
    morePaths: "More paths",
    morePathsHint: "New games can be added without changing the guild hub.",
    gameHub: "GAME HUB",
    choosePath: "Choose your path.",
    choosePathHint: "Tools and knowledge are grouped by game, so the guild can grow without making the home page complicated.",
    allGames: "← All games",
    gameTools: "WHERE WINDS MEET · GUILD TOOLS",
    whereMeetHint: "Everything the guild uses for GVG preparation, from the interactive plan to weekly registration.",
    planner: "Interactive battle map, timeline, and key timings",
    registration: "Register for war and prepare teams",
    guildWarIntro: "One place to register and prepare teams for the current War round.",
    openRegister: "Open registration",
    openBuilder: "Open Team Builder",
    managerNote: "No login is required to get started.",
    nextRound: "NEXT ROUND",
    statusReady: "SYSTEM READY",
    guidesPageTitle: "Guild knowledge",
    guidesPageIntro: "Curated Tune and Skill notes for GVG preparation.",
    searchGuides: "Search guides...",
    reviewed: "CURATED STARTER SET",
    readyForMore: "READY FOR MORE",
    guidesTitle: "Guides and builds will live here next.",
    guidesHint: "The shared Tune, Mystic Skill, EX Skill, Command Skill, and battlefield notes can be cleaned up into searchable guides without changing this game structure.",
    footer: "Made for the Path of Memories guild",
    language: "Language",
  },
} as const;

function useLanguage(): [Language, (language: Language) => void] {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "th";
    return window.localStorage.getItem(languageKey) === "en" ? "en" : "th";
  });

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(languageKey, language);
  }, [language]);

  return [language, setLanguage];
}

function LanguageToggle({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <div className="language-toggle" role="group" aria-label={t.language}>
      <button className={language === "th" ? "active" : ""} type="button" onClick={() => onChange("th")} aria-pressed={language === "th"}>ไทย</button>
      <button className={language === "en" ? "active" : ""} type="button" onClick={() => onChange("en")} aria-pressed={language === "en"}>EN</button>
    </div>
  );
}

function ExternalMark() {
  return <span className="external-mark" aria-hidden="true">↗</span>;
}

function Shell({ children, language, onLanguageChange }: { children: ReactNode; language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Path of Memories home"><span className="brand-mark">P</span><span>Path of Memories</span></a>
        <div className="top-links">
          <a href="/games">{t.games}</a>
          <a href={guildWarUrl} target="_blank" rel="noreferrer">{t.guildWar} <ExternalMark /></a>
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </div>
      </nav>
      {children}
      <footer>{t.footer} · <span>pathofmemories.com</span></footer>
    </main>
  );
}

function HomePage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <p className="eyebrow">PATH OF MEMORIES · EST. 2026</p>
          <h1 id="welcome-heading">{t.playTogether}<br /><em>{t.keepMemories}</em></h1>
          <p className="intro">{t.intro}</p>
          <div className="hero-actions">
            <a className="primary-button" href="/games/where-winds-meet/">{t.explore} <span aria-hidden="true">→</span></a>
            <a className="secondary-button" href={guildWarUrl} target="_blank" rel="noreferrer">{t.manager} <ExternalMark /></a>
          </div>
          <p className="login-hint">{t.noAccount}</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="moon" /><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="lantern"><span /></div><div className="spark spark-one" /><div className="spark spark-two" /><div className="spark spark-three" /></div>
      </section>
      <section className="section-heading" aria-labelledby="games-heading">
        <div><p className="eyebrow">{t.playSpaces}</p><h2 id="games-heading">{t.chooseGame}</h2></div>
        <p>{t.chooseGameHint}</p>
      </section>
      <section className="game-grid" aria-label="Games">
        <a className="game-card game-card-active" href="/games/where-winds-meet/">
          <span className="game-card-kicker">{t.activeGame}</span><h3>Where Winds Meet</h3><p>{t.gameCard}</p><span className="card-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="game-card game-card-soon" aria-label={t.morePaths}>
          <span className="game-card-kicker">{t.comingLater}</span><h3>{t.morePaths}</h3><p>{t.morePathsHint}</p><span className="card-arrow" aria-hidden="true">＋</span>
        </div>
      </section>
    </Shell>
  );
}

function GamesPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro"><p className="eyebrow">{t.gameHub}</p><h1>{t.choosePath}</h1><p className="intro">{t.choosePathHint}</p></section>
      <section className="game-grid game-grid-wide" aria-label="Games">
        <a className="game-card game-card-active" href="/games/where-winds-meet/"><span className="game-card-kicker">{t.activeGame}</span><h3>Where Winds Meet</h3><p>{t.gameCard}</p><span className="card-arrow" aria-hidden="true">↗</span></a>
        <div className="game-card game-card-soon"><span className="game-card-kicker">{t.comingLater}</span><h3>{t.morePaths}</h3><p>{t.morePathsHint}</p><span className="card-arrow" aria-hidden="true">＋</span></div>
      </section>
    </Shell>
  );
}

function WhereWindsMeetPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  const tools = [
    { label: "GVG Planner", detail: t.planner, href: "/games/where-winds-meet/gvg-planner/", external: false },
    { label: "Guild War Manager", detail: t.registration, href: "/games/where-winds-meet/guild-war/", external: false },
    { label: "Guides", detail: t.guidesPageIntro, href: "/games/where-winds-meet/guides/", external: false },
  ];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro game-page-intro"><a className="back-link" href="/games">{t.allGames}</a><p className="eyebrow">{t.gameTools}</p><h1>Where Winds<br /><em>Meet.</em></h1><p className="intro">{t.whereMeetHint}</p></section>
      <section className="tool-list" aria-label="Where Winds Meet tools">
        {tools.map((tool) => <a className="tool-row" key={tool.label} href={tool.href} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noreferrer" : undefined}><span className="tool-icon" aria-hidden="true">✦</span><span className="tool-copy"><strong>{tool.label}</strong><small>{tool.detail}</small></span><span className="tool-arrow" aria-hidden="true">{tool.external ? "↗" : "→"}</span></a>)}
      </section>
      <section className="future-note"><p className="eyebrow">{t.readyForMore}</p><h2>{t.guidesTitle}</h2><p>{t.guidesHint}</p></section>
    </Shell>
  );
}

function GuildWarPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return <Shell language={language} onLanguageChange={onLanguageChange}>
    <section className="manager-hero">
      <div><a className="back-link" href="/games/where-winds-meet">← Where Winds Meet</a><p className="eyebrow">WHERE WINDS MEET · GUILD WAR</p><h1>Ready the<br /><em>guild.</em></h1><p className="intro">{t.guildWarIntro}</p></div>
      <aside className="manager-status"><span className="status-dot" /> <span>{t.statusReady}</span><strong>{t.nextRound}</strong><small>Saturday · 19:30 / 20:15 / 21:15 / 21:50</small></aside>
    </section>
    <section className="manager-actions" aria-label="Guild War actions">
      <a className="manager-action manager-action-primary" href={guildWarUrl} target="_blank" rel="noreferrer"><span>01</span><strong>{t.openRegister}</strong><small>Players, loadouts, role and availability <ExternalMark /></small></a>
      <div className="manager-action manager-action-muted"><span>02</span><strong>{t.openBuilder}</strong><small>Organizer access will be connected next</small><b>SOON</b></div>
    </section>
    <p className="manager-note">✦ {t.managerNote}</p>
  </Shell>;
}

function getGuides(language: Language) { return whereWindsMeetGuides[language]; }

function GuidesPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language]; const [query, setQuery] = useState(""); const [category, setCategory] = useState("All"); const guides = getGuides(language);
  const categories = ["All", ...guides.map((guide) => guide.category)];
  const visibleGuides = guides.filter((guide) => (category === "All" || guide.category === category) && `${guide.category} ${guide.title} ${guide.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Shell language={language} onLanguageChange={onLanguageChange}><section className="page-intro guides-intro"><a className="back-link" href="/games/where-winds-meet">← Where Winds Meet</a><p className="eyebrow">WHERE WINDS MEET · GUIDES</p><h1>{t.guidesPageTitle}</h1><p className="intro">{t.guidesPageIntro}</p></section><div className="guides-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t.searchGuides} placeholder={t.searchGuides} /><span>{t.reviewed}</span></div><div className="guide-filters" role="group" aria-label="Guide categories">{categories.map((item) => <button type="button" className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>{visibleGuides.length > 0 ? <section className="guide-grid" aria-label="Guides">{visibleGuides.map((guide) => <a className="guide-card" href={`/games/where-winds-meet/guides/${guide.slug}/`} key={guide.slug}><span className="guide-category">{guide.category}</span><h2>{guide.title}</h2><p>{guide.detail}</p><span className="guide-soon">V1 · READ ↗</span></a>)}</section> : <div className="guide-empty"><strong>{language === "th" ? "ยังไม่พบ Guide" : "No guides found"}</strong><span>{language === "th" ? "ลองเปลี่ยนคำค้นหาหรือเลือกทุกหมวด" : "Try another search or show all categories."}</span></div>}<p className="manager-note">✦ {language === "th" ? "ข้อมูลตั้งต้นจากชีตที่แนบมาและยังควรตรวจสอบกับ patch ล่าสุดก่อนเผยแพร่ถาวร" : "Starter content is based on the supplied sheet and should be checked against the latest patch before final publication."}</p></Shell>;
}

function GuideDetailPage({ slug, language, onLanguageChange }: { slug: string; language: Language; onLanguageChange: (language: Language) => void }) {
  const guide = getGuides(language).find((item) => item.slug === slug);
  if (!guide) return <GuidesPage language={language} onLanguageChange={onLanguageChange} />;
  return <Shell language={language} onLanguageChange={onLanguageChange}><section className="page-intro guides-intro"><a className="back-link" href="/games/where-winds-meet/guides/">← Guides</a><p className="eyebrow">{guide.category} · WHERE WINDS MEET</p><h1>{guide.title}</h1><p className="intro">{guide.detail}</p></section><article className="guide-detail">{guide.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="guide-detail-note">V1 · CURATED STARTER CONTENT</div></article></Shell>;
}

export default function App() {
  const [language, setLanguage] = useLanguage();
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/games") return <GamesPage language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet") return <WhereWindsMeetPage language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet/guides") return <GuidesPage language={language} onLanguageChange={setLanguage} />;
  if (path.startsWith("/games/where-winds-meet/guides/")) return <GuideDetailPage slug={path.split("/").filter(Boolean).pop() || ""} language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet/guild-war") return <GuildWarPage language={language} onLanguageChange={setLanguage} />;
  return <HomePage language={language} onLanguageChange={setLanguage} />;
}
