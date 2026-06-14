// ============================================================================
//  Project Destiny 2: Electric Boogaloo
//  Fireteam availability calendar — runs on GitHub Pages + Firebase
// ============================================================================

import { h, render, Fragment } from 'https://esm.sh/preact@10.22.0';
import {
  useState, useEffect, useCallback, useMemo, useRef
} from 'https://esm.sh/preact@10.22.0/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getDatabase, ref as dbRef, set, onValue, remove, update
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js';
import {
  getAuth, signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';


// ============================================================================
//                                                                  ▼ EDIT ▼
//  PASTE YOUR FIREBASE CONFIG HERE
//
//  From Firebase Console:
//    Project Settings (gear icon) → General tab → Your apps → SDK setup
//    → Config (the object that starts with "apiKey")
//
//  Also make sure you've enabled:
//    1. Authentication → Sign-in method → Anonymous (toggle on)
//    2. Realtime Database → Create database (start in test mode, then
//       replace rules with the contents of database.rules.json)
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyAxw0yndXFHXNM3Mc0-XFSf0LD5m7MFZ3M",
  authDomain: "destiny-2-electric-boogaloo.firebaseapp.com",
  databaseURL: "https://destiny-2-electric-boogaloo-default-rtdb.firebaseio.com/",
  projectId: "destiny-2-electric-boogaloo",
  storageBucket: "destiny-2-electric-boogaloo.firebasestorage.app",
  messagingSenderId: "261878471576",
  appId: "1:261878471576:web:8c80f1cfde75fa18b129ed"
};

// ============================================================================
//                                                                  ▲ EDIT ▲
// ============================================================================


const html = htm.bind(h);
const IS_UNCONFIGURED = !firebaseConfig
  || !firebaseConfig.apiKey
  || typeof firebaseConfig.apiKey !== 'string'
  || firebaseConfig.apiKey.startsWith('REPLACE_');

// Surface any uncaught error directly on the page so non-dev users see it.
function showFatalError(label, detail) {
  const el = document.getElementById('app');
  if (!el) return;
  el.innerHTML = `
    <div style="max-width:600px;margin:60px auto;padding:24px;
                background:#11151E;border:1px solid #D6493E;
                border-left:2px solid #D6493E;color:#ECE7D9;
                font-family:Inter,system-ui,sans-serif;">
      <h2 style="margin:0 0 12px;color:#D6493E;font-size:18px;">${label}</h2>
      <pre style="margin:0;padding:12px;background:#0A0D14;color:#E8B968;
                  font-size:12px;white-space:pre-wrap;word-break:break-word;
                  font-family:ui-monospace,monospace;">${
        String(detail).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))
      }</pre>
    </div>`;
}

window.addEventListener('error', (e) => {
  showFatalError('JavaScript error', e.error?.stack || e.message || String(e));
});
window.addEventListener('unhandledrejection', (e) => {
  showFatalError('Async error', e.reason?.stack || e.reason?.message || String(e.reason));
});

let firebaseApp, db, auth;
if (!IS_UNCONFIGURED) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);
  } catch (e) {
    showFatalError('Firebase init failed', e.stack || e.message || String(e));
    throw e;
  }
}


// ============================================================================
//  Constants
// ============================================================================

const HOURS = [16, 17, 18, 19, 20, 21, 22, 23];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CLASSES = {
  titan:   { name: 'Titan',   color: '#D6493E' },
  hunter:  { name: 'Hunter',  color: '#9B6BD8' },
  warlock: { name: 'Warlock', color: '#4BB4D8' },
};

const RAIDS = [
  "Salvation's Edge",
  "Crota's End",
  "Root of Nightmares",
  "King's Fall",
  "Vow of the Disciple",
  "Vault of Glass",
  "Deep Stone Crypt",
  "Garden of Salvation",
  "Last Wish",
  "Dungeon",
  "Other",
];

const FIRETEAM_SIZE = 6;
const LS_KEY = 'pd2eb_my_guardian_id';


// ============================================================================
//  Icons (inline SVG, Lucide path data)
// ============================================================================

function svgIcon(size, color, inner) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
         viewBox="0 0 24 24" fill="none"
         stroke=${color || 'currentColor'} stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">${inner}</svg>
  `;
}

const I = {
  chevronLeft:  (s=16, c) => svgIcon(s, c, html`<path d="m15 18-6-6 6-6"/>`),
  chevronRight: (s=16, c) => svgIcon(s, c, html`<path d="m9 18 6-6-6-6"/>`),
  plus:         (s=16, c) => svgIcon(s, c, html`<path d="M5 12h14"/><path d="M12 5v14"/>`),
  x:            (s=16, c) => svgIcon(s, c, html`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`),
  check:        (s=16, c) => svgIcon(s, c, html`<path d="M20 6 9 17l-5-5"/>`),
  shield:       (s=16, c) => svgIcon(s, c, html`<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`),
  sparkles:     (s=16, c) => svgIcon(s, c, html`<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>`),
  sword:        (s=16, c) => svgIcon(s, c, html`<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/>`),
  users:        (s=16, c) => svgIcon(s, c, html`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`),
  clock:        (s=16, c) => svgIcon(s, c, html`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`),
  trash:        (s=16, c) => svgIcon(s, c, html`<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`),
  calendar:     (s=16, c) => svgIcon(s, c, html`<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`),
};

function classIcon(klass, size = 14) {
  const color = CLASSES[klass]?.color;
  if (klass === 'titan')   return I.shield(size, color);
  if (klass === 'hunter')  return I.sword(size, color);
  if (klass === 'warlock') return I.sparkles(size, color);
  return I.users(size);
}


// ============================================================================
//  Helpers
// ============================================================================

const pad = (n) => String(n).padStart(2, '0');
const dateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slotKey = (ds, hour) => `${ds}_${hour}`;
const randomId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

function formatHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
}

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatRange(start) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function formatLongDate(date) {
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  return `${day}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function raidDateTime(raid) {
  const d = new Date(raid.date + 'T00:00:00');
  d.setHours(raid.hour);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}


// ============================================================================
//  Firebase data operations
// ============================================================================

const fb = {
  guardianRef:    (id)            => dbRef(db, `guardians/${id}`),
  guardiansRef:   ()              => dbRef(db, 'guardians'),
  availRef:       (gid, key)      => dbRef(db, `availability/${gid}/${key}`),
  availUserRef:   (gid)           => dbRef(db, `availability/${gid}`),
  availAllRef:    ()              => dbRef(db, 'availability'),
  raidRef:        (id)            => dbRef(db, `raids/${id}`),
  raidsRef:       ()              => dbRef(db, 'raids'),
  attendeeRef:    (raidId, gid)   => dbRef(db, `raids/${raidId}/attendees/${gid}`),
};


// ============================================================================
//  Root — handles auth state and config errors
// ============================================================================

function Root() {
  const [phase, setPhase] = useState('connecting'); // 'connecting' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (IS_UNCONFIGURED) return; // Root will render the config screen
    signInAnonymously(auth)
      .then(() => setPhase('ready'))
      .catch(err => {
        console.error('Auth failed:', err);
        setErrorMsg(err.message || String(err));
        setPhase('error');
      });
  }, []);

  if (IS_UNCONFIGURED) {
    return html`
      <div class="ft-root">
        <div class="ft-error">
          <h2>Firebase config required</h2>
          <p>Open <code>app.js</code> and paste your Firebase config into the
             marked section near the top of the file.</p>
          <p>See <code>README.md</code> for the full setup walkthrough.</p>
        </div>
      </div>
    `;
  }

  if (phase === 'error') {
    return html`
      <div class="ft-root">
        <div class="ft-error">
          <h2>Could not connect</h2>
          <p>Firebase rejected the connection. Common causes:
             Anonymous auth isn't enabled in the Firebase console,
             or the database URL is wrong.</p>
          <p><code>${errorMsg}</code></p>
        </div>
      </div>
    `;
  }

  if (phase === 'connecting') {
    return html`<div class="ft-root ft-center"><div class="ft-loading">Establishing fireteam link…</div></div>`;
  }

  return html`<${MainApp} />`;
}


// ============================================================================
//  MainApp — the actual scheduler UI
// ============================================================================

function MainApp() {
  const [guardians, setGuardians] = useState({});
  const [availability, setAvailability] = useState({});
  const [raids, setRaids] = useState({});
  const [myId, setMyId] = useState(() => localStorage.getItem(LS_KEY));
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [modal, setModal] = useState(null);
  const [dataReady, setDataReady] = useState({ g: false, a: false, r: false });

  // ---- Real-time subscriptions ----
  useEffect(() => {
    const offGuardians = onValue(fb.guardiansRef(), (snap) => {
      setGuardians(snap.val() || {});
      setDataReady(prev => ({ ...prev, g: true }));
    });
    const offAvail = onValue(fb.availAllRef(), (snap) => {
      setAvailability(snap.val() || {});
      setDataReady(prev => ({ ...prev, a: true }));
    });
    const offRaids = onValue(fb.raidsRef(), (snap) => {
      setRaids(snap.val() || {});
      setDataReady(prev => ({ ...prev, r: true }));
    });
    return () => { offGuardians(); offAvail(); offRaids(); };
  }, []);

  const allReady = dataReady.g && dataReady.a && dataReady.r;
  const guardiansList = useMemo(() => Object.values(guardians), [guardians]);
  const me = myId ? guardians[myId] : null;
  const raidsList = useMemo(() => Object.values(raids), [raids]);

  // ---- Actions ----

  const createGuardian = async ({ name, klass }) => {
    const id = randomId();
    const guardian = { id, name: name.trim(), klass, createdAt: Date.now() };
    try {
      await set(fb.guardianRef(id), guardian);
      localStorage.setItem(LS_KEY, id);
      setMyId(id);
      setModal(null);
    } catch (e) {
      console.error('createGuardian failed', e);
      alert('Could not save guardian. Check your Firebase database rules.');
    }
  };

  const switchGuardian = (id) => {
    localStorage.setItem(LS_KEY, id);
    setMyId(id);
  };

  const toggleSlot = async (ds, hour) => {
    if (!myId) return;
    const key = slotKey(ds, hour);
    const currently = availability[myId]?.[key];
    try {
      if (currently) {
        await remove(fb.availRef(myId, key));
      } else {
        await set(fb.availRef(myId, key), true);
      }
    } catch (e) {
      console.error('toggleSlot failed', e);
    }
  };

  const createRaid = async ({ raidName, date, hour, notes }) => {
    const id = randomId();
    const raid = {
      id, raidName, date, hour,
      notes: (notes || '').trim() || null,
      createdBy: myId || null,
      createdAt: Date.now(),
      attendees: myId ? { [myId]: true } : {},
    };
    try {
      await set(fb.raidRef(id), raid);
      setModal(null);
    } catch (e) {
      console.error('createRaid failed', e);
      alert('Could not schedule raid. Check your Firebase database rules.');
    }
  };

  const toggleRaidAttendance = async (raid) => {
    if (!myId) return;
    const attending = !!raid.attendees?.[myId];
    try {
      if (attending) {
        await remove(fb.attendeeRef(raid.id, myId));
      } else {
        await set(fb.attendeeRef(raid.id, myId), true);
      }
    } catch (e) {
      console.error('toggleRaidAttendance failed', e);
    }
  };

  const deleteRaid = async (raid) => {
    if (!window.confirm(`Delete "${raid.raidName}" on ${raid.date}?`)) return;
    try {
      await remove(fb.raidRef(raid.id));
    } catch (e) {
      console.error('deleteRaid failed', e);
    }
  };

  // ---- Derived ----

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const getSlotGuardians = useCallback(
    (ds, hour) => {
      const key = slotKey(ds, hour);
      return guardiansList.filter(g => availability[g.id]?.[key]);
    },
    [guardiansList, availability]
  );

  const sortedRaids = useMemo(() => {
    const now = new Date();
    const withTime = raidsList.map(r => ({ ...r, _t: raidDateTime(r), _past: raidDateTime(r) < now }));
    const upcoming = withTime.filter(r => !r._past).sort((a, b) => a._t - b._t);
    const past = withTime.filter(r => r._past).sort((a, b) => b._t - a._t);
    return [...upcoming, ...past];
  }, [raidsList]);

  // ---- Render ----

  if (!allReady) {
    return html`<div class="ft-root ft-center"><div class="ft-loading">Loading fireteam data…</div></div>`;
  }

  return html`
    <div class="ft-root">
      <header class="ft-header">
        <div class="ft-title-block">
          <div class="ft-eyebrow">
            <span class="ft-sync-dot" title="Live sync active"></span>
            Fireteam scheduler · ${guardiansList.length} guardian${guardiansList.length === 1 ? '' : 's'} · Eastern Time
          </div>
          <h1 class="ft-title">
            <span class="ft-title-main">Project Destiny 2</span>${' '}
            <span class="ft-title-sub">Electric Boogaloo</span>
          </h1>
        </div>
        <div class="ft-header-right">
          <${GuardianBadge}
            me=${me}
            guardians=${guardiansList}
            onSwitch=${switchGuardian}
            onCreate=${() => setModal('guardian')}
          />
        </div>
      </header>

      ${!me && html`
        <div class="ft-cta">
          <div>
            <div class="ft-cta-title">Welcome, Guardian.</div>
            <div class="ft-cta-sub">Set up your profile to mark availability and join raids.</div>
          </div>
          <button class="ft-primary" onClick=${() => setModal('guardian')}>
            ${I.plus(14)} Create guardian
          </button>
        </div>
      `}

      <section class="ft-section">
        <div class="ft-section-head">
          <div>
            <div class="ft-eyebrow">Availability · all times ET</div>
            <div class="ft-section-title">${formatRange(weekStart)}</div>
          </div>
          <div class="ft-week-nav">
            <button class="ft-icon-btn" onClick=${() => setWeekStart(addDays(weekStart, -7))} title="Previous week">
              ${I.chevronLeft(16)}
            </button>
            <button class="ft-text-btn" onClick=${() => setWeekStart(mondayOf(new Date()))}>This week</button>
            <button class="ft-icon-btn" onClick=${() => setWeekStart(addDays(weekStart, 7))} title="Next week">
              ${I.chevronRight(16)}
            </button>
          </div>
        </div>

        <${CalendarGrid}
          weekDates=${weekDates}
          me=${me}
          getSlotGuardians=${getSlotGuardians}
          onToggle=${toggleSlot}
          onHover=${setHoveredSlot}
        />

        <${SlotDetail}
          hoveredSlot=${hoveredSlot}
          getSlotGuardians=${getSlotGuardians}
          me=${me}
          total=${guardiansList.length}
        />
      </section>

      <section class="ft-section">
        <div class="ft-section-head">
          <div>
            <div class="ft-eyebrow">Scheduled</div>
            <div class="ft-section-title">Upcoming raids</div>
          </div>
          <button
            class="ft-primary"
            onClick=${() => setModal('raid')}
            disabled=${!me}
            title=${!me ? 'Create a guardian first' : ''}>
            ${I.plus(14)} Schedule raid
          </button>
        </div>

        ${sortedRaids.length === 0
          ? html`<div class="ft-empty">No raids scheduled. Pick a time when the fireteam's lit up gold, and lock it in.</div>`
          : html`
            <div class="ft-raids">
              ${sortedRaids.map(r => html`
                <${RaidCard}
                  key=${r.id}
                  raid=${r}
                  guardians=${guardians}
                  me=${me}
                  onToggleAttend=${toggleRaidAttendance}
                  onDelete=${deleteRaid}
                />
              `)}
            </div>
          `}
      </section>

      <footer class="ft-footer">
        All times shown in Eastern Time (ET) · Live sync via Firebase
      </footer>

      ${modal === 'guardian' && html`
        <${CreateGuardianModal} onCreate=${createGuardian} onClose=${() => setModal(null)} />
      `}
      ${modal === 'raid' && html`
        <${CreateRaidModal} weekDates=${weekDates} onCreate=${createRaid} onClose=${() => setModal(null)} />
      `}
    </div>
  `;
}


// ============================================================================
//  Subcomponents
// ============================================================================

function CalendarGrid({ weekDates, me, getSlotGuardians, onToggle, onHover }) {
  const today = new Date();
  return html`
    <div class="ft-grid-wrap">
      <div class="ft-grid" style=${{ gridTemplateColumns: '64px repeat(7, minmax(80px, 1fr))' }}>
        <div></div>
        ${weekDates.map((d, i) => html`
          <div class="ft-grid-dayhead ${isSameDay(d, today) ? 'ft-grid-today' : ''}" key=${i}>
            <div class="ft-grid-dayname">${DAYS[i]}</div>
            <div class="ft-grid-daynum">${d.getDate()}</div>
          </div>
        `)}
        ${HOURS.map(h => html`
          <${Row}
            key=${h}
            hour=${h}
            weekDates=${weekDates}
            me=${me}
            getSlotGuardians=${getSlotGuardians}
            onToggle=${onToggle}
            onHover=${onHover}
          />
        `)}
      </div>
    </div>
  `;
}

function Row({ hour, weekDates, me, getSlotGuardians, onToggle, onHover }) {
  return html`
    <${Fragment}>
      <div class="ft-grid-hour">${formatHour(hour)}</div>
      ${weekDates.map(d => {
        const ds = dateString(d);
        const slotG = getSlotGuardians(ds, hour);
        const count = slotG.length;
        const isReady = count >= FIRETEAM_SIZE;
        const mine = me && slotG.some(g => g.id === me.id);
        const ratio = Math.min(count / FIRETEAM_SIZE, 1);
        const bg = count === 0 ? 'transparent' : `rgba(198, 146, 73, ${0.08 + ratio * 0.35})`;
        const cls = [
          'ft-cell',
          isReady && 'ft-cell-ready',
          mine && 'ft-cell-mine',
          !me && 'ft-cell-disabled',
        ].filter(Boolean).join(' ');
        return html`
          <button
            key=${ds + hour}
            class=${cls}
            style=${{ background: bg }}
            onClick=${() => me && onToggle(ds, hour)}
            onMouseEnter=${() => onHover({ ds, hour, date: d })}
            onMouseLeave=${() => onHover(null)}
            disabled=${!me}>
            <div class="ft-cell-count">${count > 0 ? count : ''}</div>
            <div class="ft-cell-dots">
              ${slotG.slice(0, 6).map(g => html`
                <span key=${g.id} class="ft-dot" style=${{ background: CLASSES[g.klass]?.color || '#888' }}></span>
              `)}
            </div>
            ${mine && html`<div class="ft-cell-check">${I.check(10)}</div>`}
          </button>
        `;
      })}
    <//>
  `;
}

function SlotDetail({ hoveredSlot, getSlotGuardians, me, total }) {
  if (!hoveredSlot) {
    return html`
      <div class="ft-detail ft-detail-hint">
        <span class="ft-detail-icon">›</span>
        ${me
          ? 'Hover any time slot to see who\'s available. Click to toggle your own availability.'
          : 'Create a guardian to start marking your availability.'}
        <span class="ft-detail-spacer"></span>
        <span class="ft-detail-meta">${total} in fireteam · raid ready at ${FIRETEAM_SIZE}</span>
      </div>
    `;
  }
  const slotG = getSlotGuardians(hoveredSlot.ds, hoveredSlot.hour);
  const isReady = slotG.length >= FIRETEAM_SIZE;
  const label = `${formatLongDate(hoveredSlot.date)} · ${formatHour(hoveredSlot.hour)} ET`;
  return html`
    <div class=${`ft-detail ${isReady ? 'ft-detail-ready' : ''}`}>
      <span class="ft-detail-icon">›</span>
      <span class="ft-detail-when">${label}</span>
      <span class="ft-detail-count">
        ${slotG.length}/${FIRETEAM_SIZE}${isReady ? ' · raid ready' : ''}
      </span>
      <div class="ft-detail-people">
        ${slotG.length === 0
          ? html`<span class="ft-detail-empty">No guardians available</span>`
          : slotG.map(g => html`
              <span key=${g.id} class="ft-detail-person">
                ${classIcon(g.klass, 11)} ${g.name}
              </span>
            `)}
      </div>
    </div>
  `;
}

function GuardianBadge({ me, guardians, onSwitch, onCreate }) {
  const [open, setOpen] = useState(false);
  if (!me) {
    return html`
      <button class="ft-primary" onClick=${onCreate}>
        ${I.plus(14)} Create guardian
      </button>
    `;
  }
  return html`
    <div class="ft-badge-wrap">
      <button class="ft-badge" onClick=${() => setOpen(o => !o)}>
        ${classIcon(me.klass, 14)}
        <span>${me.name}</span>
        <span class="ft-badge-class">${CLASSES[me.klass]?.name}</span>
      </button>
      ${open && html`
        <${Fragment}>
          <div class="ft-badge-backdrop" onClick=${() => setOpen(false)}></div>
          <div class="ft-badge-menu">
            <div class="ft-badge-menu-label">Switch guardian</div>
            ${guardians.map(g => html`
              <button
                key=${g.id}
                class=${`ft-badge-menu-item ${g.id === me.id ? 'ft-active' : ''}`}
                onClick=${() => { onSwitch(g.id); setOpen(false); }}>
                ${classIcon(g.klass, 14)}
                <span>${g.name}</span>
                ${g.id === me.id && I.check(12)}
              </button>
            `)}
            <div class="ft-badge-menu-sep"></div>
            <button
              class="ft-badge-menu-item"
              onClick=${() => { onCreate(); setOpen(false); }}>
              ${I.plus(14)} New guardian
            </button>
          </div>
        <//>
      `}
    </div>
  `;
}

function RaidCard({ raid, guardians, me, onToggleAttend, onDelete }) {
  const attendeeIds = Object.keys(raid.attendees || {});
  const attending = me && attendeeIds.includes(me.id);
  const attendeeList = attendeeIds.map(id => guardians[id]).filter(Boolean);
  const date = new Date(raid.date + 'T00:00:00');
  const dateLabel = formatLongDate(date);
  const isFull = attendeeList.length >= FIRETEAM_SIZE;
  const isPast = raid._past;
  const cls = ['ft-raid', isFull && 'ft-raid-full', isPast && 'ft-raid-past'].filter(Boolean).join(' ');

  return html`
    <div class=${cls}>
      <div class="ft-raid-head">
        <div class="ft-raid-name">${raid.raidName}</div>
        <button class="ft-icon-btn-sm" onClick=${() => onDelete(raid)} title="Delete">
          ${I.trash(12)}
        </button>
      </div>
      <div class="ft-raid-meta">
        <span>${I.calendar(12)} ${dateLabel}</span>
        <span>${I.clock(12)} ${formatHour(raid.hour)} ET</span>
        <span>${I.users(12)} ${attendeeList.length}/${FIRETEAM_SIZE}</span>
      </div>
      ${raid.notes && html`<div class="ft-raid-notes">${raid.notes}</div>`}
      <div class="ft-raid-attendees">
        ${attendeeList.length === 0
          ? html`<div class="ft-raid-empty">No takers yet</div>`
          : attendeeList.map(g => html`
              <div key=${g.id} class="ft-raid-attendee">
                ${classIcon(g.klass, 11)}
                <span>${g.name}</span>
              </div>
            `)}
      </div>
      <button
        class=${`ft-raid-btn ${attending ? 'ft-raid-btn-leave' : ''}`}
        onClick=${() => onToggleAttend(raid)}
        disabled=${!me || (isFull && !attending)}>
        ${attending ? 'Leave' : (isFull ? 'Full' : 'Join raid')}
      </button>
    </div>
  `;
}

function CreateGuardianModal({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [klass, setKlass] = useState('titan');
  const canSubmit = name.trim().length > 0;
  return html`
    <${Modal} onClose=${onClose} title="New guardian">
      <label class="ft-field">
        <span class="ft-field-label">Name</span>
        <input
          class="ft-input"
          value=${name}
          onInput=${e => setName(e.target.value)}
          placeholder="Your gamertag"
          autoFocus
          maxLength="30" />
      </label>
      <div class="ft-field">
        <span class="ft-field-label">Class</span>
        <div class="ft-class-grid">
          ${Object.entries(CLASSES).map(([key, c]) => html`
            <button
              key=${key}
              class=${`ft-class-btn ${klass === key ? 'ft-active' : ''}`}
              style=${klass === key ? { borderColor: c.color, color: c.color } : null}
              onClick=${() => setKlass(key)}>
              ${classIcon(key, 20)}
              <span>${c.name}</span>
            </button>
          `)}
        </div>
      </div>
      <div class="ft-modal-actions">
        <button class="ft-secondary" onClick=${onClose}>Cancel</button>
        <button class="ft-primary" disabled=${!canSubmit} onClick=${() => onCreate({ name, klass })}>
          Create guardian
        </button>
      </div>
    <//>
  `;
}

function CreateRaidModal({ weekDates, onCreate, onClose }) {
  const [raidName, setRaidName] = useState(RAIDS[0]);
  const [customName, setCustomName] = useState('');
  const [date, setDate] = useState(dateString(weekDates[4])); // Friday default
  const [hour, setHour] = useState(20);
  const [notes, setNotes] = useState('');
  const finalName = raidName === 'Other' ? customName.trim() : raidName;
  const canSubmit = finalName.length > 0 && date.length > 0;
  return html`
    <${Modal} onClose=${onClose} title="Schedule raid">
      <label class="ft-field">
        <span class="ft-field-label">Activity</span>
        <select class="ft-input" value=${raidName} onChange=${e => setRaidName(e.target.value)}>
          ${RAIDS.map(r => html`<option key=${r} value=${r}>${r}</option>`)}
        </select>
      </label>
      ${raidName === 'Other' && html`
        <label class="ft-field">
          <span class="ft-field-label">Name it</span>
          <input
            class="ft-input"
            value=${customName}
            onInput=${e => setCustomName(e.target.value)}
            placeholder="e.g. Trials, Iron Banner, GM nightfall"
            maxLength="50" />
        </label>
      `}
      <div class="ft-field-row">
        <label class="ft-field">
          <span class="ft-field-label">Date</span>
          <input class="ft-input" type="date" value=${date} onInput=${e => setDate(e.target.value)} />
        </label>
        <label class="ft-field">
          <span class="ft-field-label">Time (ET)</span>
          <select class="ft-input" value=${hour} onChange=${e => setHour(Number(e.target.value))}>
            ${Array.from({ length: 24 }, (_, i) => i).map(h => html`
              <option key=${h} value=${h}>${formatHour(h)}</option>
            `)}
          </select>
        </label>
      </div>
      <label class="ft-field">
        <span class="ft-field-label">Notes (optional)</span>
        <textarea
          class="ft-input"
          value=${notes}
          onInput=${e => setNotes(e.target.value)}
          placeholder="Contest mode? Need a sherpa? Bring exotics?"
          rows="2"
          maxLength="200"></textarea>
      </label>
      <div class="ft-modal-actions">
        <button class="ft-secondary" onClick=${onClose}>Cancel</button>
        <button
          class="ft-primary"
          disabled=${!canSubmit}
          onClick=${() => onCreate({ raidName: finalName, date, hour, notes })}>
          Schedule
        </button>
      </div>
    <//>
  `;
}

function Modal({ title, onClose, children }) {
  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return html`
    <div class="ft-modal-backdrop" onClick=${onClose}>
      <div class="ft-modal" onClick=${e => e.stopPropagation()}>
        <div class="ft-modal-head">
          <div class="ft-modal-title">${title}</div>
          <button class="ft-icon-btn" onClick=${onClose}>${I.x(16)}</button>
        </div>
        <div class="ft-modal-body">${children}</div>
      </div>
    </div>
  `;
}


// ============================================================================
//  Mount
// ============================================================================

render(html`<${Root} />`, document.getElementById('app'));
