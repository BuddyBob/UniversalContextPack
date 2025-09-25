#!/usr/bin/env python3
"""
Debug script to check Stripe webhook endpoint configuration
and list recent webhook events
"""

import stripe
import os
from datetime import datetime, timedelta

# Set your Stripe secret key
stripe.api_key = os.getenv('STRIPE_SECRET_KEY') or 'sk_live_...'  # Replace with actual key

def check_webhook_endpoints():
    """List all webhook endpoints configured in Stripe"""
    print("🔗 Checking Stripe webhook endpoints...")
    
    try:
        endpoints = stripe.WebhookEndpoint.list()
        
        print(f"Found {len(endpoints.data)} webhook endpoint(s):")
        for i, endpoint in enumerate(endpoints.data, 1):
            print(f"\n{i}. Endpoint ID: {endpoint.id}")
            print(f"   URL: {endpoint.url}")
            print(f"   Status: {endpoint.status}")
            print(f"   Events: {', '.join(endpoint.enabled_events) if endpoint.enabled_events else 'ALL EVENTS'}")
            print(f"   Created: {datetime.fromtimestamp(endpoint.created)}")
            
    except Exception as e:
        print(f"❌ Error fetching webhook endpoints: {e}")

def check_recent_events():
    """Check recent Stripe events"""
    print("\n📝 Checking recent Stripe events...")
    
    try:
        # Get events from the last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        events = stripe.Event.list(
            created={'gte': int(yesterday.timestamp())},
            limit=20
        )
        
        print(f"Found {len(events.data)} recent event(s):")
        
        # Group by type for better overview
        event_types = {}
        for event in events.data:
            event_type = event.type
            if event_type not in event_types:
                event_types[event_type] = []
            event_types[event_type].append(event)
        
        for event_type, events_list in event_types.items():
            print(f"\n{event_type}: {len(events_list)} events")
            for event in events_list[:3]:  # Show first 3 of each type
                created_time = datetime.fromtimestamp(event.created)
                print(f"  - {event.id} at {created_time}")
                
                # Show details for checkout and payment events
                if 'checkout' in event_type or 'payment' in event_type:
                    obj = event.data.object
                    if hasattr(obj, 'metadata') and obj.metadata:
                        print(f"    Metadata: {dict(obj.metadata)}")
                    if hasattr(obj, 'amount_total'):
                        print(f"    Amount: ${obj.amount_total / 100 if obj.amount_total else 0}")
                    if hasattr(obj, 'payment_status'):
                        print(f"    Payment Status: {obj.payment_status}")
        
    except Exception as e:
        print(f"❌ Error fetching recent events: {e}")

def check_specific_checkout_sessions():
    """Check recent checkout sessions specifically"""
    print("\n🛒 Checking recent checkout sessions...")
    
    try:
        sessions = stripe.checkout.Session.list(limit=10)
        
        print(f"Found {len(sessions.data)} recent checkout session(s):")
        for session in sessions.data:
            created_time = datetime.fromtimestamp(session.created)
            print(f"\nSession {session.id}")
            print(f"  Created: {created_time}")
            print(f"  Status: {session.status}")
            print(f"  Payment Status: {session.payment_status}")
            print(f"  Amount: ${session.amount_total / 100 if session.amount_total else 0}")
            print(f"  Customer Email: {session.customer_email}")
            if session.metadata:
                print(f"  Metadata: {dict(session.metadata)}")
            if session.payment_intent:
                print(f"  Payment Intent: {session.payment_intent}")
                
    except Exception as e:
        print(f"❌ Error fetching checkout sessions: {e}")

if __name__ == "__main__":
    print("🔍 Stripe Webhook & Event Debug Tool")
    print("=" * 50)
    
    check_webhook_endpoints()
    check_recent_events()
    check_specific_checkout_sessions()
    
    print("\n✅ Debug check completed!")
    print("\nNext steps:")
    print("1. Verify webhook endpoint URL matches your backend")
    print("2. Check that 'checkout.session.completed' is in enabled events")
    print("3. Look for recent checkout sessions with payment_status='paid'")
    print("4. Verify metadata is being passed correctly from frontend")