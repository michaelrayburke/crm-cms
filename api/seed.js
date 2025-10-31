import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const password_hash = await bcrypt.hash(password, 10);
  const role = 'ADMIN';
  await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
    [email, password_hash, role]
  );
  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
