/* ==========================================================================
   POKEDAIX — les Pokémon partout : badges Pokédex, stickers à attraper,
   section « Qui se cache dans la boutique ? », compteur et écran final.
   Illustrations originales (SVG) : voir le sprite dans index.html.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const TOTAL = 7;
  const caught = new Set();

  // [id du symbole, n° Pokédex, nom français]
  const CARDS = [
    ['pikachu', '025', 'Pikachu'], ['evoli', '133', 'Évoli'], ['rondoudou', '039', 'Rondoudou'],
    ['salameche', '004', 'Salamèche'], ['gengar', '094', 'Ectoplasma'], ['voltorb', '100', 'Voltorb'], ['miaouss', '052', 'Miaouss']
  ];
  const FAN = ['pikachu', 'gengar', 'rondoudou', 'miaouss', 'salameche'];

  /* ---------- Badges Pokédex sur les cartes de l’univers ---------- */
  $$('.ucard').forEach((card, i) => {
    const d = CARDS[i]; if (!d) return;
    const img = $('.ucard__img', card);
    if (img) img.insertAdjacentHTML('beforeend', `<svg class="ucard__pk" aria-hidden="true"><use href="#pk-${d[0]}"/></svg>`);
    const lab = $('.ucard__body .mono', card);
    if (lab) lab.textContent = `N°${d[1]} · ${d[2]}`;
  });
  /* ---------- Filigrane Pokémon sur les cartes « épisode » ---------- */
  $$('.fcard__in').forEach((c, i) => {
    if (FAN[i]) c.insertAdjacentHTML('afterbegin', `<svg class="fcard__wm" aria-hidden="true"><use href="#pk-${FAN[i]}"/></svg>`);
  });

  const wiggle = (el, rot = 0) => {
    if (!hasGsap || reduce || !el) return;
    gsap.fromTo(el, { rotation: rot - 12 }, { rotation: rot, duration: 1, ease: 'elastic.out(1,.3)', overwrite: 'auto' });
  };

  /* ---------- Section « Qui se cache dans la boutique ? » ---------- */
  const grid = $('[data-dex-grid]');
  if (grid) {
    const cards = $$('.dex__card', grid);
    grid.classList.add('is-js');
    const reveal = () => cards.forEach((c, i) => {
      if (reduce) c.classList.add('is-revealed');
      else setTimeout(() => c.classList.add('is-revealed'), 350 + i * 320);
    });
    if (hasGsap && !reduce) ScrollTrigger.create({ trigger: grid, start: 'top 78%', once: true, onEnter: reveal });
    else reveal();
    cards.forEach((c) => {
      const art = $('.dex__svg', c);
      c.addEventListener('pointerenter', () => wiggle(art, -2));
      c.addEventListener('click', () => wiggle(art, -2));
    });
  }

  /* ---------- Compteur Pokédex ---------- */
  const hud = $('#hud'), hudBall = $('#hudBall'), hudCount = $('#hudCount'), dexCount = $('[data-dex-count]');
  const showHud = () => hud && hud.classList.add('is-on');
  if (hasGsap && !reduce && $('#pokedex')) ScrollTrigger.create({ trigger: '#pokedex', start: 'top 70%', once: true, onEnter: showHud });

  function confetti() {
    if (!hasGsap || reduce) return;
    const ids = ['ball', 'ball-great', 'ball-ultra', 'ball-master'];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.innerHTML = `<svg aria-hidden="true"><use href="#${ids[i % 4]}"/></svg>`;
      document.body.appendChild(c);
      const x = Math.random() * window.innerWidth;
      gsap.fromTo(c, { x, y: -40, rotation: Math.random() * 360, scale: 0.6 + Math.random() * 0.9 }, {
        y: window.innerHeight + 60, x: x + (Math.random() - 0.5) * 220, rotation: '+=540',
        duration: 2.4 + Math.random() * 1.6, delay: Math.random() * 0.8, ease: 'power1.in', onComplete: () => c.remove()
      });
    }
  }
  const finaleEl = $('#finale');
  function closeFinale() {
    if (!finaleEl || finaleEl.hidden) return;
    finaleEl.classList.remove('is-on');
    setTimeout(() => { finaleEl.hidden = true; }, 500);
  }
  function finale() {
    if (!finaleEl) return;
    finaleEl.hidden = false;
    requestAnimationFrame(() => finaleEl.classList.add('is-on'));
    confetti();
    const b = $('#finaleClose'); if (b) b.focus();
  }
  const fc = $('#finaleClose'); if (fc) fc.addEventListener('click', closeFinale);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFinale(); });

  function bump(id) {
    caught.add(id);
    const n = caught.size;
    if (hudCount) hudCount.textContent = n;
    if (dexCount) dexCount.textContent = n;
    const card = $(`.dex__card[data-dex="${id}"]`);
    if (card) card.classList.add('is-found');
    if (hasGsap && !reduce && hud) gsap.fromTo(hud, { scale: 1.18 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1,.4)' });
    if (n === TOTAL) setTimeout(finale, 650);
  }

  /* ---------- Capture : le Pokémon rentre dans une Poké Ball et file au compteur ---------- */
  function capture(el) {
    const id = el.dataset.catch;
    if (!id || el.dataset.busy) return;
    el.dataset.busy = '1';
    el.style.pointerEvents = 'none';
    showHud();
    if (!hasGsap || reduce) { el.style.visibility = 'hidden'; bump(id); return; }
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ball = document.createElement('div');
    ball.className = 'flyball';
    ball.innerHTML = '<svg aria-hidden="true"><use href="#ball"/></svg>';
    document.body.appendChild(ball);
    gsap.set(ball, { left: cx, top: cy, xPercent: -50, yPercent: -50, scale: 0 });
    const target = () => { const h = hudBall.getBoundingClientRect(); return { x: h.left + h.width / 2 - cx, y: h.top + h.height / 2 - cy }; };
    gsap.timeline({ onComplete: () => { ball.remove(); el.style.visibility = 'hidden'; bump(id); } })
      .to(el, { scale: 0.12, rotation: '+=240', opacity: 0, duration: 0.5, ease: 'power3.in' })
      .to(ball, { scale: 1, duration: 0.4, ease: 'back.out(2.4)' }, '-=0.25')
      .to(ball, { rotation: -22, duration: 0.12, ease: 'sine.inOut', yoyo: true, repeat: 5 })
      .to(ball, { x: () => target().x, y: () => target().y, scale: 0.5, duration: 0.85, ease: 'power3.inOut' });
  }

  /* ---------- Stickers cachés dans la page ---------- */
  $$('.pk').forEach((el, i) => {
    const svg = $('svg', el), rot = +el.dataset.rot || 0;
    el.addEventListener('click', () => capture(el));
    if (!hasGsap) return;
    gsap.set(el, { rotation: rot });
    el.addEventListener('pointerenter', () => wiggle(el, rot));
    if (reduce) return;

    // apparition quand on arrive dessus
    gsap.set(el, { scale: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 94%', once: true,
      onEnter: () => gsap.to(el, { scale: 1, duration: 1.2, ease: 'elastic.out(1,.5)', delay: 0.1 })
    });
    // légère parallaxe (sauf dans la section épinglée)
    if (!el.classList.contains('pk--static')) {
      gsap.fromTo(el, { y: 34 }, { y: -34, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    // mouvements propres à chacun
    if (el.hasAttribute('data-roll')) {
      gsap.to(svg, { x: -110, rotation: -360, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    } else {
      gsap.to(svg, { y: -9, rotation: i % 2 ? -3 : 3, duration: 2.2 + (i % 3) * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.2 });
    }
    if (el.hasAttribute('data-notes')) {
      for (let k = 0; k < 3; k++) {
        const n = document.createElement('b');
        n.className = 'pk__note'; n.textContent = k % 2 ? '♫' : '♪'; n.setAttribute('aria-hidden', 'true');
        el.appendChild(n);
        gsap.timeline({ repeat: -1, delay: k * 0.8 })
          .fromTo(n, { y: 10, x: 0, opacity: 0, scale: 0.6 }, { y: -64, x: 22, opacity: 1, scale: 1, duration: 1, ease: 'power1.out' })
          .to(n, { y: -110, x: 42, opacity: 0, duration: 1, ease: 'power1.in' });
      }
    }
  });
})();
