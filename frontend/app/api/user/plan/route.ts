import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { pool } from '../../../lib/db';

export async function GET() {
  try {
    const { user } = await withAuth();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT plan, firm_name, status, seats, current_period_end, source, stripe_customer_id
       FROM auth.user_access
       WHERE email = $1 AND status = 'active'
       LIMIT 1`,
      [user.email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ plan: null, firm_name: null });
    }

    return NextResponse.json(result.rows[0]);
  } catch (e) {
    console.error('Failed to get plan:', e);
    return NextResponse.json({ error: 'Failed to get plan' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { plan } = await request.json();

    if (!plan || !['free', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const source = plan === 'free' ? 'workos' : 'stripe';

    await pool.query(
      `INSERT INTO auth.user_access (email, plan, source)
       VALUES ($1, $2, $3)
       ON CONFLICT ((email)) WHERE email IS NOT NULL
       DO UPDATE SET plan = $2, source = $3, updated_at = now()`,
      [user.email, plan, source]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Failed to save plan:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
