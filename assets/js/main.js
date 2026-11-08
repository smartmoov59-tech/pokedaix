/* ==========================================================================
   POKEDAIX — animations & réservation (site statique, aucun back-end)
   GSAP + ScrollTrigger + Lenis (fichiers locaux, voir assets/js/vendor)
   Réservation : message pré-rempli SMS / WhatsApp / e-mail + fichier .ics
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const safe = (fn) => { try { fn(); } catch (e) { console.error('[pokedaix]', e); } };

  /* ---------- Données de la boutique ---------- */
  const SHOP = {
    phone: '+33753884939',
    email: 'pokedaix.shop@gmail.com',
    place: 'Pokedaix, 19 rue d’Entrecasteaux, 13100 Aix-en-Provence'
  };
  // Horaires (source : fiche Google Maps). Mercredi : 11h–19h supposé comme jeudi-samedi.
  const HOURS = { 0: null, 1: null, 2: [13, 19], 3: [11, 19], 4: [11, 19], 5: [11, 19], 6: [11, 19] };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const RACHAT_DAYS = [2, 6]; // rachat & expertise : mardi et samedi uniquement

  const parisNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));

  /* ---------- Fail-safe : si GSAP est absent, on affiche tout ---------- */
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap) {
    const l = $('#loader'); if (l) l.remove();
    root.classList.remove('is-loading');
  }

  /* ---------- Ouvert / fermé (calcul en heure de Paris) ---------- */
  function updateStatus() {
    const n = parisNow(), d = n.getDay(), t = n.getHours() + n.getMinutes() / 60, today = HOURS[d];
    let cls = 'is-closed', text;
    if (today && t >= today[0] && t < today[1]) {
      cls = 'is-open'; text = `Ouvert · ferme à ${today[1]}h`;
    } else {
      let label = null;
      if (today && t < today[0]) label = `aujourd’hui à ${today[0]}h`;
      else for (let i = 1; i <= 7; i++) {
        const dd = (d + i) % 7;
        if (HOURS[dd]) { label = i === 1 ? `demain à ${HOURS[dd][0]}h` : `${DAYS[dd]} à ${HOURS[dd][0]}h`; break; }
      }
      text = `Fermé · ouvre ${label}`;
    }
    $$('[data-status]').forEach((el) => {
      el.classList.remove('is-open', 'is-closed'); el.classList.add(cls);
      const b = $('[data-status-text]', el); if (b) b.textContent = text;
    });
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', +tr.dataset.day === d));
  }
  updateStatus(); setInterval(updateStatus, 60000);

  /* ---------- Découpe de texte (lettres / mots) avec masque ---------- */
  function split(el, mode) {
    const chars = [], words = [];
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            if (mode === 'chars') {
              Array.from(tok).forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); chars.push(s); });
            } else {
              const s = document.createElement('span'); s.className = 'wi'; s.textContent = tok; w.appendChild(s); words.push(s);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    const wrap = document.createElement('span'); wrap.setAttribute('aria-hidden', 'true'); wrap.style.display = 'contents';
    while (el.firstChild) wrap.appendChild(el.firstChild);
    el.appendChild(wrap);
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = label; el.appendChild(sr);
    return { chars, words };
  }

  /* ---------- Vidéo du hero : adaptée à l’écran et aux préférences ---------- */
  safe(() => {
    const v = $('#heroVideo'); if (!v) return;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduce || saveData) {
      v.removeAttribute('autoplay'); v.pause(); $$('source', v).forEach((s) => s.remove()); v.load();
    } else if (window.innerWidth < 768) {
      const s = $('source', v); if (s) { s.src = 'assets/video/hero-8348410-sd.mp4'; v.load(); v.play().catch(() => {}); }
    }
  });
  // Vidéo de la section réservation : chargée seulement quand on s’en approche
  safe(() => {
    const v = $('[data-lazy-video]'); if (!v || reduce) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          if (!v.src) { v.src = v.dataset.lazyVideo; v.load(); }
          v.play().catch(() => {});
        } else v.pause();
      });
    }, { rootMargin: '300px' });
    io.observe(v);
  });

  /* ======================================================================
     Tout ce qui suit nécessite GSAP
     ====================================================================== */
  let lenis = null;
  const onScroll = (cb) => {
    if (lenis) lenis.on('scroll', (e) => cb(e.scroll, e.direction));
    else { let last = window.scrollY; window.addEventListener('scroll', () => { const y = window.scrollY; cb(y, y > last ? 1 : -1); last = y; }, { passive: true }); }
  };

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    if (!reduce && window.Lenis) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ---------- Menu mobile ---------- */
  const menu = $('#menu'), burger = $('#burger');
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    if (open) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (lenis) open ? lenis.stop() : lenis.start();
    root.style.overflow = open && !lenis ? 'hidden' : '';
    const nav = $('#nav'); if (open) nav.classList.remove('is-hidden');
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

  /* ---------- Ancres : défilement fluide ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); if (!id || id.length < 2) return;
      const target = $(id); if (!target) return;
      e.preventDefault();
      const wasOpen = menuOpen; if (wasOpen) setMenu(false);
      const go = () => {
        if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -8, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: 'auto', block: 'start' });
        history.replaceState(null, '', id);
      };
      wasOpen ? setTimeout(go, 450) : go();
    });
  });

  /* ---------- Nav (se cache en descendant) + barre de progression ---------- */
  const navEl = $('#nav'), bar = $('#progress');
  onScroll((y, dir) => {
    navEl.classList.toggle('is-solid', y > 60);
    if (y > 320 && dir === 1 && !menuOpen) navEl.classList.add('is-hidden');
    else if (dir === -1 || y <= 320) navEl.classList.remove('is-hidden');
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
  });

  /* ---------- Boutons magnétiques ---------- */
  safe(() => {
    if (!hasGsap || !hasHover || reduce) return;
    const items = $$('[data-magnet]').map((btn) => {
      const label = $('.btn__label', btn);
      return {
        btn,
        bx: gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'power3.out' }), by: gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'power3.out' }),
        lx: label ? gsap.quickTo(label, 'x', { duration: 0.7, ease: 'power3.out' }) : null,
        ly: label ? gsap.quickTo(label, 'y', { duration: 0.7, ease: 'power3.out' }) : null
      };
    });
    window.addEventListener('pointermove', (e) => {
      items.forEach((it) => {
        const r = it.btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy, reach = Math.max(r.width, r.height) * 0.9;
        if (Math.hypot(dx, dy) < reach) { it.bx(dx * 0.26); it.by(dy * 0.34); it.lx && it.lx(dx * 0.1); it.ly && it.ly(dy * 0.14); }
        else { it.bx(0); it.by(0); it.lx && it.lx(0); it.ly && it.ly(0); }
      });
    }, { passive: true });
  });

  /* ---------- Inclinaison 3D + reflet des cartes ---------- */
  safe(() => {
    if (!hasGsap || !hasHover || reduce) return;
    $$('.tilt').forEach((el) => {
      const glare = $('.glare', el);
      let gx = null, gy = null;
      if (glare) {
        let i = $('i', glare); if (!i) { i = document.createElement('i'); glare.appendChild(i); }
        gx = gsap.quickTo(i, 'x', { duration: 0.5, ease: 'power3.out' }); gy = gsap.quickTo(i, 'y', { duration: 0.5, ease: 'power3.out' });
      }
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      const lift = el.hasAttribute('data-lift');
      el.addEventListener('pointerenter', () => { if (lift) gsap.to(el, { y: -34, scale: 1.04, duration: 0.7, ease: 'expo.out', overwrite: 'auto' }); });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 14); rx(-(py - 0.5) * 14);
        if (gx) { gx((px - 0.5) * r.width); gy((py - 0.5) * r.height); }
      });
      el.addEventListener('pointerleave', () => {
        rx(0); ry(0); if (gx) { gx(0); gy(0); }
        if (lift) gsap.to(el, { y: 0, scale: 1, duration: 0.8, ease: 'expo.out', overwrite: 'auto' });
      });
    });
  });

  /* ---------- Carrousel d’avis ---------- */
  safe(() => {
    const box = $('[data-carousel]'); if (!box || !hasGsap) return;
    const track = $('[data-carousel-track]', box), cards = $$('.rcard', track);
    const prev = $('[data-carousel-prev]'), next = $('[data-carousel-next]'), prog = $('[data-carousel-progress]');
    let i = 0, dragging = false, startX = 0, startTrack = 0, moved = 0, inView = false, hover = false, timer = null;
    const padL = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const minX = () => Math.min(0, -(track.scrollWidth - box.clientWidth));
    const posFor = (idx) => Math.max(minX(), -(cards[idx].offsetLeft - padL()));
    const curX = () => gsap.getProperty(track, 'x');
    function paint(x) {
      cards.forEach((c) => {
        const l = c.offsetLeft + x, r = l + c.offsetWidth;
        c.classList.toggle('is-active', l >= -12 && r <= box.clientWidth + 12);
      });
    }
    function go(idx, animate = true) {
      i = clamp(idx, 0, cards.length - 1);
      const x = posFor(i);
      gsap.to(track, { x, duration: animate && !reduce ? 1.1 : 0, ease: 'expo.out', overwrite: true });
      paint(x);
      prog.style.transform = `scaleX(${(i + 1) / cards.length})`;
    }
    const play = () => { clearInterval(timer); if (reduce) return; timer = setInterval(() => { if (inView && !hover && !dragging) go(i >= cards.length - 1 ? 0 : i + 1); }, 6500); };
    prev.addEventListener('click', () => { go(i - 1); play(); });
    next.addEventListener('click', () => { go(i + 1); play(); });
    box.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go(i + 1); play(); } if (e.key === 'ArrowLeft') { go(i - 1); play(); } });
    box.tabIndex = 0;
    box.addEventListener('pointerenter', () => { hover = true; }); box.addEventListener('pointerleave', () => { hover = false; });
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; moved = 0; startX = e.clientX; startTrack = curX(); track.classList.add('is-drag');
      gsap.killTweensOf(track);
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
      let x = startTrack + dx; const lo = minX();
      if (x > 0) x *= 0.35; if (x < lo) x = lo + (x - lo) * 0.35;
      gsap.set(track, { x }); paint(x);
    });
    const end = (e) => {
      if (!dragging) return; dragging = false; track.classList.remove('is-drag');
      const dx = e.clientX - startX;
      if (dx < -40) go(i + 1); else if (dx > 40) go(i - 1); else go(i);
      play();
    };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    track.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    track.addEventListener('dragstart', (e) => e.preventDefault());
    new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0.3 }).observe(box);
    window.addEventListener('resize', () => go(i, false));
    go(0, false); play();
  });

  /* ======================================================================
     RÉSERVATION — aucun serveur : SMS / WhatsApp / e-mail / .ics
     ====================================================================== */
  safe(() => {
    const form = $('#bookForm'); if (!form) return;
    const elDates = $('#bDates'), elSlots = $('#bSlots'), err = $('#bError'), result = $('#bResult'), ticket = $('#ticket');
    const tType = $('#tType'), tDate = $('#tDate'), tTime = $('#tTime'), tName = $('#tName');
    const TYPES = {
      rachat: { label: 'Rachat', long: 'un rachat / une expertise de cartes', dur: 30 },
      collection: { label: 'Collection', long: 'l’expertise d’une collection ou d’un gros lot de cartes', dur: 60 }
    };
    const state = { type: 'rachat', date: null, time: null };
    const pad = (n) => String(n).padStart(2, '0');
    const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const longDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const hm = (t) => t.replace(':', 'h');

    const slotsFor = (d) => {
      const h = HOURS[d.getDay()]; if (!h) return [];
      const out = [], dur = TYPES[state.type].dur;
      for (let m = h[0] * 60; m + dur <= h[1] * 60; m += 30) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
      return out;
    };
    const isFuture = (d, t, now) => {
      const [h, m] = t.split(':').map(Number);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime() >= now.getTime() + 60 * 60 * 1000;
    };
    const upcoming = () => {
      const now = parisNow(), res = [];
      for (let i = 0; i < 49 && res.length < 8; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (!RACHAT_DAYS.includes(d.getDay())) continue;
        if (slotsFor(d).some((t) => isFuture(d, t, now))) res.push(d);
      }
      return res;
    };

    function renderDates() {
      const list = upcoming();
      elDates.innerHTML = '';
      list.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'bdate'; b.setAttribute('role', 'radio');
        const sel = state.date && key(state.date) === key(d);
        b.setAttribute('aria-checked', String(!!sel));
        b.dataset.key = key(d);
        const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
        const mo = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        b.innerHTML = `<span class="mono">${wd}</span><b>${d.getDate()}</b><small>${mo}</small>`;
        b.setAttribute('aria-label', longDate(d));
        b.addEventListener('click', () => { state.date = d; state.time = null; renderDates(); renderSlots(); paintTicket(); });
        elDates.appendChild(b);
      });
      if (state.date && !list.some((d) => key(d) === key(state.date))) { state.date = null; state.time = null; }
    }
    function renderSlots() {
      elSlots.innerHTML = '';
      if (!state.date) { elSlots.innerHTML = '<p class="bnote mono">Choisis d’abord un jour.</p>'; return; }
      const now = parisNow();
      slotsFor(state.date).forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'bslot'; b.textContent = hm(t); b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(state.time === t));
        b.disabled = !isFuture(state.date, t, now);
        b.addEventListener('click', () => { state.time = t; renderSlots(); paintTicket(); });
        elSlots.appendChild(b);
      });
    }
    function placeNotch() {
      const cut = $('.ticket__cut', ticket); if (cut) ticket.style.setProperty('--notch-y', `${cut.offsetTop}px`);
    }
    function paintTicket() {
      tType.textContent = TYPES[state.type].label;
      tDate.textContent = state.date ? longDate(state.date) : '— à choisir —';
      tTime.textContent = state.time ? hm(state.time) : '— à choisir —';
      tName.textContent = ($('#fPrenom').value || '').trim() || '—';
      placeNotch();
    }

    form.addEventListener('change', (e) => {
      if (e.target.name === 'type') { state.type = e.target.value; state.time = null; renderDates(); renderSlots(); paintTicket(); }
    });
    $('#fPrenom').addEventListener('input', paintTicket);

    const PHONE_RE = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    function showError(msg, field) {
      err.textContent = msg; err.hidden = false;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }
    function buildMessage() {
      const f = new FormData(form);
      const prenom = String(f.get('prenom') || '').trim(), tel = String(f.get('tel') || '').trim(), msg = String(f.get('msg') || '').trim();
      const items = f.getAll('items');
      const list = items.length > 1 ? items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1] : items[0];
      const lines = [`Bonjour Pokedaix ! Je voudrais réserver un créneau pour ${TYPES[state.type].long} le ${longDate(state.date)} à ${hm(state.time)}.`];
      if (list) lines.push(`J’apporte ${list}.`);
      if (msg) lines.push(`Précision : ${msg}`);
      lines.push(`Je m’appelle ${prenom}, mon numéro : ${tel}.`);
      lines.push('Pouvez-vous me confirmer le créneau ? Merci !');
      return { text: lines.join('\n'), prenom, tel };
    }

    // .ics : l’heure de Paris est convertie en UTC (changement d’heure géré)
    const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
    function parisToUtc(y, mo, d, h, mi) {
      const guess = Date.UTC(y, mo, d, h - 1, mi);
      const dstStart = Date.UTC(y, 2, lastSunday(y, 2), 1), dstEnd = Date.UTC(y, 9, lastSunday(y, 9), 1);
      return new Date(guess >= dstStart && guess < dstEnd ? guess - 3600000 : guess);
    }
    const icsStamp = (dt) => `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
    const icsEsc = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    function downloadIcs(info) {
      const [h, m] = state.time.split(':').map(Number), d = state.date;
      const start = parisToUtc(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      const end = new Date(start.getTime() + TYPES[state.type].dur * 60000);
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pokedaix//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT', `UID:${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pokedaix`, `DTSTAMP:${icsStamp(new Date())}`,
        `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
        `SUMMARY:${icsEsc(TYPES[state.type].label + ' de cartes — Pokedaix (à confirmer)')}`,
        `LOCATION:${icsEsc(SHOP.place)}`,
        `DESCRIPTION:${icsEsc('Demande envoyée à la boutique, à confirmer par SMS ou WhatsApp.\nTéléphone : 07 53 88 49 39\n' + info.text)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous Pokedaix dans 1 heure', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rendez-vous-pokedaix.ics';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault(); err.hidden = true;
      $$('[aria-invalid]', form).forEach((x) => x.removeAttribute('aria-invalid'));
      const prenom = $('#fPrenom'), tel = $('#fTel');
      if (!state.date) return showError('Choisis un jour pour ton rendez-vous.');
      if (!state.time) return showError('Choisis une heure pour ton rendez-vous.');
      if (prenom.value.trim().length < 2) return showError('Dis-nous ton prénom.', prenom);
      if (!PHONE_RE.test(tel.value.trim())) return showError('Ajoute un numéro de téléphone valide (ex. 06 12 34 56 78).', tel);
      const info = buildMessage(), enc = encodeURIComponent;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      $('#bSms').href = `sms:${SHOP.phone}${ios ? '&' : '?'}body=${enc(info.text)}`;
      $('#bWa').href = `https://wa.me/${SHOP.phone.replace('+', '')}?text=${enc(info.text)}`;
      $('#bMail').href = `mailto:${SHOP.email}?subject=${enc('Demande de créneau — ' + TYPES[state.type].label)}&body=${enc(info.text.replace(/\n/g, '\r\n'))}`;
      $('#bIcs').onclick = () => downloadIcs(info);
      $('#bCopy').onclick = async (ev) => {
        const btn = ev.currentTarget;
        try { await navigator.clipboard.writeText(info.text); }
        catch (_) { const ta = document.createElement('textarea'); ta.value = info.text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
        btn.textContent = 'Message copié ✓'; setTimeout(() => { btn.textContent = 'Copier le message'; }, 2200);
      };
      result.hidden = false; paintTicket();
      ticket.classList.remove('is-ready'); void ticket.offsetWidth; ticket.classList.add('is-ready');
      const tgt = window.innerWidth < 1100 ? result : ticket;
      if (lenis) lenis.scrollTo(tgt, { offset: -90, duration: 1.4 }); else tgt.scrollIntoView({ behavior: 'auto', block: 'center' });
      if (hasGsap && !reduce) gsap.from(result.children, { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out' });
    });

    renderDates(); renderSlots(); paintTicket();
    window.addEventListener('resize', placeNotch);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeNotch);
  });

  if (!hasGsap) return;

  /* ---------- Préférence « réduire les animations » : version allégée ---------- */
  if (reduce) {
    $$('[data-count]').forEach((n) => { const d = +n.dataset.dec || 0; n.textContent = (+n.dataset.count).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); });
    $$('.stat__bar i').forEach((i) => { i.style.transform = `scaleX(${getComputedStyle(i).getPropertyValue('--p') || 1})`; });
    $$('.seam__line').forEach((l) => { l.style.transform = 'none'; });
    const dockR = $('#dock'); onScroll((y) => dockR.classList.toggle('is-on', y > window.innerHeight * 0.8));
    const l = $('#loader'); if (l) l.remove(); root.classList.remove('is-loading');
    return;
  }

  /* ======================================================================
     MISE EN SCÈNE
     ====================================================================== */

  /* ---------- Hero : découpe des titres ---------- */
  const heroTitle = $('[data-hero-title]'), heroBig = $('[data-hero-big]');
  const titleChars = heroTitle ? split(heroTitle, 'chars').chars : [];
  const bigChars = heroBig ? split(heroBig, 'chars').chars : [];
  $$('.hcard').forEach((c) => gsap.set(c, { rotation: +c.dataset.rot || 0 }));

  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: floats });
    tl.from(bigChars, { yPercent: 118, duration: 1.7, stagger: 0.05 }, 0)
      .from('.hero__eyebrow', { opacity: 0, y: 20, duration: 1 }, 0.25)
      .from(titleChars, { yPercent: 120, rotate: 7, duration: 1.4, stagger: 0.028 }, 0.2)
      .from('.hero__lead', { opacity: 0, y: 30, duration: 1.1 }, 0.8)
      .from('.hero__cta > *', { opacity: 0, y: 34, duration: 1.1, stagger: 0.1 }, 0.9)
      .from('.hero__meta > *', { opacity: 0, y: 20, duration: 1, stagger: 0.08 }, 1.1)
      .from('.hcard', { scale: 0.5, opacity: 0, y: 120, rotation: (i, el) => (+el.dataset.rot || 0) + 26, duration: 1.8, stagger: 0.14 }, 0.35)
      .from('#nav', { yPercent: -100, duration: 1.1, clearProps: 'transform' }, 0.9)
      .from('.hero__scroll', { opacity: 0, duration: 1 }, 1.4);
  }
  function floats() {
    $$('.hcard').forEach((c, i) => {
      gsap.to(c, { y: i % 2 ? 14 : -14, rotation: `+=${i % 2 ? -2.5 : 2.5}`, duration: 3.2 + i * 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });
  }

  /* ---------- Préchargeur : la Pokéball s’ouvre ---------- */
  function runLoader(onOpen) {
    const loader = $('#loader');
    if (!loader || reduce) { if (loader) loader.remove(); root.classList.remove('is-loading'); onOpen(); return; }
    root.classList.add('is-loading'); if (lenis) lenis.stop();
    const pct = $('#loaderPct'), ball = $('#loaderBall'), top = $('.loader__half--top'), bot = $('.loader__half--bot');
    const flash = $('#loaderFlash'), label = $('.loader__label'), counter = { v: 0 };
    const shake = gsap.timeline({ repeat: -1 })
      .to(ball, { rotation: -16, duration: 0.14, ease: 'sine.inOut' })
      .to(ball, { rotation: 16, duration: 0.28, ease: 'sine.inOut' })
      .to(ball, { rotation: 0, duration: 0.14, ease: 'sine.inOut' })
      .to({}, { duration: 0.22 });
    const tl = gsap.timeline({ onComplete: () => { loader.remove(); root.classList.remove('is-loading'); if (lenis) lenis.start(); } });
    tl.to(counter, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: () => { pct.textContent = Math.round(counter.v); } }, 0.15)
      .add(() => shake.kill())
      .to(ball, { rotation: 0, scale: 1.1, duration: 0.25, ease: 'power3.out' })
      .to(flash, { opacity: 0.95, duration: 0.1, ease: 'none' })
      .to(flash, { opacity: 0, duration: 0.55, ease: 'power2.out' })
      .to(label, { opacity: 0, duration: 0.2 }, '<')
      .to(ball, { scale: 7, opacity: 0, duration: 0.8, ease: 'expo.in' }, '<')
      .to(top, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '<0.1')
      .to(bot, { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
      .add(onOpen, '<0.15');
    // sécurité : on ne bloque jamais le visiteur
    setTimeout(() => { if (document.body.contains(loader)) { loader.remove(); root.classList.remove('is-loading'); if (lenis) lenis.start(); } }, 8000);
  }

  /* ---------- Marquees : vitesse et sens liés au scroll ---------- */
  safe(() => {
    const rows = $$('.marquee__row'); if (!rows.length) return;
    rows.forEach((row) => {
      const set = $('.marquee__set', row), w = set.offsetWidth || 1;
      const need = Math.ceil((window.innerWidth * 2.2) / w) + 1;
      for (let i = 0; i < need; i++) { const c = set.cloneNode(true); c.setAttribute('aria-hidden', 'true'); row.appendChild(c); }
      row._dir = +row.dataset.marquee; row._w = w; row._x = row._dir > 0 ? -w : 0;
      row.style.transform = `translate3d(${row._x}px,0,0)`;
    });
    if (reduce) return;
    // la largeur d’un « set » change quand les polices arrivent
    const measure = () => rows.forEach((row) => { row._w = $('.marquee__set', row).offsetWidth || row._w; });
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    // vitesse et sens réagissent à la vélocité du scroll (vers le haut : le sens s’inverse)
    let vel = 0, sm = 0;
    if (lenis) lenis.on('scroll', (e) => { vel = e.velocity; });
    gsap.ticker.add((time, dt) => {
      sm += (vel - sm) * 0.08; vel *= 0.9;
      const k = dt / 16.67, f = clamp(sm, -20, 20);
      rows.forEach((row) => {
        row._x += row._dir * (1.15 + f * 0.35) * k;
        if (row._x <= -row._w) row._x += row._w;
        if (row._x > 0) row._x -= row._w;
        row.style.transform = `translate3d(${row._x.toFixed(2)}px,0,0)`;
      });
    });
  });

  /* ---------- Titres, révélations, parallaxe d’images ---------- */
  function scrollFx() {
    // titres mot par mot (masque qui monte)
    $$('[data-split="words"]').forEach((el) => {
      const { words } = split(el, 'words');
      gsap.from(words, { yPercent: 118, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    // révélations simples
    $$('[data-reveal]').forEach((el) => {
      gsap.from(el, { y: 44, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 91%', once: true } });
    });
    // tuiles de galerie : cercle qui s’agrandit
    $$('[data-reveal-clip]').forEach((el) => {
      gsap.fromTo(el, { clipPath: 'circle(0% at 50% 50%)', scale: 0.92 }, {
        clipPath: 'circle(150% at 50% 50%)', scale: 1, duration: 1.7, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 93%', once: true },
        onComplete: () => gsap.set(el, { clearProps: 'clipPath,scale' })
      });
    });
    // photo ronde + carte : masque circulaire
    $$('[data-circle-reveal]').forEach((el) => {
      gsap.fromTo(el, { clipPath: 'circle(0% at 50% 50%)' }, {
        clipPath: 'circle(75% at 50% 50%)', duration: 1.9, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onComplete: () => gsap.set(el, { clearProps: 'clipPath' })
      });
    });
    // images qui bougent dans leur cadre
    $$('[data-parallax-img]').forEach((box) => {
      if (box.closest('.hz__track') && window.innerWidth > 900) return; // géré avec le défilement horizontal
      const img = $('img', box); if (!img) return;
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // séparateurs : la couture de la Pokéball
    $$('.seam').forEach((s) => {
      const l = $('.seam__line--l', s), r = $('.seam__line--r', s), b = $('.seam__ball', s);
      gsap.fromTo([l, r], { scaleX: 0 }, { scaleX: 1, duration: 1.7, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 92%', once: true } });
      gsap.fromTo(b, { rotation: -360, scale: 0.35 }, { rotation: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: s, start: 'top 98%', end: 'top 45%', scrub: true } });
    });
    // manifeste : les mots s’allument au fil du scroll
    const mf = $('[data-manifest]');
    if (mf) {
      const { words } = split(mf, 'words');
      gsap.fromTo(words, { opacity: 0.13 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: mf, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 } });
    }
    // chiffres clés + barres de stats
    $$('[data-stat]').forEach((st) => {
      const num = $('[data-count]', st), barEl = $('.stat__bar i', st);
      const p = parseFloat(getComputedStyle(barEl).getPropertyValue('--p')) || 1;
      ScrollTrigger.create({
        trigger: st, start: 'top 88%', once: true,
        onEnter: () => {
          const end = +num.dataset.count, dec = +num.dataset.dec || 0, o = { v: 0 };
          gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { num.textContent = o.v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); } });
          gsap.to(barEl, { scaleX: p, duration: 2.2, ease: 'expo.out', delay: 0.15 });
        }
      });
    });
    // pied de page : le grand nom
    const giant = $('[data-foot-giant]');
    if (giant) {
      const { chars } = split(giant, 'chars');
      gsap.from(chars, { yPercent: 105, duration: 1.5, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: giant, start: 'top 92%', once: true } });
    }
    // anneau Pokéball de la section rachat
    gsap.to('.buy__ring', { rotation: 180, ease: 'none', scrollTrigger: { trigger: '.buy', start: 'top bottom', end: 'bottom top', scrub: true } });
    // barre d’actions mobile
    const dock = $('#dock');
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 85%', onEnter: () => dock.classList.add('is-on'), onLeaveBack: () => dock.classList.remove('is-on') });
    ScrollTrigger.create({ trigger: '#reserver', start: 'top 70%', end: 'bottom 30%', onToggle: (s) => dock.classList.toggle('is-off', s.isActive) });
  }

  /* ---------- Hero : parallaxe multicouche ---------- */
  function heroParallax() {
    const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('[data-hero-media]', { yPercent: 16, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__glow--v', { y: 180, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__glow--r', { y: -140, ease: 'none', scrollTrigger: st });
    gsap.to('[data-hero-big]', { yPercent: -45, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__content', { yPercent: -10, ease: 'none', scrollTrigger: st });
    $$('.hfloat').forEach((f) => gsap.to(f, { y: -(+f.dataset.depth || 1) * 200, ease: 'none', scrollTrigger: st }));
    if (hasHover) {
      const hero = $('.hero');
      const fx = $$('.hfloat').map((f) => ({ x: gsap.quickTo(f, 'xPercent', { duration: 1.1, ease: 'power3.out' }), y: gsap.quickTo(f, 'yPercent', { duration: 1.1, ease: 'power3.out' }), d: +f.dataset.depth || 1 }));
      const big = gsap.quickTo('[data-hero-big]', 'x', { duration: 1.4, ease: 'power3.out' });
      hero.addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        fx.forEach((o) => { o.x(nx * -22 * o.d); o.y(ny * -16 * o.d); });
        big(nx * 30);
      });
    }
  }

  /* ---------- Sections épinglées / défilement horizontal / éventail ---------- */
  function pinned() {
    const mm = gsap.matchMedia();

    // Histoire : section pinnée, étape par étape
    mm.add('(min-width: 901px)', () => {
      const steps = $$('.story__step'), figs = $$('.story__fig'), dots = $$('.story__dots li'), ballmark = $('.story__ballmark');
      let cur = -1;
      const set = (i) => {
        if (i === cur) return; cur = i;
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
        figs.forEach((f, k) => f.classList.toggle('is-shown', k <= i));
        dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
        $$('.story__pk').forEach((p, k) => p.classList.toggle('is-on', k === i));
      };
      set(0);
      ScrollTrigger.create({
        trigger: '.story__stage', start: 'top top', end: () => '+=' + window.innerHeight * 3.4, pin: true, anticipatePin: 1,
        onUpdate: (self) => { set(clamp(Math.floor(self.progress * 4), 0, 3)); gsap.set(ballmark, { rotation: self.progress * 540 }); }
      });
      return () => { steps.forEach((s, k) => s.classList.toggle('is-active', k === 0)); };
    });

    // Univers : défilement horizontal piloté par le scroll vertical
    mm.add('(min-width: 901px)', () => {
      const track = $('[data-hz-track]'), section = $('.hz');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      $$('.ucard', track).forEach((card) => {
        const img = $('.ucard__img img', card);
        gsap.fromTo(img, { xPercent: -5 }, { xPercent: 5, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
    });

    // Éventail de cartes : les épisodes s’ouvrent comme une main
    mm.add('(min-width: 701px)', () => {
      const cards = $$('.fcard'), n = cards.length, mid = (n - 1) / 2;
      gsap.fromTo(cards,
        { rotation: (i) => (i - mid) * 1.2, x: (i) => (i - mid) * 3, y: (i) => i * -2 },
        {
          rotation: (i) => (i - mid) * 11, x: (i) => (i - mid) * Math.min(window.innerWidth * 0.145, 210), y: (i) => Math.abs(i - mid) * 24, ease: 'power3.inOut',
          scrollTrigger: { trigger: '.fan__pin', start: 'top top', end: '+=85%', pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }
        });
    });

    // Mobile : les histoires et les cartes apparaissent simplement
    mm.add('(max-width: 900px)', () => {
      $$('.story__step').forEach((s) => gsap.from(s, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
    });
  }

  /* ---------- Démarrage ---------- */
  safe(heroParallax);
  safe(scrollFx);
  safe(pinned);

  runLoader(heroIntro);

  const refresh = () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); };
  window.addEventListener('load', () => { refresh(); setTimeout(refresh, 600); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
})();
