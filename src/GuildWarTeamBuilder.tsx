import {useEffect, useState} from "react";

type Language = "th" | "en";
type Event = {id: string; starts_at: string; war_type: string; status: string; capacity: number};
type Registration = {player_id: string; character_name: string; preferred_role: string | null; note: string; loadouts: {id: string; role: string; main_weapon_name: string; sub_weapon_name: string}[]};
type Squad = "Attack 1" | "Attack 2" | "Defense" | "Reserve";

const gameId = "where-winds-meet";
const squads: Squad[] = ["Attack 1", "Attack 2", "Defense", "Reserve"];

export function GuildWarTeamBuilder({language}: {language: Language}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Squad>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch(`/api/v2/games/${gameId}/war/events`).then((response) => response.json()).then((data) => {
      const open = (data.events || []).filter((event: Event) => event.status === "open");
      setEvents(open);
      setEventId(open[0]?.id || "");
      setState("ready");
    }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setState("loading");
    fetch(`/api/v2/games/${gameId}/war/events/${eventId}/registrations`).then((response) => response.json()).then((data) => {
      setRegistrations(data.registrations || []);
      setAssignments(Object.fromEntries((data.registrations || []).map((item: Registration) => [item.player_id, "Reserve"])));
      setState("ready");
    }).catch(() => setState("error"));
  }, [eventId]);

  return <section className="team-builder">
    <div className="registration-heading"><div><p className="eyebrow">ORGANIZER · TEAM BUILDER</p><h1>{language === "th" ? "จัดทีมของคืนนี้" : "Build tonight's teams"}</h1></div><span>{language === "th" ? "DRAFT · ยังไม่ประกาศ" : "DRAFT · NOT PUBLISHED"}</span></div>
    {events.length > 0 && <label className="team-event-select">{language === "th" ? "เลือกรอบ War" : "Choose a War round"}<select value={eventId} onChange={(event) => setEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{new Date(event.starts_at).toLocaleString(language === "th" ? "th-TH" : "en-GB", {dateStyle: "medium", timeStyle: "short"})} · {event.war_type}</option>)}</select></label>}
    {state === "loading" && <p className="team-builder-message">✦ {language === "th" ? "กำลังเรียกรายชื่อ…" : "Gathering the roster…"}</p>}
    {state === "error" && <p className="registration-error">{language === "th" ? "ยังโหลดรายชื่อไม่ได้" : "The roster is unavailable."}</p>}
    {state === "ready" && !events.length && <p className="team-builder-message">{language === "th" ? "ยังไม่มีรอบ War ที่เปิดอยู่" : "No War round is currently open."}</p>}
    {state === "ready" && registrations.length > 0 && <div className="squad-grid">{squads.map((squad) => <section className="squad-column" key={squad}><header><span>{squad}</span><b>{Object.values(assignments).filter((value) => value === squad).length}</b></header><div>{registrations.filter((registration) => assignments[registration.player_id] === squad).map((registration) => <article className="team-player" key={registration.player_id}><div><strong>{registration.character_name}</strong><small>{registration.preferred_role || registration.loadouts[0]?.role || "—"}</small></div><select value={assignments[registration.player_id]} onChange={(event) => setAssignments((current) => ({...current, [registration.player_id]: event.target.value as Squad}))}>{squads.map((target) => <option value={target} key={target}>{target}</option>)}</select></article>)}</div></section>)}</div>}
    {state === "ready" && eventId && !registrations.length && <p className="team-builder-message">{language === "th" ? "ยังไม่มีผู้ลงทะเบียนในรอบนี้" : "No registrations for this round yet."}</p>}
    <p className="manager-note">✦ {language === "th" ? "Draft นี้อยู่ใน browser ของคุณเท่านั้น ยังไม่กระทบรายชื่อจริง" : "This draft stays only in your browser and does not change the live roster."}</p>
  </section>;
}
