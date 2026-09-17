import {useEffect, useRef, useState} from "react";

type Round = {id:string;starts_at:string;war_type:string};

type GuildWarRoundPickerProps = {
  rounds: Round[];
  selectedId: string;
  warningByRound: Record<string, number>;
  language: "th" | "en";
  disabled?: boolean;
  onChange: (roundId: string) => void;
};

function formatRound(round: Round, language: "th" | "en") {
  return new Date(round.starts_at).toLocaleString(language === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "short",
  }) + " · " + round.war_type;
}

export function GuildWarRoundPicker({
  rounds,
  selectedId,
  warningByRound,
  language,
  disabled = false,
  onChange,
}: GuildWarRoundPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, rounds.findIndex((round) => round.id === selectedId));
  const selectedRound = rounds[selectedIndex];
  const selectedWarning = selectedRound ? warningByRound[selectedRound.id] || 0 : 0;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(index: number) {
    const nextRound = rounds[index];
    if (!nextRound) return;
    onChange(nextRound.id);
    setOpen(false);
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      setOpen(true);
      choose(Math.min(selectedIndex + 1, rounds.length - 1));
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      setOpen(true);
      choose(Math.max(selectedIndex - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={"gw-round-picker" + (selectedWarning > 0 ? " has-unassigned" : "")}>
      <button
        type="button"
        role="combobox"
        aria-label="War round"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="gw-round-picker-trigger"
        disabled={disabled || rounds.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="gw-round-picker-label">
          {selectedRound ? formatRound(selectedRound, language) : (language === "th" ? "กำลังโหลดรอบ War…" : "Loading War rounds…")}
        </span>
        {selectedWarning > 0 && <span className="gw-round-warning" title={language === "th" ? `ยังมี ${selectedWarning} คนที่ไม่ได้จัดทีม` : `${selectedWarning} player(s) still unassigned`}>⚠ {selectedWarning}</span>}
        <span className="gw-round-picker-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && rounds.length > 0 && (
        <div className="gw-round-picker-menu" role="listbox" aria-label="War rounds">
          {rounds.map((round, index) => {
            const warning = warningByRound[round.id] || 0;
            const isSelected = index === selectedIndex;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={round.id}
                className={"gw-round-picker-option" + (isSelected ? " selected" : "")}
                onClick={() => choose(index)}
              >
                <span className="gw-round-picker-label">{formatRound(round, language)}</span>
                {warning > 0 && <span className="gw-round-warning" title={language === "th" ? `ยังมี ${warning} คนที่ไม่ได้จัดทีม` : `${warning} player(s) still unassigned`}>⚠ {warning}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
