// v3 (26-11-12): 녹음이 sori-audio-N 저장소(같은 출처 /sori-audio-N/...)로 옮겨 가서, 미리 받은 녹음 꺼내기에 그 경로도 넣음.
// v2 (26-11-09): 미리 받기. 화면과 guide_data.js, chime.wav는 늘 인터넷에서 새로 받고 끊겼을 때만 저장본.
// 사진과 녹음은 '미리 받기'로 받아 둔 것(sori-dl)만 저장본에서 꺼내고, 나머지는 그대로 인터넷에서.
const C = "sori-v2", DL = "sori-dl", KEEP = [C, DL];
const BASE = ["guide_data.js", "chime.wav"];
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => Promise.all([c.add(new Request("./", { cache: "reload" })), ...BASE.map(f => c.add(new Request(f, { cache: "reload" })).catch(() => {}))])));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
async function ranged(res, req) {  // 녹음은 재생기가 부분(Range)으로 달라고 하므로 잘라서 206으로
  const r = req.headers.get("range"); if (!r) return res;
  const buf = await res.arrayBuffer(), n = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(r);
  let s = 0, en = n - 1;
  if (m && m[1]) { s = +m[1]; if (m[2]) en = Math.min(+m[2], n - 1); } else if (m && m[2]) { s = Math.max(0, n - +m[2]); }
  return new Response(buf.slice(s, en + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
    "Content-Range": `bytes ${s}-${en}/${n}`, "Content-Length": String(en - s + 1), "Accept-Ranges": "bytes" } });
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url); if (u.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname, rel = u.pathname.startsWith(scope) ? u.pathname.slice(scope.length) : "";
  if (req.mode === "navigate") {
    e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
      const copy = r.clone(); caches.open(C).then(c => c.put("./", copy)); return r;
    }).catch(() => caches.match("./")));
  } else if (BASE.includes(rel)) {
    e.respondWith(fetch(req.url, { cache: "no-cache" }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put(rel, copy)); } return r;
    }).catch(() => caches.open(C).then(c => c.match(rel)).then(hit => hit ? ranged(hit, req) : Response.error())));
  } else if (rel.startsWith("images/") || rel.startsWith("audio/") || rel.startsWith("sori-audio-")) {
    e.respondWith(caches.open(DL).then(c => c.match(u.origin + u.pathname)).then(hit => hit ? ranged(hit, req) : fetch(req)));
  }
});
