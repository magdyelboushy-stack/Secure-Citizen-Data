// UI controls: theme toggle and language switch
(function() {
  const STORAGE_KEYS = {
    THEME: 'ui_theme',
    LANG: 'ui_lang'
  };

  const DEFAULTS = {
    theme: 'dark',
    lang: 'ar'
  };

  const translations = {
    brand: { ar: 'خزينة بيانات المواطنين', en: 'Citizen Data Vault' },
    nav_home: { ar: 'الرئيسية', en: 'Home' },
    nav_tech: { ar: 'التقنيات', en: 'Technologies' },
    nav_blocks: { ar: 'البلوكات', en: 'Blocks' },
    login_title: { ar: 'تسجيل الدخول', en: 'Login' },
    email_label: { ar: 'البريد الإلكتروني', en: 'Email' },
    email_invalid: { ar: 'الرجاء إدخال بريد إلكتروني صالح.', en: 'Please enter a valid email address.' },
    password_label: { ar: 'كلمة المرور', en: 'Password' },
    password_invalid: { ar: 'الرجاء إدخال كلمة مرور (6 أحرف على الأقل).', en: 'Please enter a password (at least 6 characters).' },
    login_btn: { ar: 'تسجيل الدخول', en: 'Login' },
    header_title: { ar: 'نظام خزينة بيانات المواطنين الآمنة', en: 'Secure Citizen Data Vault' },
    header_subtitle: { ar: 'يعمل بتقنية البلوك تشين اللامركزية والشفافة', en: 'Powered by decentralized and transparent blockchain technology' },
    auth_status: { ar: 'غير مسجل الدخول', en: 'Not signed in' },
    open_login: { ar: 'تسجيل الدخول', en: 'Open Login' },
    home_title: { ar: 'نظام خزينة بيانات المواطنين الآمنة', en: 'Secure Citizen Data Vault' },
    home_desc: { ar: 'نظام ثوري يعمل بتقنية البلوك تشين اللامركزية والشفافة لحماية بيانات المواطنين', en: 'A revolutionary system using decentralized, transparent blockchain to protect citizen data' },
    metric_security: { ar: 'أمان عالي', en: 'High Security' },
    metric_encryption: { ar: 'تشفير AES-256', en: 'AES-256 Encryption' },
    metric_decentralized: { ar: 'لامركزي', en: 'Decentralized' },
    metric_blockchain: { ar: 'تقنية البلوك تشين', en: 'Blockchain Technology' },
    metric_transparent: { ar: 'شفاف', en: 'Transparent' },
    metric_auditable: { ar: 'قابل للتدقيق', en: 'Auditable' },
    tech_title: { ar: 'التقنيات المستخدمة', en: 'Technologies Used' },
    tech_subtitle: { ar: 'مجموعة متقدمة من التقنيات الحديثة لضمان الأمان والكفاءة', en: 'An advanced set of modern technologies for security and efficiency' },
    php_desc: { ar: 'لغة البرمجة الخلفية المتقدمة مع PDO لقواعد البيانات الآمنة', en: 'Advanced backend language with PDO for secure databases' },
    php_item1: { ar: '• معالجة البيانات الآمنة', en: '• Secure data processing' },
    php_item2: { ar: '• التشفير المتقدم', en: '• Advanced encryption' },
    php_item3: { ar: '• إدارة الجلسات', en: '• Session management' },
    mysql_desc: { ar: 'قاعدة بيانات متقدمة مع فهرسة محسنة ونظام الأمان المتكامل', en: 'Advanced database with improved indexing and integrated security' },
    mysql_item1: { ar: '• تشفير البيانات الحساسة', en: '• Sensitive data encryption' },
    mysql_item2: { ar: '• فهرسة متقدمة', en: '• Advanced indexing' },
    mysql_item3: { ar: '• إجراءات مخزنة آمنة', en: '• Secure stored procedures' },
    js_desc: { ar: 'واجهة مستخدم تفاعلية مع معالجة الأخطاء المتقدمة', en: 'Interactive UI with advanced error handling' },
    js_item2: { ar: '• معالجة الأخطاء', en: '• Error handling' },
    js_item3: { ar: '• واجهة تفاعلية', en: '• Interactive UI' },
    firebase_desc: { ar: 'نظام مصادقة متقدم وآمن من Google', en: 'Advanced and secure authentication by Google' },
    firebase_item1: { ar: '• مصادقة ثنائية', en: '• Two-factor authentication' },
    firebase_item2: { ar: '• أمان متقدم', en: '• Advanced security' },
    firebase_item3: { ar: '• إدارة المستخدمين', en: '• User management' },
    aes_title: { ar: 'تشفير AES-256-CBC', en: 'AES-256-CBC Encryption' },
    aes_desc: { ar: 'أقوى معايير التشفير المعتمدة عالمياً', en: 'The strongest globally adopted encryption standards' },
    aes_item1: { ar: '• تشفير البيانات الحساسة', en: '• Encryption for sensitive data' },
    aes_item2: { ar: '• مفاتيح تشفير آمنة', en: '• Secure encryption keys' },
    aes_item3: { ar: '• هاشينج SHA-256', en: '• SHA-256 hashing' },
    blockchain_desc: { ar: 'سجل موزع لامركزي لضمان الشفافية', en: 'Decentralized distributed ledger ensuring transparency' },
    blockchain_item1: { ar: '• توافق موزع', en: '• Distributed consensus' },
    blockchain_item2: { ar: '• تتبع كامل', en: '• Full traceability' },
    blockchain_item3: { ar: '• مقاومة للتلاعب', en: '• Tamper resistance' }
  };

  function applyTheme(theme) {
    const body = document.body;
    const navbar = document.getElementById('mainNavbar');
    const isLight = theme === 'light';

    body.classList.toggle('light-theme', isLight);

    if (navbar) {
      navbar.classList.toggle('navbar-light', isLight);
      navbar.classList.toggle('navbar-dark', !isLight);
      if (!navbar.classList.contains('glass-navbar')) {
        navbar.classList.add('glass-navbar');
      }
    }

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      themeBtn.setAttribute('title', isLight ? 'Dark' : 'Light');
    }
  }

  function applyLanguage(lang) {
    const html = document.documentElement;
    const isArabic = lang === 'ar';

    html.setAttribute('lang', lang);
    html.setAttribute('dir', isArabic ? 'rtl' : 'ltr');

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      const key = el.getAttribute('data-i18n');
      const value = translations[key] && translations[key][lang];
      if (typeof value === 'string') {
        el.textContent = value;
      }
    });

    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
      langBtn.textContent = isArabic ? 'EN' : 'عربي';
      langBtn.setAttribute('title', isArabic ? 'Switch to English' : 'التبديل إلى العربية');
    }

    // Adjust Bootstrap alignment utilities for RTL/LTR if needed
    document.querySelectorAll('[class*="ms-"]').forEach(function(el) {
      // Swap ms- and me- when switching direction
      const classes = el.className.split(' ');
      const swapped = classes.map(function(cls) {
        if (cls.startsWith('ms-')) return cls.replace('ms-', 'tmp-');
        if (cls.startsWith('me-')) return cls.replace('me-', 'ms-');
        return cls;
      }).map(function(cls) { return cls.replace('tmp-', 'me-'); });
      if (!isArabic) {
        el.className = swapped.join(' ');
      }
    });
  }

  function getStored(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch(_) { return fallback; }
  }
  function setStored(key, value) {
    try { localStorage.setItem(key, value); } catch(_) {}
  }

  function init() {
    const initialTheme = getStored(STORAGE_KEYS.THEME, DEFAULTS.theme);
    const initialLang = getStored(STORAGE_KEYS.LANG, DEFAULTS.lang);

    applyTheme(initialTheme);
    applyLanguage(initialLang);

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function() {
        const newTheme = (getStored(STORAGE_KEYS.THEME, DEFAULTS.theme) === 'dark') ? 'light' : 'dark';
        setStored(STORAGE_KEYS.THEME, newTheme);
        applyTheme(newTheme);
      });
    }

    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
      langBtn.addEventListener('click', function() {
        const newLang = (getStored(STORAGE_KEYS.LANG, DEFAULTS.lang) === 'ar') ? 'en' : 'ar';
        setStored(STORAGE_KEYS.LANG, newLang);
        applyLanguage(newLang);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();