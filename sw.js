// 画面とフォントを保存し、会場でネットがなくても表示できるようにする
const CACHE = 'kiosk-v1';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;700&family=Barlow+Condensed:wght@500;700&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(['./index.html']);
    // フォントは文字の範囲ごとに分かれたファイルなので、CSSに書かれたものを全部保存する
    try {
      const res = await fetch(FONT_CSS);
      await c.put(FONT_CSS, res.clone());
      const urls = [...(await res.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
      await Promise.all(urls.map(u => fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {})));
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // 画面はネットがあれば最新を取り、なければ保存分を出す
    if (e.request.mode === 'navigate') {
      try {
        const r = await fetch(e.request);
        if (r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (_) {
        return (await c.match('./index.html')) || Response.error();
      }
    }
    // フォントなどは保存分を優先する
    const hit = await c.match(e.request, { ignoreVary: true });
    if (hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());
      return r;
    } catch (_) {
      return Response.error();
    }
  })());
});
