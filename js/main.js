/* Hausarztpraxis Stärke & Staack — gemeinsames Verhalten aller Seiten */
(function () {
  'use strict';

  var API_BASE = 'https://praxis-staerke-backend-production.up.railway.app';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Navigation ---------- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  function onScrollNav() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileMenu.classList.toggle('is-open', !open);
    });
  }

  /* ---------- Scroll progress ---------- */
  var progress = document.querySelector('.scroll-progress');
  if (progress) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal, .reveal-line');
  if (reducedMotion) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Privacy-Hinweis + anonymes Tracking ---------- */
  var bar = document.getElementById('privacy-bar');

  function track() {
    try {
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: location.pathname + location.search,
          referrer: document.referrer
        })
      }).catch(function () {});
    } catch (e) { /* Tracking darf nie die Seite stören */ }
  }

  if (localStorage.getItem('privacy-ack') === '1') {
    track();
  } else if (bar) {
    setTimeout(function () { bar.classList.add('is-visible'); }, 1200);
    bar.querySelector('button').addEventListener('click', function () {
      localStorage.setItem('privacy-ack', '1');
      bar.classList.remove('is-visible');
      track();
    });
  }

  /* ---------- Premium Motion Layer ---------- */
  if (!reducedMotion) {
    /* EKG-Divider: Linie zeichnet sich beim Scrollen */
    var ekgs = [];
    document.querySelectorAll('.ekg-divider').forEach(function (div) {
      var path = div.querySelector('.ekg-divider__path');
      if (!path) return;
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      ekgs.push({ el: div, path: path, len: len, done: false });
    });

    var hero = document.querySelector('.hero');
    var statementEl = document.querySelector('.statement');
    var statementImg = document.querySelector('.statement__bg img');

    /* Statement-Headline in Wörter splitten (Scroll-Scrub) */
    var scrubWords = [];
    var stH2 = document.querySelector('.statement h2');
    if (stH2) {
      (function splitWords(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var s = document.createElement('span');
              s.className = 'w';
              s.textContent = part;
              frag.appendChild(s);
              scrubWords.push(s);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1 && child.tagName !== 'BR') {
            splitWords(child);
          }
        });
      })(stH2);
    }

    var motionTick = false;
    function onMotionScroll() {
      if (motionTick) return;
      motionTick = true;
      requestAnimationFrame(function () {
        motionTick = false;
        var vh = window.innerHeight;

        if (hero) {
          var hr = hero.getBoundingClientRect();
          if (hr.bottom > 0) {
            var hp = Math.min(1, Math.max(0, -hr.top / hr.height));
            hero.style.setProperty('--hero-zoom', hp.toFixed(3));
            hero.style.setProperty('--hero-drift', (hp * vh * 0.18).toFixed(1) + 'px');
          }
        }

        if (statementEl && statementImg) {
          var sr = statementEl.getBoundingClientRect();
          if (sr.bottom > 0 && sr.top < vh) {
            var sp = (vh - sr.top) / (vh + sr.height);
            statementImg.style.setProperty('--parallax', ((sp - 0.5) * -48).toFixed(1) + 'px');
            if (scrubWords.length) {
              var wp = Math.min(1, Math.max(0, (vh * 0.82 - sr.top) / (vh * 0.55)));
              var on = Math.round(wp * scrubWords.length);
              scrubWords.forEach(function (w, i) { w.classList.toggle('is-on', i < on); });
            }
          }
        }

        ekgs.forEach(function (e) {
          var r = e.el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) return;
          var pr = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.6)));
          e.path.style.strokeDashoffset = (e.len * (1 - pr)).toFixed(1);
          if (pr >= 1 && !e.done) { e.done = true; e.el.classList.add('is-complete'); }
        });
      });
    }
    window.addEventListener('scroll', onMotionScroll, { passive: true });
    onMotionScroll();

    /* Magnetische Buttons */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('.btn').forEach(function (btn) {
        btn.addEventListener('pointermove', function (ev) {
          var r = btn.getBoundingClientRect();
          var x = (ev.clientX - r.left - r.width / 2) / (r.width / 2);
          var y = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
          btn.style.setProperty('--mx', (x * 6).toFixed(1) + 'px');
          btn.style.setProperty('--my', (y * 5).toFixed(1) + 'px');
        });
        btn.addEventListener('pointerleave', function () {
          btn.style.setProperty('--mx', '0px');
          btn.style.setProperty('--my', '0px');
        });
      });
    }

    /* Auto-Stagger für data-stagger Container */
    document.querySelectorAll('[data-stagger]').forEach(function (wrap) {
      var step = parseInt(wrap.getAttribute('data-stagger'), 10) || 90;
      Array.prototype.forEach.call(wrap.children, function (child, i) {
        if (child.classList.contains('reveal')) {
          child.style.setProperty('--reveal-delay', (i * step) + 'ms');
        }
      });
    });
  }

  window.PRAXIS = { API_BASE: API_BASE };
})();
