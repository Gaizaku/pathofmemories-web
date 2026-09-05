import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { whereWindsMeetGuides } from "./content/where-winds-meet-guides";
import { GuildWarRegistration } from "./GuildWarRegistration";

type Language = "th" | "en";

const guildWarUrl =
  "https://script.google.com/macros/s/AKfycbzIFk8_ZNRQ5OiZ_n8pdAQKFfXu7S60iwrXlYvgvucrtY_KQ4LCb3fwzmsjI1-uizq9/exec";
const languageKey = "pom-language";

const copy = {
  th: {
    language: "ภาษา",
    discord: "Discord",
    world: "Where Winds Meet",
    homeKicker: "แคมป์ของพวกเรา · EST. 2026",
    playTogether: "คืนนี้ มาเล่นด้วยกัน",
    keepMemories: "แล้วสร้างความทรงจำใหม่",
    intro: "บ้านเล็ก ๆ ของชาว Path of Memories สำหรับนัดหมาย วางแผน และแบ่งปันสิ่งที่ค้นพบระหว่างการผจญภัย",
    explore: "เข้าสู่ Where Winds Meet",
    noAccount: "เปิดใช้เครื่องมือได้ทันที · ไม่ต้องเข้าสู่ระบบ",
    playSpaces: "เส้นทางคืนนี้",
    chooseGame: "ทุกอย่างที่กิลด์ใช้ อยู่ตรงนี้",
    chooseGameHint: "เลือกสิ่งที่ต้องการแล้วไปต่อได้เลย ไม่ต้องผ่านเมนูหลายชั้น",
    activeGame: "โลกที่กำลังเล่น",
    gameCard: "วางแผน Guild War เตรียมทีม และแบ่งปันความรู้ร่วมกัน",
    gameHub: "โลกของกิลด์",
    choosePath: "เลือกโลกที่จะออกเดินทาง",
    choosePathHint: "ตอนนี้พวกเราอยู่ใน Where Winds Meet และโครงสร้างนี้พร้อมรองรับเกมอื่นในอนาคต",
    allGames: "← กลับหน้าหลัก",
    gameTools: "WHERE WINDS MEET · GUILD CAMP",
    whereMeetHint: "เครื่องมือที่จำเป็นสำหรับ GVG รวมไว้ในที่เดียว เลือกได้ทันทีว่าจะดูแผน ลงทะเบียน หรืออ่าน Guides",
    planner: "เปิดแผนที่ Interactive, Timeline และจังหวะสำคัญของสนามรบ",
    registration: "ลงทะเบียนรอบ War และเตรียมข้อมูลสำหรับจัดทีม",
    guildWarIntro: "ลงชื่อเข้าร่วมรอบถัดไปและเช็กเวลานัดหมายได้จากจุดเดียว",
    openRegister: "ไปหน้าลงทะเบียน",
    openBuilder: "Team Builder",
    managerNote: "เริ่มใช้งานได้โดยไม่ต้อง Login",
    nextRound: "รอบถัดไป",
    statusReady: "พร้อมใช้งาน",
    guidesPageTitle: "บันทึกจากคนในกิลด์",
    guidesPageIntro: "รวมแนวทาง Tune, Skill และเทคนิคที่ช่วยกันค้นพบสำหรับการเตรียมตัว GVG",
    searchGuides: "ค้นหา Guides...",
    reviewed: "เนื้อหาที่จัดไว้แล้ว",
    footer: "สร้างไว้ให้ชาว Path of Memories",
    share: "แชร์หน้านี้",
    copied: "คัดลอกแล้ว",
    discordTitle: "เจอกันต่อใน Discord",
    discordIntro: "พื้นที่สำหรับประกาศ นัดหมาย และพูดคุยกันของชาว Path of Memories",
    discordServer: "เซิร์ฟเวอร์ของกิลด์",
    discordServerHint: "ทางเข้าหลักสำหรับพบสมาชิกและติดตามประกาศ",
    discordChannels: "ห้องที่ใช้บ่อย",
    discordChannelsHint: "GVG · Guides · Announcements",
    bannerAlt: "สมาชิก Path of Memories รวมตัวกันรอบกองไฟใต้ท้องฟ้ายามค่ำ",
  },
  en: {
    language: "Language",
    discord: "Discord",
    world: "Where Winds Meet",
    homeKicker: "OUR GUILD CAMP · EST. 2026",
    playTogether: "Gather here tonight",
    keepMemories: "and make a new memory",
    intro: "A small home for Path of Memories to meet, plan, and share everything we discover along the way.",
    explore: "Enter Where Winds Meet",
    noAccount: "Open the guild tools instantly · No login required",
    playSpaces: "TONIGHT'S PATHS",
    chooseGame: "Everything the guild needs, in one place",
    chooseGameHint: "Choose what you need and continue without digging through layers of menus.",
    activeGame: "CURRENT WORLD",
    gameCard: "Guild War planning, team preparation, and shared knowledge.",
    gameHub: "GUILD WORLDS",
    choosePath: "Choose a world to explore",
    choosePathHint: "We are currently playing Where Winds Meet, with room for more games in the future.",
    allGames: "← Back home",
    gameTools: "WHERE WINDS MEET · GUILD CAMP",
    whereMeetHint: "The essential GVG tools live in one place. Open the plan, register for War, or read the guild Guides.",
    planner: "Open the interactive map, timeline, and key battle timings.",
    registration: "Register for the next War and prepare the team roster.",
    guildWarIntro: "Join the next round and check the session times from one place.",
    openRegister: "Open registration",
    openBuilder: "Team Builder",
    managerNote: "No login is required to get started",
    nextRound: "NEXT ROUND",
    statusReady: "READY",
    guidesPageTitle: "Notes from the guild",
    guidesPageIntro: "Tune, Skill, and GVG tips discovered and shared by our members.",
    searchGuides: "Search Guides...",
    reviewed: "CURATED NOTES",
    footer: "Made for Path of Memories",
    share: "Share this page",
    copied: "Copied",
    discordTitle: "Continue in Discord",
    discordIntro: "The home of Path of Memories announcements, sessions, and guild chat.",
    discordServer: "GUILD SERVER",
    discordServerHint: "The main doorway to meet members and follow announcements.",
    discordChannels: "FREQUENT CHANNELS",
    discordChannelsHint: "GVG · Guides · Announcements",
    bannerAlt: "Path of Memories members gathering around a campfire under the night sky",
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

function ShareButton({ language }: { language: Language }) {
  const [done, setDone] = useState(false);
  const label = done ? copy[language].copied : copy[language].share;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      // The visitor cancelled the native share dialog.
    }
  };
  return <button className="share-button" type="button" onClick={share}><span aria-hidden="true">✦</span>{label}</button>;
}

function Shell({ children, language, onLanguageChange }: { children: ReactNode; language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Path of Memories home">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <span className="brand-name"><span className="brand-long">Path of Memories</span><span className="brand-short">POM</span></span>
        </a>
        <nav className="top-links" aria-label="Primary navigation">
          <a href="/games/where-winds-meet/"><span className="nav-long">{t.world}</span><span className="nav-short">WWM</span></a>
          <a href="/discord/">{t.discord}</a>
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </nav>
      </header>
      <div className="site-content">{children}</div>
      <footer className="site-footer"><span aria-hidden="true">✦</span>{t.footer}<span aria-hidden="true">✦</span></footer>
    </main>
  );
}

function HomePage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  const portals = [
    { number: "01", label: "GVG Planner", detail: t.planner, href: "/games/where-winds-meet/gvg-planner/" },
    { number: "02", label: "Guild War", detail: t.registration, href: "/games/where-winds-meet/guild-war/" },
    { number: "03", label: "Guides", detail: t.guidesPageIntro, href: "/games/where-winds-meet/guides/" },
  ];

  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="home-hero" aria-labelledby="welcome-heading">
        <div className="hero-media">
          <img src="/assets/pathofmemories-banner.jpg" alt={t.bannerAlt} fetchPriority="high" />
        </div>
        <div className="hero-copy">
          <div>
            <p className="eyebrow">{t.homeKicker}</p>
            <h1 id="welcome-heading">{t.playTogether}<br /><em>{t.keepMemories}</em></h1>
          </div>
          <div className="hero-summary">
            <p className="intro">{t.intro}</p>
            <a className="primary-button" href="/games/where-winds-meet/">{t.explore}<span aria-hidden="true">→</span></a>
            <p className="login-hint">{t.noAccount}</p>
          </div>
        </div>
      </section>

      <section className="portal-section" aria-labelledby="portal-heading">
        <div className="section-heading">
          <div><p className="eyebrow">{t.playSpaces}</p><h2 id="portal-heading">{t.chooseGame}</h2></div>
          <p>{t.chooseGameHint}</p>
        </div>
        <div className="portal-grid">
          {portals.map((portal) => (
            <a className="portal-card" href={portal.href} key={portal.label}>
              <span className="portal-number">{portal.number}</span>
              <span className="portal-copy"><strong>{portal.label}</strong><small>{portal.detail}</small></span>
              <span className="portal-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function GamesPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro compact-intro">
        <p className="eyebrow">{t.gameHub}</p>
        <h1>{t.choosePath}</h1>
        <p className="intro">{t.choosePathHint}</p>
      </section>
      <a className="realm-card" href="/games/where-winds-meet/">
        <span className="realm-status"><i />{t.activeGame}</span>
        <strong>Where Winds Meet</strong>
        <small>{t.gameCard}</small>
        <span className="realm-arrow" aria-hidden="true">→</span>
      </a>
    </Shell>
  );
}

function WhereWindsMeetPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  const tools = [
    { number: "01", label: "GVG Planner", detail: t.planner, href: "/games/where-winds-meet/gvg-planner/" },
    { number: "02", label: "Guild War Manager", detail: t.registration, href: "/games/where-winds-meet/guild-war/" },
    { number: "03", label: "Guides", detail: t.guidesPageIntro, href: "/games/where-winds-meet/guides/" },
  ];

  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro game-page-intro">
        <a className="back-link" href="/">{t.allGames}</a>
        <p className="eyebrow">{t.gameTools}</p>
        <h1>Where Winds <em>Meet</em></h1>
        <p className="intro">{t.whereMeetHint}</p>
      </section>
      <section className="portal-grid game-portals" aria-label="Where Winds Meet tools">
        {tools.map((tool) => (
          <a className="portal-card" key={tool.label} href={tool.href}>
            <span className="portal-number">{tool.number}</span>
            <span className="portal-copy"><strong>{tool.label}</strong><small>{tool.detail}</small></span>
            <span className="portal-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </section>
    </Shell>
  );
}

function GuildWarPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="manager-hero">
        <div>
          <a className="back-link" href="/games/where-winds-meet/">← Where Winds Meet</a>
          <p className="eyebrow">WHERE WINDS MEET · GUILD WAR</p>
          <h1>Ready the <em>guild</em></h1>
          <p className="intro">{t.guildWarIntro}</p>
        </div>
        <aside className="manager-status">
          <span className="status-line"><i className="status-dot" />{t.statusReady}</span>
          <strong>{t.nextRound}</strong>
          <small>{language === "th" ? "เลือกตัวเอง แล้วบันทึกได้ในไม่กี่ขั้นตอน" : "Choose yourself and save in a few simple steps."}</small>
        </aside>
      </section>
      <GuildWarRegistration language={language} />
      <p className="manager-note">✦ {t.managerNote}</p>
    </Shell>
  );
}

function getGuides(language: Language) {
  return whereWindsMeetGuides[language];
}

function guideStatusLabel(status: "published" | "needs-review", language: Language) {
  if (status === "published") return language === "th" ? "พร้อมอ่าน" : "Ready";
  return language === "th" ? "รอตรวจ patch" : "Patch review";
}

function GuidesPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const guides = getGuides(language);
  const categories = ["All", ...new Set(guides.map((guide) => guide.category))];
  const visibleGuides = guides.filter((guide) =>
    (category === "All" || guide.category === category)
    && `${guide.category} ${guide.title} ${guide.detail} ${guide.searchTerms.join(" ")} ${guide.sections.flatMap((section) => [section.heading, ...(section.paragraphs || []), ...(section.items || [])]).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro guides-intro">
        <a className="back-link" href="/games/where-winds-meet/">← Where Winds Meet</a>
        <p className="eyebrow">WHERE WINDS MEET · GUIDES</p>
        <h1>{t.guidesPageTitle}</h1>
        <p className="intro">{t.guidesPageIntro}</p>
      </section>
      <div className="guides-toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t.searchGuides} placeholder={t.searchGuides} /></label>
        <span>{t.reviewed}</span>
      </div>
      <div className="guide-filters" role="group" aria-label="Guide categories">
        {categories.map((item) => <button type="button" className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item === "All" ? (language === "th" ? "ทั้งหมด" : "All") : item}</button>)}
      </div>
      {visibleGuides.length > 0 ? (
        <section className="guide-grid" aria-label="Guides">
          {visibleGuides.map((guide, index) => (
            <a className="guide-card" href={`/games/where-winds-meet/guides/${guide.slug}/`} key={guide.slug}>
              <span className="guide-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="guide-card-meta"><span className="guide-category">{guide.category}</span><span className={`guide-status ${guide.status}`}>{guideStatusLabel(guide.status, language)}</span></span>
              <h2>{guide.title}</h2>
              <p>{guide.detail}</p>
              <span className="guide-read">READ <span aria-hidden="true">→</span></span>
            </a>
          ))}
        </section>
      ) : (
        <div className="guide-empty"><strong>{language === "th" ? "ยังไม่พบ Guide" : "No guides found"}</strong><span>{language === "th" ? "ลองเปลี่ยนคำค้นหาหรือเลือกทุกหมวด" : "Try another search or show all categories."}</span></div>
      )}
      <p className="manager-note">✦ {language === "th" ? "เนื้อหาชุดแรกกำลังทยอยตรวจสอบและจัดระเบียบจากข้อมูลของกิลด์" : "The starter set is being reviewed and organized from the guild's shared notes."}</p>
    </Shell>
  );
}

function GuideDetailPage({ slug, language, onLanguageChange }: { slug: string; language: Language; onLanguageChange: (language: Language) => void }) {
  const guide = getGuides(language).find((item) => item.slug === slug);
  if (!guide) return <GuidesPage language={language} onLanguageChange={onLanguageChange} />;

  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro guides-intro guide-detail-intro">
        <a className="back-link" href="/games/where-winds-meet/guides/">← Guides</a>
        <p className="eyebrow">{guide.category} · WHERE WINDS MEET</p>
        <h1>{guide.title}</h1>
        <p className="intro">{guide.detail}</p>
        <span className={`guide-status detail-status ${guide.status}`}>{guideStatusLabel(guide.status, language)}</span>
        <ShareButton language={language} />
      </section>
      <article className="guide-detail">
        {guide.status === "needs-review" && (
          <aside className="guide-review-note">
            <strong>{language === "th" ? "ข้อมูลส่วนนี้กำลังตรวจสอบ" : "This guide is under review"}</strong>
            <span>{language === "th" ? "ใช้เป็นแนวทางเบื้องต้น และเช็กกับสมาชิกกิลด์ก่อนนำไปจัด build จริง" : "Use it as a starting point and confirm with the guild before finalizing a build."}</span>
          </aside>
        )}
        {guide.sections.map((section, index) => (
          <section className="guide-section" key={`${section.heading}-${index}`}>
            <span className="guide-section-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            </div>
          </section>
        ))}
        <div className="guide-detail-note">PATH OF MEMORIES · GUILD NOTES · SOURCE: SHARED GUIDE SHEET</div>
      </article>
    </Shell>
  );
}

function DiscordPage({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const t = copy[language];
  return (
    <Shell language={language} onLanguageChange={onLanguageChange}>
      <section className="page-intro discord-intro">
        <a className="back-link" href="/">← Path of Memories</a>
        <p className="eyebrow">PATH OF MEMORIES · DISCORD</p>
        <h1>{t.discordTitle}</h1>
        <p className="intro">{t.discordIntro}</p>
      </section>
      <section className="discord-panel">
        <div className="discord-orb" aria-hidden="true">✦</div>
        <div><span className="guide-category">{t.discordServer}</span><h2>Path of Memories</h2><p>{t.discordServerHint}</p></div>
        <div className="discord-channels"><span>{t.discordChannels}</span><strong>{t.discordChannelsHint}</strong><small>INVITE LINK · COMING SOON</small></div>
      </section>
    </Shell>
  );
}

export default function App() {
  const [language, setLanguage] = useLanguage();
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/games") return <GamesPage language={language} onLanguageChange={setLanguage} />;
  if (path === "/discord") return <DiscordPage language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet") return <WhereWindsMeetPage language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet/guides") return <GuidesPage language={language} onLanguageChange={setLanguage} />;
  if (path.startsWith("/games/where-winds-meet/guides/")) return <GuideDetailPage slug={path.split("/").filter(Boolean).pop() || ""} language={language} onLanguageChange={setLanguage} />;
  if (path === "/games/where-winds-meet/guild-war") return <GuildWarPage language={language} onLanguageChange={setLanguage} />;
  return <HomePage language={language} onLanguageChange={setLanguage} />;
}
