# Twitter / X Thread

> Paste each numbered block as a separate tweet. All tweets are under 280 characters.

---

**1/**
I open-sourced a real-time drone streaming dashboard.

RTMP in. HLS video + JSON telemetry out. ~3 second glass-to-glass latency in any browser, no plugin.

TypeScript end-to-end, MIT licensed. Stack and design choices below 🧵

**2/**
The pipeline:

Autel drone → RTMP (port 1935) → node-media-server (FFmpeg under the hood) → HLS segments → HLS.js in a React `<video>` tag

One Node process. ~50 lines of backend. The whole media server config is a single object literal.

**3/**
Why HLS, not WebRTC?

WebRTC gets you sub-second latency but drags in TURN servers, ICE negotiation, and codec headaches.

HLS plays in every browser with one `<video>` element. Trade ~2–6s latency for radical simplicity. For v0.1, simplicity wins.

**4/**
HLS tuning that matters:

• hls_time=2 (2-second segments)
• hls_list_size=3 (3-segment manifest)
• delete_segments (no disk bloat)

Default HLS buffers ~30s. This config gets it under 5s end-to-end on a LAN.

**5/**
Telemetry rides a separate Socket.IO channel — not muxed into the video.

POST /api/telemetry → io.emit('drone-telemetry') → every dashboard updates instantly.

Battery + GPS shouldn't stall because video is buffering. Decouple the channels.

**6/**
Frontend is intentionally boring:

React 18 + Vite 5 + HLS.js + Tailwind v4.
useRef on <video>, Hls.attachMedia, Socket.IO listener in useEffect. That's it.

The dashboard color-codes battery (green/yellow/red) and pulses on WS connect.

**7/**
What's deliberately NOT in v0.1:
• no auth
• no DB
• one drone, one stream key
• no map overlay

Each is a clean, well-scoped issue waiting in the repo. Resist the urge to ship v1.0 before v0.1 exists.

**8/**
Code, README, MIT license — all on GitHub:

https://github.com/<your-org>/stream-autel

If you fly Autel (or DJI — RTMP is RTMP) and want a hackable dashboard, clone it and break things. Issues and PRs welcome.

---

## Character counts (for verification)

| Tweet | Chars |
| ----- | ----- |
| 1     | ~245  |
| 2     | ~244  |
| 3     | ~256  |
| 4     | ~199  |
| 5     | ~244  |
| 6     | ~245  |
| 7     | ~225  |
| 8     | ~225  |

All within Twitter's 280-character limit.
