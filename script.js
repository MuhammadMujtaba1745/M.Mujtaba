/* ==========================================================================
   Muhammad Mujtaba | Portfolio
   1. Footer year
   2. Theme toggle (light / dark)
   3. Mobile menu
   4. Active nav link on scroll
   5. Portrait fallback
   6. Shared noise helpers
   7. Hero contour lines (topographic map background)
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- 1. Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 2. Theme toggle ---------- */
  var themeBtn = document.querySelector('.theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (themeBtn) {
      themeBtn.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#08122a' : '#ffffff');
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* storage unavailable */ }
    }
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  applyTheme(root.getAttribute('data-theme') || 'light', false);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  /* ---------- 3. Mobile menu ---------- */
  var menuBtn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('primary-nav');

  function setMenu(open) {
    if (!menuBtn || !nav) return;
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) setMenu(false);
    });
  }

  /* ---------- 4. Active nav link on scroll ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  function clearActive() {
    navLinks.forEach(function (l) {
      l.classList.remove('is-active');
      l.removeAttribute('aria-current');
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { navObserver.observe(section); });

    // Clear the highlight while the hero is on screen
    var topSection = document.getElementById('top');
    if (topSection) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) clearActive();
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 }).observe(topSection);
    }
  }

  /* ---------- 5. Portrait fallback ---------- */
  var portrait = document.querySelector('.portrait-frame');
  var portraitImg = portrait && portrait.querySelector('img');

  if (portrait && portraitImg) {
    var showFallback = function () { portrait.classList.add('no-photo'); };
    portraitImg.addEventListener('error', showFallback);
    if (portraitImg.complete && portraitImg.naturalWidth === 0) showFallback();
  }

  /* ---------- 6. Shared noise helpers ---------- */
  function hash(x, y, z) {
    var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // Smooth 3D value noise
  function noise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
    var x00 = lerp(hash(xi, yi, zi),         hash(xi + 1, yi, zi),         xf);
    var x10 = lerp(hash(xi, yi + 1, zi),     hash(xi + 1, yi + 1, zi),     xf);
    var x01 = lerp(hash(xi, yi, zi + 1),     hash(xi + 1, yi, zi + 1),     xf);
    var x11 = lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf);
    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
  }

  /* ---------- 7. Hero contour lines ----------
     Draws a slowly drifting topographic map with marching squares.
     Every 4th line is an "index contour" and drawn heavier, like on a
     real topo sheet. The lines rise around the cursor like a hill.
     Static (drawn once) if the visitor prefers reduced motion.          */

  var canvas = document.getElementById('contour-canvas');
  var heroEl = document.getElementById('top');
  if (!canvas || !heroEl || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var CELL = 16;                 // grid resolution in CSS pixels
  var LEVELS = 14;               // number of contour levels
  var LEVEL_START = 0.22;
  var LEVEL_STEP = 0.05;
  var FRAME_MS = 33;             // about 30 frames per second

  var width = 0, height = 0, gx = 0, gy = 0, grid = null;
  var time = Math.random() * 50;
  var rafId = 0, lastTs = 0, running = false, inView = true;
  var pointer = { x: -9999, y: -9999, strength: 0, target: 0 };
  var colors = { rgb: '26, 109, 255', minor: 0.15, major: 0.34 };

  // Marching squares: for each case, the edge pairs to join.
  // Edges: 0 = top, 1 = right, 2 = bottom, 3 = left
  var SEGMENTS = [
    [], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[0, 3], [2, 1]], [[0, 2]], [[0, 3]],
    [[0, 3]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []
  ];

  function readColors() {
    var cs = getComputedStyle(root);
    var rgb = cs.getPropertyValue('--contour-rgb').trim();
    var minor = parseFloat(cs.getPropertyValue('--contour-minor'));
    var major = parseFloat(cs.getPropertyValue('--contour-major'));
    if (rgb) colors.rgb = rgb;
    if (!isNaN(minor)) colors.minor = minor;
    if (!isNaN(major)) colors.major = major;
  }

  function resize() {
    var rect = heroEl.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx = Math.ceil(width / CELL) + 2;
    gy = Math.ceil(height / CELL) + 2;
    grid = new Float32Array(gx * gy);
    draw();
  }

  function fillGrid() {
    var sigma2 = 2 * 150 * 150;
    var bump = pointer.strength > 0.002;
    for (var j = 0; j < gy; j++) {
      var y = j * CELL;
      for (var i = 0; i < gx; i++) {
        var x = i * CELL;
        var v = noise(x / 280, y / 280, time) * 0.65 +
                noise(x / 120 + 17, y / 120 + 9, time * 1.4) * 0.35;
        if (bump) {
          var dx = x - pointer.x, dy = y - pointer.y;
          v += pointer.strength * 0.3 * Math.exp(-(dx * dx + dy * dy) / sigma2);
        }
        grid[j * gx + i] = v;
      }
    }
  }

  function edgePoint(edge, x0, y0, tl, tr, br, bl, level) {
    switch (edge) {
      case 0: return [x0 + CELL * (level - tl) / (tr - tl), y0];
      case 1: return [x0 + CELL, y0 + CELL * (level - tr) / (br - tr)];
      case 2: return [x0 + CELL * (level - bl) / (br - bl), y0 + CELL];
      default: return [x0, y0 + CELL * (level - tl) / (bl - tl)];
    }
  }

  function draw() {
    if (!grid) return;
    ctx.clearRect(0, 0, width, height);
    fillGrid();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (var l = 0; l < LEVELS; l++) {
      var level = LEVEL_START + l * LEVEL_STEP;
      var major = l % 4 === 0;
      ctx.beginPath();

      for (var j = 0; j < gy - 1; j++) {
        for (var i = 0; i < gx - 1; i++) {
          var tl = grid[j * gx + i];
          var tr = grid[j * gx + i + 1];
          var br = grid[(j + 1) * gx + i + 1];
          var bl = grid[(j + 1) * gx + i];
          var idx = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) |
                    (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
          if (idx === 0 || idx === 15) continue;

          var segs = SEGMENTS[idx];
          var x0 = i * CELL, y0 = j * CELL;
          for (var s = 0; s < segs.length; s++) {
            var a = edgePoint(segs[s][0], x0, y0, tl, tr, br, bl, level);
            var b = edgePoint(segs[s][1], x0, y0, tl, tr, br, bl, level);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
          }
        }
      }

      ctx.strokeStyle = 'rgba(' + colors.rgb + ',' + (major ? colors.major : colors.minor) + ')';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.stroke();
    }
  }

  function frame(ts) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    if (ts - lastTs < FRAME_MS) return;
    var dt = lastTs ? ts - lastTs : FRAME_MS;
    lastTs = ts;
    time += dt * 0.00008;
    pointer.strength += (pointer.target - pointer.strength) * 0.08;
    draw();
  }

  function start() {
    if (running || reduceMotion.matches || !inView || document.hidden) return;
    running = true;
    lastTs = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  /* Pointer: raise a "hill" under the cursor */
  heroEl.addEventListener('pointermove', function (e) {
    if (reduceMotion.matches) return;
    var rect = heroEl.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.target = 1;
  });
  heroEl.addEventListener('pointerleave', function () { pointer.target = 0; });

  /* Pause when off-screen or tab hidden */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }).observe(heroEl);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  /* Redraw on theme or motion-preference change, and on resize */
  document.addEventListener('themechange', function () { readColors(); draw(); });
  var onMotionChange = function () {
    if (reduceMotion.matches) { stop(); draw(); } else { start(); }
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(heroEl);
  } else {
    window.addEventListener('resize', resize);
  }

  readColors();
  resize();
  start();
})();