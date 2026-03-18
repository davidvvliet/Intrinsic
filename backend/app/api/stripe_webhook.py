import os
import stripe
from fastapi import APIRouter, Request, HTTPException
from app.storage.async_db import execute_query_one, execute_command

router = APIRouter()

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')

PRICE_TO_PLAN = {
    os.getenv('STRIPE_MONTHLY_PRICE_ID'): 'pro',
    os.getenv('STRIPE_YEARLY_PRICE_ID'): 'pro',
}


async def handle_checkout_completed(session):
    customer_email = (session.get('customer_details') or {}).get('email') or session.get('customer_email')
    stripe_customer_id = session.get('customer')
    stripe_subscription_id = session.get('subscription')
    plan = session.get('metadata', {}).get('plan', 'pro')

    if not customer_email:
        print(f"[STRIPE] No email in checkout session {session.get('id')}")
        return

    existing = await execute_query_one(
        "SELECT id FROM auth.user_access WHERE email = $1",
        customer_email
    )

    if existing:
        await execute_command(
            """UPDATE auth.user_access
               SET plan = $1, source = 'stripe', status = 'active',
                   stripe_customer_id = $2, stripe_subscription_id = $3,
                   updated_at = NOW()
               WHERE email = $4""",
            plan, stripe_customer_id, stripe_subscription_id, customer_email
        )
    else:
        await execute_command(
            """INSERT INTO auth.user_access (email, plan, source, status, stripe_customer_id, stripe_subscription_id)
               VALUES ($1, $2, 'stripe', 'active', $3, $4)""",
            customer_email, plan, stripe_customer_id, stripe_subscription_id
        )

    print(f"[STRIPE] checkout.session.completed: {customer_email} -> {plan}")


async def handle_subscription_updated(subscription):
    stripe_customer_id = subscription.get('customer')
    stripe_subscription_id = subscription.get('id')
    subscription_status = subscription.get('status')

    items = subscription.get('items', {}).get('data', [])
    if not items:
        return

    price_id = items[0].get('price', {}).get('id')
    plan = PRICE_TO_PLAN.get(price_id, 'pro')
    status = 'active' if subscription_status in ['active', 'trialing'] else 'inactive'

    await execute_command(
        """UPDATE auth.user_access
           SET plan = $1, status = $2, stripe_subscription_id = $3, updated_at = NOW()
           WHERE stripe_customer_id = $4""",
        plan, status, stripe_subscription_id, stripe_customer_id
    )

    print(f"[STRIPE] subscription.updated: {stripe_customer_id} -> plan={plan}, status={status}")


async def handle_subscription_deleted(subscription):
    stripe_customer_id = subscription.get('customer')

    await execute_command(
        """UPDATE auth.user_access
           SET plan = 'free', status = 'inactive', stripe_subscription_id = NULL, updated_at = NOW()
           WHERE stripe_customer_id = $1""",
        stripe_customer_id
    )

    print(f"[STRIPE] subscription.deleted: {stripe_customer_id} -> free/inactive")


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event['type']
    event_data = event['data']['object']

    print(f"[STRIPE] Received: {event_type}")

    try:
        if event_type == 'checkout.session.completed':
            await handle_checkout_completed(event_data)
        elif event_type == 'customer.subscription.updated':
            await handle_subscription_updated(event_data)
        elif event_type == 'customer.subscription.deleted':
            await handle_subscription_deleted(event_data)
    except Exception as e:
        print(f"[STRIPE] Error handling {event_type}: {e}")

    return {"received": True}
