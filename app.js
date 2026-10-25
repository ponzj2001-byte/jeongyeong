/* 전경 길잡이 — 화면 하나 = 구체적 전경 한 장 + 같은 일화의 전경 절 (짝 없는 전경 절은 한 절씩)
   저장(이 폰 안에만): 마지막 본 곳·책갈피·메모·설정 */
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const B = TOC.bigs, N = TOC.total;

  /* ---------- 저장 ---------- */
  const KEY = "jg-state";
  const S = Object.assign({ fs: 16, theme: "auto", rate: 1, auto: true, last: null, marks: [], memos: {} }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} sdTouch(); };
  /* SD카드 자동 저장 상태: mode "file"(고른 파일에 바로 덮어쓰기) | "dl"(하루 한 번 내려받기) */
  const SD = Object.assign({ mode: "", name: "", at: 0, day: "", body: "" }, (() => { try { return JSON.parse(localStorage.getItem("jg-sd")) || {}; } catch (e) { return {}; } })());
  let sdH = null, sdT = 0, sdReady = false;

  /* ---------- 위치·색 ---------- */
  function loc(n) {
    for (let b = 0; b < B.length; b++) for (let s = 0; s < B[b].subs.length; s++) {
      const [, f, c] = B[b].subs[s]; if (n >= f && n < f + c) return [b, s];
    }
    return [0, 0];
  }
  const dark = () => document.documentElement.dataset.theme === "dark";
  function mix(h, t, a) { const p = (x) => [1, 3, 5].map((i) => parseInt(x.substr(i, 2), 16)); const A = p(h), T = p(t); return "rgb(" + A.map((c, i) => Math.round(c * (1 - a) + T[i] * a)).join(",") + ")"; }
  function paint(b) {
    const r = document.documentElement.style, c = B[b].color;
    r.setProperty("--c", c);
    r.setProperty("--memo", dark() ? mix(c, "#1d1f24", .8) : B[b].memo);
    r.setProperty("--mline", dark() ? mix(c, "#1d1f24", .68) : mix(c, "#ffffff", .8));
    r.setProperty("--edge", mix(c, dark() ? "#1d1f24" : "#ffffff", .45));
    r.setProperty("--tape", dark() ? mix(c, "#1d1f24", .5) : mix(c, "#ffffff", .6));
  }
  function bigVars(b) { const c = B[b].color; return `--c:${c};--memo:${dark() ? mix(c, "#1d1f24", .8) : B[b].memo}`; }

  /* ---------- 본문 불러오기 (대단원 파일) ---------- */
  const loading = {};
  function loadBig(b) {
    if (DATA[b]) return Promise.resolve(DATA[b]);
    if (!loading[b]) loading[b] = new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = `data/u${String(b + 1).padStart(2, "0")}.js`;
      s.onload = () => ok(DATA[b]); s.onerror = () => { delete loading[b]; no(); }; document.head.appendChild(s);
    });
    return loading[b];
  }
  const loadAll = () => Promise.all(B.map((_, b) => loadBig(b)));
  function screen(n) { const [b] = loc(n); return DATA[b][n - B[b].subs[0][1]]; }

  /* ---------- 핵심어 강조 (화면마다 같은 낱말은 한 번, 글의 15% 안) ---------- */
  const KW = ["천지공사", "무극대도", "옥황상제", "공사", "도수", "신명", "해원", "상생", "개벽", "후천", "선천", "조화", "천지", "강세", "도통", "구천", "성도", "종도", "천명", "신교", "삼신", "천주", "미륵", "동학", "공부", "의통", "태을주", "일심", "조화정부", "도운"];
  const KRE = new RegExp(KW.sort((a, b) => b.length - a.length).join("|"), "g");
  function mark(t, used) {
    let budget = t.length * 0.15;
    return esc(t).replace(KRE, (w) => { if (used.has(w) || budget < w.length) return w; used.add(w); budget -= w.length; return `<b class="kw">${w}</b>`; });
  }

  /* ---------- 화면 전환 ---------- */
  let view = "home";
  function go(v) {
    if (v === "read" && view !== "read") return openScreen(S.last ? S.last.n : 0, S.last ? S.last.y : 0);
    if (v !== "read") stopSpeak();
    view = v; $$(".view").forEach((e) => e.classList.toggle("on", e.id === "v-" + v));
    $$(".tabs button").forEach((e) => e.classList.toggle("on", e.dataset.go === v));
    if (v === "home") renderHome(); if (v === "toc") renderToc(); if (v === "marks") renderMarks(); if (v === "more") renderMore();
    if (v !== "read") { document.documentElement.style.removeProperty("--c"); scrollTo(0, 0); }
    if (v === "search") setTimeout(() => $("#q").focus(), 50);
  }

  /* ---------- 읽기 ---------- */
  let cur = 0;
  function cardHTML(c, used) {
    const k = c[4], bm = S.marks.some((m) => m.k === k), memo = S.memos[k];
    const tools = `<div class="tools"><button data-bm="${k}" class="${bm ? "on" : ""}">${bm ? "★ 책갈피" : "☆ 책갈피"}</button><button data-memo="${k}">✏️ 메모</button><button data-say="${k}">🔊 읽기</button><button data-share="${k}">↗ 공유</button></div>`;
    const note = memo ? `<div class="note">${esc(memo.t)}</div>` : "";
    if (c[0] === "d")
      return `<article class="memo dj" id="c-${k}"><div class="tape"></div><div class="src s1">◆ 구체적 전경 ${c[1]}</div><h3>${esc(c[2])}</h3>` +
        c[3].map(([n, t]) => `<p><span class="vn">${n}</span>${mark(t, used)}</p>`).join("") + note + tools + `</article>`;
    return `<article class="memo jg" id="c-${k}"><div class="pin"></div><div class="src s2">❖ ${c[2] ? "같은 일화 · " : ""}전경 ${esc(c[1])}</div><p>${mark(c[3], used)}</p>` + note + tools + `</article>`;
  }
  async function openScreen(n, y) {
    n = Math.max(0, Math.min(N - 1, n | 0)); const [b, s] = loc(n);
    try { await loadBig(b); } catch (e) { return toast("내용을 불러오지 못했습니다. 인터넷을 확인해 주세요."); }
    stopSpeak(); cur = n; view = "read";
    $$(".view").forEach((e) => e.classList.toggle("on", e.id === "v-read"));
    $$(".tabs button").forEach((e) => e.classList.toggle("on", e.dataset.go === "read"));
    paint(b);
    const big = B[b], sub = big.subs[s];
    $("#r-bar").innerHTML = `<div class="rw"><button class="path" data-tocb="${b}">${big.no}. ${esc(big.title)} ›</button><span class="pg">${n + 1}/${N}</span></div><h1>${CIRC[s]} ${esc(sub[0])}</h1>`;
    $("#r-road").innerHTML = big.subs.map((x, k) => `<button class="${k === s ? "on" : ""}" data-open="${x[1]}">${CIRC[k]} ${esc(x[0])}</button>`).join("");
    const used = new Set();
    $("#r-body").innerHTML = screen(n).map((c) => cardHTML(c, used)).join("");
    const pv = n > 0, nx = n < N - 1;
    $("#r-prev").disabled = !pv; $("#r-next").disabled = !nx;
    $("#r-prev").innerHTML = `<small>◀ 이전 장</small>${pv ? esc(TOC.titles[n - 1]) : "처음입니다"}`;
    $("#r-next").innerHTML = `<small>다음 장 ▶</small>${nx ? esc(TOC.titles[n + 1]) : "끝입니다"}`;
    const on = $("#r-road .on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    scrollTo(0, y || 0); S.last = { n, y: y || 0 }; save();
    if (nx) loadBig(loc(n + 1)[0]).catch(() => {});
  }
  let st; addEventListener("scroll", () => { if (view !== "read") return; clearTimeout(st); st = setTimeout(() => { S.last = { n: cur, y: scrollY }; save(); }, 300); });
  addEventListener("pagehide", () => { if (view === "read") { S.last = { n: cur, y: scrollY }; save(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden && view === "read") { S.last = { n: cur, y: scrollY }; save(); } });
  $("#r-prev").onclick = () => openScreen(cur - 1);
  $("#r-next").onclick = () => openScreen(cur + 1);
  let sx = null, sy = null;
  $("#r-body").addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $("#r-body").addEventListener("touchend", (e) => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 60) openScreen(cur + (dx < 0 ? 1 : -1));
  });

  /* ---------- 홈 ---------- */
  function renderHome() {
    const r = $("#resume");
    if (S.last) {
      const [b, s] = loc(S.last.n);
      r.innerHTML = `<button class="resume" data-resume style="background:${B[b].color}"><span><small>이어 읽기 · ${B[b].no}. ${esc(B[b].title)} › ${CIRC[s]}</small><b>${esc(TOC.titles[S.last.n])}</b><small>${S.last.n + 1}/${N}</small></span><span class="go">계속 ▶</span></button>`;
    } else r.innerHTML = `<button class="resume" data-open="0" style="background:${B[0].color}"><span><small>처음부터 읽기</small><b>${esc(B[0].title)}</b></span><span class="go">시작 ▶</span></button>`;
    renderToday(); renderInstall();
    let h = "", part = null;
    B.forEach((x, b) => {
      if (x.part !== part) { if (part) h += "</div>"; part = x.part; h += `<div class="part">${esc(part)}</div><div class="bigs">`; }
      const cnt = x.subs.reduce((a, s) => a + s[2], 0);
      h += `<button class="bigc" style="${bigVars(b)}" data-tocb="${b}"><div class="no">${x.no}</div><div class="t">${esc(x.title)}</div><div class="n">소단원 ${x.subs.length} · ${cnt}화면</div></button>`;
    });
    $("#home-list").innerHTML = h + "</div>";
  }
  async function renderToday() {
    // 날짜마다 바뀌는 전경 한 절
    const ks = Object.keys(TOC.keys).filter((k) => k[0] === "j"), d = Math.floor((Date.now() + 9 * 3600e3) / 86400e3);
    let c, n;
    for (let t = 0; t < 12; t++) {  // 너무 긴 절은 건너뛰고 짧은 절을 고름
      const k = ks[((d + t * 131) * 7919) % ks.length]; n = TOC.keys[k];
      try { await loadBig(loc(n)[0]); } catch (e) { return; }
      c = screen(n).find((x) => x[4] === k); if (c[3].length <= 170) break;
    }
    $("#today").innerHTML = `<div class="today"><div class="h">☀️ 오늘의 말씀</div>${esc(c[3])}<div class="src"><span>전경 ${esc(c[1])}</span><button data-open="${n}">이 대목 열기 ›</button></div></div>`;
  }

  /* ---------- 목차 ---------- */
  let tocOpen = null;
  function renderToc() {
    const curN = S.last ? S.last.n : -1, [cb] = curN >= 0 ? loc(curN) : [-1];
    let h = "", part = null;
    B.forEach((x, b) => {
      if (x.part !== part) { part = x.part; h += `<div class="part">${esc(part)}</div>`; }
      const open = tocOpen === b || (tocOpen === null && cb === b);
      h += `<div class="tbig${open ? " open" : ""}" style="${bigVars(b)}" id="tb-${b}"><button class="hd" data-tbig="${b}"><b>${x.no}. ${esc(x.title)}</b><small>${x.subs.length}개 소단원</small></button><div class="bd">` +
        x.subs.map((s, k) => `<button class="tsub" data-tsub="${b}-${k}"><span class="c">${CIRC[k]}</span><span class="t">${esc(s[0])}</span><small>${s[2]}</small></button><div class="tlist" id="tl-${b}-${k}"></div>`).join("") + `</div></div>`;
    });
    $("#toc-list").innerHTML = h;
    if (curN >= 0) { const [b, s] = loc(curN); if (tocOpen === null || tocOpen === b) openSub(b, s, true); }
  }
  function openSub(b, k, scroll) {
    const el = $(`#tl-${b}-${k}`); if (!el) return;
    if (el.classList.contains("open") && !scroll) { el.classList.remove("open"); return; }
    const [, f, c] = B[b].subs[k], curN = S.last ? S.last.n : -1;
    let h = ""; for (let n = f; n < f + c; n++) h += `<button class="tch${TOC.titles[n].startsWith("전경 ") ? " j" : ""}${n === curN ? " cur" : ""}" data-open="${n}">${esc(TOC.titles[n])}</button>`;
    el.innerHTML = h; el.classList.add("open");
    if (scroll) { const c2 = el.querySelector(".cur") || el; setTimeout(() => c2.scrollIntoView({ block: "center" }), 30); }
  }

  /* ---------- 찾기 ---------- */
  let kind = "all", qt;
  const strip = (t) => t.replace(/\([^)]*[㐀-鿿][^)]*\)/g, "");
  function jump(q) {
    let m = q.match(/^\s*(\d{1,2})\s*(?::|편\s*)(\d{1,3})\s*장?\s*$/);
    if (m && TOC.keys[`d${m[1]}-${m[2]}`] != null) return TOC.keys[`d${m[1]}-${m[2]}`];
    return null;
  }
  async function doSearch() {
    const q = $("#q").value.trim(), out = $("#results");
    if (!q) { out.innerHTML = `<p class="fine">낱말로 찾거나, <b>3:45</b>(편:장)처럼 넣으면 그 장으로 바로 갑니다. 전경은 「행록 1장 7」처럼 넣어 보세요.</p>`; return; }
    const jn = jump(q);
    out.innerHTML = `<p class="fine">찾는 중…</p>`;
    try { await loadAll(); } catch (e) { out.innerHTML = `<p class="fine">내용을 다 불러오지 못했습니다. 인터넷을 확인해 주세요.</p>`; return; }
    if (q !== $("#q").value.trim()) return;
    const jm = q.match(/^\s*([가-힣]{2})\s*(?:(\d)\s*장\s*)?(\d{1,3})\s*절?\s*$/);
    const res = []; let more = 0;
    for (let b = 0; b < B.length; b++) DATA[b].forEach((sc, i) => {
      const n = B[b].subs[0][1] + i;
      sc.forEach((c) => {
        if (kind !== "all" && c[0] !== kind) return;
        if (jm && c[0] === "j") { const nm = jm[1] + (jm[2] ? ` ${jm[2]}장` : "") + ` ${jm[3]}절`; if (c[1] === nm) res.unshift({ b, n, c, t: c[3] }); return; }
        const lines = c[0] === "d" ? [c[2], ...c[3].map((v) => v[1])] : [c[3]];
        for (const t of lines) { if (t.includes(q) || strip(t).includes(q)) { if (res.length < 300) res.push({ b, n, c, t }); else more++; break; } }
      });
    });
    const asked = /^\s*\d{1,2}\s*(?::|편)\s*\d{1,3}/.test(q);
    let h = jn != null ? `<button class="res" data-open="${jn}" style="--c:${B[loc(jn)[0]].color}"><small>바로가기</small>◆ 구체적 전경 ${esc(q)} · ${esc(TOC.titles[jn])}</button>`
      : asked ? `<p class="fine">그 장은 이 앱에 넣지 않은 장입니다. 앞뒤 장 번호로 찾아보세요.</p>` : "";
    h += `<p class="fine">${res.length + more}곳${more ? ` (앞의 300곳만 보임)` : ""}</p>`;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    h += res.map(({ b, n, c, t }) => {
      const i = Math.max(0, t.indexOf(q) - 30), sn = (i ? "…" : "") + t.slice(i, i + 90) + (t.length > i + 90 ? "…" : "");
      const lab = c[0] === "d" ? `◆ 구체적 전경 ${c[1]} · ${c[2]}` : `❖ 전경 ${c[1]}`;
      return `<button class="res" data-open="${n}" data-card="${c[4]}" style="--c:${B[b].color}"><small>${esc(lab)} · ${B[b].no}</small>${esc(sn).replace(re, (w) => `<mark>${w}</mark>`)}</button>`;
    }).join("");
    out.innerHTML = h;
  }
  $("#q").addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(doSearch, 350); });
  $("#q-kind").addEventListener("click", (e) => { const t = e.target.closest("[data-k]"); if (!t) return; kind = t.dataset.k; $$("#q-kind button").forEach((x) => x.classList.toggle("on", x === t)); doSearch(); });

  /* ---------- 책갈피·메모 ---------- */
  function cardTitle(k) {
    const n = TOC.keys[k], sc = DATA[loc(n)[0]] && screen(n), c = sc && sc.find((x) => x[4] === k);
    if (!c) return TOC.titles[n];
    return c[0] === "d" ? `구체적 전경 ${c[1]} · ${c[2]}` : `전경 ${c[1]}`;
  }
  function toggleMark(k) {
    const i = S.marks.findIndex((m) => m.k === k);
    if (i >= 0) { S.marks.splice(i, 1); toast("책갈피를 뺐습니다"); } else { S.marks.unshift({ k, t: cardTitle(k), d: Date.now() }); toast("책갈피에 넣었습니다"); }
    save(); const btn = $(`[data-bm="${k}"]`); if (btn) { const on = i < 0; btn.classList.toggle("on", on); btn.textContent = on ? "★ 책갈피" : "☆ 책갈피"; }
  }
  function memoSheet(k) {
    openSheet(`<h2>✏️ 메모</h2><div class="fine" style="margin-top:0">${esc(cardTitle(k))}</div><textarea id="mtext" placeholder="이 대목에 대한 생각을 적어 두세요 (이 폰에만 저장)">${esc((S.memos[k] || {}).t || "")}</textarea>
      <div class="install on" style="border:0;padding:8px 0 0"><div class="btns"><button class="btn" id="msave">저장</button><button class="btn ghost" id="mdel">지우기</button></div></div>`);
    $("#msave").onclick = () => { const t = $("#mtext").value.trim(); if (t) S.memos[k] = { t, d: Date.now(), title: cardTitle(k) }; else delete S.memos[k]; save(); closeSheet(); if (view === "read") openScreen(cur, scrollY); toast(t ? "메모를 저장했습니다" : "메모를 지웠습니다"); };
    $("#mdel").onclick = () => { delete S.memos[k]; save(); closeSheet(); if (view === "read") openScreen(cur, scrollY); };
  }
  function renderMarks() {
    const item = (k, title, sub, kind) => { const n = TOC.keys[k]; if (n == null) return ""; const [b] = loc(n);
      return `<div class="mk" style="--c:${B[b].color}"><button class="o" data-open="${n}" data-card="${k}">${esc(title)}<small>${esc(sub)}</small></button><button class="x" data-del${kind}="${k}" aria-label="지우기">✕</button></div>`; };
    $("#bm-list").innerHTML = S.marks.length ? S.marks.map((m) => item(m.k, m.t, B[loc(TOC.keys[m.k])[0]].no + ". " + B[loc(TOC.keys[m.k])[0]].title, "bm")).join("") : `<div class="empty">읽기 화면에서 ☆ 책갈피를 누르면 여기에 모입니다.</div>`;
    const ms = Object.entries(S.memos).sort((a, b) => b[1].d - a[1].d);
    $("#memo-list").innerHTML = ms.length ? ms.map(([k, m]) => item(k, m.t.slice(0, 80), m.title || "", "memo")).join("") : `<div class="empty">읽기 화면에서 ✏️ 메모를 누르면 여기에 모입니다.</div>`;
  }
  $("#b-export").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "jg", v: 1, marks: S.marks, memos: S.memos, last: S.last }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `전경길잡이_백업_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("백업 파일을 내려받았습니다");
  };
  $("#b-import").onclick = () => $("#b-file").click();
  $("#b-file").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (d.app !== "jg") throw 0;
      const have = new Set(S.marks.map((m) => m.k)); (d.marks || []).forEach((m) => { if (!have.has(m.k)) S.marks.push(m); });
      Object.assign(S.memos, d.memos || {}); save(); renderMarks(); toast("백업을 불러왔습니다");
    } catch (x) { toast("이 앱의 백업 파일이 아닙니다"); }
    e.target.value = "";
  };

  /* ---------- SD카드 자동 저장 ----------
     책갈피·메모가 바뀔 때마다 폰 저장소(SD카드)의 파일에도 같이 저장. 서버로는 보내지 않음.
     파일 고르기를 지원하는 브라우저: 처음 한 번 SD카드에 파일을 정해 두면 그 파일에 바로 덮어씀.
     지원하지 않는 브라우저: 바뀐 날 하루 한 번 백업 파일을 내려받음(내려받기 위치를 SD카드로 정해 둠). */
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const pack = () => JSON.stringify({ app: "jg", v: 1, saved: new Date().toISOString(), marks: S.marks, memos: S.memos, last: S.last, set: { fs: S.fs, theme: S.theme, rate: S.rate, auto: S.auto } }, null, 1);
  const sdBody = () => JSON.stringify([S.marks, S.memos]);
  const sdKeep = () => { try { localStorage.setItem("jg-sd", JSON.stringify(SD)); } catch (e) {} };
  const canPick = () => typeof window.showSaveFilePicker === "function";
  function idb(val) {
    return new Promise((ok) => {
      try {
        const r = indexedDB.open("jg-files", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("h");
        r.onsuccess = () => { try { const st = r.result.transaction("h", val === undefined ? "readonly" : "readwrite").objectStore("h");
          const q = val === undefined ? st.get("sd") : val === null ? st.delete("sd") : st.put(val, "sd"); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch (e) { ok(null); } };
        r.onerror = () => ok(null);
      } catch (e) { ok(null); }
    });
  }
  function sdShow(msg) {
    const el = $("#sd-st"); if (!el) return;
    const when = SD.at ? new Date(SD.at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    el.textContent = msg || (SD.mode === "file" ? `켜짐 · 파일 「${SD.name}」에 저장${when ? " · 마지막 저장 " + when : ""}`
      : SD.mode === "dl" ? `켜짐 · 바뀐 날 하루 한 번 「내려받기」 폴더에 저장${when ? " · 마지막 저장 " + when : ""}` : "꺼짐 · 아래 「저장할 곳 정하기」를 누르세요");
    $("#sd-off").hidden = !SD.mode;
  }
  function sdDone() { SD.at = Date.now(); SD.body = sdBody(); sdKeep(); sdShow(); }
  async function sdWrite(ask) {
    if (!sdH) return false;
    try {
      let p = await sdH.queryPermission({ mode: "readwrite" });
      if (p !== "granted" && ask) p = await sdH.requestPermission({ mode: "readwrite" });
      if (p !== "granted") { sdShow("저장 대기 · 화면을 한 번 누르고 「허용」을 고르면 저장합니다"); return false; }
      const w = await sdH.createWritable(); await w.write(pack()); await w.close(); sdDone(); return true;
    } catch (e) { sdShow("저장하지 못했습니다 · 「저장할 곳 정하기」를 다시 눌러 주세요"); return false; }
  }
  function sdDownload() {
    const blob = new Blob([pack()], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `전경길잡이_자동저장_${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); SD.day = today(); sdDone();
  }
  // 책갈피·메모가 바뀌면 부름 (save() 안에서). 읽던 자리만 바뀔 때는 쓰지 않음.
  function sdTouch(now) {
    if (!sdReady || !SD.mode) return;
    if (!now && sdBody() === SD.body) return sdShow();
    if (SD.mode === "file") { clearTimeout(sdT); sdT = setTimeout(() => sdWrite(false), now ? 0 : 800); }
    // 내려받기는 사용자가 누른 순간에만 (누르지 않았을 때는 다음 터치 때 저장)
    else if (now || (SD.day !== today() && (!navigator.userActivation || navigator.userActivation.isActive))) sdDownload();
    else if (SD.day !== today()) sdShow("바뀐 내용이 있습니다 · 화면을 한 번 누르면 저장합니다");
    else sdShow("오늘 저장한 뒤 바뀐 내용이 있습니다 · 「지금 저장하기」를 누르거나 내일 첫 변경 때 저장됩니다");
  }
  $("#sd-pick").onclick = async () => {
    if (canPick()) {
      try {
        const h = await showSaveFilePicker({ suggestedName: "전경길잡이_자동저장.json", types: [{ description: "전경 길잡이 저장 파일", accept: { "application/json": [".json"] } }] });
        sdH = h; await idb(h); SD.mode = "file"; SD.name = h.name; sdKeep();
        if (await sdWrite(true)) toast("SD카드 파일에 저장했습니다. 이제부터 바뀔 때마다 자동 저장합니다");
      } catch (e) { if (e && e.name !== "AbortError") toast("이 브라우저에서는 파일을 고를 수 없습니다"); }
    } else {
      SD.mode = "dl"; sdKeep(); sdDownload(); $("#sd-help").hidden = false;
      toast("백업 파일을 내려받았습니다. 내려받기 위치를 SD카드로 정해 두세요");
    }
  };
  $("#sd-now").onclick = () => { if (!SD.mode) return $("#sd-pick").click(); if (SD.mode === "file") sdWrite(true).then((ok) => ok && toast("SD카드 파일에 저장했습니다")); else { sdDownload(); toast("백업 파일을 내려받았습니다"); } };
  $("#sd-off").onclick = () => { if (!confirm("SD카드 자동 저장을 끌까요? (이미 저장된 파일은 그대로 남습니다)")) return; SD.mode = ""; SD.name = ""; sdH = null; idb(null); sdKeep(); sdShow(); };
  // 앱을 다시 열면: 정해 둔 파일을 되찾고, 그동안 바뀐 것이 있으면 저장. 허락이 다시 필요하면 첫 터치 때 묻기.
  (async () => {
    if (SD.mode === "file") { sdH = await idb(); if (!sdH) { SD.mode = ""; sdKeep(); } }
    sdReady = true; sdShow();
    const changed = sdBody() !== SD.body;
    if (SD.mode === "file" && changed && !(await sdWrite(false)) && sdH) {
      const again = (e) => { if (!e.isTrusted) return; document.removeEventListener("click", again, true); sdWrite(true); };
      document.addEventListener("click", again, true);
    } else if (SD.mode === "dl" && changed && SD.day !== today()) {
      const again = (e) => { if (!e.isTrusted) return; document.removeEventListener("click", again, true); sdTouch(); };
      document.addEventListener("click", again, true);
    }
  })();

  /* ---------- 읽어주기 ---------- */
  let speaking = false, queue = [];
  const voice = () => { const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ko")); return vs.find((v) => /google|samsung/i.test(v.name)) || vs[0] || null; };
  const sayText = (c) => c[0] === "d" ? [`구체적 전경 ${c[1]}. ${c[2]}.`, ...c[3].map((v) => strip(v[1]))] : [`전경 ${c[1]}.`, strip(c[3])];
  function speak(lines, then) {
    if (!("speechSynthesis" in window)) return toast("이 브라우저는 읽어주기를 지원하지 않습니다");
    stopSpeak(); queue = lines.slice(); speaking = true; setPlay(); const v = voice();
    (function next() {
      if (!speaking) return;
      if (!queue.length) { speaking = false; setPlay(); if (then) then(); return; }
      const u = new SpeechSynthesisUtterance(queue.shift()); u.lang = "ko-KR"; if (v) u.voice = v; u.rate = S.rate;
      u.onend = next; u.onerror = () => { speaking = false; setPlay(); }; speechSynthesis.speak(u);
    })();
  }
  function speakScreen() {
    speak(screen(cur).flatMap(sayText), () => { if (S.auto && cur < N - 1) openScreen(cur + 1).then(() => setTimeout(speakScreen, 400)); });
  }
  function setPlay() { const p = $("#r-play"); p.classList.toggle("on", speaking); p.textContent = speaking ? "❚❚" : "▶"; }
  function stopSpeak() { speaking = false; queue = []; try { speechSynthesis.cancel(); } catch (e) {} setPlay(); }
  $("#r-play").onclick = () => speaking ? stopSpeak() : speakScreen();
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};

  /* ---------- 공유 ---------- */
  const online = () => /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, "");
  async function shareText(title, text) {
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text); toast("글을 복사했습니다. 붙여넣기로 보내세요"); } catch (e) { openSheet(`<h2>공유</h2><div class="link" style="white-space:pre-wrap">${esc(text)}</div>`); }
  }
  function shareCard(k) {
    const c = screen(cur).find((x) => x[4] === k); if (!c) return;
    const text = c[0] === "d" ? `「${c[2]}」\n` + c[3].map((v) => `${v[0]} ${v[1]}`).join("\n") + `\n— 구체적 전경 ${c[1]}` : `${c[3]}\n— 전경 ${c[1]}`;
    shareText("전경 길잡이", text);
  }
  async function shareApp() {
    if (!online()) return toast("인터넷 주소로 연 앱에서만 보낼 수 있습니다");
    const url = appUrl(), text = "전경 길잡이 앱입니다. 주소를 열고 비밀번호를 넣은 뒤, 메뉴에서 '홈 화면에 추가'를 누르면 폰에 설치됩니다.";
    if (navigator.share) { try { await navigator.share({ title: "전경 길잡이", text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text + "\n" + url); toast("주소를 복사했습니다"); } catch (e) { openSheet(`<h2>앱 주소</h2><div class="link">${esc(url)}</div>`); }
  }

  /* ---------- 설치 ---------- */
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; renderInstall(); });
  addEventListener("appinstalled", () => { installEvt = null; renderInstall(); toast("폰에 설치되었습니다"); });
  function renderInstall() {
    const box = $("#install"); if (!box) return;
    if (standalone() || !online()) { box.classList.remove("on"); return; }
    box.innerHTML = `<b>📲 폰에 앱으로 설치하기</b><p>설치하면 홈 화면 아이콘으로 바로 열리고, 인터넷이 없어도 읽을 수 있습니다.</p><div class="btns">${installEvt ? `<button class="btn" id="i-go">지금 설치</button>` : ""}<button class="btn ghost" id="i-how">설치하는 법</button></div>`;
    box.classList.add("on");
    if ($("#i-go")) $("#i-go").onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderInstall(); };
    $("#i-how").onclick = installSheet;
  }
  const steps = (t, a) => `<h2>${t}</h2><ol class="steps">${a.map((x) => `<li>${x}</li>`).join("")}</ol>`;
  const installSheet = () => openSheet(steps("폰에 앱으로 설치하는 법", [
    "<b>크롬</b>: 오른쪽 위 <b>⋮</b> → <b>홈 화면에 추가</b>(또는 <b>앱 설치</b>) → <b>설치</b>",
    "<b>삼성 인터넷</b>: 아래 <b>≡</b> → <b>현재 페이지 추가</b> → <b>홈 화면</b>",
    "홈 화면에 생긴 <b>전경 길잡이</b> 아이콘을 누르면 앱처럼 열립니다.",
    "한 번 열어 두면 인터넷이 없어도 읽을 수 있습니다."]));
  const voiceSheet = () => openSheet(steps("읽어주기 음성이 안 나올 때", [
    "폰 <b>설정</b> → <b>일반</b>(또는 일반 관리) → <b>글자 읽어주기</b>(TTS) 로 갑니다.",
    "기본 엔진을 <b>Google 음성 인식 및 합성</b> 또는 <b>삼성 TTS</b>로 고릅니다.",
    "엔진 설정에서 <b>한국어 음성 데이터</b>를 내려받습니다.",
    "앱을 껐다 켜고 ▶ 단추를 다시 누릅니다."]));

  /* ---------- 설정 ---------- */
  function applyTheme() {
    const d = S.theme === "dark" || (S.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    document.documentElement.style.setProperty("--fs", S.fs + "px");
  }
  function seg(id, opts, val, set) {
    $(id).innerHTML = opts.map(([v, l]) => `<button class="${v === val ? "on" : ""}" data-v="${v}">${l}</button>`).join("");
    $(id).onclick = (e) => { const t = e.target.closest("[data-v]"); if (!t) return; set(isNaN(t.dataset.v) ? t.dataset.v : +t.dataset.v); save(); applyTheme(); renderMore(); };
  }
  function renderMore() {
    seg("#s-font", [[14, "가"], [16, "가+"], [18, "가++"], [20, "크게"], [23, "아주"]], S.fs, (v) => S.fs = v);
    seg("#s-theme", [["auto", "자동"], ["light", "밝게"], ["dark", "어둡게"]], S.theme, (v) => S.theme = v);
    seg("#s-rate", [[0.8, "느리게"], [1, "보통"], [1.25, "빠르게"], [1.5, "아주"]], S.rate, (v) => S.rate = v);
    $("#s-auto").checked = S.auto; $("#s-auto").onchange = (e) => { S.auto = e.target.checked; save(); };
  }
  $("#m-share").onclick = shareApp; $("#m-install").onclick = installSheet; $("#m-voice").onclick = voiceSheet;

  /* ---------- 시트·알림 ---------- */
  function openSheet(h) { $("#sheet-body").innerHTML = h; $("#sheet").classList.add("on"); $("#sheet-bg").classList.add("on"); }
  function closeSheet() { $("#sheet").classList.remove("on"); $("#sheet-bg").classList.remove("on"); }
  $("#sheet-bg").onclick = closeSheet;
  let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2200); }

  /* ---------- 누르기 ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-go],[data-open],[data-resume],[data-tocb],[data-tbig],[data-tsub],[data-bm],[data-memo],[data-say],[data-share],[data-delbm],[data-delmemo]");
    if (!t) return; const d = t.dataset;
    if (d.go) return go(d.go);
    if (d.open != null) {
      closeSheet(); await openScreen(+d.open);
      if (d.card) { const el = $("#c-" + d.card); if (el) { el.scrollIntoView({ block: "start" }); scrollBy(0, -110); } }
      return;
    }
    if (t.hasAttribute("data-resume")) return openScreen(S.last.n, S.last.y);
    if (d.tocb != null) { tocOpen = +d.tocb; go("toc"); const el = $("#tb-" + d.tocb); if (el) { el.classList.add("open"); el.scrollIntoView({ block: "start" }); } return; }
    if (d.tbig != null) { const el = $("#tb-" + d.tbig); el.classList.toggle("open"); tocOpen = +d.tbig; return; }
    if (d.tsub) { const [b, k] = d.tsub.split("-").map(Number); return openSub(b, k, false); }
    if (d.bm) return toggleMark(d.bm);
    if (d.memo) return memoSheet(d.memo);
    if (d.say) { const c = screen(cur).find((x) => x[4] === d.say); return speak(sayText(c)); }
    if (d.share) return shareCard(d.share);
    if (d.delbm) { S.marks = S.marks.filter((m) => m.k !== d.delbm); save(); return renderMarks(); }
    if (d.delmemo) { if (confirm("이 메모를 지울까요?")) { delete S.memos[d.delmemo]; save(); renderMarks(); } return; }
  });

  /* ---------- 시작: 마지막으로 본 곳이 있으면 그 장에서 이어 엶 ---------- */
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); if (view === "read") paint(loc(cur)[0]); });
  const hn = parseInt(location.hash.slice(1), 10);
  if (!isNaN(hn)) openScreen(hn);
  else if (S.last) openScreen(S.last.n, S.last.y).then(() => toast("마지막으로 보던 곳에서 이어서 엽니다"));
  else go("home");
})();
