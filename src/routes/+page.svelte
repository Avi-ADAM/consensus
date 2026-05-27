<script>
  import { onMount } from 'svelte';

  let activeDiscussionsCount = $state(2847);
  let heroVisible = $state(false);
  let scrollY = $state(0);
  let currentTestimonial = $state(0);

  const features = [
    { icon: '🧠', title: 'AI מנחה חכם', desc: 'בינה מלאכותית מזהה ממדי מחלוקת ומציעה נוסחאות גישור בזמן אמת' },
    { icon: '🔄', title: 'סבבי שיפור', desc: 'כל סבב מצמצם פערים — המערכת מודדת קרבה לקונצנזוס' },
    { icon: '🌍', title: 'RTL ראשוני', desc: 'עברית, ערבית ואנגלית — חווית משתמש מלאה בכל שפה' },
    { icon: '⚡', title: 'עדכון מיידי', desc: 'Optimistic UI — שינויים מופיעים רגע לפני אישור השרת' },
    { icon: '🗺️', title: 'מפת מחלוקות', desc: 'ראה אילו נושאים "חמים" באזורך ומצא דיונים רלוונטיים' },
    { icon: '🔒', title: 'פרטיות מלאה', desc: 'SSO מאובטח, עוגיות httpOnly, אפשרות השתתפות כאורח' },
  ];

  const steps = [
    { num: '01', title: 'הגדר נושא', desc: 'כתב את המחלוקת במשפט אחד ברור. AI עוזר לנסח בצורה ניטרלית.' },
    { num: '02', title: 'הצע עמדה', desc: 'כל משתתף מציע את עמדתו. AI ממפה ממדי הסכמה ומחלוקת.' },
    { num: '03', title: 'תמוך ושכלל', desc: 'תמוך בעמדות אחרים, הצבע על ממדי הסכמה, שפר את עמדתך.' },
    { num: '04', title: 'הגע להסכמה', desc: 'המערכת מזהה נוסחה שכולם יכולים לחיות איתה. הסכם נוצר.' },
  ];

  const testimonials = [
    { text: 'הפלטפורמה שינתה איך הצוות שלנו מקבל החלטות. פחות ויכוחים, יותר הסכמות אמיתיות.', author: 'ד"ר מיכל לוי', role: 'מנהלת מוצר, SaaS' },
    { text: 'ניסינו לפתור ויכוח שנמשך חודשים. בשלושה סבבים הגענו להסכמה שאף אחד לא צפה.', author: 'אהמד חסן', role: 'עורך דין, תל אביב' },
    { text: 'הכלי המושלם לדיונים קהילתיים. AI שמנחה בלי לשפוט — בדיוק מה שחיפשנו.', author: 'שרה כהן', role: 'ראש מועצה שכונתית' },
  ];

  // Reveal Action for Svelte 5
  function reveal(node) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          node.classList.add('visible');
          observer.unobserve(node);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
      }
    };
  }

  onMount(() => {
    setTimeout(() => heroVisible = true, 100);

    const handleScroll = () => scrollY = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });

    const interval = setInterval(() => {
      currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    }, 4000);

    // Animate counter
    let count = 0;
    const target = 2847;
    const step = Math.ceil(target / 60);
    const counter = setInterval(() => {
      count = Math.min(count + step, target);
      activeDiscussionsCount = count;
      if (count >= target) clearInterval(counter);
    }, 30);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
      clearInterval(counter);
    };
  });
</script>

<svelte:head>
  <title>Consensus — פלטפורמת יישוב מחלוקות</title>
  <meta name="description" content="AI-powered dispute resolution platform" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Frank+Ruhl+Libre:wght@400;700;900&display=swap" />
</svelte:head>

<main dir="rtl" lang="he">

  <!-- ═══════════════════ HERO ═══════════════════ -->
  <section class="hero" class:visible={heroVisible}>
    <div class="hero-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <svg class="hero-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
        {#each Array(10) as _, i}
          <line x1={i*11} y1="0" x2={i*11} y2="100" stroke="white" stroke-opacity="0.04" stroke-width="0.3"/>
          <line x1="0" y1={i*11} x2="100" y2={i*11} stroke="white" stroke-opacity="0.04" stroke-width="0.3"/>
        {/each}
      </svg>
    </div>

    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="logo">
          <span class="logo-icon">⚖</span>
          <span class="logo-text">Consensus</span>
        </a>
        <div class="nav-links">
          <a href="/faq">שאלות נפוצות</a>
          <a href="/negotiation/local">מפת דיונים</a>
          <a href="/login" class="nav-login">כניסה</a>
          <a href="/register" class="nav-cta">הצטרף</a>
        </div>
      </div>
    </nav>

    <div class="hero-content">
      <div class="hero-badge">
        <span class="badge-dot"></span>
        {activeDiscussionsCount.toLocaleString('he')} דיונים פעילים עכשיו
      </div>

      <h1 class="hero-title">
        כשיורדים לפרטים<br/>
        <em>תמיד</em> ניתן<br/>
        למצוא הסכמה
      </h1>

      <p class="hero-sub">
        פלטפורמת AI לניהול מחלוקות בצורה מובנית ואינטליגנטית.<br/>
        מגדירים נושא, מציעים עמדות, ה-AI מוצא את הנוסחה שכולם יכולים לחיות איתה.
      </p>

      <div class="hero-actions">
        <a href="/negotiation/new" class="btn-primary">
          <span>התחל דיון</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
        <a href="#how-it-works" class="btn-ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>צפה איך זה עובד</span>
        </a>
      </div>

      <div class="hero-stats">
        <div class="stat"><strong>94%</strong><span>שיעור הצלחה</span></div>
        <div class="stat-divider"></div>
        <div class="stat"><strong>3.2</strong><span>סבבים בממוצע</span></div>
        <div class="stat-divider"></div>
        <div class="stat"><strong>12k+</strong><span>הסכמות שנוצרו</span></div>
      </div>
    </div>

    <div class="hero-visual">
      <div class="consensus-card" use:reveal>
        <div class="card-header">
          <div class="topic-dot"></div>
          <span>דיון פעיל</span>
          <span class="round-badge">סבב 2/4</span>
        </div>
        <h3>האם לאמץ מדיניות עבודה היברידית?</h3>
        <div class="consensus-meter">
          <div class="meter-label">
            <span>מד הסכמה</span>
            <strong>67%</strong>
          </div>
          <div class="meter-track">
            <div class="meter-fill" style="width: 67%"></div>
          </div>
        </div>
        <div class="positions-preview">
          {#each ['3 ימים מהמשרד', '2 ימים מהבית', 'גמישות מלאה'] as pos, i}
            <div class="pos-chip" style="--delay: {i * 0.1}s">{pos}</div>
          {/each}
        </div>
        <div class="card-footer">
          <span>🤖 AI ממליץ: ניתן להגיע להסכמה על מודל גמיש</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ FEATURES ═══════════════════ -->
  <section class="features" id="features">
    <div class="section-inner">
      <div class="section-header" use:reveal>
        <span class="section-tag">יתרונות</span>
        <h2>מדוע Consensus עובד</h2>
        <p>שש סיבות שגורמות לדיונים להגיע לתוצאה</p>
      </div>

      <div class="features-grid">
        {#each features as f, i}
          <div class="feature-card" style="--i: {i}" use:reveal>
            <div class="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <div class="feature-glow"></div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ═══════════════════ HOW IT WORKS ═══════════════════ -->
  <section class="how-it-works" id="how-it-works">
    <div class="section-inner">
      <div class="section-header" use:reveal>
        <span class="section-tag">תהליך</span>
        <h2>ארבעה שלבים להסכמה</h2>
        <p>תהליך פשוט שמוביל לתוצאות אמיתיות</p>
      </div>

      <div class="steps">
        {#each steps as step, i}
          <div class="step" style="--i: {i}" use:reveal>
            <div class="step-num">{step.num}</div>
            <div class="step-content">
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
            {#if i < steps.length - 1}
              <div class="step-connector"></div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ═══════════════════ LIVE DEMO ═══════════════════ -->
  <section class="live-demo">
    <div class="section-inner">
      <div class="demo-wrapper" use:reveal>
        <div class="demo-label">
          <span class="live-dot"></span>
          דיון חי — לצפייה בלבד
        </div>
        <div class="demo-frame">
          <div class="demo-header">
            <div class="demo-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="demo-url">consensus.app/negotiation/demo</span>
          </div>
          <div class="demo-content">
            <div class="demo-topic">
              <h3>האם העיר צריכה להשקיע בתחבורה ציבורית או כבישים?</h3>
              <div class="demo-meta">
                <span>👥 24 משתתפים</span>
                <span>🔄 סבב 3 מתוך 5</span>
                <span>✅ הסכמה: 71%</span>
              </div>
            </div>
            <div class="demo-positions">
              {#each [
                { text: 'השקעה מלאה בתחבורה ציבורית', score: 38, support: 9 },
                { text: 'פיתוח מאוזן של שניהם', score: 72, support: 11 },
                { text: 'עדיפות לפיתוח כבישים ראשיים', score: 45, support: 4 },
              ] as pos}
                <div class="demo-pos">
                  <div class="demo-pos-header">
                    <span>{pos.text}</span>
                    <span class="pos-support">{pos.support} תומכים</span>
                  </div>
                  <div class="demo-bar">
                    <div class="demo-bar-fill" style="width: {pos.score}%"></div>
                    <span>{pos.score}%</span>
                  </div>
                </div>
              {/each}
            </div>
            <div class="demo-ai-note">
              <span class="ai-icon">🤖</span>
              <p>AI מזהה: עמדה 2 מייצגת נקודת גישור בין שתי הגישות. ניתן לנסח הסכמה על <strong>"השקעה ראשונה בתחבורה ציבורית לצירים עיקריים, תוך שיפור כבישים קיימים"</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ TESTIMONIALS ═══════════════════ -->
  <section class="testimonials">
    <div class="section-inner">
      <div class="section-header" use:reveal>
        <span class="section-tag">עדויות</span>
        <h2>מה אומרים המשתמשים</h2>
      </div>

      <div class="testimonials-carousel">
        {#each testimonials as t, i}
          <div class="testimonial" class:active={i === currentTestimonial} class:prev={i === (currentTestimonial - 1 + testimonials.length) % testimonials.length}>
            <div class="quote-mark">"</div>
            <blockquote>{t.text}</blockquote>
            <div class="testimonial-author">
              <div class="author-avatar">{t.author[0]}</div>
              <div>
                <strong>{t.author}</strong>
                <span>{t.role}</span>
              </div>
            </div>
          </div>
        {/each}

        <div class="carousel-dots">
          {#each testimonials as _, i}
            <button
              class="dot"
              class:active={i === currentTestimonial}
              onclick={() => currentTestimonial = i}
              aria-label={`עדות ${i + 1}`}
            ></button>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ CTA ═══════════════════ -->
  <section class="cta-section">
    <div class="cta-bg">
      <div class="cta-orb"></div>
    </div>
    <div class="section-inner">
      <div class="cta-content" use:reveal>
        <div class="cta-counter">
          <span class="counter-num">{activeDiscussionsCount.toLocaleString('he')}</span>
          <span class="counter-label">דיונים פעילים כרגע</span>
        </div>
        <h2>מוכן להגיע להסכמה?</h2>
        <p>הצטרף לאלפי אנשים שמגלים שניתן למצוא נקודת ביניים בכל מחלוקת</p>
        <div class="cta-actions">
          <a href="/register" class="btn-primary large">הצטרף עכשיו — בחינם</a>
          <a href="/negotiation/local" class="btn-ghost large">
            <span>🗺️</span> ראה דיונים בסביבתך
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ FOOTER ═══════════════════ -->
  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/" class="logo">
          <span class="logo-icon">⚖</span>
          <span class="logo-text">Consensus</span>
        </a>
        <p>פלטפורמת AI ליישוב מחלוקות בצורה מובנית ואינטליגנטית</p>
        <div class="social-links">
          <a href="#" aria-label="Twitter">𝕏</a>
          <a href="#" aria-label="LinkedIn">in</a>
          <a href="#" aria-label="GitHub">⌥</a>
        </div>
      </div>

      <div class="footer-links">
        <div class="footer-col">
          <h4>מוצר</h4>
          <a href="/faq">שאלות נפוצות</a>
          <a href="/negotiation/local">מפת דיונים</a>
          <a href="/about">אודות</a>
          <a href="/contact">צור קשר</a>
        </div>
        <div class="footer-col">
          <h4>משפטי</h4>
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
        </div>
        <div class="footer-col">
          <h4>שפות</h4>
          <a href="?lang=he">עברית</a>
          <a href="?lang=ar">العربية</a>
          <a href="?lang=en">English</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Consensus Platform · גרסה 1.1</span>
      <span>נוצר אוטומטית · 5.3.2026</span>
    </div>
  </footer>
</main>

<style>
  /* ══════════════ BASE ══════════════ */
  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }

  :global(body) {
    font-family: 'Sora', 'Frank Ruhl Libre', sans-serif;
    background: #09090f;
    color: #f0f0f8;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #7c3aed #1a1a2e;
  }

  :global(html) { scroll-behavior: smooth; overflow-x: hidden; }

  :global(.visible) {
    opacity: 1 !important;
    transform: translateY(0) scale(1) !important;
  }

  .reveal { opacity: 0; transform: translateY(30px); } /* Fallback or class usage */

  main {
    font-family: 'Frank Ruhl Libre', 'Sora', serif;
  }

  /* ══════════════ HERO ══════════════ */
  .hero {
    position: relative;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr minmax(0, 640px) minmax(0, 640px) 1fr;
    grid-template-areas: "nav nav nav nav" ". content visual .";
    overflow: hidden;
    background: linear-gradient(135deg, #09090f 0%, #120b2e 50%, #0d0d1a 100%);
    padding-bottom: 6rem;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0;
    transition: opacity 1.5s ease;
  }

  .hero.visible .orb { opacity: 1; }

  .orb-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, #7c3aed44, transparent 70%);
    top: -200px; left: -100px;
    animation: float1 12s ease-in-out infinite;
  }

  .orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, #4f46e544, transparent 70%);
    bottom: -100px; right: 20%;
    animation: float2 15s ease-in-out infinite;
  }

  .orb-3 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, #a855f733, transparent 70%);
    top: 40%; right: -50px;
    animation: float1 18s ease-in-out infinite reverse;
  }

  @keyframes float1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(40px, -30px) scale(1.05); }
    66% { transform: translate(-20px, 20px) scale(0.98); }
  }

  @keyframes float2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-30px, -40px); }
  }

  .hero-grid {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
  }

  /* NAV */
  .nav { grid-area: nav; position: relative; z-index: 10; padding: 1.5rem 0; }

  .nav-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
  }

  .logo-icon {
    font-size: 1.8rem;
    filter: drop-shadow(0 0 12px #7c3aed88);
  }

  .logo-text {
    font-family: 'Sora', sans-serif;
    font-weight: 800;
    font-size: 1.4rem;
    background: linear-gradient(135deg, #c4b5fd, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .nav-links a {
    color: #a0a0c0;
    text-decoration: none;
    font-size: 0.95rem;
    font-family: 'Sora', sans-serif;
    transition: color 0.2s;
  }

  .nav-links a:hover { color: #f0f0f8; }

  .nav-login {
    background: transparent;
    border: 1px solid #4a4a6a;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    transition: border-color 0.2s !important;
  }

  .nav-login:hover { border-color: #7c3aed !important; }

  .nav-cta {
    background: linear-gradient(135deg, #7c3aed, #4f46e5) !important;
    color: white !important;
    padding: 0.55rem 1.4rem;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 4px 24px #7c3aed44;
    transition: transform 0.2s, box-shadow 0.2s !important;
  }

  .nav-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 32px #7c3aed66 !important;
  }

  /* HERO CONTENT */
  .hero-content {
    grid-area: content;
    position: relative;
    z-index: 6;
    padding: 4rem 2rem 2rem 2rem;
    max-width: 100%;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 1s ease 0.2s, transform 1s ease 0.2s;
  }

  .hero.visible .hero-content { opacity: 1; transform: translateY(0); }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: #ffffff0a;
    border: 1px solid #ffffff18;
    backdrop-filter: blur(12px);
    padding: 0.5rem 1.2rem;
    border-radius: 100px;
    font-size: 0.85rem;
    font-family: 'Sora', sans-serif;
    color: #c4b5fd;
    width: fit-content;
  }

  .badge-dot {
    width: 8px; height: 8px;
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 8px #4ade8088;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }

  .hero-title {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: clamp(2.5rem, 5vw, 4.2rem);
    font-weight: 900;
    line-height: 1.15;
    color: #f8f7ff;
    text-shadow: 0 0 80px #7c3aed22;
  }

  .hero-title em {
    font-style: normal;
    background: linear-gradient(135deg, #a78bfa, #818cf8, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: 1.15rem;
    line-height: 1.75;
    color: #9090b8;
    font-family: 'Sora', sans-serif;
    font-weight: 300;
  }

  .hero-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
    color: white;
    text-decoration: none;
    padding: 0.9rem 2rem;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-weight: 600;
    font-size: 1rem;
    box-shadow: 0 8px 32px #7c3aed44, inset 0 1px 0 #ffffff22;
    transition: transform 0.2s, box-shadow 0.2s;
    border: none;
    cursor: pointer;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 48px #7c3aed66, inset 0 1px 0 #ffffff22;
  }

  .btn-primary.large { padding: 1.1rem 2.4rem; font-size: 1.1rem; }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: #9090b8;
    text-decoration: none;
    padding: 0.9rem 2rem;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-weight: 500;
    font-size: 1rem;
    border: 1px solid #3a3a5a;
    background: transparent;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
    cursor: pointer;
  }

  .btn-ghost:hover {
    color: #f0f0f8;
    border-color: #7c3aed;
    background: #7c3aed11;
  }

  .btn-ghost.large { padding: 1.1rem 2.4rem; font-size: 1.1rem; }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding-top: 1rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stat strong {
    font-family: 'Sora', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .stat span {
    font-size: 0.8rem;
    color: #6060808;
    color: #60608a;
    font-family: 'Sora', sans-serif;
  }

  .stat-divider {
    width: 1px; height: 40px;
    background: #3a3a5a;
  }

  /* HERO VISUAL */
  .hero-visual {
    grid-area: visual;
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    opacity: 0;
    transform: translateY(20px) scale(0.96);
    transition: opacity 1s ease 0.5s, transform 1s ease 0.5s;
  }

  .hero.visible .hero-visual { opacity: 1; transform: translateY(0) scale(1); }

  .consensus-card {
    background: #ffffff08;
    backdrop-filter: blur(24px);
    border: 1px solid #ffffff14;
    border-radius: 20px;
    padding: 2rem;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 32px 80px #00000055, inset 0 1px 0 #ffffff10;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: #7070a0;
    font-family: 'Sora', sans-serif;
  }

  .topic-dot {
    width: 8px; height: 8px;
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 8px #4ade8066;
    animation: pulse 2s ease-in-out infinite;
  }

  .round-badge {
    margin-right: auto;
    background: #7c3aed22;
    color: #c4b5fd;
    padding: 0.2rem 0.7rem;
    border-radius: 100px;
    border: 1px solid #7c3aed44;
    font-size: 0.78rem;
  }

  .consensus-card h3 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: 1.15rem;
    font-weight: 700;
    color: #f0f0f8;
    margin-bottom: 1.2rem;
    line-height: 1.4;
  }

  .consensus-meter { margin-bottom: 1.2rem; }

  .meter-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    font-family: 'Sora', sans-serif;
    color: #8080aa;
  }

  .meter-label strong { color: #a78bfa; font-size: 1.1rem; }

  .meter-track {
    height: 8px;
    background: #ffffff10;
    border-radius: 100px;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #4ade80);
    border-radius: 100px;
    animation: fillMeter 1.5s ease-out 0.8s both;
  }

  @keyframes fillMeter {
    from { width: 0 !important; }
  }

  .positions-preview {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.2rem;
  }

  .pos-chip {
    background: #ffffff0a;
    border: 1px solid #ffffff15;
    padding: 0.4rem 0.9rem;
    border-radius: 100px;
    font-size: 0.82rem;
    font-family: 'Sora', sans-serif;
    color: #c0c0e0;
    animation: chipIn 0.5s ease calc(1s + var(--delay)) both;
  }

  @keyframes chipIn {
    from { opacity: 0; transform: translateY(6px) scale(0.95); }
    to { opacity: 1; transform: none; }
  }

  .card-footer {
    background: #7c3aed11;
    border: 1px solid #7c3aed33;
    border-radius: 10px;
    padding: 0.7rem 1rem;
    font-size: 0.82rem;
    font-family: 'Sora', sans-serif;
    color: #a78bfa;
    line-height: 1.5;
  }

  /* ══════════════ SECTIONS SHARED ══════════════ */
  .section-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .section-header {
    text-align: center;
    margin-bottom: 4rem;
  }

  .section-tag {
    display: inline-block;
    font-family: 'Sora', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #7c3aed;
    background: #7c3aed15;
    border: 1px solid #7c3aed33;
    padding: 0.3rem 0.9rem;
    border-radius: 100px;
    margin-bottom: 1rem;
  }

  .section-header h2 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 900;
    color: #f0f0f8;
    margin-bottom: 0.75rem;
  }

  .section-header p {
    font-family: 'Sora', sans-serif;
    font-size: 1.05rem;
    color: #7070a0;
  }

  /* ══════════════ FEATURES ══════════════ */
  .features {
    padding: 8rem 0;
    background: #09090f;
    position: relative;
    z-index: 2;
  }

  .features::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 50% at 50% 0%, #7c3aed08, transparent);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .feature-card {
    position: relative;
    background: #ffffff05;
    border: 1px solid #ffffff0e;
    border-radius: 16px;
    padding: 2rem;
    transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
    overflow: hidden;
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 0.1s), 
                transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 0.1s), 
                border-color 0.3s, box-shadow 0.3s;
    z-index: 2;
  }

  .feature-card.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .feature-card:hover {
    border-color: #7c3aed44;
    box-shadow: 0 16px 48px #7c3aed15;
  }

  .feature-card:hover .feature-glow {
    opacity: 1;
  }

  .feature-glow {
    position: absolute;
    inset: -1px;
    border-radius: 16px;
    background: linear-gradient(135deg, #7c3aed22, transparent, transparent);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }

  .feature-icon {
    font-size: 2.2rem;
    margin-bottom: 1rem;
    display: block;
  }

  .feature-card h3 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: 1.2rem;
    font-weight: 700;
    color: #f0f0f8;
    margin-bottom: 0.6rem;
  }

  .feature-card p {
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    line-height: 1.7;
    color: #7070a0;
  }

  /* ══════════════ HOW IT WORKS ══════════════ */
  .how-it-works {
    padding: 8rem 0;
    background: linear-gradient(180deg, #09090f, #0d0820, #09090f);
    position: relative;
    overflow: hidden;
  }

  .how-it-works::before {
    content: '';
    position: absolute;
    width: 800px; height: 800px;
    border-radius: 50%;
    background: radial-gradient(circle, #7c3aed08, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
    position: relative;
  }

  .step {
    position: relative;
    text-align: center;
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s ease calc(var(--i) * 0.15s), transform 0.7s ease calc(var(--i) * 0.15s);
  }

  .step.visible { opacity: 1; transform: translateY(0); }

  .step-num {
    font-family: 'Sora', sans-serif;
    font-size: 3.5rem;
    font-weight: 800;
    color: #7c3aed22;
    line-height: 1;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
    transition: color 0.3s;
  }

  .step:hover .step-num { color: #7c3aed66; }

  .step-content h3 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: 1.2rem;
    font-weight: 700;
    color: #f0f0f8;
    margin-bottom: 0.7rem;
  }

  .step-content p {
    font-family: 'Sora', sans-serif;
    font-size: 0.88rem;
    color: #7070a0;
    line-height: 1.7;
  }

  .step-connector {
    position: absolute;
    top: 1.5rem;
    left: -1rem;
    width: 2rem; height: 2px;
    background: linear-gradient(90deg, transparent, #7c3aed33, transparent);
  }

  /* ══════════════ LIVE DEMO ══════════════ */
  .live-demo {
    padding: 8rem 0;
    background: #09090f;
  }

  .demo-wrapper {
    max-width: 860px;
    margin: 0 auto;
  }

  .demo-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    color: #7070a0;
    margin-bottom: 1rem;
    justify-content: center;
  }

  .live-dot {
    width: 8px; height: 8px;
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 8px #4ade8088;
    animation: pulse 2s ease-in-out infinite;
  }

  .demo-frame {
    background: #0f0f1e;
    border: 1px solid #ffffff12;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 32px 80px #00000077;
  }

  .demo-header {
    background: #17172a;
    padding: 0.8rem 1.2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid #ffffff08;
  }

  .demo-dots {
    display: flex;
    gap: 0.4rem;
  }

  .demo-dots span {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #3a3a5a;
  }

  .demo-url {
    font-family: 'Sora', sans-serif;
    font-size: 0.8rem;
    color: #5050808;
    color: #505080;
  }

  .demo-content { padding: 2rem; }

  .demo-topic { margin-bottom: 1.5rem; }

  .demo-topic h3 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f0f0f8;
    margin-bottom: 0.75rem;
  }

  .demo-meta {
    display: flex;
    gap: 1.5rem;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    color: #6060808;
    color: #60608a;
  }

  .demo-positions { margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem; }

  .demo-pos {
    background: #ffffff06;
    border: 1px solid #ffffff0a;
    border-radius: 10px;
    padding: 0.9rem 1.1rem;
  }

  .demo-pos-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    color: #c0c0e0;
  }

  .pos-support {
    font-size: 0.8rem;
    color: #7070a0;
  }

  .demo-bar {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .demo-bar {
    height: 6px;
    background: #ffffff0a;
    border-radius: 100px;
    overflow: visible;
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .demo-bar-fill {
    height: 6px;
    background: linear-gradient(90deg, #7c3aed, #818cf8);
    border-radius: 100px;
    transition: width 1s ease;
  }

  .demo-bar span {
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem;
    color: #7070a0;
    margin-right: 0.6rem;
    white-space: nowrap;
  }

  .demo-ai-note {
    background: #7c3aed11;
    border: 1px solid #7c3aed33;
    border-radius: 12px;
    padding: 1rem 1.2rem;
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
  }

  .ai-icon { font-size: 1.2rem; flex-shrink: 0; }

  .demo-ai-note p {
    font-family: 'Sora', sans-serif;
    font-size: 0.88rem;
    color: #a090d0;
    line-height: 1.6;
  }

  .demo-ai-note strong { color: #c4b5fd; }

  /* ══════════════ TESTIMONIALS ══════════════ */
  .testimonials {
    padding: 8rem 0;
    background: linear-gradient(180deg, #09090f, #0d0820, #09090f);
    overflow: hidden;
  }

  .testimonials-carousel {
    max-width: 700px;
    margin: 0 auto;
    position: relative;
    min-height: 260px;
  }

  .testimonial {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateX(-30px);
    transition: opacity 0.6s ease, transform 0.6s ease;
    pointer-events: none;
    padding-bottom: 3rem;
  }

  .testimonial.active {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .testimonial.prev {
    opacity: 0;
    transform: translateX(30px);
  }

  .quote-mark {
    font-size: 5rem;
    line-height: 1;
    color: #7c3aed22;
    font-family: 'Frank Ruhl Libre', serif;
    margin-bottom: -1.5rem;
  }

  blockquote {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: 1.25rem;
    line-height: 1.7;
    color: #d0d0f0;
    font-style: italic;
    margin-bottom: 1.5rem;
  }

  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-family: 'Sora', sans-serif;
  }

  .author-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    color: white;
    flex-shrink: 0;
  }

  .testimonial-author strong {
    display: block;
    font-size: 0.95rem;
    color: #f0f0f8;
    font-weight: 600;
  }

  .testimonial-author span {
    font-size: 0.82rem;
    color: #7070a0;
  }

  .carousel-dots {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.5rem;
  }

  .dot {
    width: 8px; height: 8px;
    border-radius: 100px;
    background: #3a3a5a;
    border: none;
    cursor: pointer;
    transition: background 0.3s, width 0.3s;
  }

  .dot.active {
    background: #7c3aed;
    width: 24px;
  }

  /* ══════════════ CTA ══════════════ */
  .cta-section {
    padding: 8rem 0;
    position: relative;
    overflow: hidden;
    background: #09090f;
  }

  .cta-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .cta-orb {
    position: absolute;
    width: 700px; height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, #7c3aed18, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  }

  .cta-content {
    position: relative;
    text-align: center;
    max-width: 700px;
    margin: 0 auto;
  }

  .cta-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: 2rem;
  }

  .counter-num {
    font-family: 'Sora', sans-serif;
    font-size: 4rem;
    font-weight: 800;
    background: linear-gradient(135deg, #a78bfa, #818cf8, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }

  .counter-label {
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    color: #7070a0;
    letter-spacing: 0.05em;
  }

  .cta-content h2 {
    font-family: 'Frank Ruhl Libre', serif;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 900;
    color: #f0f0f8;
    margin-bottom: 1rem;
  }

  .cta-content p {
    font-family: 'Sora', sans-serif;
    font-size: 1.05rem;
    color: #7070a0;
    margin-bottom: 2.5rem;
  }

  .cta-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* ══════════════ FOOTER ══════════════ */
  footer {
    background: #07070d;
    border-top: 1px solid #ffffff08;
    padding: 4rem 0 2rem;
  }

  .footer-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2rem;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 4rem;
    margin-bottom: 3rem;
  }

  .footer-brand p {
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    color: #7070a0;
    margin-top: 0.8rem;
    margin-bottom: 1.2rem;
    line-height: 1.6;
  }

  .social-links {
    display: flex;
    gap: 0.8rem;
  }

  .social-links a {
    width: 38px; height: 38px;
    border: 1px solid #3a3a5a;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7070a0;
    text-decoration: none;
    font-size: 0.9rem;
    transition: border-color 0.2s, color 0.2s;
  }

  .social-links a:hover { border-color: #7c3aed; color: #c4b5fd; }

  .footer-links {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }

  .footer-col h4 {
    font-family: 'Sora', sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5050808;
    color: #505080;
    margin-bottom: 1rem;
  }

  .footer-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer-col a {
    font-family: 'Sora', sans-serif;
    font-size: 0.88rem;
    color: #7070a0;
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-col a:hover { color: #c4b5fd; }

  .footer-bottom {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.5rem 2rem 0;
    border-top: 1px solid #ffffff08;
    display: flex;
    justify-content: space-between;
    font-family: 'Sora', sans-serif;
    font-size: 0.82rem;
    color: #4a4a6a;
  }

  /* ══════════════ RESPONSIVE ══════════════ */
  @media (max-width: 1200px) {
    .hero {
      grid-template-columns: 1fr;
      grid-template-areas: "nav" "content" "visual";
      padding-bottom: 4rem;
    }

    .hero-content {
      margin: 0 auto;
      max-width: 700px;
      padding: 3rem 1.5rem 1rem;
      text-align: center;
      align-items: center;
    }

    .hero-visual { padding: 1rem 1.5rem 3rem; }

    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .steps { grid-template-columns: repeat(2, 1fr); }
    .step-connector { display: none; }
    .footer-inner { grid-template-columns: 1fr; gap: 2rem; }
  }

  @media (max-width: 640px) {
    .features-grid { grid-template-columns: 1fr; }
    .steps { grid-template-columns: 1fr; }
    .hero-stats { flex-wrap: wrap; gap: 1rem; }
    .stat-divider { display: none; }
    .nav-links a:not(.nav-cta):not(.nav-login) { display: none; }
    .footer-links { grid-template-columns: repeat(2, 1fr); }
    .cta-actions { flex-direction: column; align-items: center; }
  }
</style>