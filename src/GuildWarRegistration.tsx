import {useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";

type Language = "th" | "en";
type Event = {id: string; starts_at: string; war_type: string; status: string; capacity: number};
type Loadout = {id: string; role: string; main_weapon_name: string; sub_weapon_name: string};
type Player = {id: string; character_name: string; loadouts: Loadout[]};

const gameId = "where-winds-meet";
const claimKey = (eventId: string, playerId: string) => `pom-war-claim:${eventId}:${playerId}`;

export function GuildWarRegistration({language}: {language: Language}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [eventId, setEventId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [loadoutIds, setLoadoutIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error" | "saved">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/v2/games/${gameId}/war/events`).then((response) => response.json()),
      fetch(`/api/v2/games/${gameId}/players`).then((response) => response.json()),
    ]).then(([eventData, playerData]) => {
      const openEvents = (eventData.events || []).filter((event: Event) => event.status === "open");
      setEvents(openEvents);
      setEventId(openEvents[0]?.id || "");
      setPlayers(playerData.players || []);
      setState("ready");
    }).catch(() => {
      setState("error");
      setMessage(language === "th" ? "ยังเชื่อมข้อมูล War ไม่ได้ ลองใหม่อีกครั้งภายหลัง" : "War data is temporarily unavailable. Please try again.");
    });
  }, [language]);

  const player = useMemo(() => players.find((item) => item.id === playerId), [players, playerId]);
  const toggleLoadout = (id: string) => setLoadoutIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!eventId || !player) return;
    setState("saving");
    setMessage("");
    const response = await fetch(`/api/v2/games/${gameId}/war/events/${eventId}/registrations`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        playerId: player.id,
        preferredRole: player.loadouts.find((item) => loadoutIds.includes(item.id))?.role || null,
        loadoutIds,
        note,
        claimToken: localStorage.getItem(claimKey(eventId, player.id)),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("error");
      setMessage(body.error === "claim_required"
        ? (language === "th" ? "รายการนี้ถูกลงทะเบียนจากเครื่องอื่นแล้ว ให้ผู้จัดช่วยแก้ไข หรือเข้าสู่ระบบ Discord เมื่อเปิดใช้" : "This registration was made on another device. Ask an organizer for help or use Discord Login when available.")
        : (language === "th" ? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" : "Could not save your registration. Please try again."));
      return;
    }
    if (body.claimToken) localStorage.setItem(claimKey(eventId, player.id), body.claimToken);
    setState("saved");
    setMessage(language === "th" ? "ลงทะเบียนเรียบร้อยแล้ว คุณแก้ไขได้จาก browser เครื่องนี้" : "Registered. You can edit this entry from this browser.");
  }

  if (state === "loading") return <section className="war-registration loading"><span>✦</span>{language === "th" ? "กำลังเปิดสมุดลงทะเบียน…" : "Opening the registration book…"}</section>;
  if (!events.length) return <section className="war-registration empty"><strong>{language === "th" ? "ยังไม่มีรอบ War ที่เปิดอยู่" : "No War round is currently open"}</strong><span>{language === "th" ? "กลับมาตรวจอีกครั้งเมื่อผู้จัดเปิดรอบใหม่" : "Check back when an organizer opens the next round."}</span></section>;

  return <section className="war-registration">
    <div className="registration-heading"><div><p className="eyebrow">GUILD WAR · REGISTER</p><h2>{language === "th" ? "ลงชื่อให้ทีมรู้" : "Let the team know"}</h2></div><span>{language === "th" ? "ไม่ต้อง Login" : "No login needed"}</span></div>
    <form onSubmit={submit}>
      <label> {language === "th" ? "เลือกรอบ War" : "Choose a War round"}
        <select value={eventId} onChange={(event) => {setEventId(event.target.value); setLoadoutIds([]);}}>
          {events.map((item) => <option value={item.id} key={item.id}>{new Date(item.starts_at).toLocaleString(language === "th" ? "th-TH" : "en-GB", {dateStyle: "medium", timeStyle: "short"})} · {item.war_type}</option>)}
        </select>
      </label>
      <label>{language === "th" ? "ชื่อตัวละคร" : "Character name"}
        <select value={playerId} onChange={(event) => {setPlayerId(event.target.value); setLoadoutIds([]);}}>
          <option value="">{language === "th" ? "เลือกชื่อตัวเอง" : "Choose your name"}</option>
          {players.map((item) => <option value={item.id} key={item.id}>{item.character_name}</option>)}
        </select>
      </label>
      {player && <fieldset><legend>{language === "th" ? "Build ที่พร้อมเล่น" : "Available build"}</legend>
        <div className="loadout-list">{player.loadouts.map((item) => <label className="loadout-choice" key={item.id}><input type="checkbox" checked={loadoutIds.includes(item.id)} onChange={() => toggleLoadout(item.id)} /><span><b>{item.role}</b>{item.main_weapon_name} + {item.sub_weapon_name}</span></label>)}</div>
      </fieldset>}
      <label>{language === "th" ? "หมายเหตุ (ถ้ามี)" : "Note (optional)"}<textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>
      {message && <p className={state === "error" ? "registration-error" : "registration-success"}>{message}</p>}
      <button className="primary-button" disabled={!player || state === "saving"}>{state === "saving" ? (language === "th" ? "กำลังบันทึก…" : "Saving…") : (language === "th" ? "ลงทะเบียน" : "Register")}</button>
    </form>
  </section>;
}
