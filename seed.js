require('dotenv/config');
const { neon } = require('@neondatabase/serverless');
const { v4: uuidv4 } = require('uuid');

function slugify(text) {
  return text.toString().toLowerCase().replace(/[\s]+/g, '-').replace(/[^\u0590-\u05FFa-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || uuidv4().slice(0, 8);
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Set it in .env or environment.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Init tables
  console.log('Creating tables...');
  await sql`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', icon TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', short_description TEXT DEFAULT '', price NUMERIC(10,2) NOT NULL, unit TEXT DEFAULT 'kg', price_label TEXT DEFAULT '', image TEXT DEFAULT '', gallery JSONB DEFAULT '[]', in_stock BOOLEAN DEFAULT true, is_featured BOOLEAN DEFAULT false, weight_options JSONB DEFAULT '[]', tags JSONB DEFAULT '[]', sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT DEFAULT '', delivery_address TEXT NOT NULL, delivery_city TEXT NOT NULL, delivery_notes TEXT DEFAULT '', items JSONB NOT NULL, subtotal NUMERIC(10,2) NOT NULL, delivery_fee NUMERIC(10,2) DEFAULT 0, total NUMERIC(10,2) NOT NULL, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`;

  // Check if already seeded
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM products`;
  if (parseInt(count) > 0) {
    console.log(`Database already has ${count} products. Skipping seed.`);
    return;
  }

  console.log('Seeding categories...');
  const cats = [
    { name: 'דגי ים', icon: '🐟', description: 'דגי ים טריים מהדייג המקומי בים התיכון', sort_order: 1 },
    { name: 'דגי מים מתוקים', icon: '🐠', description: 'דגי מים מתוקים טריים ואיכותיים', sort_order: 2 },
    { name: 'פירות ים', icon: '🦐', description: 'פירות ים טריים ומגוונים', sort_order: 3 },
    { name: 'תבלינים לדגים', icon: '🌿', description: 'תבלינים ותערובות מיוחדות ל��כנ�� דגים', sort_order: 4 },
    { name: 'תבלינים כלליים', icon: '🧂', description: 'תבלינים איכותיים למטבח', sort_order: 5 },
    { name: 'חבילות מיוחדות', icon: '🎁', description: 'חבילות מוכנות לארוחות משפחתיות', sort_order: 6 },
  ];

  const categoryIds = {};
  for (const cat of cats) {
    const id = uuidv4();
    await sql`INSERT INTO categories (id, name, slug, description, icon, sort_order) VALUES (${id}, ${cat.name}, ${slugify(cat.name)}, ${cat.description}, ${cat.icon}, ${cat.sort_order})`;
    categoryIds[cat.name] = id;
  }

  console.log('Seeding products...');
  const products = [
    { category: 'דגי ים', name: 'דניס', short_description: 'דג דניס טרי מהים התיכון, בשר לבן ועדין', description: 'דג דניס (Sea Bream) טרי, נתפס בים התיכון. בשר לבן, עדין ��עסיסי. מתאים לצלייה, אפייה בתנור או על הגריל.\n\nמשקל ממוצע: 300-500 גרם לדג.\nמגיע שלם או מנוקה לפי בחירה.', price: 89, unit: 'kg', price_label: '₪89 לק"ג', tags: ['טרי', 'ים תיכון', 'גריל', 'תנור'], is_featured: true, sort_order: 1 },
    { category: 'דגי ים', name: 'לברק', short_description: 'לברק ים טרי, מלך הדגים הים תיכוניים', description: 'דג לברק (Sea Bass) טרי מהים התיכון. נחשב לאחד הדגים האיכותיים ביותר. בשר יציב, טעם עדין ומעודן.\n\nמשקל ממוצע: 400-700 ��רם.\nמושלם לאפייה בתנור עם לימון ועשבי תיבול.', price: 95, unit: 'kg', price_label: '₪95 לק"ג', tags: ['טרי', 'ים תיכון', 'פרימיום', 'תנור'], is_featured: true, sort_order: 2 },
    { category: 'דגי ים', name: 'מוסר ים', short_description: 'מוסר ים טרי, דג שטוח עם בשר עדין במיוחד', description: 'מוסר ים (Sole) טרי. דג שטוח עם בשר לבן ועדין מאוד. נמס בפה.\n\nמתאים לטיגון, אפייה או הכנה ברוטב.', price: 110, unit: 'kg', price_label: '₪110 לק"ג', tags: ['טרי', 'פרימיום', 'עדין'], sort_order: 3 },
    { category: 'דגי ים', name: 'בקלה טרייה', short_description: 'פילה בקלה טרי, רב-שימושי ועשיר בחלבון', description: 'פילה בקלה (Cod) טרי. דג רב-שימושי עם בשר לבן ויציב. עשיר בחלבון ודל בשומן.\n\nמגיע כפילה ללא עצמות.\nמושלם לטיגון, אפייה, או תבשילים.', price: 75, unit: 'kg', price_label: '₪75 לק"ג', tags: ['טרי', 'פילה', 'בריא'], sort_order: 4 },
    { category: 'דגי ים', name: 'סלמון טרי', short_description: 'פילה סלמון נורווגי טרי, עשיר באומגה 3', description: 'פילה סלמון (Salmon) נורווגי טרי. עשיר באומגה 3 וחומצות שומן בריאות.\n\nמגיע כפילה עם או בלי עור.\nמצוין לסושי, צלייה, אפייה או אכילה נא.', price: 120, unit: 'kg', price_label: '₪120 לק"ג', tags: ['טרי', 'פילה', 'אומגה 3', 'סושי', 'פרימיום'], is_featured: true, sort_order: 5 },
    { category: 'דגי ים', name: 'טונה אדומה', short_description: 'סטייק טונה אדומה טרייה, איכות סשימי', description: 'סטייק טונה אדומה (Bluefin Tuna) באיכות סשימי. בשר אדום עמוק, טעם עשיר ומלא.\n\nמגיע כסטייק חתוך.\nמושלם לצריבה קלה, סשימי או טאטאקי.', price: 180, unit: 'kg', price_label: '₪180 לק"ג', tags: ['טרי', 'סשימי', 'פרימיום', 'סטייק'], sort_order: 6 },
    { category: 'דגי ים', name: 'פורל', short_description: 'דג פורל שלם, טעם עדין ומתוק', description: 'דג פורל (Trout) שלם וטרי. טעם עדין ומתוק, בשר ורוד בהיר.\n\nמשקל ממוצע: 250-400 גרם.\nמצוין לצלייה על גריל או אפייה בתנור עם חמאה ולימון.', price: 65, unit: 'kg', price_label: '₪65 לק"ג', tags: ['טרי', 'גריל', 'עדין'], sort_order: 7 },
    { category: 'דגי ים', name: 'סרדינים טריים', short_description: 'סרדינים טריים מהים התיכון, מושלמים לגריל', description: 'סרדינים (Sardines) טריים מהים התיכון. דגים קטנים עשירים בטעם ובאומגה 3.\n\nנמכרים בקילו.\nמושלמים לצלייה על גריל, טיגון או הכנה בתנור.', price: 45, unit: 'kg', price_label: '₪45 לק"ג', tags: ['טרי', 'ים תיכון', 'גריל', 'אומגה 3'], sort_order: 8 },
    { category: 'דגי מים מתוקים', name: 'אמנון (מושט)', short_description: 'דג אמנון טרי, קלאסיקה ישראלית', description: 'דג אמנון/מושט (Tilapia) טרי. דג פופולרי עם בשר לבן וטעם עדין.\n\nמגיע שלם או כפילה.\nמתאים לטיגון, אפייה או תבשילים.', price: 45, unit: 'kg', price_label: '₪45 לק"ג', tags: ['טרי', 'קלאסי', 'משפחתי'], sort_order: 1 },
    { category: 'דגי מים מתוקים', name: 'קרפיון', short_description: 'קרפיון טרי, מסורתי ומלא טעם', description: 'דג קרפיון (Carp) טרי. דג מסורתי במטבח היהודי, מצוין לגפילטע פיש וחריימה.\n\nמגיע שלם.\nמשקל ממוצע: 1-2 ק"ג.', price: 40, unit: 'kg', price_label: '₪40 לק"ג', tags: ['טרי', 'מסורתי', 'חגים'], sort_order: 2 },
    { category: 'דגי מים מתוקים', name: 'בורי', short_description: 'דג בורי טרי, בשר שמנוני ועסיסי', description: 'דג בורי (Mullet) טרי. בשר שמנוני ועסיסי עם טעם מלא.\n\nמתאים במיוחד לצלייה על גריל או לעישון.\nמשקל ממוצע: 500 גרם - 1 ק"ג.', price: 55, unit: 'kg', price_label: '₪55 לק"ג', tags: ['טרי', 'גריל', 'עישון'], sort_order: 3 },
    { category: 'פירות ים', name: 'שרימפס (חסילונים)', short_description: 'שרימפס טרי בגדלים שונים', description: 'שרימפס (Shrimp) טרי באיכות מעולה. זמין בגדלים שונים - קטן, בינוני וגדול (ג\'מבו).\n\nמגיע מנוקה או עם קליפה לפי בחירה.\nמושלם לפאסטה, סלטים או צלייה.', price: 140, unit: 'kg', price_label: '₪140 לק"ג', tags: ['טרי', 'פירות ים', 'פרימיום'], is_featured: true, sort_order: 1 },
    { category: 'פירות ים', name: 'קלמארי (דיונון)', short_description: 'טבעות קלמארי טריות, רכות ועדינות', description: 'טבעות קלמארי (Calamari) טריות. רכות ועדינות, מוכנות לבישול.\n\nמושלמות לטיגון עמוק, צלייה או הוספה לפאסטה ותבשילים ים תיכוניים.', price: 95, unit: 'kg', price_label: '₪95 לק"ג', tags: ['טרי', 'פירות ים', 'טיגון'], sort_order: 2 },
    { category: 'פירות ים', name: 'תמנון', short_description: 'תמנון טרי, מושלם לסלט או גריל', description: 'תמנון (Octopus) טרי ואיכותי. מגיע מנוקה ומוכן לבישול.\n\nמצוין לסלט תמנון ים תיכוני, צלייה על גריל או תבשיל.', price: 160, unit: 'kg', price_label: '₪160 לק"ג', tags: ['טרי', 'פירות ים', 'גריל', 'פרימיום'], sort_order: 3 },
    { category: 'תבלינים לדגים', name: 'תערובת תבלינים לדגים', short_description: 'תערובת ביתית מושלמת לכל סוגי הדגים', description: 'תערובת תבלינים ביתית המותאמת במיוחד לדגים. כוללת פפריקה, כמון, כוסברה, שום, שמיר ולימון מיובש.\n\nמתאימה לאפייה, צלייה וטיגון.\nללא תוספי טעם מלאכותיים.', price: 18, unit: '100g', price_label: '₪18 ל-100 גרם', tags: ['טבעי', 'תערובת', 'ללא תוספים'], is_featured: true, sort_order: 1 },
    { category: 'תבלינים לדגים', name: 'תערובת חריימה', short_description: 'תערובת תבלינים אותנטית לחריימה מרוקאית', description: 'תערובת תבלינים מסורתית להכנת חריימה אותנטית. כוללת פפריקה חריפה, כמון, שום מיובש, כוסברה, גרגר חרדל ופלפל.\n\nמספיקה להכנת סיר חריימה ל-6 סועדים.', price: 22, unit: '100g', price_label: '₪22 ל-100 גרם', tags: ['מסורתי', 'מרוקאי', 'חריף'], sort_order: 2 },
    { category: 'תבלינים לדגים', name: 'עשבי תיבול לדגים', short_description: 'תערובת עשבי תיבול יבשים - שמיר, פטרוזיליה, בזיליקום', description: 'תערובת עשבי תיבול מיובשים הכוללת שמיר, פטרוזיליה, בזיליקום ואורגנו.\n\nמושלמת לדגים אפויים, רוטבים ומרינדות.\nגידול ישראלי, יבוש טבעי.', price: 15, unit: '100g', price_label: '₪15 ל-100 גרם', tags: ['טבעי', 'ישראלי', 'עשבי תיבול'], sort_order: 3 },
    { category: 'תבלינים לדגים', name: 'תבלין לימון-שום לדגים', short_description: 'תערובת לימון ושום מושלמת לדגים צלויים', description: 'תערובת תבל��נים של לימון מיובש, שום גרגירי, מלח ים, פלפל שחור ועשבי תיבול.\n\nפשוט מפזרים על הדג לפני הצלייה.\nתוצאה מושלמת בכל פעם.', price: 20, unit: '100g', price_label: '₪20 ל-100 גרם', tags: ['לימון', 'שום', 'קל להכנה'], sort_order: 4 },
    { category: 'תבלינים כלליים', name: 'פפריקה מתוקה', short_description: 'פפריקה מתוקה מעושנת, איכות פרימיום', description: 'פפריקה מתוקה מעושנת באיכות גבוהה. צבע אדום עמוק וטעם עשיר.\n\nמושלמת לדגים, בשרים, מרקים ותבשילים.\nארוזה בשקית אטומה לשמירה על טריות.', price: 12, unit: '100g', price_label: '₪12 ל-100 גרם', tags: ['מעושן', 'בסיסי'], sort_order: 1 },
    { category: 'תבלינים כלליים', name: 'כמון טחון', short_description: 'כמון טחון טרי, ארומטי ומלא טעם', description: 'כמון טחון טרי ואיכותי. ארומטי ומלא טעם.\n\nבסיסי במטבח המזרח תיכוני.\nמושלם לדגים, חומוס, תבשילים ומרקים.', price: 14, unit: '100g', price_label: '₪14 ל-100 גרם', tags: ['בסיסי', 'מזרח תיכוני'], sort_order: 2 },
    { category: 'תבלינים כלליים', name: 'כורכום', short_description: 'כורכום טחון, צבע זהוב ויתרונות בריאותיים', description: 'כורכום (Turmeric) טחון באיכות מעולה. צבע זהוב עמוק.\n\nידוע ביתרונותיו הבריאותיים ותכונותיו האנטי-דלקתיות.\nמצוין לתבשילים, אורז ומרקים.', price: 16, unit: '100g', price_label: '₪16 ל-100 גרם', tags: ['בריא', 'בסיסי'], sort_order: 3 },
    { category: 'תבלינים כלליים', name: 'פלפל שחור גרוס', short_description: 'פלפל שחור גרוס טרי, חריפות מאוזנת', description: 'גרגירי פלפל שחור גרוסים טריים. חריפות מאוזנת וארומה עמוקה.\n\nמושלם לתיבול דגים לפני צלייה, סלטים ומנות מוגמרות.', price: 18, unit: '100g', price_label: '₪18 ל-100 גרם', tags: ['בסיסי', 'חריף'], sort_order: 4 },
    { category: 'תבלינים כלליים', name: 'מלח ים גס', short_description: 'מלח ים גס מהים המלח, טבעי 100%', description: 'מלח ים גס מהים המלח. 100% טבעי ללא תוספים.\n\nעשיר במינרלים טבעיים.\nמושלם לתיבול דגים, בשרים ואפייה.', price: 8, unit: '100g', price_label: '₪8 ל-100 גרם', tags: ['טבעי', 'ים המלח', 'בסיסי'], sort_order: 5 },
    { category: 'חבילות מיוחדות', name: 'חבילת שבת - דגים למשפחה', short_description: 'חבילה משפחתית הכוללת דגים ותבלינים לארוחת שבת', description: 'חבילה משפחתית מושלמת לשבת:\n\n• 1 ק"ג פילה סלמון\n• 1 ק"ג דניס שלם\n• תערובת תבלינים לדגים (100 גרם)\n• תערובת חריימה (100 גרם)\n\nמספיק ל-6-8 סועדים.\nחיסכון של 15% מקנייה בנפרד!', price: 250, unit: 'חבילה', price_label: '₪250 לחבילה', tags: ['חיסכון', 'שבת', 'משפחתי'], is_featured: true, sort_order: 1 },
    { category: 'חבילות מיוחדות', name: 'חבילת גריל ים', short_description: 'חבילת דגים וקלמארי מושלמת לגריל', description: 'חבילת גריל ים מושלמת:\n\n• 500 גרם לברק שלם\n• 500 גרם דניס שלם\n• 500 גרם שרימפס\n• 500 גרם קלמארי\n• תבלין לימון-שום (100 גרם)\n\nמספיק ל-4-6 סועדים.\nכל מה שצריך לגריל מושלם!', price: 320, unit: 'חבילה', price_label: '₪320 לחבילה', tags: ['גריל', 'חיסכון', 'מסיבה'], sort_order: 2 },
    { category: 'חבילות מיוחדות', name: 'ערכת תבלינים בסיסית', short_description: '5 תבלינים בסיסיים שכל מטבח צריך', description: 'ערכת תבלינים בסיסית למטבח:\n\n• פפריקה מתוקה (100 גרם)\n• כמון טחון (100 גרם)\n• כורכום (100 גרם)\n• פלפל שחור גרוס (100 גרם)\n• מלח ים גס (200 גרם)\n\nחיסכון של 20% מקנייה בנפרד!', price: 55, unit: 'ערכה', price_label: '₪55 לערכה', tags: ['חיסכון', 'בסיסי', 'מתנה'], sort_order: 3 },
  ];

  for (const p of products) {
    const id = uuidv4();
    const slug = slugify(p.name);
    const catId = categoryIds[p.category];
    await sql`INSERT INTO products (id, category_id, name, slug, description, short_description, price, unit, price_label, image, in_stock, is_featured, tags, sort_order)
      VALUES (${id}, ${catId}, ${p.name}, ${slug}, ${p.description}, ${p.short_description}, ${p.price}, ${p.unit}, ${p.price_label || ''}, '', true, ${p.is_featured || false}, ${JSON.stringify(p.tags || [])}, ${p.sort_order || 0})`;
  }

  const [result] = await sql`SELECT COUNT(*) as count FROM products`;
  console.log(`Seeded ${cats.length} categories and ${result.count} products successfully!`);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
