(function () {
  "use strict";

  /* ──────────────────────────────────────────────────────────
     Helpers
  ────────────────────────────────────────────────────────── */
  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const reduced   = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  /* ──────────────────────────────────────────────────────────
     Splash
  ────────────────────────────────────────────────────────── */
  function initSplash() {
    const splash = $("[data-splash]");
    if (!splash) return;

    function hide() {
      splash.classList.add("is-out");
      setTimeout(() => {
        splash.style.display = "none";
        // Reveal hero elements
        const hero = $(".hero");
        if (hero) hero.classList.add("is-ready");
      }, 650);
    }

    if (document.readyState === "complete") {
      setTimeout(hide, 500);
    } else {
      window.addEventListener("load", () => setTimeout(hide, 400));
    }
    // JS safety net (CSS has 4.5s, this is backup)
    setTimeout(hide, 3800);
  }

  /* ──────────────────────────────────────────────────────────
     Nav — solidify on scroll, mobile hamburger
  ────────────────────────────────────────────────────────── */
  function initNav() {
    const nav    = $("[data-nav]");
    const burger = $(".nav-burger");
    const mobile = $("#nav-mobile");
    const closeBtn = $(".nav-mobile-close");
    if (!nav) return;

    // Solidify
    const THRESHOLD = 80;
    let ticking = false;
    function checkScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle("is-solid", window.scrollY > THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();

    // Mobile menu open/close
    function openMobile() {
      if (!mobile || !burger) return;
      mobile.classList.add("is-open");
      mobile.setAttribute("aria-hidden", "false");
      burger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function closeMobile() {
      if (!mobile || !burger) return;
      mobile.classList.remove("is-open");
      mobile.setAttribute("aria-hidden", "true");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    if (burger) burger.addEventListener("click", openMobile);
    if (closeBtn) closeBtn.addEventListener("click", closeMobile);

    // Close on mobile link click
    $$(".nav-mobile-link, .nav-mobile .btn").forEach(link => {
      link.addEventListener("click", closeMobile);
    });

    // Close on Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeMobile();
    });
  }

  /* ──────────────────────────────────────────────────────────
     Smooth scroll — anchor links with nav offset
  ────────────────────────────────────────────────────────── */
  function setupSmoothScroll() {
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h") || "72");
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - navH,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     Custom cursor (desktop only)
  ────────────────────────────────────────────────────────── */
  function initCursor() {
    if (!fineHover) return;
    const cursor = $(".cursor");
    const dot    = $(".cursor-dot");
    const ring   = $(".cursor-ring");
    if (!cursor || !dot || !ring) return;

    let dx = 0, dy = 0, rx = 0, ry = 0;
    let firstMove = false;
    const LERP = reduced ? 1 : 0.12;

    window.addEventListener("mousemove", e => {
      dx = e.clientX; dy = e.clientY;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      if (!firstMove) {
        firstMove = true;
        rx = dx; ry = dy;
        cursor.classList.add("is-ready");
      }
    });

    function loop() {
      rx += (dx - rx) * LERP;
      ry += (dy - ry) * LERP;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    }
    loop();

    // Hover detection for ring scale
    const HOVERABLES = 'a, button, [data-tilt], .carta-tab, input, select, textarea, label';
    document.addEventListener("mouseover", e => {
      if (e.target.closest(HOVERABLES)) cursor.classList.add("is-hovering");
    });
    document.addEventListener("mouseout", e => {
      if (!e.relatedTarget || !e.relatedTarget.closest(HOVERABLES)) {
        cursor.classList.remove("is-hovering");
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     Reveal on scroll — IntersectionObserver
  ────────────────────────────────────────────────────────── */
  function initReveals() {
    const items = $$(".reveal[data-reveal]");
    if (!items.length) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.02, rootMargin: "0px 0px -4% 0px" });

    items.forEach(el => io.observe(el));

    // 6s safety: force-reveal anything still hidden in viewport
    setTimeout(() => {
      items.forEach(el => {
        if (!el.classList.contains("is-visible")) {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight + 100) {
            el.classList.add("is-visible");
          }
        }
      });
    }, 6000);
  }

  /* ──────────────────────────────────────────────────────────
     Tilt — 3D card tilt with amber halo
  ────────────────────────────────────────────────────────── */
  function initTilt() {
    if (!fineHover) return;
    const cards = $$("[data-tilt]");
    if (!cards.length) return;

    const MAX_TILT = 7;
    const LERP_T   = 0.1;

    cards.forEach(card => {
      // Inject halo element
      const halo = document.createElement("div");
      halo.className = "plato-card-halo";
      halo.style.cssText = "position:absolute;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,82,0,0.18),transparent 70%);pointer-events:none;transform:translate(-50%,-50%);z-index:1;opacity:0;transition:opacity .3s;";
      card.style.position = "relative";
      card.style.overflow = "visible";
      card.appendChild(halo);

      let curX = 0, curY = 0, tarX = 0, tarY = 0;
      let animId = null;
      let isHovered = false;

      function animate() {
        if (!isHovered && Math.abs(curX) < 0.05 && Math.abs(curY) < 0.05) {
          cancelAnimationFrame(animId);
          animId = null;
          card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
          return;
        }
        curX += (tarX - curX) * LERP_T;
        curY += (tarY - curY) * LERP_T;
        card.style.transform = `perspective(900px) rotateX(${curX}deg) rotateY(${curY}deg) scale3d(1.02,1.02,1.02)`;
        animId = requestAnimationFrame(animate);
      }

      card.addEventListener("mousemove", e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        tarX = -y * MAX_TILT * 2;
        tarY =  x * MAX_TILT * 2;
        // Halo
        halo.style.left = (e.clientX - rect.left) + "px";
        halo.style.top  = (e.clientY - rect.top)  + "px";
        halo.style.opacity = "1";
        if (!animId) animId = requestAnimationFrame(animate);
      });

      card.addEventListener("mouseenter", () => { isHovered = true; });

      card.addEventListener("mouseleave", () => {
        isHovered = false;
        tarX = 0; tarY = 0;
        halo.style.opacity = "0";
        if (!animId) animId = requestAnimationFrame(animate);
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     Count-up — [data-count-to] elements
  ────────────────────────────────────────────────────────── */
  function initCountUp() {
    const els = $$("[data-count-to]");
    if (!els.length) return;

    const DURATION = reduced ? 0 : 1600;

    function formatNum(n, target) {
      // If target string has dots (e.g. "12.000"), preserve format
      const targetStr = String(target);
      if (targetStr.includes(".")) {
        return parseFloat(n).toLocaleString("es-ES");
      }
      if (parseFloat(targetStr) % 1 !== 0) {
        return parseFloat(n).toFixed(1);
      }
      return Math.round(n).toLocaleString("es-ES");
    }

    const io2 = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const targetVal = parseFloat(el.dataset.countTo);
        const start = performance.now();

        function step(now) {
          const elapsed = now - start;
          const progress = DURATION > 0 ? Math.min(elapsed / DURATION, 1) : 1;
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = formatNum(targetVal * eased, el.dataset.countTo);
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = formatNum(targetVal, el.dataset.countTo);
        }

        requestAnimationFrame(step);
        io2.unobserve(el);
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -4% 0px" });

    els.forEach(el => io2.observe(el));

    setTimeout(() => {
      els.forEach(el => {
        if (!el.dataset.counted) {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight + 100) {
            const targetVal = parseFloat(el.dataset.countTo);
            el.textContent = formatNum(targetVal, el.dataset.countTo);
          }
        }
      });
    }, 6000);
  }

  /* ──────────────────────────────────────────────────────────
     Carta tabs
  ────────────────────────────────────────────────────────── */
  function initCartaTabs() {
    const tabs   = $$(".carta-tab");
    const panels = $$(".carta-panel");
    if (!tabs.length || !panels.length) return;

    function activate(tab) {
      const targetId = "tab-" + tab.dataset.tab;

      tabs.forEach(t => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });

      panels.forEach(p => {
        const isTarget = p.id === targetId;
        p.classList.toggle("is-active", isTarget);
        if (isTarget) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });

      // Re-trigger tilt on new cards
      safe(initTilt, "initTilt-retrigger");
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(tab);
        }
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     Form submit (simulated — no backend)
  ────────────────────────────────────────────────────────── */
  function initFormSubmit() {
    const form   = $("#form-reservas");
    const btn    = $("#btn-submit");
    const notice = $(".form-notice");
    if (!form || !btn) return;

    form.addEventListener("submit", e => {
      e.preventDefault();

      // Validate
      if (!form.reportValidity()) return;

      // Set loading state
      btn.classList.add("is-loading");
      btn.disabled = true;
      if (notice) { notice.className = "form-notice"; notice.textContent = ""; }

      // Simulate server call (1.8s)
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.classList.add("is-done");

        if (notice) {
          notice.classList.add("is-success");
          notice.textContent = "¡Reserva recibida! Contactaremos contigo en breve para confirmar.";
        }

        // Reset after 5s
        setTimeout(() => {
          btn.classList.remove("is-done");
          btn.disabled = false;
          form.reset();
          if (notice) { notice.className = "form-notice"; notice.textContent = ""; }
        }, 5000);
      }, 1800);
    });
  }

  /* ──────────────────────────────────────────────────────────
     GSAP parallax on hero image (subtle — only if GSAP loaded)
  ────────────────────────────────────────────────────────── */
  function initHeroParallax() {
    if (!window.gsap || !window.ScrollTrigger || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const heroBg = $(".hero-bg img");
    if (!heroBg) return;
    gsap.to(heroBg, {
      yPercent: 20,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     Boot
  ────────────────────────────────────────────────────────── */
  function boot() {
    safe(initSplash,        "initSplash");
    safe(initNav,           "initNav");
    safe(setupSmoothScroll, "setupSmoothScroll");
    safe(initCursor,        "initCursor");
    safe(initReveals,       "initReveals");
    safe(initTilt,          "initTilt");
    safe(initCountUp,       "initCountUp");
    safe(initCartaTabs,     "initCartaTabs");
    safe(initFormSubmit,    "initFormSubmit");

    if (window.gsap && window.ScrollTrigger) {
      safe(initHeroParallax, "initHeroParallax");
    }

    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
