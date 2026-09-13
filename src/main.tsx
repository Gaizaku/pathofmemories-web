import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GuildWarOverlayProvider } from "./GuildWarOverlay";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><GuildWarOverlayProvider><App /></GuildWarOverlayProvider></StrictMode>);
