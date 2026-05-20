# LinkedIn Post

> Paste the text below directly into a LinkedIn post. Line breaks are intentional — LinkedIn preserves them.

---

🚁 Just open-sourced **stream-autel** — a real-time live streaming + telemetry dashboard for Autel drones.

RTMP in. HLS video and JSON telemetry out. ~3 seconds glass-to-glass in any modern browser, no plugin required.

**The problem:** Autel drones publish RTMP, but browsers don't speak RTMP. Most teams reach for heavy commercial ground-station software or fragile shell-script pipelines. I wanted something in between — a small, readable codebase you can drop on a Raspberry Pi or a VPS and stream from anywhere.

**The pipeline:**
↳ Autel RTMP → node-media-server (FFmpeg under the hood) → HLS segments → HLS.js in React

**Engineering choices worth flagging:**

• HLS over WebRTC. RTMP-to-WebRTC repacking is doable but brittle; HLS plays everywhere with one `<video>` tag. Latency trade-off: ~2–6s instead of sub-second.

• Tuned for live, not VOD: `hls_time=2`, `hls_list_size=3`, `delete_segments`. Disk stays empty, manifest stays short, latency stays bounded.

• Telemetry rides a **separate Socket.IO channel**, not muxed into the video. Battery and GPS update at their own cadence even if the video buffers.

• `FFMPEG_PATH` env var so you can swap in a hardware-accelerated build (`h264_nvenc`, `h264_qsv`) for higher-resolution streams.

**Stack:** TypeScript end-to-end. Express + node-media-server + Socket.IO on the backend. React 18 + Vite 5 + HLS.js + Tailwind on the frontend. MIT licensed.

It's v0.1 — no auth, no persistence, no multi-drone support yet. Plenty of low-hanging issues if you want to contribute.

Repo 👉 https://github.com/<your-org>/stream-autel

#OpenSource #TypeScript #React #NodeJS #LiveStreaming #FFmpeg #Drones #WebDev
