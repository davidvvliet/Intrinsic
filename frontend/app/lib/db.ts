import { Pool } from 'pg';

const needsSSL = process.env.DATABASE_URL?.includes('ondigitalocean.com') ||
                 process.env.DATABASE_URL?.includes('sslmode=require');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(needsSSL && { ssl: { rejectUnauthorized: false } })
});

export async function checkUserAccess(email: string): Promise<{
  hasAccess: boolean;
  plan: string | null;
}> {
  try {
    const result = await pool.query(
      `SELECT plan FROM auth.user_access
       WHERE email = $1 AND status = 'active'
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return { hasAccess: false, plan: null };
    }

    return { hasAccess: true, plan: result.rows[0].plan };
  } catch (e) {
    console.error('Failed to check user access:', e);
    return { hasAccess: false, plan: null };
  }
}
