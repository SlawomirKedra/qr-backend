require('dotenv').config();
const express = require("express");
const axios = require("axios");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SpotifyTokenUrl = "https://accounts.spotify.com/api/token";

let spotifyToken = null;
async function getSpotifyToken() {
  if (spotifyToken && spotifyToken.expires > Date.now()) return spotifyToken.token;

  const resp = await axios.post(SpotifyTokenUrl, "grant_type=client_credentials", {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    auth: {
      username: process.env.SPOTIFY_CLIENT_ID,
      password: process.env.SPOTIFY_CLIENT_SECRET
    }
  });
  spotifyToken = {
    token: resp.data.access_token,
    expires: Date.now() + resp.data.expires_in * 1000
  };
  return spotifyToken.token;
}

app.post("/generate", async (req, res) => {
  const { playlistUrl } = req.body;
  if (!playlistUrl) return res.status(400).send("playlistUrl is required");

  try {
    const playlistId = playlistUrl.split("/").pop().split("?")[0];
    const token = await getSpotifyToken();

    const items = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    while (url) {
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      resp.data.items.forEach(i => {
        const t = i.track;
        items.push({
          title: t.name,
          artist: t.artists[0].name,
          year: t.album.release_date.slice(0, 4),
          url: t.external_urls.spotify
        });
      });
      url = resp.data.next;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const size = 6 * 72 / 2.54;

    for (const song of items) {
      doc.fontSize(12).text(`${song.title} – ${song.artist} (${song.year})`);
      const qrDataUrl = await QRCode.toDataURL(song.url);
      const img = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const imgBuf = Buffer.from(img, 'base64');
      doc.image(imgBuf, doc.x, doc.y + 10, { width: size, height: size });
      doc.moveDown(3);
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating PDF");
  }
});

app.get("/", (req, res) => {
  res.send("🎵 QR Generator Backend działa!");
});

app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));