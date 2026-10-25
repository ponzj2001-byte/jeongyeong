/* 오프라인 저장: 앱 파일을 폰에 보관해 인터넷 없이 열리게 함.
   내용을 고치면 VERSION 숫자를 올려야 폰에 새 내용이 반영됨.
   인터넷에서 오류(404 등)가 오면 보관해 둔 내용을 그대로 씀 → 올린 곳이 사라져도 폰의 앱은 계속 열림 */
const VERSION = "jg-v3";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "data/toc.js", "data/u01.js", "data/u02.js", "data/u03.js", "data/u04.js", "data/u05.js", "data/u06.js", "data/u07.js", "data/u08.js", "data/u09.js", "data/u10.js", "data/u11.js", "data/u12.js", "data/u13.js", "data/u14.js", "data/u15.js", "data/u16.js", "data/u17.js", "data/u18.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"));
  e.respondWith(
    fetch(e.request).then((res) => {
      if (!res.ok) return fromCache().then((hit) => hit || res);
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(fromCache)
  );
});
