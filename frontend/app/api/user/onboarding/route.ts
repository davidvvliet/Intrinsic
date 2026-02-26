import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { Pool } from 'pg';

const needsSSL = process.env.DATABASE_URL?.includes('ondigitalocean.com') ||
                 process.env.DATABASE_URL?.includes('sslmode=require');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(needsSSL && { ssl: { rejectUnauthorized: false } })
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const data = await request.json();
    await pool.query(
      `INSERT INTO auth.onboarding_responses (email, onboarding_data) VALUES ($1, $2)`,
      [user.email, JSON.stringify(data)]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Failed to save onboarding data:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
