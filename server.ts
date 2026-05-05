import NodeMediaServer from 'node-media-server';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

// 1. Konfigurasi Media Server (RTMP to HLS/HTTP-FLV)
const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg', // use FFMPEG_PATH env or `ffmpeg` in PATH
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false, // hapus file HLS setelah stream selesai
      }
    ]
  }
};

const nms = new NodeMediaServer(nmsConfig);
nms.run();

// 2. Konfigurasi Telemetry API & WebSocket
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

// Endpoint untuk menerima telemetri dari Autel Controller (jika menggunakan custom app/script)
app.post('/api/telemetry', (req, res) => {
  const data = req.body; // { lat, lng, altitude, battery, speed }
  
  // Teruskan data ke dashboard via WebSockets
  io.emit('drone-telemetry', data);
  
  // TODO: Simpan data ke PostgreSQL untuk reporting (REN PULKET / LAPINFO)
  
  res.status(200).send('Telemetry received');
});

server.listen(4000, () => {
  console.log('API & WebSocket server running on port 4000');
});