import React, { useEffect } from 'react';
import {
  ShieldCheck, MapPin, Camera, FileCheck2, PenTool, Landmark, Building2, Home, Trees, Factory, Store,
  Phone, Mail, ArrowRight, ArrowUp, LogIn, Send, UserCheck, ClipboardCheck, Download, Lock, Smartphone, Menu, X,
} from 'lucide-react';
import { SITE, BANKS, BANKS_SERVED } from '../../config/site';
import './PublicSite.css';

/**
 * Public website: home, privacy policy, terms and account-deletion pages.
 * page: 'home' | 'privacy' | 'terms' | 'delete-account'
 */
export default function PublicSite({ page = 'home', onNavigate, loggedIn = false }) {
  const [menu, setMenu] = React.useState(false);
  useEffect(() => { // website font (only loaded on the public pages)
    if (document.getElementById('ps-font')) return;
    const l = document.createElement('link');
    l.id = 'ps-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [page]);
  useEffect(() => {
    const titles = { home: 'Gouru Valuations — Bank property valuation', privacy: 'Privacy Policy — Gouru Valuations', terms: 'Terms of Use — Gouru Valuations', 'delete-account': 'Delete your account — Gouru Valuations' };
    document.title = titles[page] || titles.home;
  }, [page]);

  const scrolled = useScrollFx();
  const go = (path) => (e) => { e.preventDefault(); onNavigate(path); };
  const anchor = (id) => (e) => {
    e.preventDefault();
    if (page !== 'home') { onNavigate('/'); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60); }
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenu(false);
  };

  return (
    <div className="ps">
      <div className="ps-progress" aria-hidden="true"><span /></div>
      <header className={`ps-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="/" onClick={go('/')} className="ps-logo">
          <img src="/gcr_logo.png" alt="" width="36" height="36" />
          <span>{SITE.brand}</span>
        </a>
        <nav className={`ps-links ${menu ? 'open' : ''}`} aria-label="Main">
          <a href="/#how" onClick={anchor('how')}>How it works</a>
          <a href="/#services" onClick={anchor('services')}>Services</a>
          <a href="/#banks" onClick={anchor('banks')}>Banks</a>
          <a href="/#security" onClick={anchor('security')}>Security</a>
          <a href="/#contact" onClick={anchor('contact')}>Contact</a>
          <a href="/login" onClick={go('/login')} className="ps-login"><LogIn size={16} /> {loggedIn ? 'Open portal' : 'Login'}</a>
        </nav>
        <button className="ps-burger" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
      </header>

      {page === 'home' && <HomePage go={go} />}
      {page === 'privacy' && <Privacy />}
      {page === 'terms' && <Terms />}
      {page === 'delete-account' && <DeleteAccount />}

      <footer className="ps-footer">
        <div className="ps-footer-grid">
          <div>
            <div className="ps-footer-brand"><img src="/gcr_logo.png" alt="" width="28" height="28" /> {SITE.brand}</div>
            <p>{SITE.valuer}, {SITE.valuerTitle}. {SITE.iiv}.</p>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/#how" onClick={anchor('how')}>How it works</a>
            <a href="/#banks" onClick={anchor('banks')}>Banks we serve</a>
            <a href="/#contact" onClick={anchor('contact')}>Contact</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="/privacy" onClick={go('/privacy')}>Privacy Policy</a>
            <a href="/terms" onClick={go('/terms')}>Terms of Use</a>
            <a href="/delete-account" onClick={go('/delete-account')}>Delete your account</a>
          </div>
          <div>
            <h4>Portal</h4>
            <a href="/login" onClick={go('/login')}>Bank employee login</a>
            <a href="/login" onClick={go('/login')}>Staff login</a>
          </div>
        </div>
        <div className="ps-copy">© {new Date().getFullYear()} {SITE.brand}. All rights reserved.</div>
      </footer>
      <button type="button" className={`ps-top ${scrolled ? 'show' : ''}`} aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' })}><ArrowUp size={20} /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ Motion helpers */
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Adds .in to every [data-reveal] element when it scrolls into view (slide / fade in).
 *  Elements that appear later (new sections, re-renders) are picked up too. */
function useReveal() {
  useEffect(() => {
    const show = (e) => e.classList.add('in');
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(show);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    const seen = new WeakSet(); // per watcher, so a restarted watcher (React dev mode) still sees everything
    const watch = () => document.querySelectorAll('[data-reveal]:not(.in)').forEach((e) => { if (!seen.has(e)) { seen.add(e); io.observe(e); } });
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
}

const finePointer = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Scroll effects for every public page: reading-progress bar (--ps-p) and the "scrolled" nav state. */
function useScrollFx() {
  const [scrolled, setScrolled] = React.useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty('--ps-p', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
      document.documentElement.style.setProperty('--ps-y', `${Math.min(window.scrollY, 900)}px`);
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return scrolled;
}

/** Pointer effects (mouse only): a soft light that follows the cursor over cards ([data-glow]),
 *  3D tilt on [data-tilt] and a gentle magnetic pull on [data-magnet] buttons. */
function usePointerFx() {
  useEffect(() => {
    if (reduceMotion() || !finePointer()) return undefined;
    let tiltEl = null; let magEl = null;
    const onMove = (e) => {
      const glow = e.target.closest?.('[data-glow]');
      if (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty('--mx', `${e.clientX - r.left}px`);
        glow.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      const tilt = e.target.closest?.('[data-tilt]');
      if (tiltEl && tiltEl !== tilt) { tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); }
      tiltEl = tilt;
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      }
      const mag = e.target.closest?.('[data-magnet]');
      if (magEl && magEl !== mag) magEl.style.removeProperty('--tx');
      magEl = mag;
      if (mag) {
        const r = mag.getBoundingClientRect();
        mag.style.setProperty('--tx', `${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px`);
      }
    };
    const onLeave = () => {
      if (tiltEl) { tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); tiltEl = null; }
      if (magEl) { magEl.style.removeProperty('--tx'); magEl = null; }
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); };
  }, []);
}

/** Splits a phrase into words that rise in one after another. */
function Words({ text, start = 0, className = '' }) {
  return text.split(' ').map((w, i) => (
    <React.Fragment key={i}><span className={`ps-word ${className}`} style={{ '--i': start + i }}>{w}</span>{' '}</React.Fragment>
  ));
}

/** Number that counts up when it first appears. */
function CountUp({ to, suffix = '' }) {
  const ref = React.useRef(null);
  const [n, setN] = React.useState(0);
  useEffect(() => {
    if (reduceMotion()) { setN(to); return undefined; }
    let raf; let started = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (t) => { const k = Math.min(1, (t - t0) / 1200); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{n}{suffix}</span>;
}

/** The hero demo card: the 5 steps tick through by themselves, then start again. */
function LiveTracker() {
  const steps = ['Received by Gouru', 'Engineer assigned', 'Site visit done', 'Under Gouru review', 'Report ready'];
  const [at, setAt] = React.useState(reduceMotion() ? 5 : 1);
  useEffect(() => {
    if (reduceMotion()) return undefined;
    const t = setInterval(() => setAt((a) => (a >= 6 ? 1 : a + 1)), 1300);
    return () => clearInterval(t);
  }, []);
  const done = Math.min(at, 5);
  return (
    <div className="ps-hero-card" aria-hidden="true">
      <div className="ps-mock-head">
        <span className="ps-mock-bank"><Landmark size={16} /></span>
        <div><b>Valuation request</b><small>GOURU/KDP/2026/11/0021 · Open site</small></div>
        <span className={`ps-mock-pill ${done === 5 ? 'ok' : ''}`}>{done === 5 ? 'Ready' : 'Live'}</span>
      </div>
      <div className="ps-mock-bar"><span style={{ width: `${(done / 5) * 100}%` }} /></div>
      {steps.map((s, i) => (
        <div key={s} className={`ps-mock-row ${i + 1 < done || done === 5 ? 'done' : i + 1 === done ? 'now' : ''}`}>
          <span>{i + 1 < done || done === 5 ? '✓' : i + 1}</span>{s}
        </div>
      ))}
      <div className={`ps-mock-foot ${done === 5 ? 'show' : ''}`}>Signed report ready to download</div>
    </div>
  );
}

/** Official bank logo if public/bank-logos/<key>.png exists; otherwise the plain bank icon. */
function BankMark({ bank, size = 40, wide = false }) {
  const [ok, setOk] = React.useState(!!bank.logo);
  if (ok && bank.wordmark && wide) {
    return <img className="ps-bank-wordmark" src={`/bank-logos/${bank.key}.png`} alt={bank.name} style={{ height: size }} onError={() => setOk(false)} />;
  }
  return ok
    ? <img className="ps-bank-logo" src={`/bank-logos/${bank.key}.png`} alt={`${bank.name} logo`} width={size} height={size} onError={() => setOk(false)} />
    : <span className="ps-bank-icon" style={{ width: size, height: size }}><Landmark size={Math.round(size * 0.48)} /></span>;
}

/* ------------------------------------------------------------------ Home */
function HomePage({ go }) {
  useReveal();
  usePointerFx();
  const steps = [
    { icon: Send, t: 'Bank sends the request', d: 'The bank officer logs in and sends the customer, property and loan details to the Gouru branch.', c: 'c1' },
    { icon: UserCheck, t: 'Branch assigns an engineer', d: 'The Gouru branch admin picks a field engineer and fixes the site visit.', c: 'c2' },
    { icon: Camera, t: 'Site inspection', d: 'Documents checked by AI, geo-tagged and time-stamped site photos.', c: 'c3' },
    { icon: ClipboardCheck, t: 'Review & signature', d: 'Report built in the bank’s own format, reviewed and digitally signed.', c: 'c4' },
    { icon: Download, t: 'Bank downloads it', d: 'The approved report appears in the bank portal the moment it is approved.', c: 'c5' },
  ];
  const services = [
    { icon: Home, t: 'Independent houses', d: 'Land + building, plinth area, age and depreciation.', c: 'c1' },
    { icon: Building2, t: 'Apartments & flats', d: 'UDS, plinth / carpet area and project details.', c: 'c2' },
    { icon: MapPin, t: 'Open sites & plots', d: 'Guideline and market rates, boundaries, road access.', c: 'c3' },
    { icon: Trees, t: 'Agricultural land', d: 'Survey numbers, extents, irrigation and access.', c: 'c4' },
    { icon: Store, t: 'Commercial buildings', d: 'Shops, offices and mixed-use properties.', c: 'c5' },
    { icon: Factory, t: 'Industrial units', d: 'Land, sheds and structures for industrial loans.', c: 'c6' },
  ];
  const features = [
    { icon: FileCheck2, t: 'AI document check', d: 'Sale deeds (even in Telugu), plans, tax receipts and market value certificates are read and verified. Wrong or duplicate files are rejected.' },
    { icon: MapPin, t: 'Real GPS photos', d: 'Every site photo carries its real position, date, time and address — no gallery tricks.' },
    { icon: PenTool, t: 'Digital signature', d: 'Engineers sign once in settings; every report is signed in one tap.' },
    { icon: Lock, t: 'Tamper-evident archive', d: 'Submitted reports are fingerprinted (SHA-256) so any change can be detected.' },
  ];
  const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  return (
    <main className="ps-home">
      <section className="ps-hero">
        <div className="ps-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="ps-grid-bg" aria-hidden="true" />
        <div className="ps-hero-text">
          <span className="ps-eyebrow">Approved panel valuer · Andhra Pradesh</span>
          <h1 className="ps-h1">
            <Words text="Property valuations," />
            <span className="ps-word ps-grad" style={{ '--i': 2 }}>from site visit to signature</span>{' '}
            <Words text="— in one app." start={3} />
          </h1>
          <p>
            Gouru Valuations connects banks, branch offices and field engineers. Requests, AI-checked documents,
            geo-tagged photos and digitally signed reports — in each bank’s own format.
          </p>
          <div className="ps-cta">
            <a className="ps-btn ps-primary" data-magnet href="/login" onClick={go('/login')}><LogIn size={18} /> Bank / staff login <ArrowRight size={18} className="ps-arrow" /></a>
            <a className="ps-btn ps-ghost" data-magnet href="/#how" onClick={scrollTo('how')}>See how it works</a>
          </div>
          <div className="ps-trust">
            <span>Role-based security</span>
            <span>GPS-verified visits</span>
            <span>Digitally signed</span>
          </div>
        </div>
        <div className="ps-hero-stage" data-tilt><LiveTracker /></div>
        <a href="/#how" className="ps-scroll-cue" onClick={scrollTo('how')} aria-label="Scroll down"><span /></a>
      </section>

      <section className="ps-stats" data-reveal>
        <div><b><CountUp to={BANKS_SERVED.length} /></b><span>bank report formats built in</span></div>
        <div><b><CountUp to={6} /></b><span>property types valued</span></div>
        <div><b><CountUp to={5} /></b><span>clear steps, request to report</span></div>
        <div><b><CountUp to={4} /></b><span>roles, each sees only its own work</span></div>
      </section>

      <section className="ps-marquee" aria-label="Banks we serve">
        <div className="ps-marquee-track">
          {[...BANKS, ...BANKS].map((b, i) => (
            <span key={i} className={b.logo && b.wordmark ? 'ps-mq-logo' : ''}>
              <BankMark bank={b} size={b.logo && b.wordmark ? 34 : 26} wide />{!(b.logo && b.wordmark) && ` ${b.name}`}
            </span>
          ))}
        </div>
      </section>

      <section className="ps-section" id="how">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">How it works</span>
          <h2>One clear path for every valuation</h2>
          <p className="ps-lead">Everyone sees exactly what they need — nothing more.</p>
        </div>
        <ol className="ps-steps" data-reveal="line">
          {steps.map((s, i) => (
            <li key={s.t} data-reveal data-glow style={{ '--d': `${150 + i * 120}ms` }} className={s.c}>
              <span className="ps-step-n">0{i + 1}</span>
              <span className="ps-chip"><s.icon size={22} /></span>
              <h3>{s.t}</h3><p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ps-section ps-dark" id="features">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">Built for trust</span>
          <h2>Banks get reports they can rely on</h2>
        </div>
        <div className="ps-feat">
          {features.map((f, i) => (
            <div key={f.t} className="ps-feat-card" data-reveal="zoom" data-glow style={{ '--d': `${i * 90}ms` }}>
              <span className="ps-feat-icon"><f.icon size={22} /></span>
              <h3>{f.t}</h3><p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ps-section" id="services">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">Services</span>
          <h2>Every kind of property a bank lends on</h2>
          <p className="ps-lead">Home loans, mortgages, construction, agriculture and business lending.</p>
        </div>
        <div className="ps-grid3">
          {services.map((s, i) => (
            <div key={s.t} className={`ps-tile ${s.c}`} data-reveal data-glow style={{ '--d': `${(i % 3) * 90}ms` }}>
              <span className="ps-chip"><s.icon size={22} /></span><h3>{s.t}</h3><p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ps-section ps-soft" id="banks">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">Banks we serve</span>
          <h2>Each bank’s own approved format</h2>
          <p className="ps-lead">Exactly the layout each bank expects — with the values filled in automatically.</p>
        </div>
        <div className="ps-banks">
          {BANKS.map((b, i) => (
            <div key={b.key} className="ps-bank-card" data-reveal="zoom" data-glow style={{ '--d': `${(i % 4) * 70}ms` }}>
              <BankMark bank={b} size={b.wordmark ? 64 : 52} wide />
              {!(b.logo && b.wordmark) && <span>{b.name}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="ps-section" id="roles">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">One system</span>
          <h2>Four roles, perfectly connected</h2>
        </div>
        <div className="ps-grid2">
          {[
            { icon: Landmark, t: 'Bank employees', d: 'Send valuation requests, follow every step live and download approved reports.', c: 'c1' },
            { icon: Building2, t: 'Branch admins', d: 'Receive requests, assign engineers, review and approve, manage the team.', c: 'c2' },
            { icon: Smartphone, t: 'Field engineers', d: 'Mobile app at the site: documents, measurements, GPS photos, signature.', c: 'c3' },
            { icon: ShieldCheck, t: 'Head office', d: 'Every branch, bank formats, letterheads and valuation percentages.', c: 'c4' },
          ].map((r, i) => (
            <div key={r.t} className={`ps-tile ps-role ${r.c}`} data-reveal={i % 2 ? 'right' : 'left'} data-glow style={{ '--d': `${(i % 2) * 90}ms` }}>
              <span className="ps-chip"><r.icon size={22} /></span><div><h3>{r.t}</h3><p>{r.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="ps-cta-band" data-reveal="zoom">
        <div className="ps-sparks" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--k': i }} />)}</div>
        <div>
          <h2>Ready to send your next valuation?</h2>
          <p>Bank officers and Gouru staff sign in with the login given by Gouru.</p>
        </div>
        <a className="ps-btn ps-white" data-magnet href="/login" onClick={go('/login')}><LogIn size={18} /> Login now <ArrowRight size={18} className="ps-arrow" /></a>
      </section>

      <section className="ps-section" id="contact">
        <div className="ps-head" data-reveal>
          <span className="ps-kicker">Contact</span>
          <h2>Talk to us</h2>
        </div>
        <div className="ps-contact">
          <div data-reveal className="c1"><span className="ps-chip"><MapPin size={20} /></span><div><b>Head office</b><p>{SITE.address}</p></div></div>
          <div data-reveal className="c2" style={{ '--d': '90ms' }}><span className="ps-chip"><Phone size={20} /></span><div><b>Phone</b><p>{SITE.phones.map((p) => <a key={p} href={`tel:+91${p.replace(/\s/g, '')}`}>{p}</a>).reduce((a, b) => [a, ' · ', b])}</p></div></div>
          <div data-reveal className="c3"><span className="ps-chip"><Mail size={20} /></span><div><b>Email</b><p><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p></div></div>
          <div data-reveal className="c4" style={{ '--d': '90ms' }}><span className="ps-chip"><PenTool size={20} /></span><div><b>Valuer</b><p>{SITE.valuer}<br />{SITE.iiv}</p></div></div>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ Legal pages */
function Legal({ title, children }) {
  return (
    <>
      <div className="ps-legal-hero">
        <div className="ps-blobs" aria-hidden="true"><i /><i /><i /></div>
        <h1>{title}</h1>
        <p>Last updated: {SITE.policyDate}</p>
      </div>
      <main className="ps-legal">{children}</main>
    </>
  );
}

function Privacy() {
  return (
    <Legal title="Privacy Policy">
      <p>
        This policy explains how <b>{SITE.brand}</b> ({SITE.valuer}, {SITE.address}) — “we”, “us” — collects, uses, shares and
        protects personal data in the {SITE.apps} (together, the “Services”). We follow the Digital Personal Data Protection
        Act, 2023 and the Information Technology Act, 2000 and its rules.
      </p>

      <h2>1. Who uses the Services</h2>
      <ul>
        <li><b>Gouru staff</b> — field engineers, branch admins and head office.</li>
        <li><b>Bank employees</b> — officers of our client banks who send valuation requests and download reports.</li>
        <li><b>Property owners / borrowers</b> do not use the apps, but their details appear in the documents and reports we prepare for the bank.</li>
      </ul>
      <p>Accounts are created only by Gouru. The Services are for professional use and are not meant for anyone under 18.</p>

      <h2>2. Data we collect</h2>
      <table className="ps-table">
        <thead><tr><th>Data</th><th>Whose</th><th>Why we use it</th></tr></thead>
        <tbody>
          <tr><td>Name, username, mobile number, email, role, branch; for bank employees: bank, bank branch and designation</td><td>Staff, bank employees</td><td>To create and secure your account and show you the right work</td></tr>
          <tr><td>Password (stored only as a one-way hash)</td><td>All users</td><td>To log you in</td></tr>
          <tr><td><b>Precise location</b> (GPS)</td><td>Field engineers</td><td>To check in / out of duty, to stamp site photos with their real position, and — <b>only while the engineer is on duty</b> — to show their live position to their branch admin, <b>including when the app is in the background or the screen is off</b>. Tracking stops at check-out.</td></tr>
          <tr><td>Approximate location from the network (IP address)</td><td>Field engineers</td><td>Only when GPS is unavailable, to resolve an approximate place for attendance</td></tr>
          <tr><td>Camera and photos</td><td>Field engineers</td><td>To take or select site photos and scan property documents</td></tr>
          <tr><td><b>Face data</b> (a face template and reference photo)</td><td>Staff who choose Face check-in</td><td>Only to confirm that the right person checks in for attendance. It is optional and can be removed by your admin.</td></tr>
          <tr><td>Fingerprint / Face ID / passkey</td><td>Users who turn it on</td><td>To unlock the app. This check happens on your phone; we never receive your fingerprint or face scan.</td></tr>
          <tr><td>Digital signature image</td><td>Field engineers</td><td>To sign the valuation reports they submit</td></tr>
          <tr><td>Property documents (sale deeds, plans, tax receipts, certificates), measurements and site details</td><td>Property owners / borrowers</td><td>To prepare the valuation report the bank asked for. These documents can contain names, addresses and ID numbers; we do not copy ID numbers (such as Aadhaar) into reports.</td></tr>
          <tr><td>Valuation request details (customer name, mobile, property address, loan purpose)</td><td>Borrowers, entered by bank employees</td><td>To carry out the requested valuation</td></tr>
          <tr><td>Chat messages and notifications</td><td>Staff</td><td>Work communication between engineers and admins</td></tr>
          <tr><td>Device and log data (app version, push token, activity times, error logs)</td><td>All users</td><td>To deliver notifications, keep the Services secure and fix problems</td></tr>
        </tbody>
      </table>

      <h2>3. App permissions</h2>
      <ul>
        <li><b>Location (including background, engineers only)</b> — attendance, live field map while on duty, geo-tagged photos.</li>
        <li><b>Camera / photos and media</b> — site photos and document scans.</li>
        <li><b>Notifications</b> — new cases, assignments, approvals and reminders.</li>
        <li><b>Biometrics</b> — optional app unlock; handled entirely by your phone.</li>
        <li><b>Internet / network state</b> — to sync with our servers.</li>
      </ul>
      <p>You can turn permissions off in your phone settings; some features (such as site photos or attendance) will then not work.</p>

      <h2>4. How documents are read</h2>
      <p>
        To check that an uploaded document is the right kind (for example, a sale deed and not a tax receipt) and to read its
        details, the file is sent securely to <b>Google’s Gemini API</b>, which returns the text and details to us. Addresses for
        site photos are looked up from the GPS position with <b>OpenStreetMap (Nominatim)</b>. Approximate network location uses
        <b> ip-api.com</b> only when GPS is unavailable.
      </p>

      <h2>5. Who we share data with</h2>
      <ul>
        <li><b>The requesting bank</b> — the valuation report and the details in it.</li>
        <li><b>Service providers</b> that run the Services for us: cloud hosting and database, Google (Gemini document reading; Firebase Cloud Messaging for notifications), OpenStreetMap and ip-api.com (location look-ups), and file storage when enabled. They may process data only to provide their service to us.</li>
        <li><b>Authorities</b> — when the law requires it.</li>
      </ul>
      <p>We do <b>not</b> sell personal data, and we do not use it for advertising.</p>

      <h2>6. How long we keep data</h2>
      <p>
        Valuation reports and their supporting documents are kept for as long as our agreements with the banks and the law
        require, because banks rely on them for loan records and audits. Account data is kept while the account is active.
        Location history, face data and device data are kept only as long as needed for attendance and security, and are deleted
        or anonymised when no longer needed or when the account is closed (except where the law requires us to keep them).
      </p>

      <h2>7. Security</h2>
      <ul>
        <li>Data is sent over encrypted connections (HTTPS).</li>
        <li>Passwords are stored only as secure hashes; temporary passwords issued by admins are stored encrypted.</li>
        <li>Role-based access: each login sees only its own branch, cases or requests.</li>
        <li>Submitted reports are archived with a SHA-256 fingerprint so tampering can be detected.</li>
      </ul>
      <p>No system is perfectly secure. If a breach affects your data, we will inform you and the authorities as the law requires.</p>

      <h2>8. Your rights</h2>
      <p>
        You can ask to <b>access</b>, <b>correct</b> or <b>erase</b> your personal data, withdraw consent for optional features
        (such as Face check-in), and nominate someone to exercise your rights. Some data cannot be erased while the law or our
        agreements with banks require us to keep it — we will tell you when that applies. To delete your account, see
        <a href="/delete-account"> Delete your account</a>.
      </p>

      <h2>9. Grievance officer & contact</h2>
      <p>
        {SITE.grievanceOfficer}, {SITE.address}<br />
        Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a> · Phone: {SITE.phones.join(', ')}<br />
        We reply to requests and complaints within the time the law requires. If you are not satisfied, you may complain to the
        Data Protection Board of India.
      </p>

      <h2>10. Changes</h2>
      <p>We will update this page when our practices change and show the new date at the top. Important changes will also be shown in the app.</p>
    </Legal>
  );
}

function Terms() {
  return (
    <Legal title="Terms of Use">
      <p>These terms apply to the {SITE.apps}. By logging in you agree to them.</p>
      <h2>1. Accounts</h2>
      <p>Accounts are issued by {SITE.brand} to its staff and to employees of its client banks. Keep your password private; you are responsible for activity on your account. Tell us at once if you think it has been misused.</p>
      <h2>2. Proper use</h2>
      <ul>
        <li>Use the Services only for genuine valuation work.</li>
        <li>Upload only documents and photos that belong to the property being valued. Duplicate, altered or unrelated files are rejected and may lead to the account being suspended.</li>
        <li>Do not try to access other branches’ or other banks’ data, or interfere with the Services.</li>
      </ul>
      <h2>3. Reports</h2>
      <p>Valuation reports are prepared for the requesting bank by an approved valuer. The opinion of value is given in the signed report; status screens and previews are for tracking only.</p>
      <h2>4. Availability</h2>
      <p>We work to keep the Services available but cannot promise they will never be interrupted (for example, during maintenance or when a third-party service is unavailable).</p>
      <h2>5. Privacy</h2>
      <p>Our <a href="/privacy">Privacy Policy</a> explains how personal data is handled.</p>
      <h2>6. Contact</h2>
      <p>{SITE.brand}, {SITE.address}. Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
    </Legal>
  );
}

function DeleteAccount() {
  return (
    <Legal title="Delete your account">
      <p>You can ask us to delete your {SITE.brand} account and the personal data linked to it at any time.</p>
      <h2>How to ask</h2>
      <ol>
        <li>Email <a href={`mailto:${SITE.email}?subject=Account%20deletion%20request`}>{SITE.email}</a> from the email or mobile number on your account, with your name, username and branch / bank — or</li>
        <li>Ask your Gouru branch admin, or call {SITE.phones[0]}.</li>
      </ol>
      <p>We confirm your identity, then close the account and confirm when it is done.</p>
      <h2>What is deleted</h2>
      <ul>
        <li>Your login, profile, phone number and email</li>
        <li>Face check-in data, passkeys and saved digital signature</li>
        <li>Location history, push tokens and device data</li>
      </ul>
      <h2>What we must keep</h2>
      <p>Valuation reports you prepared, approved or requested — and the case records behind them — are kept for as long as our agreements with banks and the law require, because banks rely on them for loan records and audits. Your name may remain on those reports.</p>
    </Legal>
  );
}
