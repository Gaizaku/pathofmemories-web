import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import "./GuildWarOverlay.css";

type NoticeKind = "success" | "error" | "info";
type ConfirmOptions = {title:string; message:string; confirmLabel:string; cancelLabel:string; danger?:boolean};
type Overlay = {notify:(message:string, kind?:NoticeKind)=>void; confirm:(options:ConfirmOptions)=>Promise<boolean>};
const OverlayContext = createContext<Overlay|null>(null);

export function GuildWarOverlayProvider({children}:{children:ReactNode}) {
  const [notice,setNotice] = useState<{message:string;kind:NoticeKind}|null>(null);
  const [confirmation,setConfirmation] = useState<ConfirmOptions|null>(null);
  const resolver = useRef<((accepted:boolean)=>void)|null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.kind === "error" ? 6000 : 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const value:Overlay = {
    notify: (message, kind="info") => {if (message) setNotice({message,kind});},
    confirm: (options) => new Promise((resolve) => {resolver.current=resolve;setConfirmation(options);}),
  };
  function finish(accepted:boolean) {resolver.current?.(accepted);resolver.current=null;setConfirmation(null);}
  return <OverlayContext.Provider value={value}>{children}{notice&&<div className="gw-notice-backdrop" role="presentation"><section className={'gw-notice gw-notice-'+notice.kind} role={notice.kind==='error'?'alert':'status'} aria-live="polite"><span>{notice.kind==='success'?'✓':notice.kind==='error'?'!':'i'}</span><p>{notice.message}</p><button type="button" aria-label="Close" onClick={() => setNotice(null)}>×</button></section></div>}{confirmation&&<div className="gw-confirm-backdrop" role="presentation"><section className={'gw-confirm '+(confirmation.danger?'is-danger':'')} role="dialog" aria-modal="true" aria-labelledby="gw-confirm-title"><h2 id="gw-confirm-title">{confirmation.title}</h2><p>{confirmation.message}</p><footer><button type="button" onClick={() => finish(false)}>{confirmation.cancelLabel}</button><button type="button" className="gw-confirm-accept" onClick={() => finish(true)}>{confirmation.confirmLabel}</button></footer></section></div>}</OverlayContext.Provider>;
}

export function useGuildWarOverlay() {
  const overlay = useContext(OverlayContext);
  if (!overlay) throw new Error("Guild War overlay is unavailable");
  return overlay;
}
