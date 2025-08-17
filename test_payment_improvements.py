#!/usr/bin/env python3
"""
Test Script for New Payment System Features
Tests the newly implemented payment system components
"""

import asyncio
import json
import requests
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_TOKEN = None  # Will need to be set with actual token

async def test_payment_validation():
    """Test payment amount validation endpoint"""
    print("\n🧪 Testing Payment Amount Validation...")
    
    test_cases = [
        {"credits": 25, "amount": 2.50, "should_pass": True},   # Correct amount
        {"credits": 25, "amount": 3.00, "should_pass": False},  # Wrong amount
        {"credits": 100, "amount": 9.00, "should_pass": True},  # Volume discount
        {"credits": 0, "amount": 0, "should_pass": False},      # Invalid credits
        {"credits": -5, "amount": 1.00, "should_pass": False},  # Negative credits
    ]
    
    for i, test_case in enumerate(test_cases):
        try:
            response = requests.post(f"{BASE_URL}/api/payment/validate-amount", json=test_case)
            
            if test_case["should_pass"]:
                assert response.status_code == 200, f"Test {i+1} should pass but got {response.status_code}"
                data = response.json()
                assert data["valid"] == True, f"Test {i+1} should be valid"
                print(f"✅ Test {i+1}: Validation passed for {test_case['credits']} credits at ${test_case['amount']}")
            else:
                assert response.status_code == 400, f"Test {i+1} should fail but got {response.status_code}"
                print(f"✅ Test {i+1}: Validation correctly rejected {test_case['credits']} credits at ${test_case['amount']}")
                
        except Exception as e:
            print(f"❌ Test {i+1} failed: {e}")

async def test_rate_limiting():
    """Test rate limiting on payment intent creation"""
    print("\n🧪 Testing Rate Limiting...")
    
    if not TEST_USER_TOKEN:
        print("⚠️ Skipping rate limiting test - no auth token provided")
        return
    
    headers = {"Authorization": f"Bearer {TEST_USER_TOKEN}"}
    
    # Try to create 6 payment intents rapidly (limit is 5 per hour)
    for i in range(6):
        try:
            response = requests.post(f"{BASE_URL}/api/create-payment-intent", 
                json={"credits": 25, "amount": 2.50},
                headers=headers
            )
            
            if i < 5:
                print(f"✅ Payment intent {i+1}: Should succeed - Status {response.status_code}")
            else:
                assert response.status_code == 429, f"6th request should be rate limited"
                print(f"✅ Payment intent {i+1}: Correctly rate limited - Status {response.status_code}")
                
        except Exception as e:
            print(f"❌ Rate limiting test {i+1} failed: {e}")

async def test_webhook_event_handling():
    """Test webhook event handling with mock events"""
    print("\n🧪 Testing Webhook Event Handling...")
    
    # Mock webhook events
    mock_events = [
        {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_test_123",
                    "amount": 2500,  # $25.00
                    "metadata": {
                        "user_id": "test-user-123",
                        "credits": "250"
                    }
                }
            }
        },
        {
            "type": "payment_intent.payment_failed",
            "data": {
                "object": {
                    "id": "pi_test_456",
                    "last_payment_error": {
                        "message": "Your card was declined."
                    }
                }
            }
        },
        {
            "type": "charge.dispute.created",
            "data": {
                "object": {
                    "charge": "ch_test_789"
                }
            }
        }
    ]
    
    for event in mock_events:
        print(f"📝 Testing event: {event['type']}")
        # Note: This would need proper Stripe signature in real test
        # For now, just checking the webhook endpoint exists
        try:
            response = requests.post(f"{BASE_URL}/api/stripe-webhook", 
                json=event,
                headers={"stripe-signature": "test"}
            )
            print(f"   Status: {response.status_code}")
        except Exception as e:
            print(f"   Error: {e}")

async def test_payment_history():
    """Test payment history endpoint"""
    print("\n🧪 Testing Payment History...")
    
    if not TEST_USER_TOKEN:
        print("⚠️ Skipping payment history test - no auth token provided")
        return
    
    headers = {"Authorization": f"Bearer {TEST_USER_TOKEN}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/payment/history", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Payment history retrieved successfully")
            print(f"   Total transactions: {data['summary']['total_transactions']}")
            print(f"   Total purchased: {data['summary']['total_purchased']} credits")
            print(f"   Total used: {data['summary']['total_used']} credits")
            print(f"   Total refunded: {data['summary']['total_refunded']} credits")
        else:
            print(f"❌ Payment history test failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Payment history test failed: {e}")

async def test_backend_health():
    """Test that backend is running and endpoints exist"""
    print("\n🧪 Testing Backend Health...")
    
    endpoints_to_test = [
        "/api/payment/validate-amount",
        "/api/payment/history", 
        "/api/create-payment-intent",
        "/api/stripe-webhook"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            response = requests.options(f"{BASE_URL}{endpoint}")
            if response.status_code in [200, 405]:  # 405 is method not allowed, which means endpoint exists
                print(f"✅ {endpoint}: Endpoint exists")
            else:
                print(f"❌ {endpoint}: Unexpected status {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: Connection failed - {e}")

async def run_all_tests():
    """Run all tests"""
    print("🚀 Starting Payment System Tests")
    print(f"🎯 Target: {BASE_URL}")
    print(f"⏰ Time: {datetime.now()}")
    
    await test_backend_health()
    await test_payment_validation()
    await test_rate_limiting()
    await test_webhook_event_handling()
    await test_payment_history()
    
    print("\n✨ Test suite completed!")

if __name__ == "__main__":
    print("🧪 Payment System Test Suite")
    print("=" * 50)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code == 200:
            print("✅ Backend is running")
            asyncio.run(run_all_tests())
        else:
            print("❌ Backend not responding correctly")
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        print("🔧 Make sure your backend is running on http://localhost:8000")
