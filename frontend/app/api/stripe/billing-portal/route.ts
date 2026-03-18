import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import Stripe from 'stripe';
import { pool } from '../../../lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const { user } = await withAuth();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT stripe_customer_id FROM auth.user_access WHERE email = $1 LIMIT 1`,
      [user.email]
    );

    const customerId = result.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Billing portal error:', e);
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 });
  }
}
