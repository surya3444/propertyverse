import Reveal from './components/Reveal';
import { LogoMark } from './components/Logo';
import s from './landing.module.css';

/**
 * Android build download — the Expo build page (stable), which serves the
 * installable APK. Swap for a Play Store link when the app is published.
 */
const ANDROID_APK =
  'https://expo.dev/accounts/suryakarthikvarma/projects/frontend/builds/cdd50711-6fe9-418f-8776-ddc10699a857';

const PROPERTY_IMG =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=640&q=80';

/* --- Minimal inline icons (stroke, inherit color) ----------------------- */
type IconProps = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IGrid = ({ size = 22 }: IconProps) => svg(size, <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
const IBuilding = ({ size = 22 }: IconProps) => svg(size, <><rect x="4" y="2" width="16" height="20" rx="1.5" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M16 14h.01" /></>);
const IUsers = ({ size = 22 }: IconProps) => svg(size, <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>);
const ICal = ({ size = 22 }: IconProps) => svg(size, <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
const IUser = ({ size = 22 }: IconProps) => svg(size, <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>);
const IMic = ({ size = 22 }: IconProps) => svg(size, <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></>);
const IPlus = ({ size = 22 }: IconProps) => svg(size, <path d="M12 5v14M5 12h14" />);
const ICalPlus = ({ size = 22 }: IconProps) => svg(size, <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></>);
const IFile = ({ size = 22 }: IconProps) => svg(size, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>);
const IBell = ({ size = 20 }: IconProps) => svg(size, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
const IClock = ({ size = 18 }: IconProps) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const ICheck = ({ size = 14 }: IconProps) => svg(size, <path d="M20 6 9 17l-5-5" />);
const IAndroid = ({ size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 9v8a1 1 0 0 0 1 1h1v3a1 1 0 0 0 2 0v-3h4v3a1 1 0 0 0 2 0v-3h1a1 1 0 0 0 1-1V9H6Zm-2 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1Zm16 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1ZM15.6 3.5l1-1.5a.3.3 0 0 0-.5-.3l-1.1 1.6A6.3 6.3 0 0 0 12 2.9c-1 0-2 .2-3 .4L7.9 1.7a.3.3 0 0 0-.5.3l1 1.5A5.4 5.4 0 0 0 6 8h12a5.4 5.4 0 0 0-2.4-4.5ZM9.5 6.2a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Zm5 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z" /></svg>
);

/* Real, verified app capabilities (from the app's screens). */
const FEATURES = [
  { icon: <IMic size={24} />, title: 'Voice lead capture', text: 'Record a voice note after a call and PropertyVerse turns it into a structured lead — client, phone and requirements, filled in for you.' },
  { icon: <IFile size={24} />, title: 'Public capture forms', text: 'Build branded requirement & listing forms, share the link, and submissions arrive straight in your leads — tagged as “Form”.' },
  { icon: <IBuilding size={24} />, title: 'Property management', text: 'List, price and organise every property with photos and details, all in one tidy, searchable place.' },
  { icon: <IUsers size={24} />, title: 'Contacts', text: 'Keep every buyer, seller and owner on file with full history and notes, so you have context before you dial.' },
  { icon: <ICal size={24} />, title: 'Schedule & follow-ups', text: 'Track viewings and tasks with Overdue, Today and Upcoming views — and never let a follow-up slip through.' },
  { icon: <IGrid size={24} />, title: 'Custom fields', text: 'Add your own fields to properties, leads and contacts so PropertyVerse fits exactly how you work.' },
];

const STEPS = [
  { title: 'Capture', text: 'Record a voice note after a call, or let a shared form collect the enquiry. The lead is created and organised for you.' },
  { title: 'Organise', text: 'Leads, properties and contacts live together — enriched with your own custom fields and easy to search.' },
  { title: 'Follow up', text: 'Your schedule surfaces what’s overdue and due today, so every viewing and callback happens on time.' },
];

/* ---------- Faithful in-app phone previews ------------------------------- */

function StatusBar() {
  return (
    <div className={s.statusbar}>
      <span>9:41</span>
      <span className={s.statusIcons}>▪▪▪ ▾ ▮</span>
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  const tabs = [
    { k: 'home', label: 'Home', icon: <IGrid size={19} /> },
    { k: 'props', label: 'Properties', icon: <IBuilding size={19} /> },
    { k: 'contacts', label: 'Contacts', icon: <IUsers size={19} /> },
    { k: 'schedule', label: 'Schedule', icon: <ICal size={19} /> },
    { k: 'profile', label: 'Profile', icon: <IUser size={19} /> },
  ];
  return (
    <div className={s.appTabs}>
      {tabs.map((t) => (
        <span key={t.k} className={`${s.appTab} ${active === t.k ? s.appTabActive : ''}`}>
          {t.icon}
          {t.label}
        </span>
      ))}
    </div>
  );
}

function HomeScreen() {
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.notch} />
        <StatusBar />
        <div className={s.appBody}>
          <div className={s.appHead}>
            <div className={s.appAvatar}>A</div>
            <div className={s.appBell}>
              <IBell />
              <span className={s.appBellDot} />
            </div>
          </div>
          <div className={s.appGreet}>Hi Alex 👋</div>
          <div className={s.appSubtle}>Here’s your day at a glance.</div>
          <div className={s.appStats}>
            <div className={s.appStat}>
              <div className={s.appStatIcon} style={{ background: '#fdede1', color: '#e9591c' }}><IBuilding size={15} /></div>
              <div className={s.appStatVal}>24</div>
              <div className={s.appStatLbl}>Properties</div>
            </div>
            <div className={s.appStat}>
              <div className={s.appStatIcon} style={{ background: '#fef3e2', color: '#ee7c19' }}><IUsers size={15} /></div>
              <div className={s.appStatVal}>12</div>
              <div className={s.appStatLbl}>Active reqs</div>
            </div>
            <div className={s.appStat}>
              <div className={s.appStatIcon} style={{ background: '#e7f6ec', color: '#16a34a' }}><IClock size={15} /></div>
              <div className={s.appStatVal}>5</div>
              <div className={s.appStatLbl}>Today</div>
            </div>
          </div>
          <div className={s.appSection}>QUICK ACTIONS</div>
          <div className={s.appActions}>
            <div className={s.appAction}><span className={s.appActionIcon}><IMic size={17} /></span><span className={s.appActionLbl}>Record lead</span></div>
            <div className={s.appAction}><span className={s.appActionIcon}><IPlus size={17} /></span><span className={s.appActionLbl}>Add property</span></div>
            <div className={s.appAction}><span className={s.appActionIcon}><ICalPlus size={17} /></span><span className={s.appActionLbl}>Schedule</span></div>
            <div className={s.appAction}><span className={s.appActionIcon}><IFile size={17} /></span><span className={s.appActionLbl}>Forms</span></div>
          </div>
          <div className={s.appOverdue}>
            <div className={s.appOverdueIcon}><IClock size={18} /></div>
            <div>
              <div className={s.appOverdueT}>3 follow-ups overdue</div>
              <div className={s.appOverdueD}>Tap to review and reschedule.</div>
            </div>
          </div>
        </div>
        <TabBar active="home" />
      </div>
    </div>
  );
}

function LeadsScreen() {
  const leads = [
    { name: 'Ravi Sharma', badge: <span className={`${s.appBadge} ${s.badgeAccent}`}>Form</span>, status: <span className={`${s.appBadge} ${s.badgeBrand}`}>New</span>, phone: '+91 98765 43210', meta: '3 BHK · Whitefield · ₹1.2 Cr' },
    { name: 'Meera Nair', badge: null, status: <span className={`${s.appBadge} ${s.badgeGreen}`}>Active</span>, phone: '+91 90080 11223', meta: 'Villa · ECR · ₹3.5 Cr' },
    { name: 'David Lee', badge: null, status: <span className={`${s.appBadge} ${s.badgeMuted}`}>Closed</span>, phone: '+91 99000 55221', meta: '2 BHK · Indiranagar · Rent' },
  ];
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.notch} />
        <StatusBar />
        <div className={s.appBody}>
          <div className={s.appHead}>
            <div className={s.appTitle}>Leads</div>
            <div className={s.appBell}><IBell /></div>
          </div>
          {leads.map((l) => (
            <div key={l.name} className={s.appCard}>
              <div className={s.appCardTop}>
                <span className={s.appName}>{l.name}</span>
                <span className={s.appBadges}>{l.badge}{l.status}</span>
              </div>
              <div className={s.appPhone}>{l.phone}</div>
              <div className={s.appMeta}>{l.meta}</div>
            </div>
          ))}
        </div>
        <div className={s.appFab}><IMic size={17} /> Record New Lead</div>
        <TabBar active="home" />
      </div>
    </div>
  );
}

function PropertiesScreen() {
  const specs = [
    { tag: 'For sale', title: 'Riverside Villa', meta: '4 BHK · 3,200 sqft · ₹4.8 Cr' },
    { tag: 'For rent', title: 'Skyline Apartment', meta: '2 BHK · 1,150 sqft · ₹65k/mo' },
  ];
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.notch} />
        <StatusBar />
        <div className={s.appBody}>
          <div className={s.appHead}>
            <div className={s.appTitle}>Properties</div>
            <div className={s.appBell}><IPlus size={18} /></div>
          </div>
          {specs.map((p, i) => (
            <div key={p.title} className={s.appCard}>
              <div className={s.appPhoto} style={{ backgroundImage: `url(${PROPERTY_IMG}${i ? '&sat=-30' : ''})` }}>
                <span className={s.appPhotoTag}>{p.tag}</span>
              </div>
              <div className={s.appName}>{p.title}</div>
              <div className={s.appMeta}>{p.meta}</div>
            </div>
          ))}
        </div>
        <TabBar active="props" />
      </div>
    </div>
  );
}

function ScheduleScreen() {
  const acts = [
    { done: false, title: 'Site visit — Ravi Sharma', when: 'Today, 2:30 PM · Whitefield' },
    { done: false, title: 'Callback — Meera Nair', when: 'Today, 5:00 PM' },
    { done: true, title: 'Document signing', when: 'Yesterday · Done' },
    { done: false, title: 'Follow-up — David Lee', when: 'Tomorrow, 11:00 AM' },
  ];
  return (
    <div className={s.phone}>
      <div className={s.phoneScreen}>
        <div className={s.notch} />
        <StatusBar />
        <div className={s.appBody}>
          <div className={s.appHead}>
            <div className={s.appTitle}>Schedule</div>
            <div className={s.appBell}><IPlus size={18} /></div>
          </div>
          <div className={s.appScopes}>
            <span className={`${s.appScope} ${s.appScopeActive}`}>Overdue</span>
            <span className={s.appScope}>Today</span>
            <span className={s.appScope}>Upcoming</span>
            <span className={s.appScope}>Past</span>
          </div>
          {acts.map((a) => (
            <div key={a.title} className={s.appActRow}>
              <span className={`${s.appActTick} ${a.done ? s.appActTickDone : ''}`}>{a.done ? <ICheck /> : null}</span>
              <div>
                <div className={s.appActT}>{a.title}</div>
                <div className={s.appActWhen}>{a.when}</div>
              </div>
            </div>
          ))}
        </div>
        <TabBar active="schedule" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={s.page}>
      {/* Nav */}
      <nav className={s.nav}>
        <a className={s.logo} href="#top">
          <LogoMark size={28} />
          PropertyVerse
        </a>
        <div className={s.navLinks}>
          <a className={s.navLink} href="#features">Features</a>
          <a className={s.navLink} href="#screens">Screens</a>
          <a className={s.navLink} href="#how">How it works</a>
        </div>
        <a className={s.navCta} href={ANDROID_APK}>Download app ↓</a>
      </nav>

      {/* Hero */}
      <header id="top" className={s.hero}>
        <div className={s.heroGrid}>
          <Reveal className={s.reveal}>
            <span className={s.badge}>
              <span className={s.badgeDot}>APP</span>
              The real-estate CRM in your pocket
            </span>
            <h1 className={s.h1}>
              Every lead, property &amp; follow-up in <em>one app</em>.
            </h1>
            <p className={s.lede}>
              PropertyVerse captures leads from your calls and forms, keeps your
              properties and contacts organised, and makes sure no follow-up is
              ever missed.
            </p>
            <div className={s.ctaRow}>
              <a className={s.btnPrimary} href={ANDROID_APK}>
                <IAndroid size={20} /> Download for Android
              </a>
              <a className={s.btnGhost} href="#screens">See the app</a>
            </div>
            <p className={s.soon} style={{ marginTop: 16 }}>
              Android APK · direct download &nbsp;·&nbsp; iOS coming soon
            </p>
          </Reveal>

          <Reveal className={s.reveal} delay={120}>
            <div className={s.heroArt} style={{ display: 'flex', justifyContent: 'center', minHeight: 0 }}>
              <HomeScreen />
              <div className={`${s.floatCard} ${s.floatCall}`}>
                <span className={`${s.fcIcon} ${s.fcIconBrand}`}><IMic size={17} /></span>
                <div>
                  <div className={s.fcTitle}>Voice note → lead</div>
                  <div className={s.fcSub}>Captured after your call</div>
                </div>
              </div>
              <div className={`${s.floatCard} ${s.floatLead}`}>
                <span className={`${s.fcIcon} ${s.fcIconGreen}`}><IFile size={17} /></span>
                <div>
                  <div className={s.fcTitle}>New form submission</div>
                  <div className={s.fcSub}>Added to your leads</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      {/* Feature strip */}
      <section className={s.trust}>
        <div className={s.trustInner}>
          <span className={s.trustLabel}>All in one app</span>
          <div className={s.trustLogos}>
            <span className={s.trustLogo}>Leads</span>
            <span className={s.trustLogo}>Properties</span>
            <span className={s.trustLogo}>Contacts</span>
            <span className={s.trustLogo}>Schedule</span>
            <span className={s.trustLogo}>Forms</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={s.section}>
        <div className={s.sectionWrap}>
          <Reveal className={`${s.reveal} ${s.head} ${s.headCenter}`}>
            <span className={s.kicker}>What PropertyVerse does</span>
            <h2 className={`${s.h2} ${s.h2Center}`}>Everything an agent needs, nothing they don’t</h2>
            <p className={`${s.sub} ${s.subCenter}`}>
              Six focused tools that work together — from capturing an enquiry to
              closing the visit.
            </p>
          </Reveal>
          <div className={s.grid}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} className={`${s.reveal} ${s.card}`} delay={i * 70}>
                <div className={s.cardIcon}>{f.icon}</div>
                <h3 className={s.cardTitle}>{f.title}</h3>
                <p className={s.cardText}>{f.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screens" className={s.section} style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className={s.sectionWrap}>
          <Reveal className={`${s.reveal} ${s.head} ${s.headCenter}`}>
            <span className={s.kicker}>Take a look</span>
            <h2 className={`${s.h2} ${s.h2Center}`}>Built to be fast on your phone</h2>
          </Reveal>
          <div className={s.shots}>
            <Reveal className={s.reveal}>
              <div className={s.shot}>
                <LeadsScreen />
                <div className={s.shotCap}>
                  <div className={s.shotCapT}>Leads that capture themselves</div>
                  <div className={s.shotCapD}>Voice notes and form submissions become organised leads with status and requirements.</div>
                </div>
              </div>
            </Reveal>
            <Reveal className={`${s.reveal} ${s.shotMid}`} delay={90}>
              <div className={s.shot}>
                <PropertiesScreen />
                <div className={s.shotCap}>
                  <div className={s.shotCapT}>Your listings, organised</div>
                  <div className={s.shotCapD}>Every property with photos, price and details — ready to share with a buyer.</div>
                </div>
              </div>
            </Reveal>
            <Reveal className={s.reveal} delay={180}>
              <div className={s.shot}>
                <ScheduleScreen />
                <div className={s.shotCap}>
                  <div className={s.shotCapT}>Never miss a follow-up</div>
                  <div className={s.shotCapD}>Overdue, today and upcoming — tick off viewings and callbacks as you go.</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={s.section}>
        <div className={s.sectionWrap}>
          <Reveal className={`${s.reveal} ${s.head} ${s.headCenter}`}>
            <span className={s.kicker}>How it works</span>
            <h2 className={`${s.h2} ${s.h2Center}`}>Three steps, start to close</h2>
          </Reveal>
          <div className={s.steps}>
            {STEPS.map((step, i) => (
              <Reveal key={step.title} className={`${s.reveal} ${s.step}`} delay={i * 90}>
                <div className={s.stepNum}>{i + 1}</div>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepText}>{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Download band */}
      <section id="download" className={s.section} style={{ paddingBottom: 'clamp(64px, 8vw, 100px)' }}>
        <Reveal className={`${s.reveal} ${s.ctaBand}`}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <div style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 22, padding: 14, display: 'grid', placeItems: 'center' }}>
              <LogoMark size={40} />
            </div>
          </div>
          <h2 className={s.ctaH}>Get PropertyVerse on your phone</h2>
          <p className={s.ctaP}>
            Download the Android app and start capturing leads, managing
            properties and staying on top of every follow-up today.
          </p>
          <div className={s.ctaBtnRow} style={{ flexDirection: 'column', alignItems: 'center' }}>
            <div className={s.dlRow}>
              <a className={`${s.storeBtn} ${s.storeBtnLight}`} href={ANDROID_APK}>
                <span className={s.storeIcon}><IAndroid size={26} /></span>
                <span className={s.storeText}>
                  <small>DOWNLOAD THE</small>
                  <b>Android App</b>
                </span>
              </a>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              iOS version coming soon
            </span>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div>
            <a className={s.logo} href="#top">
              <LogoMark size={26} />
              PropertyVerse
            </a>
            <p className={s.footBrandText}>
              The real-estate CRM built for agents who’d rather be selling than
              chasing paperwork.
            </p>
          </div>
          <div className={s.footCol}>
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#screens">Screens</a>
            <a href="#how">How it works</a>
          </div>
          <div className={s.footCol}>
            <h4>Get the app</h4>
            <a href={ANDROID_APK}>Download for Android</a>
            <a href="#download">iOS (coming soon)</a>
          </div>
          <div className={s.footCol}>
            <h4>Legal</h4>
            <a href="#top">Privacy</a>
            <a href="#top">Terms</a>
          </div>
        </div>
        <div className={s.footBar}>
          <span>© {new Date().getFullYear()} PropertyVerse. All rights reserved.</span>
          <span>Made for modern agents.</span>
        </div>
      </footer>
    </main>
  );
}
