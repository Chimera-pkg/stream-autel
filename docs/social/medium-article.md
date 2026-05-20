# Building a Real-Time Drone Streaming Dashboard with Node.js, FFmpeg, and React

*How I wired an Autel drone's RTMP feed to a browser dashboard in under 500 lines of TypeScript — and what I learned about HLS tuning, telemetry decoupling, and resisting the urge to over-engineer.*

---

## The Problem

Most consumer and prosumer drones — Autel, DJI, Skydio — speak **RTMP** when you ask them to live-stream. RTMP is a fine 2005-era protocol, but browsers don't natively play it. So if you want a teammate halfway across the world to watch your drone's camera from a laptop, you have two practical choices: pay for heavy commercial ground-station software, or stitch together a DIY pipeline of FFmpeg flags and prayer.

I wanted a third option: a small, readable codebase I could drop on a Raspberry Pi, a VPS, or my laptop, and have a browser dashboard show me live video plus telemetry (battery, GPS, altitude, speed) with minimal fuss. The result is **stream-autel**, MIT-licensed and now on GitHub.

## Architecture at a Glance

```
┌──────────────┐   RTMP    ┌────────────────────┐    HLS     ┌──────────────────┐
│ Autel Drone  ├──────────►│  node-media-server ├───────────►│ React Frontend   │
│  (RTMP out)  │  :1935    │   (transcode)      │   :8000    │     :3000        │
└──────────────┘           └────────────────────┘            └────────▲─────────┘
                                                                      │
┌──────────────┐  POST /api/telemetry   ┌────────────────────┐        │ Socket.IO
│  Telemetry   ├───────────────────────►│  Express + Socket  ├────────┘
│   source     │                        │      .IO :4000     │
└──────────────┘                        └────────────────────┘
```

One Node process, three concerns: an RTMP/HLS media server, a JSON telemetry endpoint, and a WebSocket broadcaster. The React frontend speaks HLS for video and Socket.IO for telemetry. That's the whole system.

## RTMP Ingest with node-media-server

`node-media-server` is a pure-Node RTMP/HTTP-FLV/HLS server that wraps FFmpeg for transcoding. It's the right level of abstraction for this job — high enough that I don't write FFmpeg invocations by hand, low enough that I can still tune every parameter that matters.

```ts
const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media',
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false,
      },
    ],
  },
};
```

A few details worth calling out. `gop_cache: true` makes new viewers pick up the stream at the most recent keyframe rather than waiting for the next one — meaningful when GOP intervals are several seconds. `FFMPEG_PATH` lets operators substitute a hardware-accelerated FFmpeg build (`h264_nvenc` on NVIDIA, `h264_qsv` on Intel) without touching code, which matters once you push past 1080p.

## HLS Tuning for Low Latency

HLS has a reputation for being slow. That reputation is earned — by default, players wait for several 6-to-10-second segments before starting playback. For a live drone feed, that's unacceptable.

The relevant flags are in the config above: `hls_time=2` produces 2-second segments, `hls_list_size=3` keeps only the three most recent segments in the manifest, and `delete_segments` cleans the rest off disk. The arithmetic: a player needs roughly two segments buffered before it begins playing, so 2-second segments × 2 ≈ 4 seconds of inherent latency, plus encode time, plus network. End-to-end I measure ~3–5 seconds on a LAN and ~5–8 over WAN.

The obvious alternative is WebRTC, which gets you sub-second latency. I deliberately didn't go there. Repackaging RTMP into WebRTC's SRTP-based transport is doable but operationally fragile — TURN servers, ICE negotiation, codec compatibility quirks. HLS plays in every browser with a single `<video>` element and no signaling. For a v0.1, that simplicity wins.

## Telemetry: Why a Separate Channel

Video and telemetry are *different data*. They have different latency requirements (telemetry should arrive faster than video for safety-relevant readings), different bandwidth profiles, and different failure modes. Muxing telemetry into the video container's metadata tracks would couple them in ways I don't want.

So telemetry rides its own channel: HTTP POST in, Socket.IO broadcast out.

```ts
app.post('/api/telemetry', (req, res) => {
  const data = req.body; // { lat, lng, altitude, battery, speed }
  io.emit('drone-telemetry', data);
  res.status(200).send('Telemetry received');
});
```

Twelve lines, including the `app.use(express.json())` upstream. Whatever source you have for telemetry — a custom Autel SDK script, a serial bridge from a Pixhawk, a manual debug poke from `curl` — POSTs JSON to one endpoint, and every connected dashboard updates in real time. There's a `TODO` in there for persistence (PostgreSQL, time-series DB, whatever), which is the next obvious extension.

## Frontend: HLS.js + React Hooks

The frontend is intentionally boring. A `useRef` on the `<video>` element, an `HLS.js` instance attaching to that element, and a Socket.IO subscription updating component state.

```tsx
useEffect(() => {
  if (videoRef.current && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(`http://${HOST}:8000/live/autelv2/index.m3u8`);
    hls.attachMedia(videoRef.current);
  }

  socket.on('connect', () => setIsConnected(true));
  socket.on('disconnect', () => setIsConnected(false));
  socket.on('drone-telemetry', (data: Telemetry) => setTelemetry(data));

  return () => {
    socket.off('drone-telemetry');
    socket.off('connect');
    socket.off('disconnect');
  };
}, []);
```

HLS.js handles all the segment-fetching, buffer-management, and adaptive-bitrate logic. React Hooks handle the state. Tailwind handles the styling. The dashboard color-codes battery level (green > 60%, yellow 30–60%, red < 30%) and pulses a connection indicator when the WebSocket is live. That's all the UI logic.

## What's Next

v0.1 is deliberately minimal. Things I'd reach for next:

- **Persistence** — the `TODO` in `server.ts` exists for a reason. A time-series DB (TimescaleDB, InfluxDB) would let you replay missions.
- **Auth** — right now the API and HLS endpoint are wide open. Anyone on the network can publish to `rtmp://host:1935/live/autelv2`. A stream-key validation hook in `node-media-server` is the right place to start.
- **Multi-drone** — one stream key today (`autelv2`). Generalizing the frontend to a drone-picker is a half-day of work.
- **Map view** — the dashboard shows lat/lng as raw numbers. A Leaflet or MapLibre overlay is the obvious upgrade.

If any of those scratch an itch, the issues tab is empty and waiting.

## Try It

```bash
git clone https://github.com/<your-org>/stream-autel.git
cd stream-autel
npm install
npm --prefix frontend install
npm run dev
```

Point your Autel ground station's RTMP output at `rtmp://<your-host>:1935/live/autelv2`, open `http://localhost:3000`, and you should see your drone's feed within a few seconds.

Repo: **https://github.com/&lt;your-org&gt;/stream-autel** — MIT licensed, contributions welcome.

---

*Tags: nodejs, react, typescript, live-streaming, drones*
