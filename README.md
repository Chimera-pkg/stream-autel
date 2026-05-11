# stream-autel

Real-time live streaming and telemetry dashboard for Autel drones.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-3178C6.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)

## Overview

`stream-autel` ingests an RTMP video stream from an Autel drone, transcodes it to HLS for low-latency playback in any modern browser, and broadcasts telemetry data (battery, altitude, GPS, speed) over WebSockets to a live React dashboard. Backend is Node.js + TypeScript; frontend is React + Vite.

## Features

- Live HLS video playback from any RTMP source (default stream key: `autelv2`)
- Real-time telemetry over Socket.IO: battery %, altitude, latitude/longitude, speed
- Dynamic battery-level color coding (green / yellow / red)
- Live connection status indicator
- Responsive layout (single-column on mobile, 3+1 column grid on desktop)
- Configurable FFmpeg path via `FFMPEG_PATH` environment variable

## Architecture

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

## Tech Stack

**Backend**
- Node.js + TypeScript 5.1
- Express 4 — HTTP API
- node-media-server 2 — RTMP ingest + HLS transcoding (requires FFmpeg)
- Socket.IO 4 — telemetry WebSocket broadcast

**Frontend**
- React 18 + Vite 5
- HLS.js — HLS playback in the browser
- Socket.IO Client — telemetry receiver
- Tailwind CSS 4

## Prerequisites

- **Node.js 18+** and npm
- **FFmpeg** installed and available on your `PATH` (or set the `FFMPEG_PATH` environment variable to point to the binary). FFmpeg is required by `node-media-server` to transcode RTMP to HLS.

## Project Structure

```
stream-autel/
├── server.ts                 # Backend: RTMP/HLS media server + telemetry API + WebSocket
├── tsconfig.json
├── package.json
├── types/
│   └── node-media-server.d.ts
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       └── DroneDashboard.tsx
│   ├── vite.config.ts
│   └── package.json
└── media/                    # HLS segments (created at runtime)
```

## Installation

```bash
git clone https://github.com/<your-org>/stream-autel.git
cd stream-autel

# Install backend dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install
```

## Development

Run backend and frontend together with hot reload:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server      # Backend on :4000 (API/WS) + :1935 (RTMP) + :8000 (HLS)
npm run dev:frontend    # Frontend on :3000
```

Then open:

- Dashboard: <http://localhost:3000>
- Telemetry API: <http://localhost:4000>
- HLS media server: <http://localhost:8000>

## Production Build

```bash
# Backend: compile TypeScript to dist/
npm run build
npm run start:server

# Frontend: produce static bundle in frontend/dist
npm --prefix frontend run build
```

Serve `frontend/dist` with any static host (Nginx, Caddy, etc.) or behind the same reverse proxy as the backend.

## Endpoints

| Purpose             | URL                                                   |
| ------------------- | ----------------------------------------------------- |
| RTMP ingest         | `rtmp://<host>:1935/live/autelv2`                     |
| HLS playback        | `http://<host>:8000/live/autelv2/index.m3u8`          |
| Telemetry (POST)    | `http://<host>:4000/api/telemetry`                    |
| Telemetry WebSocket | `ws://<host>:4000` — event `drone-telemetry`          |

## Sending Telemetry

Any source that can POST JSON can feed the dashboard. Payload shape:

```json
{
  "lat": -6.200000,
  "lng": 106.816666,
  "altitude": 120,
  "battery": 78,
  "speed": 14
}
```

Example with `curl`:

```bash
curl -X POST http://localhost:4000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"lat":-6.2,"lng":106.81,"altitude":120,"battery":78,"speed":14}'
```

The server emits the payload to all connected dashboards on the `drone-telemetry` Socket.IO event.

## Configuring an Autel Drone

In your Autel ground station / Live Deck streaming settings, set the RTMP destination to:

```
rtmp://<your-server-ip>:1935/live/autelv2
```

The default stream key is `autelv2`. To use a different key, change the URL the drone publishes to and update the HLS source path in [frontend/src/components/DroneDashboard.tsx](frontend/src/components/DroneDashboard.tsx) accordingly.

## Environment Variables

| Variable      | Default    | Description                                  |
| ------------- | ---------- | -------------------------------------------- |
| `FFMPEG_PATH` | `ffmpeg`   | Path to the FFmpeg binary used for HLS transcoding |

## License

[MIT](LICENSE)
