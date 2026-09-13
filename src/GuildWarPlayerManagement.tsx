import {useEffect, useMemo, useState} from "react";
import {useGuildWarOverlay} from "./GuildWarOverlay";

type Player = {id:string;characterName:string;nickname:string;loadoutCount:number;registrationCount:number};
const base = "/api/v2/games/where-winds-meet";

export function GuildWarPlayerManagement({language}:{language:"th"|"en"}) {
  const th = language === "th";
  const {notify,confirm} = useGuildWarOverlay();
  const [organizer,setOrganizer] = useState("");
  const [players,setPlayers] = useState<Player[]>([]);
  const [selected,setSelected] = useState("");
  const [query,setQuery] = useState("");
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState("");
  const current = players.find((player) => player.id === selected);
  const visible = useMemo(() => players.filter((player) => (player.characterName+" "+player.nickname).toLowerCase().includes(query.toLowerCase())), [players,query]);
  async function load() {
    setBusy(true); setMessage("");
    try {
      const [sessionResponse,playersResponse] = await Promise.all([fetch("/api/auth/discord/session"),fetch(base+"/players/manage")]);
      const session = await sessionResponse.json(), data = await playersResponse.json();
      if (!playersResponse.ok) throw new Error(data.error || "request_failed");
      setOrganizer(session.organizer?.displayName || "");
      setPlayers(data.players || []);
      setSelected((previous) => data.players?.some((player:Player) => player.id === previous) ? previous : data.players?.[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error && error.message === "organizer_required" ? (th?"เข้าสู่ระบบ Discord เพื่อจัดการรายชื่อ":"Sign in with Discord to manage players.") : (th?"โหลดรายชื่อไม่สำเร็จ":"Could not load players."));
    } finally { setBusy(false); }
  }
  useEffect(() => {void load();}, []);
  useEffect(() => {if(message) notify(message, message.includes("ไม่สำเร็จ")||message.includes("Could not")?"error":"success");}, [message,notify]);
  async function removePlayer() {
    if (!current) return;
    if (!await confirm({title:th?"ลบผู้เล่นถาวร":"Delete player permanently",message:th?`ยืนยันลบ ${current.characterName} และข้อมูลที่เกี่ยวข้องทั้งหมดถาวร?`:`Permanently delete ${current.characterName} and all related data?`,confirmLabel:th?"ยืนยันลบ":"Delete",cancelLabel:th?"ยกเลิก":"Cancel",danger:true})) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(base+"/players/manage", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerId:current.id})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "request_failed");
      setPlayers((all) => all.filter((player) => player.id !== current.id));
      setSelected("");
      setMessage(th?`ลบ ${current.characterName} และข้อมูลที่เกี่ยวข้องแล้ว`:`Deleted ${current.characterName} and related data.`);
    } catch {
      setMessage(th?"ลบรายชื่อไม่สำเร็จ":"Could not delete the player.");
    } finally { setBusy(false); }
  }
  if (!organizer && !busy) return <section className="player-manager"><p className="eyebrow">GUILD WAR · ORGANIZER</p><h1>{th?"จัดการรายชื่อ":"Player management"}</h1><p>{th?"หน้านี้สำหรับผู้จัดทีมเท่านั้น":"This page is for organizers only."}</p><a className="primary-button" href={"/api/auth/discord/login?return="+encodeURIComponent("/games/where-winds-meet/guild-war/players")}>{th?"เข้าสู่ระบบ Discord เพื่อจัดการ":"Sign in with Discord to manage"}</a></section>;
  return <section className="player-manager"><header className="player-manager-heading"><div><a className="back-link" href="/games/where-winds-meet/guild-war/teams">← {th?"กลับ Team Builder":"Back to Team Builder"}</a><p className="eyebrow">GUILD WAR · ORGANIZER</p><h1>{th?"จัดการรายชื่อผู้เล่น":"Player management"}</h1><p>{th?"ลบผู้เล่นพร้อมข้อมูลลงทะเบียน Loadout กฎขาประจำ และข้อมูลจัดทีมที่ยังไม่ประกาศ":"Delete a player with their registrations, Loadouts, regular rules and unpublished team data."}</p></div><span>{organizer || "…"}</span></header><div className="player-manager-layout"><aside className="player-manager-list"><label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={th?"ค้นหาชื่อหรือชื่อเล่น":"Search name or nickname"}/></label>{visible.map((player) => <button type="button" className={selected===player.id?"active":""} key={player.id} onClick={() => setSelected(player.id)}><b>{player.characterName}</b><small>{player.nickname&&"("+player.nickname+") · "}{player.loadoutCount} Loadout</small></button>)}</aside>{current&&<main className="player-manager-detail"><h2>{current.characterName} {current.nickname&&<small>({current.nickname})</small>}</h2><dl><div><dt>{th?"Loadout":"Loadouts"}</dt><dd>{current.loadoutCount}</dd></div><div><dt>{th?"รอบที่ลงทะเบียน":"Registered rounds"}</dt><dd>{current.registrationCount}</dd></div></dl><section className="player-manager-danger"><h3>{th?"ลบผู้เล่นถาวร":"Permanently delete player"}</h3><p>{th?"จะลบ Loadout การลงทะเบียน การขาด กฎขาประจำ สิทธิ์เดิม และรายการจัดทีมที่ยังไม่ประกาศออกทั้งหมด ประกาศทีมที่เผยแพร่แล้วจะเก็บไว้เป็นประวัติ":"This removes Loadouts, registrations, absences, regular rules, legacy access and unpublished team assignments. Published team announcements remain as history."}</p><button type="button" disabled={busy} onClick={() => void removePlayer()}>{th?"ลบผู้เล่นถาวร":"Delete player permanently"}</button></section></main>}</div></section>;
}
