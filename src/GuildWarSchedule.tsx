import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useGuildWarOverlay } from "./GuildWarOverlay";
import "./GuildWarSchedule.css";

type Language = "th" | "en";
type Slot = { slot: string; weekday: number; roundNumber: number; time: string; warType: string };
type Round = { local_date: string; starts_at: string; war_type: string; round_number: number };
type Pause = { id: string; startsOn: string; endsOn: string; slots: string[]; note: string | null; createdAt: string };
type Schedule = { today: string; weekStart: string; slots: Slot[]; events: Round[]; pauses: Pause[] };
type NoticeKey = "loadError" | "saveError" | "restoreError" | "saved" | "restored" | "savedRefreshError" | "restoredRefreshError" | "session";
type Notice = { kind: "error" | "success" | "warning"; key: NoticeKey };
type FormErrors = { dates?: "invalidDates" | "invalidRange"; slots?: "invalidSlots"; note?: "invalidNote" };

const endpoint = "/api/v2/games/where-winds-meet/war/schedule";
const route = "/games/where-winds-meet/guild-war/schedule";
const copy = {
  th: {
    back: "← กลับหน้า Guild War", title: "ตาราง Guild War", intro: "พักรอบวอร์ชั่วคราวตามช่วงวันที่ และเปิดกลับได้ก่อนกำหนด รอบจะกลับมาอัตโนมัติเมื่อสิ้นสุดช่วงพัก",
    organizer: "สำหรับผู้จัดทีม", timezone: "ทุกวันและเวลาอ้างอิงกรุงเทพฯ (UTC+7)", refresh: "รีเฟรช", builder: "Team Builder",
    weekend: "รอบวอร์สุดสัปดาห์นี้", visible: "รอบที่เปิดอยู่", saturday: "วันเสาร์", sunday: "วันอาทิตย์", noRounds: "ไม่มีรอบที่เปิดในวันนี้",
    newPause: "พักรอบชั่วคราว", formHint: "ใช้กับรอบที่เลือกในช่วงวันที่นี้ รวมวันเริ่มต้นและวันสิ้นสุด ข้อมูลลงทะเบียนและทีมจะยังอยู่",
    startsOn: "วันเริ่มพัก", endsOn: "วันสุดท้ายที่พัก", slots: "เลือกรอบที่ต้องการพัก", slotsHint: "เลือกแยกวันได้ · มีเฉพาะรอบมาตรฐานของกิลด์",
    note: "หมายเหตุ (ไม่บังคับ)", noteHint: "ระบุเหตุผลสั้น ๆ ให้ผู้จัดทีมคนอื่นทราบ", characters: "ตัวอักษร", submit: "บันทึกการพักรอบ", submitting: "กำลังบันทึก…",
    invalidDates: "กรุณาระบุวันเริ่มต้นและวันสิ้นสุดที่ถูกต้อง", invalidRange: "วันสิ้นสุดต้องเป็นวันเดียวกันหรือหลังวันเริ่มต้น", invalidSlots: "กรุณาเลือกอย่างน้อยหนึ่งรอบจากรายการ", invalidNote: "หมายเหตุต้องไม่เกิน 240 ตัวอักษร",
    pauses: "รายการพักรอบ", pausesHint: "แสดงรายการที่ยังมีผลและที่กำลังจะเริ่ม · รายการหมดอายุจะไม่แสดง", empty: "ไม่มีรายการพักรอบที่ยังมีผลหรือกำลังจะเริ่ม", active: "กำลังพัก", upcoming: "รอเริ่ม", inclusive: "รวมทั้งสองวัน",
    restore: "ยกเลิกการพัก", restoring: "กำลังคืนรอบ…", confirmTitle: "ยกเลิกการพักรอบนี้?", confirmMessage: "รอบในช่วงวันที่นี้จะเปิดกลับ หากไม่มีรายการพักอื่นที่ทับซ้อนกัน ข้อมูลทีมและการลงทะเบียนจะยังอยู่", cancel: "กลับ", confirm: "ยืนยันยกเลิกการพัก",
    loading: "กำลังโหลดตารางและตรวจสอบสิทธิ์ผู้จัดทีม…", ready: "ตารางล่าสุดจากเซิร์ฟเวอร์", loginTitle: "เข้าสู่ระบบผู้จัดทีม", loginHint: "ใช้บัญชี Discord ที่มีสิทธิ์ผู้จัดทีมเพื่อดูและแก้ไขตารางวอร์", login: "เข้าสู่ระบบด้วย Discord",
    session: "กรุณาเข้าสู่ระบบ Discord ด้วยบัญชีผู้จัดทีมอีกครั้ง", loadError: "โหลดตารางไม่สำเร็จ โปรดรีเฟรชเพื่อลองอีกครั้ง", saveError: "บันทึกการพักรอบไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง", restoreError: "ยกเลิกการพักไม่สำเร็จ โปรดลองอีกครั้ง",
    saved: "บันทึกการพักรอบและอัปเดตตารางแล้ว", restored: "ยกเลิกการพักแล้ว รายการพักอื่นที่ทับซ้อนกันยังมีผล", savedRefreshError: "บันทึกการพักแล้ว แต่โหลดตารางล่าสุดไม่สำเร็จ โปรดรีเฟรชก่อนแก้ไขต่อ", restoredRefreshError: "ยกเลิกการพักแล้ว แต่โหลดตารางล่าสุดไม่สำเร็จ โปรดรีเฟรชก่อนแก้ไขต่อ",
  },
  en: {
    back: "← Back to Guild War", title: "Guild War schedule", intro: "Pause War slots for a date range or restore them early. Rounds resume automatically when the pause ends.",
    organizer: "Organizers only", timezone: "All dates and times use Bangkok (UTC+7)", refresh: "Refresh", builder: "Team Builder",
    weekend: "This weekend’s rounds", visible: "visible rounds", saturday: "Saturday", sunday: "Sunday", noRounds: "No visible rounds on this day",
    newPause: "Pause War slots", formHint: "Applies to the selected slots throughout the inclusive date range. Registrations and saved teams are preserved.",
    startsOn: "Start date", endsOn: "Last paused date", slots: "Slots to pause", slotsHint: "Choose each day separately · Existing guild slots only",
    note: "Note (optional)", noteHint: "Add a short reason for other organizers", characters: "characters", submit: "Save pause", submitting: "Saving…",
    invalidDates: "Enter a valid start date and end date.", invalidRange: "The end date must be on or after the start date.", invalidSlots: "Select at least one slot from the list.", invalidNote: "The note must be 240 characters or fewer.",
    pauses: "Pause rules", pausesHint: "Active and upcoming pauses · Expired rules are omitted", empty: "No active or upcoming pauses", active: "Active", upcoming: "Upcoming", inclusive: "Both dates included",
    restore: "Cancel pause", restoring: "Restoring…", confirmTitle: "Cancel this pause?", confirmMessage: "Slots in this date range will return unless another pause overlaps. Registrations and saved teams are preserved.", cancel: "Keep pause", confirm: "Cancel pause",
    loading: "Loading the schedule and checking organizer access…", ready: "Latest schedule from the server", loginTitle: "Organizer sign in", loginHint: "Use a Discord account with organizer access to view and manage the War schedule.", login: "Sign in with Discord",
    session: "Please sign in again with an organizer Discord account.", loadError: "Could not load the schedule. Refresh to try again.", saveError: "Could not save the pause. Check your connection and try again.", restoreError: "Could not cancel the pause. Please try again.",
    saved: "Pause saved and schedule updated.", restored: "Pause cancelled. Other overlapping pauses still apply.", savedRefreshError: "Pause saved, but the latest schedule could not load. Refresh before making more changes.", restoredRefreshError: "Pause cancelled, but the latest schedule could not load. Refresh before making more changes.",
  },
} as const;

class ScheduleError extends Error {
  constructor(readonly status: number) { super("Schedule request failed"); }
}

async function requestSchedule(path = "", options: RequestInit = {}) {
  const response = await fetch(endpoint + path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) throw new ScheduleError(response.status);
  return response;
}

function addDays(date: string, days: number) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() > 0 && date.toISOString().slice(0, 10) === value;
}

export function GuildWarSchedule({ language }: { language: Language }) {
  const t = copy[language];
  const { confirm } = useGuildWarOverlay();
  const [data, setData] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginRequired, setLoginRequired] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>(["6:1", "0:1"]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const defaultsApplied = useRef(false);
  const mutationLock = useRef(false);
  const busy = loading || pending !== null;
  const disabled = busy || !data || loginRequired || needsRefresh;

  const showError = useCallback((error: unknown, key: NoticeKey) => {
    if (error instanceof ScheduleError && error.status === 401) {
      setLoginRequired(true);
      setNotice({ kind: "error", key: "session" });
    } else {
      setNotice({ kind: "error", key });
    }
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await requestSchedule("", { signal });
    const schedule: Schedule = await response.json();
    if (signal?.aborted) return;
    setData(schedule);
    setLoginRequired(false);
    setNeedsRefresh(false);
    if (!defaultsApplied.current) {
      const saturday = addDays(schedule.weekStart, 5);
      setStartsOn(schedule.today > saturday ? schedule.today : saturday);
      setEndsOn(addDays(schedule.weekStart, 6));
      defaultsApplied.current = true;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotice(null);
    void load(controller.signal)
      .catch((error: unknown) => { if (!controller.signal.aborted) showError(error, "loadError"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, reload, showError]);

  async function refreshAfterWrite(success: "saved" | "restored", failure: "savedRefreshError" | "restoredRefreshError") {
    // A successful write must never be reported as failed just because the follow-up GET failed.
    setNeedsRefresh(true);
    try {
      await load();
      setNotice({ kind: "success", key: success });
    } catch (error) {
      if (error instanceof ScheduleError && error.status === 401) showError(error, failure);
      else setNotice({ kind: "warning", key: failure });
    }
  }

  async function savePause(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || mutationLock.current || !data) return;
    const nextErrors: FormErrors = {};
    if (!validDate(startsOn) || !validDate(endsOn)) nextErrors.dates = "invalidDates";
    else if (startsOn > endsOn) nextErrors.dates = "invalidRange";
    if (!selectedSlots.length || selectedSlots.some((slot) => !data.slots.some((item) => item.slot === slot))) nextErrors.slots = "invalidSlots";
    if (note.length > 240) nextErrors.note = "invalidNote";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.querySelector<HTMLElement>("[data-field='" + (nextErrors.dates ? "dates" : nextErrors.slots ? "slots" : "note") + "']")?.focus();
      return;
    }
    mutationLock.current = true;
    setPending("save");
    setNotice(null);
    try {
      await requestSchedule("", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsOn, endsOn, slots: selectedSlots, note: note.trim() }),
      });
      setNote("");
      await refreshAfterWrite("saved", "savedRefreshError");
    } catch (error) {
      showError(error, "saveError");
    } finally {
      mutationLock.current = false;
      setPending(null);
    }
  }

  function formatDate(date: string) {
    return new Date(date + "T00:00:00+07:00").toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
  }

  function slotLabel(id: string) {
    const slot = data?.slots.find((item) => item.slot === id);
    if (!slot) return id;
    return `${slot.weekday === 6 ? t.saturday : t.sunday} ${slot.time} · ${slot.warType}`;
  }

  async function cancelPause(pause: Pause) {
    if (disabled || mutationLock.current) return;
    mutationLock.current = true;
    setPending(pause.id);
    try {
      const accepted = await confirm({
        title: t.confirmTitle,
        message: `${formatDate(pause.startsOn)} – ${formatDate(pause.endsOn)} · ${pause.slots.map(slotLabel).join(", ")}\n${t.confirmMessage}`,
        confirmLabel: t.confirm, cancelLabel: t.cancel,
      });
      if (!accepted) return;
      setNotice(null);
      await requestSchedule("/" + encodeURIComponent(pause.id), { method: "DELETE" });
      await refreshAfterWrite("restored", "restoredRefreshError");
    } catch (error) {
      showError(error, "restoreError");
    } finally {
      mutationLock.current = false;
      setPending(null);
    }
  }

  const days = [{ weekday: 6, label: t.saturday, date: data ? addDays(data.weekStart, 5) : "" }, { weekday: 0, label: t.sunday, date: data ? addDays(data.weekStart, 6) : "" }];
  const pauses = data?.pauses.filter((pause) => pause.endsOn >= data.today).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id)) || [];

  return (
    <section className="gw-schedule" aria-labelledby="gw-schedule-title">
      <header className="gw-schedule-heading">
        <div>
          <a className="back-link" href="/games/where-winds-meet/guild-war/">{t.back}</a>
          <p className="eyebrow">GUILD WAR · {t.organizer}</p>
          <h1 id="gw-schedule-title">{t.title}</h1>
          <p className="gw-schedule-intro">{t.intro}</p>
          <p className="gw-schedule-timezone">{t.timezone}</p>
        </div>
        <div className="gw-schedule-actions">
          <a className="gw-schedule-button" href="/games/where-winds-meet/guild-war/teams">{t.builder}</a>
          <button className="gw-schedule-button" type="button" disabled={busy} onClick={() => setReload((value) => value + 1)}>{t.refresh}</button>
        </div>
      </header>

      <div className={"gw-schedule-feedback" + (notice ? " is-" + notice.kind : "")} role="status" aria-live="polite" aria-atomic="true">
        {loading ? t.loading : notice ? t[notice.key] : data && !loginRequired ? t.ready : ""}
      </div>

      {loginRequired ? (
        <section className="gw-schedule-panel gw-schedule-login" aria-labelledby="gw-schedule-login-title">
          <p className="eyebrow">DISCORD · ORGANIZER</p>
          <h2 id="gw-schedule-login-title">{t.loginTitle}</h2>
          <p>{t.loginHint}</p>
          <a className="gw-schedule-button is-primary" href={"/api/auth/discord/login?return=" + encodeURIComponent(route)}>{t.login}</a>
        </section>
      ) : (
        <>
          <section className="gw-schedule-panel gw-schedule-weekend" aria-labelledby="gw-schedule-weekend-title" aria-busy={loading}>
            <div className="gw-schedule-panel-heading"><h2 id="gw-schedule-weekend-title">{t.weekend}</h2><span>{data ? `${data.events.length} ${t.visible}` : "…"}</span></div>
            <div className="gw-schedule-days">
              {days.map((day) => {
                const rounds = data?.events.filter((round) => round.local_date === day.date).sort((a, b) => a.round_number - b.round_number) || [];
                return <section className="gw-schedule-day" key={day.weekday} aria-labelledby={"gw-schedule-day-" + day.weekday}>
                  <h3 id={"gw-schedule-day-" + day.weekday}>{day.label}<small>{day.date ? formatDate(day.date) : "…"}</small></h3>
                  {data && rounds.length === 0 ? <p className="gw-schedule-empty">{t.noRounds}</p> : <ul className="gw-schedule-rounds">{rounds.map((round) => <li key={round.local_date + ":" + round.round_number}><time dateTime={round.starts_at}>{new Date(round.starts_at).toLocaleTimeString(language === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false })}</time><span>{round.war_type}</span></li>)}</ul>}
                </section>;
              })}
            </div>
          </section>

          <div className="gw-schedule-layout">
            <form className="gw-schedule-panel gw-schedule-form" onSubmit={(event) => void savePause(event)} noValidate aria-labelledby="gw-schedule-form-title" aria-busy={pending === "save"}>
              <h2 id="gw-schedule-form-title">{t.newPause}</h2>
              <p className="gw-schedule-hint">{t.formHint}</p>
              <fieldset className="gw-schedule-controls" disabled={disabled}>
                <legend className="gw-schedule-sr-only">{t.newPause}</legend>
                <div className="gw-schedule-dates">
                  <label htmlFor="gw-schedule-start">{t.startsOn}<input id="gw-schedule-start" data-field="dates" type="date" required min="0001-01-01" max="9999-12-31" value={startsOn} aria-invalid={Boolean(errors.dates)} aria-describedby="gw-schedule-dates-error" onChange={(event) => { setStartsOn(event.target.value); setErrors((current) => ({ ...current, dates: undefined })); }} /></label>
                  <label htmlFor="gw-schedule-end">{t.endsOn}<input id="gw-schedule-end" type="date" required min={startsOn || "0001-01-01"} max="9999-12-31" value={endsOn} aria-invalid={Boolean(errors.dates)} aria-describedby="gw-schedule-dates-error" onChange={(event) => { setEndsOn(event.target.value); setErrors((current) => ({ ...current, dates: undefined })); }} /></label>
                </div>
                <p className="gw-schedule-field-error" id="gw-schedule-dates-error" aria-live="polite">{errors.dates ? t[errors.dates] : ""}</p>

                <fieldset className="gw-schedule-slots" aria-describedby="gw-schedule-slots-help gw-schedule-slots-error" aria-invalid={Boolean(errors.slots)}>
                  <legend>{t.slots}</legend>
                  <p className="gw-schedule-hint" id="gw-schedule-slots-help">{t.slotsHint}</p>
                  <div className="gw-schedule-days">
                    {days.map((day) => <fieldset className="gw-schedule-slot-day" key={day.weekday}><legend>{day.label}</legend>{data?.slots.filter((slot) => slot.weekday === day.weekday).sort((a, b) => a.roundNumber - b.roundNumber).map((slot) => <label className="gw-schedule-slot" key={slot.slot}><input type="checkbox" data-field="slots" checked={selectedSlots.includes(slot.slot)} onChange={(event) => { setSelectedSlots((current) => event.target.checked ? [...current, slot.slot] : current.filter((id) => id !== slot.slot)); setErrors((current) => ({ ...current, slots: undefined })); }} /><span><strong>{slot.time}</strong><small>{slot.warType}</small></span></label>)}</fieldset>)}
                  </div>
                </fieldset>
                <p className="gw-schedule-field-error" id="gw-schedule-slots-error" aria-live="polite">{errors.slots ? t[errors.slots] : ""}</p>

                <label className="gw-schedule-note" htmlFor="gw-schedule-note">{t.note}<textarea id="gw-schedule-note" data-field="note" rows={3} maxLength={240} value={note} aria-invalid={Boolean(errors.note)} aria-describedby="gw-schedule-note-help gw-schedule-note-count gw-schedule-note-error" onChange={(event) => { setNote(event.target.value); setErrors((current) => ({ ...current, note: undefined })); }} /></label>
                <div className="gw-schedule-note-meta"><span id="gw-schedule-note-help">{t.noteHint}</span><span id="gw-schedule-note-count">{note.length}/240 {t.characters}</span></div>
                <p className="gw-schedule-field-error" id="gw-schedule-note-error" aria-live="polite">{errors.note ? t[errors.note] : ""}</p>
                <button className="gw-schedule-button is-primary gw-schedule-submit" type="submit">{pending === "save" ? t.submitting : t.submit}</button>
              </fieldset>
            </form>

            <section className="gw-schedule-panel gw-schedule-pauses" aria-labelledby="gw-schedule-pauses-title" aria-busy={busy}>
              <div className="gw-schedule-panel-heading"><h2 id="gw-schedule-pauses-title">{t.pauses}</h2><span>{data ? pauses.length : "…"}</span></div>
              <p className="gw-schedule-hint">{t.pausesHint}</p>
              {data && pauses.length === 0 && <p className="gw-schedule-empty">{t.empty}</p>}
              <ul className="gw-schedule-pause-list">{pauses.map((pause) => <li className="gw-schedule-pause" key={pause.id}>
                <span className={"gw-schedule-badge" + (pause.startsOn > data!.today ? " is-upcoming" : "")}>{pause.startsOn > data!.today ? t.upcoming : t.active}</span>
                <h3><time dateTime={pause.startsOn}>{formatDate(pause.startsOn)}</time><span aria-hidden="true"> – </span><time dateTime={pause.endsOn}>{formatDate(pause.endsOn)}</time></h3>
                <small className="gw-schedule-inclusive">{t.inclusive}</small>
                <ul className="gw-schedule-pause-slots">{pause.slots.map((slot) => <li key={slot}>{slotLabel(slot)}</li>)}</ul>
                {pause.note && <p className="gw-schedule-pause-note">{pause.note}</p>}
                <button className="gw-schedule-button" type="button" disabled={disabled} aria-label={`${t.restore}: ${formatDate(pause.startsOn)} – ${formatDate(pause.endsOn)}, ${pause.slots.map(slotLabel).join(", ")}`} onClick={() => void cancelPause(pause)}>{pending === pause.id ? t.restoring : t.restore}</button>
              </li>)}</ul>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
