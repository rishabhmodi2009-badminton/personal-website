document.querySelectorAll('[data-year]').forEach(function (el) {
  el.textContent = String(new Date().getFullYear());
});

(function () {
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (list) {
    list.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
  els.forEach(function (el) { io.observe(el); });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var counters = new IntersectionObserver(function (list) {
    list.forEach(function (en) {
      if (!en.isIntersecting) return;
      counters.unobserve(en.target);
      var el = en.target, to = +el.getAttribute('data-count'), t0 = performance.now();
      (function tick(t) {
        var k = Math.min(1, (t - t0) / 1400);
        el.textContent = (el.getAttribute('data-prefix') || '') + Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US') + (el.getAttribute('data-suffix') || '');
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: .4 });
  document.querySelectorAll('[data-count]').forEach(function (el) { counters.observe(el); });
})();

/* LaunchLab filmstrip arrows */
document.querySelectorAll('[data-strip]').forEach(function (b) {
  b.addEventListener('click', function () {
    var strip = b.parentElement.previousElementSibling;
    strip.scrollBy({ left: +b.getAttribute('data-strip') * strip.clientWidth * .8, behavior: 'smooth' });
  });
});

/* In-page document viewer: PDFs open in an overlay, rendered page by page with PDF.js so they work on phones too */
(function () {
  var links = document.querySelectorAll('a[data-doc]');
  if (!links.length) return;
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var ready = null, viewer, pagesEl, titleEl, countEl, openBtn, task = null, lastFocus = null;

  function loadLib() {
    if (!ready) ready = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = rej; document.head.appendChild(s);
    });
    return ready;
  }

  function build() {
    viewer = document.createElement('div');
    viewer.className = 'viewer'; viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true'); viewer.hidden = true;
    viewer.innerHTML = '<div class="viewer-box"><div class="viewer-head"><div><h3 class="viewer-title"></h3><span class="viewer-count"></span></div>' +
      '<a class="viewer-open" target="_blank" rel="noopener">Open PDF ↗</a><button type="button" class="viewer-close" aria-label="Close document">×</button></div>' +
      '<div class="viewer-pages" tabindex="0"></div></div>';
    document.body.appendChild(viewer);
    pagesEl = viewer.querySelector('.viewer-pages'); titleEl = viewer.querySelector('.viewer-title');
    countEl = viewer.querySelector('.viewer-count'); openBtn = viewer.querySelector('.viewer-open');
    viewer.querySelector('.viewer-close').addEventListener('click', close);
    viewer.addEventListener('click', function (e) { if (e.target === viewer) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !viewer.hidden) close(); });
  }

  function close() {
    viewer.hidden = true; document.documentElement.classList.remove('viewer-on');
    if (task) { task.destroy(); task = null; }
    pagesEl.innerHTML = '';
    if (lastFocus) lastFocus.focus();
  }

  function open(url, title) {
    if (!viewer) build();
    lastFocus = document.activeElement;
    titleEl.textContent = title; countEl.textContent = 'Loading…'; openBtn.href = url;
    pagesEl.innerHTML = '<div class="viewer-loading">Loading document…</div>';
    viewer.hidden = false; document.documentElement.classList.add('viewer-on');
    viewer.querySelector('.viewer-close').focus();
    loadLib().then(function (lib) {
      task = lib.getDocument(url);
      return task.promise;
    }).then(function (pdf) {
      countEl.textContent = pdf.numPages + (pdf.numPages === 1 ? ' page' : ' pages');
      pagesEl.innerHTML = '';
      var width = pagesEl.clientWidth - 32, dpr = Math.min(2, window.devicePixelRatio || 1), chain = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) (function (n) {
        var canvas = document.createElement('canvas'); canvas.className = 'viewer-page'; pagesEl.appendChild(canvas);
        chain = chain.then(function () {
          if (viewer.hidden) return;
          return pdf.getPage(n).then(function (page) {
            var base = page.getViewport({ scale: 1 }), scale = width / base.width, vp = page.getViewport({ scale: scale * dpr });
            canvas.width = vp.width; canvas.height = vp.height;
            canvas.style.width = width + 'px'; canvas.style.height = (vp.height / dpr) + 'px';
            return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          });
        });
      })(n);
      chain.catch(function () {});
    }).catch(function () {
      if (viewer.hidden) return;
      countEl.textContent = '';
      pagesEl.innerHTML = '<div class="viewer-loading">This document couldn’t be shown here. Use “Open PDF” instead.</div>';
    });
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); open(a.getAttribute('href'), a.getAttribute('data-doc'));
    });
  });
})();

/* Photo lightbox: clicking a photo opens it full size, with arrows through the other photos in its [data-photos] group */
(function () {
  var groups = document.querySelectorAll('[data-photos]');
  if (!groups.length) return;
  var box, img, cap, count, items = [], at = 0, lastFocus = null;

  function build() {
    box = document.createElement('div');
    box.className = 'gallery'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.hidden = true;
    box.innerHTML = '<div class="gallery-box"><div class="gallery-head"><span class="gallery-count"></span><button type="button" class="viewer-close" aria-label="Close photo">×</button></div>' +
      '<div class="gallery-stage"><button type="button" class="gallery-nav prev" aria-label="Previous photo">‹</button><img alt=""><button type="button" class="gallery-nav next" aria-label="Next photo">›</button></div>' +
      '<p class="gallery-cap"></p></div>';
    document.body.appendChild(box);
    img = box.querySelector('.gallery-stage img'); cap = box.querySelector('.gallery-cap'); count = box.querySelector('.gallery-count');
    box.querySelector('.viewer-close').addEventListener('click', close);
    box.querySelector('.prev').addEventListener('click', function () { show(at - 1); });
    box.querySelector('.next').addEventListener('click', function () { show(at + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(at - 1); else if (e.key === 'ArrowRight') show(at + 1);
    });
    var x0 = null;
    img.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    img.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1)); x0 = null; });
  }

  function show(i) {
    at = (i + items.length) % items.length;
    img.src = items[at].src; img.alt = items[at].alt; cap.textContent = items[at].cap;
    count.textContent = (at + 1) + ' / ' + items.length;
    box.querySelectorAll('.gallery-nav').forEach(function (b) { b.hidden = items.length < 2; });
  }

  function close() { box.hidden = true; document.documentElement.classList.remove('viewer-on'); if (lastFocus) lastFocus.focus(); }

  groups.forEach(function (g) {
    var figs = g.querySelectorAll('figure');
    figs.forEach(function (f, k) {
      var im = f.querySelector('img');
      im.setAttribute('tabindex', '0'); im.setAttribute('role', 'button');
      function open() {
        if (!box) build();
        items = Array.prototype.map.call(figs, function (x) { var i2 = x.querySelector('img'), c = x.querySelector('figcaption'); return { src: i2.getAttribute('src'), alt: i2.alt, cap: c ? c.textContent : i2.alt }; });
        lastFocus = im; box.hidden = false; document.documentElement.classList.add('viewer-on');
        show(k); box.querySelector('.viewer-close').focus();
      }
      im.addEventListener('click', open);
      im.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  });
})();

/* Résumé 3D view (three.js r128, loaded on first use): a badminton court with a rally going on, ringed by one station per
   résumé section. Entries are read from the text résumé so the two views never drift apart. */
(function () {
  var box = document.getElementById('tree'), text = document.getElementById('r-text');
  if (!box || !text) return;
  var buttons = document.querySelectorAll('[data-mode]'), started = false, api = null;

  function setMode(m) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m)); });
    box.hidden = m !== 'tree'; text.hidden = m === 'tree';
    var hint = document.getElementById('text-hint'); if (hint) hint.hidden = m !== 'tree';
    try { localStorage.setItem('resume-mode', m); } catch (e) {}
    if (m === 'tree' && !started) { started = true; load(); }
    if (api) api.resize();
  }
  buttons.forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });

  function load() {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = build; s.onerror = fail;
    document.head.appendChild(s);
  }
  function fail() {
    box.querySelector('.tree-stage').innerHTML = '<p class="mut" style="padding:28px">The 3D view couldn’t load in this browser. The text view has everything.</p>';
  }

  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function read() {
    var secs = [];
    text.querySelectorAll('.r-sec').forEach(function (sec) {
      if (sec.id === 'skills') return;
      var items = [];
      if (sec.id === 'education') {
        var e = sec.querySelector('.edu');
        items.push({ title: txt(e.querySelector('h3')), org: txt(e.querySelector('.gpa')), date: txt(e.querySelector('.when')),
          text: 'AP scores of 5: ' + Array.prototype.map.call(e.querySelectorAll('.pill'), txt).join(', ') });
      }
      sec.querySelectorAll('.tl').forEach(function (el) {
        var parts = txt(el.querySelector('b')).split(' — ');
        items.push({ title: parts[0], label: el.getAttribute('data-label'), org: parts[1] || '', date: txt(el.querySelector('small')), points: Array.prototype.map.call(el.querySelectorAll('li'), txt) });
      });
      sec.querySelectorAll('.aw').forEach(function (el) {
        items.push({ title: txt(el.querySelector('h3')), org: txt(el.querySelector('.org')), date: txt(el.querySelector('.yr')), text: Array.prototype.map.call(el.querySelectorAll('p'), txt).join(' ') });
      });
      secs.push({ id: sec.id, name: txt(sec.querySelector('.kick')), items: items });
    });
    return secs;
  }
  function el(tag, cls, content) { var n = document.createElement(tag); if (cls) n.className = cls; if (content) n.textContent = content; return n; }

  function build() {
    var T = window.THREE, stage = box.querySelector('.tree-stage'), panel = stage.querySelector('.tree-panel');
    var card = panel.querySelector('.tree-card'), nav = stage.querySelector('.court-nav');
    var small = stage.clientWidth < 700, renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { fail(); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    stage.insertBefore(renderer.domElement, stage.firstChild);

    var scene = new T.Scene(), camera = new T.PerspectiveCamera(34, 1, .5, 220);
    scene.fog = new T.Fog(0xeef0e6, 70, 140);
    var hemi = new T.HemisphereLight(0xffffff, 0x6a8a4c, .6); scene.add(hemi);
    var sun = new T.DirectionalLight(0xfff3dc, .85);
    sun.position.set(-18, 30, 14); sun.castShadow = true;
    sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.far = 90;
    scene.add(sun);

    var mats = {};
    function m(c) { return mats[c] || (mats[c] = new T.MeshStandardMaterial({ color: c, roughness: .82, flatShading: true })); }
    function mesh(geo, c, x, y, z, parent) {
      var o = new T.Mesh(geo, typeof c === 'number' || typeof c === 'string' ? m(c) : c);
      o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true;
      (parent || scene).add(o); return o;
    }
    function bx(w, h, d, c, x, y, z, p) { return mesh(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, p); }
    function cy(rt, rb, h, c, x, y, z, p, seg) { return mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), c, x, y + h / 2, z, p); }
    function sign(textStr, w, h, bg, fg, p, x, y, z) {
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
      var g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = fg; g.font = '600 ' + Math.round(cv.height * .5) + 'px "Bricolage Grotesque", system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(textStr, cv.width / 2, cv.height / 2 + 2);
      var tex = new T.CanvasTexture(cv); tex.anisotropy = 4;
      var o = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex }));
      o.position.set(x, y, z); p.add(o); return o;
    }
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

    /* ground, path and garden */
    var grass = new T.Mesh(new T.CircleGeometry(80, 64), m(0x6f9e52)); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    var path = new T.Mesh(new T.RingGeometry(10.6, 12.4, 96), m(0xdccba4)); path.rotation.x = -Math.PI / 2; path.position.y = .02; path.receiveShadow = true; scene.add(path);

    function tree(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
      cy(.22, .32, 2.2, 0x7a5a3a, 0, 0, 0, g, 7);
      var greens = [0x4f8a45, 0x5f9a4c, 0x3f7a3d];
      for (var k = 0; k < 3; k++) mesh(new T.IcosahedronGeometry(1.5 - k * .25, 0), greens[k], (rnd() - .5) * .9, 2.6 + k * .9, (rnd() - .5) * .9, g);
      return g;
    }
    for (var t = 0; t < 34; t++) { var a = t / 34 * Math.PI * 2 + rnd() * .15, r = 25 + rnd() * 12; tree(Math.cos(a) * r, Math.sin(a) * r, .9 + rnd() * .6); }
    var flowerCols = [0xe88aa0, 0xf2c14e, 0xffffff, 0xb784d4, 0xf08a4b];
    function bush(x, z) {
      var b = mesh(new T.IcosahedronGeometry(.55 + rnd() * .3, 0), 0x5a9447, x, .45, z);
      for (var f = 0; f < 4; f++) mesh(new T.SphereGeometry(.09, 6, 4), flowerCols[(f + Math.floor(rnd() * 5)) % 5], x + (rnd() - .5) * .9, .75 + rnd() * .3, z + (rnd() - .5) * .9);
      return b;
    }
    for (var bI = 0; bI < 40; bI++) { var ba = bI / 40 * Math.PI * 2 + .04, br = bI % 2 ? 9.9 : 13.1; bush(Math.cos(ba) * br, Math.sin(ba) * br); }

    /* the court */
    var court = new T.Group(); scene.add(court);
    bx(16, .06, 8.6, 0x6fae6b, 0, 0, 0, court);
    bx(13.4, .07, 6.1, 0x2f7d4f, 0, 0, 0, court);
    function line(w, d, x, z) { bx(w, .08, d, 0xffffff, x, 0, z, court); }
    line(13.4, .06, 0, 3.02); line(13.4, .06, 0, -3.02); line(.06, 6.1, 6.67, 0); line(.06, 6.1, -6.67, 0);
    line(13.4, .05, 0, 2.56); line(13.4, .05, 0, -2.56);
    line(.05, 6.1, 1.98, 0); line(.05, 6.1, -1.98, 0); line(.05, 6.1, 5.92, 0); line(.05, 6.1, -5.92, 0);
    line(4.7, .05, 4.32, 0); line(4.7, .05, -4.32, 0);
    cy(.05, .05, 1.55, 0xdddddd, 0, 0, 3.15, court, 8); cy(.05, .05, 1.55, 0xdddddd, 0, 0, -3.15, court, 8);
    var net = new T.Mesh(new T.PlaneGeometry(6.3, .76), new T.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: .45, side: T.DoubleSide }));
    net.rotation.y = Math.PI / 2; net.position.set(0, 1.17, 0); court.add(net);
    bx(.04, .06, 6.3, 0xffffff, 0, 1.52, 0, court);

    function person(shirt, x, z, faceX) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = faceX > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
      cy(.11, .11, .8, 0x2b2b33, -.13, 0, 0, g, 6); cy(.11, .11, .8, 0x2b2b33, .13, 0, 0, g, 6);
      bx(.56, .7, .32, shirt, 0, .8, 0, g);
      mesh(new T.SphereGeometry(.22, 10, 8), 0xc58c62, 0, 1.75, 0, g);
      mesh(new T.SphereGeometry(.23, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1d1a17, 0, 1.79, 0, g);
      var arm = new T.Group(); arm.position.set(.34, 1.4, 0); g.add(arm);
      cy(.06, .06, .6, shirt, 0, -.05, 0, arm, 6).rotation.z = 0;
      var racket = mesh(new T.TorusGeometry(.17, .025, 6, 16), 0x2443c4, 0, .85, 0, arm);
      cy(.02, .02, .35, 0x333333, 0, .38, 0, arm, 5);
      racket.rotation.y = Math.PI / 2;
      g.userData.arm = arm; return g;
    }
    var p1 = person(0xf2d33c, -4.6, .7, 1), p2 = person(0xc8382f, 4.6, -.6, -1);
    var shuttle = new T.Group(); scene.add(shuttle);
    mesh(new T.ConeGeometry(.12, .22, 8, 1, true), 0xffffff, 0, .11, 0, shuttle).rotation.x = Math.PI;
    mesh(new T.SphereGeometry(.06, 8, 6), 0xf3efe6, 0, 0, 0, shuttle);

    /* bleachers with a small crowd */
    var bl = new T.Group(); bl.position.set(0, 0, -7.6); scene.add(bl);
    for (var row = 0; row < 3; row++) {
      bx(10, .35, 1, 0xb8c4cf, 0, row * .45, -row * .9, bl);
      for (var s2 = 0; s2 < 7; s2++) if (rnd() > .35) {
        var px = -4.3 + s2 * 1.4 + rnd() * .4;
        bx(.4, .5, .3, [0x2443c4, 0xc8382f, 0xf2d33c, 0xffffff, 0x2f7d4f][Math.floor(rnd() * 5)], px, row * .45 + .35, -row * .9, bl);
        mesh(new T.SphereGeometry(.16, 8, 6), 0xc58c62, px, row * .45 + 1.05, -row * .9, bl);
      }
    }

    /* stations: one per résumé section, facing the court */
    var secs = read(), byId = {}; secs.forEach(function (s) { byId[s.id] = s; });
    var stations = [], movers = [];
    function station(id, deg, R, buildFn) {
      var a = deg * Math.PI / 180, g = new T.Group();
      g.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      scene.add(g); buildFn(g);
      g.traverse(function (o) { o.userData.station = id; });
      stations.push({ id: id, group: g, angle: a, pos: g.position.clone(), sec: byId[id] });
    }

    station('education', 206, 16.5, function (g) {
      bx(5, 3, 3, 0xf1e6d2, 0, 0, 0, g); bx(5.4, .35, 3.4, 0xb0412e, 0, 3, 0, g);
      bx(.9, 1.5, .1, 0x6b4a32, 0, 0, 1.52, g);
      [-1.7, -.9, .9, 1.7].forEach(function (x) { bx(.55, .6, .06, 0x9cc3d5, x, 1.6, 1.52, g); });
      sign('Singapore American School', 3.6, .45, '#1F1B16', '#F5F1E8', g, 0, 2.55, 1.56);
      cy(.05, .05, 4.6, 0xcccccc, 3.1, 0, .8, g, 6);
      var flag = bx(1, .6, .03, 0xc8102e, 3.62, 3.8, .8, g); movers.push(function (time) { flag.rotation.y = Math.sin(time * 2) * .25; });
    });
    station('awards', 248, 15.5, function (g) {
      bx(1.4, 1.3, 1.2, 0xf3efe6, 0, 0, 0, g); bx(1.4, .9, 1.2, 0xe9e3d2, -1.45, 0, 0, g); bx(1.4, .6, 1.2, 0xe9e3d2, 1.45, 0, 0, g);
      var gold = new T.MeshStandardMaterial({ color: 0xd4a63a, metalness: .6, roughness: .3 });
      cy(.22, .3, .18, gold, 0, 1.3, 0, g); cy(.06, .06, .35, gold, 0, 1.48, 0, g); cy(.38, .14, .5, gold, 0, 1.82, 0, g, 14);
      bx(.6, .75, .1, 0x3a2e28, -1.45, .9, 0, g); cy(.2, .2, .04, gold, -1.45, 1.2, .07, g, 16).rotation.x = Math.PI / 2;
      mesh(new T.TorusGeometry(.22, .06, 8, 18), gold, 1.45, .95, 0, g);
      sign('Honors & Awards', 2.6, .4, '#2443C4', '#ffffff', g, 0, .65, .61);
    });
    station('leadership', 300, 16, function (g) {
      // EcoBean stall
      var e = new T.Group(); e.position.x = -2.6; g.add(e);
      bx(3, .9, 1.3, 0xc49a6c, 0, 0, 0, e);
      [-1.4, 1.4].forEach(function (x) { [-.6, .6].forEach(function (z) { cy(.05, .05, 2.6, 0x8a6a48, x, 0, z, e, 6); }); });
      bx(3.3, .12, 1.7, 0x5e9e5a, 0, 2.6, 0, e);
      sign('EcoBean', 1.8, .45, '#2F6B3A', '#FFFDF8', e, 0, 2.3, .66);
      for (var k = 0; k < 5; k++) {
        var x = -1.1 + k * .55;
        cy(.16, .16, .36, 0xe5ddc8, x, .9, -.1, e, 10);
        var sp = mesh(new T.ConeGeometry(.14, .34, 6), 0x4caf50, x, 1.42, -.1, e);
        movers.push((function (o, ph) { return function (time) { o.rotation.z = Math.sin(time * 1.5 + ph) * .12; }; })(sp, k));
      }
      bx(.7, .32, .45, 0xc9a777, .9, .9, .35, e); bx(.7, .32, .45, 0xc9a777, .1, .9, .4, e);
      // Project Wish booth
      var w = new T.Group(); w.position.x = 2.6; g.add(w);
      bx(2.6, .9, 1.2, 0xffffff, 0, 0, 0, w);
      [-1.2, 1.2].forEach(function (x) { [-.55, .55].forEach(function (z) { cy(.05, .05, 2.4, 0x2443c4, x, 0, z, w, 6); }); });
      var roof = mesh(new T.ConeGeometry(2, 1.1, 4), 0xf4b7a0, 0, 2.95, 0, w); roof.rotation.y = Math.PI / 4;
      sign('Project Wish', 2.1, .42, '#F4B7A0', '#1F1B16', w, 0, 2.15, .62);
      var star = new T.Shape(); for (var i = 0; i < 10; i++) { var rr = i % 2 ? .18 : .42, aa = i / 10 * Math.PI * 2 - Math.PI / 2; star[i ? 'lineTo' : 'moveTo'](Math.cos(aa) * rr, Math.sin(aa) * rr); }
      var st = mesh(new T.ExtrudeGeometry(star, { depth: .08, bevelEnabled: false }), new T.MeshStandardMaterial({ color: 0xf2c14e, metalness: .3, roughness: .4 }), 0, 3.9, 0, w);
      movers.push(function (time) { st.rotation.y = time * 1.2; });
      cy(.2, .2, .45, new T.MeshStandardMaterial({ color: 0xcfe3ef, transparent: true, opacity: .6 }), -.6, .9, 0, w);
      bx(.5, .7, .04, 0xf2d33c, .5, .9, .2, w);
    });
    station('experience', 72, 16, function (g) {
      var v = new T.Group(); g.add(v);
      bx(3.4, 1.9, 1.8, 0xffffff, -.3, .35, 0, v); bx(1.2, 1.4, 1.75, 0xffffff, 1.95, .35, 0, v);
      bx(1.0, .6, 1.77, 0x9cc3d5, 2.05, 1.05, 0, v);
      bx(3.42, .2, 1.82, 0x2a78c2, -.3, 1.0, 0, v);
      sign('AMBULANCE WISH', 2.4, .32, '#ffffff', '#2a78c2', v, -.3, 1.6, .91);
      [[-1.3, .9], [-1.3, -.9], [1.9, .9], [1.9, -.9]].forEach(function (p) { var wh = cy(.36, .36, .25, 0x222222, p[0], .36, p[1], v, 14); wh.rotation.x = Math.PI / 2; wh.position.y = .36; });
      var light = bx(.4, .18, .4, new T.MeshStandardMaterial({ color: 0x2a78c2, emissive: 0x2a78c2, emissiveIntensity: .4 }), 1.95, 1.75, 0, v);
      movers.push(function (time) { light.material.emissiveIntensity = .2 + Math.max(0, Math.sin(time * 6)) * 1.1; });
    });
    station('programs', 146, 16, function (g) {
      cy(.05, .05, 1.2, 0x8a6a48, -1.5, 0, 0, g, 6); cy(.05, .05, 1.2, 0x8a6a48, 1.5, 0, 0, g, 6);
      bx(3.4, 1.9, .1, 0xffffff, 0, 1.2, 0, g);
      sign('Introduction to AI', 2.8, .45, '#ffffff', '#2443C4', g, 0, 2.6, .06);
      sign('IIT Bombay · SMU · BrightChamps', 3, .32, '#ffffff', '#645A50', g, 0, 1.9, .06);
      [-1.3, 0, 1.3].forEach(function (x) {
        bx(.9, .7, .6, 0xc49a6c, x, 0, 1.6, g); bx(.5, .03, .35, 0x333333, x, .7, 1.6, g);
        var scr = bx(.5, .32, .03, 0x2443c4, x, .72, 1.42, g); scr.rotation.x = -.25;
      });
    });
    station('service', 24, 16.5, function (g) {
      bx(3.2, .85, 1.2, 0xffffff, 0, 0, 0, g);
      [-1, 0, 1].forEach(function (x) { bx(.6, .03, .4, 0x333333, x, .85, .1, g); bx(.6, .4, .03, 0x16233f, x, .87, -.1, g); });
      sign('> build(ai_curriculum)', 2.6, .38, '#16233F', '#7FB2FF', g, 0, 1.7, -.3);
      cy(.04, .04, 1.4, 0x2b2b33, 2.4, 0, .3, g, 6); cy(.04, .04, 1.4, 0x2b2b33, 2.1, 0, -.1, g, 6); cy(.04, .04, 1.4, 0x2b2b33, 2.7, 0, -.1, g, 6);
      var scope = cy(.13, .18, 1.3, 0xffffff, 2.4, 1.2, 0, g, 12); scope.rotation.z = .9;
      sign('Code For All · Science Centre', 3, .32, '#2F6B3A', '#FFFDF8', g, 0, .5, .61);
    });

    stations.sort(function (a, b) { return secs.indexOf(a.sec) - secs.indexOf(b.sec); });

    /* EcoBean can garden in the open corner */
    var garden = new T.Group(); garden.position.set(Math.cos(1.95) * 17.5, 0, Math.sin(1.95) * 17.5); garden.rotation.y = -.5; scene.add(garden);
    bx(4.6, .3, 3, 0x8a6a48, 0, 0, 0, garden); bx(4.3, .05, 2.7, 0x5a4330, 0, .3, 0, garden);
    for (var gx = 0; gx < 5; gx++) for (var gz = 0; gz < 3; gz++) {
      var cx = -1.7 + gx * .85, cz = -.8 + gz * .8;
      cy(.17, .17, .38, 0xd9d4c6, cx, .35, cz, garden, 10);
      var sp2 = mesh(new T.IcosahedronGeometry(.2 + ((gx + gz) % 3) * .05, 0), [0x4caf50, 0x6cbf5a, 0x3e8e41][(gx + gz) % 3], cx, .95, cz, garden);
      movers.push((function (o, ph) { return function (time) { o.rotation.y = time * .4 + ph; o.position.y = .95 + Math.sin(time * 1.3 + ph) * .03; }; })(sp2, gx * 3 + gz));
    }

    /* floodlights around the court, lit at dusk */
    var floods = [];
    [[-8.6, -5.2], [8.6, -5.2], [-8.6, 5.2], [8.6, 5.2]].forEach(function (c) {
      cy(.09, .12, 6.2, 0x8c939a, c[0], 0, c[1], scene, 8);
      var head = bx(.9, .35, .5, new T.MeshStandardMaterial({ color: 0xe9eef2, emissive: 0xfff1c9, emissiveIntensity: 0 }), c[0] * .96, 6.1, c[1] * .96);
      var lamp = new T.PointLight(0xfff1c9, 0, 34, 1.6); lamp.position.set(c[0] * .9, 6, c[1] * .9); scene.add(lamp);
      floods.push({ head: head, lamp: lamp });
    });

    /* time of day: day or dusk */
    var PRESETS = {
      day:   { sky: 0xffffff, ground: 0x6a8a4c, hemi: .6,  sun: 0xfff3dc, sunI: .85, sunPos: [-18, 30, 14], fog: 0xeef0e6, flood: 0 },
      dusk:  { sky: 0xffd3ad, ground: 0x5a4a62, hemi: .5,  sun: 0xff9a5a, sunI: .75, sunPos: [-32, 11, 8],  fog: 0xf0c6a6, flood: .55 }
    };
    var tod = 'day', look = null, cur = null;
    function phase() { return tod; }
    function setLook(name) {
      look = PRESETS[name]; stage.setAttribute('data-time', name);
      if (!cur) cur = { sky: new T.Color(look.sky), ground: new T.Color(look.ground), hemi: look.hemi, sun: new T.Color(look.sun), sunI: look.sunI, sunPos: new T.Vector3().fromArray(look.sunPos), fog: new T.Color(look.fog), flood: look.flood };
    }
    function blend(k) {
      cur.sky.lerp(new T.Color(look.sky), k); cur.ground.lerp(new T.Color(look.ground), k); cur.sun.lerp(new T.Color(look.sun), k); cur.fog.lerp(new T.Color(look.fog), k);
      cur.hemi += (look.hemi - cur.hemi) * k; cur.sunI += (look.sunI - cur.sunI) * k; cur.flood += (look.flood - cur.flood) * k;
      cur.sunPos.lerp(new T.Vector3().fromArray(look.sunPos), k);
      hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.ground); hemi.intensity = cur.hemi;
      sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos); scene.fog.color.copy(cur.fog);
      floods.forEach(function (f) { f.lamp.intensity = cur.flood; f.head.material.emissiveIntensity = cur.flood * 1.4; });
    }
    setLook(phase()); blend(1);

    var paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctrl = el('div', 'court-ctrl');
    var pauseBtn = el('button', 'pause', paused ? 'Play motion' : 'Pause motion'); pauseBtn.type = 'button'; pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.addEventListener('click', function () { paused = !paused; pauseBtn.textContent = paused ? 'Play motion' : 'Pause motion'; pauseBtn.setAttribute('aria-pressed', String(paused)); });
    var times = el('div', 'times'); times.setAttribute('role', 'group'); times.setAttribute('aria-label', 'Time of day');
    ['day', 'dusk'].forEach(function (name) {
      var b = el('button', '', name.charAt(0).toUpperCase() + name.slice(1)); b.type = 'button'; b.setAttribute('aria-pressed', String(name === tod));
      b.addEventListener('click', function () {
        tod = name; setLook(phase());
        times.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      times.appendChild(b);
    });
    ctrl.appendChild(pauseBtn); ctrl.appendChild(times); stage.appendChild(ctrl);

    /* camera rig */
    var target = new T.Vector3(0, 1, 2.5), az = Math.PI / 2, elev = .68, dist = small ? 62 : 47;
    var goal = null, home = { t: target.clone(), az: az, elev: elev, dist: dist };
    function place() {
      camera.position.set(target.x + Math.cos(elev) * Math.cos(az) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(elev) * Math.sin(az) * dist);
      camera.lookAt(target);
    }
    function flyTo(st) {
      if (!st) { goal = { t: home.t.clone(), az: az + wrap(home.az - az), elev: home.elev, dist: home.dist }; return; }
      var want = st.angle + Math.PI, shift = stage.clientWidth > 700 ? 4.5 : 0;
      var t = new T.Vector3(st.pos.x + Math.sin(want) * shift, 1.4, st.pos.z - Math.cos(want) * shift);
      goal = { t: t, az: az + wrap(want - az), elev: .55, dist: small ? 24 : 19 };
    }
    function wrap(d) { return ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

    /* pins, nav and panel */
    var pins = [], current = null;
    stations.forEach(function (st, i) {
      var b = el('button', 'pin', String(i + 1)); b.type = 'button'; b.setAttribute('aria-label', (i + 1) + '. ' + st.sec.name);
      b.addEventListener('click', function () { open(st); });
      stage.appendChild(b); pins.push(b);
      var n = el('button'); n.type = 'button'; n.appendChild(el('b', '', String(i + 1))); n.appendChild(document.createTextNode(st.sec.name));
      n.addEventListener('click', function () { open(st); });
      nav.appendChild(n); st.navBtn = n; st.pin = b;
    });
    function mark() { stations.forEach(function (st) { var on = st === current; st.pin.classList.toggle('on', on); st.navBtn.setAttribute('aria-pressed', String(on)); }); }
    function showSection(st) {
      card.innerHTML = '';
      card.appendChild(el('p', 'label', 'Station ' + (stations.indexOf(st) + 1)));
      card.appendChild(el('h3', '', st.sec.name));
      var list = el('div', 'tree-list');
      st.sec.items.forEach(function (item) {
        var b = el('button'); b.type = 'button'; b.appendChild(document.createTextNode(item.label || item.title)); b.appendChild(el('small', '', item.date));
        b.addEventListener('click', function () { showItem(st, item); });
        list.appendChild(b);
      });
      card.appendChild(list);
    }
    function showItem(st, item) {
      card.innerHTML = '';
      card.appendChild(el('p', 'label', st.sec.name + (item.date ? ' · ' + item.date : '')));
      card.appendChild(el('h3', '', item.title));
      if (item.org) card.appendChild(el('p', 'org', item.org));
      if (item.points && item.points.length) { var ul = el('ul'); item.points.forEach(function (p) { ul.appendChild(el('li', '', p)); }); card.appendChild(ul); }
      if (item.text) card.appendChild(el('p', '', item.text));
      if (st.sec.items.length > 1) { var back = el('button', 'tree-back', '← All of ' + st.sec.name); back.type = 'button'; back.addEventListener('click', function () { showSection(st); }); card.appendChild(back); }
    }
    function open(st) { current = st; panel.hidden = false; if (st.sec.items.length === 1) showItem(st, st.sec.items[0]); else showSection(st); flyTo(st); mark(); panel.scrollTop = 0; }
    function close() { current = null; panel.hidden = true; flyTo(null); mark(); }
    panel.querySelector('.tree-close').addEventListener('click', close);
    stage.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) close(); });

    /* drag to orbit, click a station to open it */
    var dragging = false, moved = 0, lx = 0, ly = 0, ray = new T.Raycaster(), ptr = new T.Vector2();
    var hits = []; stations.forEach(function (st) { st.group.traverse(function (o) { if (o.isMesh) hits.push(o); }); });
    stage.addEventListener('pointerdown', function (e) {
      if (e.target !== renderer.domElement) return;
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; goal = null; stage.setPointerCapture(e.pointerId); stage.classList.add('drag');
    });
    stage.addEventListener('pointermove', function (e) {
      if (dragging) {
        var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        az += dx * .006; elev = Math.max(.22, Math.min(1.25, elev + dy * .004));
        return;
      }
      if (e.target !== renderer.domElement) return;
      pick(e, function (st) { stage.style.cursor = st ? 'pointer' : ''; });
    });
    function pick(e, cb) {
      var b = renderer.domElement.getBoundingClientRect();
      ptr.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
      ray.setFromCamera(ptr, camera);
      var h = ray.intersectObjects(hits)[0], id = h && h.object.userData.station;
      cb(id ? stations.filter(function (s) { return s.id === id; })[0] : null);
    }
    stage.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false; stage.classList.remove('drag');
      if (moved < 6) pick(e, function (st) { if (st) open(st); });
    });
    stage.addEventListener('pointercancel', function () { dragging = false; stage.classList.remove('drag'); });

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
    var visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (l) { visible = l[0].isIntersecting; }).observe(stage);
    resize();

    var clock = new T.Clock(), animT = 0, v = new T.Vector3();
    (function loop() {
      requestAnimationFrame(loop);
      if (box.hidden || !visible) return;
      var dt = Math.min(clock.getDelta(), .1); if (!paused) animT += dt;
      var time = animT;
      blend(Math.min(1, dt * 2.5));
      if (goal) {
        var k = .07; target.lerp(goal.t, k); az += (goal.az - az) * k; elev += (goal.elev - elev) * k; dist += (goal.dist - dist) * k;
        if (Math.abs(goal.az - az) < .002 && Math.abs(goal.dist - dist) < .02) goal = null;
      } else if (!dragging && !current && !paused) az += .0007;
      place();
      if (!paused) {
        var cycle = 1.7, u = (time % cycle) / cycle, leg = Math.floor(time / cycle) % 2, from = leg ? 4.2 : -4.2;
        var sx = from + (-2 * from) * u, sy = 1.7 + Math.sin(Math.PI * u) * 3.2, sz = (leg ? -.6 : .7) + ((leg ? .7 : -.6) - (leg ? -.6 : .7)) * u;
        shuttle.position.set(sx, sy, sz);
        shuttle.rotation.z = (leg ? 1 : -1) * (Math.PI / 2 - Math.cos(Math.PI * u) * 1.1);
        p1.userData.arm.rotation.z = leg ? .2 : -.4 + Math.sin(u * Math.PI) * -.8;
        p2.userData.arm.rotation.z = leg ? -.4 + Math.sin(u * Math.PI) * -.8 : .2;
        p1.position.y = Math.abs(Math.sin(time * 4)) * .06; p2.position.y = Math.abs(Math.sin(time * 4 + 1)) * .06;
        movers.forEach(function (f) { f(time); });
      }
      renderer.render(scene, camera);
      var w = stage.clientWidth, h = stage.clientHeight;
      stations.forEach(function (st, i) {
        v.set(st.pos.x, 4.6, st.pos.z).project(camera);
        var off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
        pins[i].hidden = off;
        if (!off) { pins[i].style.left = ((v.x + 1) / 2 * w) + 'px'; pins[i].style.top = ((1 - v.y) / 2 * h) + 'px'; }
      });
    })();

    api = { resize: resize };
  }

  var start = 'text';
  try { start = localStorage.getItem('resume-mode') || 'text'; } catch (e) {}
  if (location.hash === '#tree' || location.hash === '#3d') start = 'tree';
  setMode(start);
})();
