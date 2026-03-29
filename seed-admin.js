require('dotenv/config');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function seedAdmin() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Set it in .env or environment.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Create table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'admin',
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // Check if admin already exists
  const [count] = await sql`SELECT COUNT(*) as count FROM admin_users`;
  if (parseInt(count.count) > 0) {
    console.log(`Already have ${count.count} admin user(s). Skipping.`);
    return;
  }

  // Create default admin
  const id = crypto.randomUUID();
  const username = 'admin';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 12);

  await sql`INSERT INTO admin_users (id, username, password_hash, display_name, role)
    VALUES (${id}, ${username}, ${hash}, ${'מנהל ראשי'}, ${'superadmin'})`;

  console.log('Default admin user created:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log('  ** Please change the password after first login! **');
}

seedAdmin().catch(err => { console.error(err); process.exit(1); });
