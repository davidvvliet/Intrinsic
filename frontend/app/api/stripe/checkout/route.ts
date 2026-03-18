import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import Stripe from 'stripe';
import { pool } from '../../../lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
    }

    // Check if user already has a Stripe customer ID
    const existing = await pool.query(
      `SELECT stripe_customer_id FROM auth.user_access WHERE email = $1 LIMIT 1`,
      [user.email]
    );

    let customerId: string | undefined = existing.rows[0]?.stripe_customer_id || undefined;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout error:', e);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
