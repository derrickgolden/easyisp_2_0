#!/bin/bash

API="http://localhost:8000/api"

echo "📝 Creating New Customer with WiFi Credentials"
echo "=============================================="
echo ""

# Get admin auth token
echo "🔐 Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@easyisp.local",
    "password": "password"
  }')

TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."
echo ""

# Create new customer
echo "➕ Creating new customer 'Alice Wonder'..."
CUSTOMER_RESPONSE=$(curl -s -X POST "$API/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "first_name": "Alice",
    "last_name": "Wonder",
    "phone": "+254712345678",
    "email": "alice@example.com",
    "location": "Nairobi",
    "apartment": "Unit 5",
    "house_no": "123",
    "package_id": 1,
    "site_id": 1,
    "connection_type": "Static IP",
    "installation_fee": 1000,
    "expiry_date": "2026-12-31",
    "balance": 0,
    "radius_username": "alice_wonder",
    "radius_password": "alice_secure_pass_123",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "is_independent": true
  }')

echo "$CUSTOMER_RESPONSE" | python3 -m json.tool
echo ""

# Extract customer ID
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('customer', {}).get('id', ''))" 2>/dev/null)

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ Failed to create customer"
  exit 1
fi

echo "✅ Customer created with ID: $CUSTOMER_ID"
echo ""

# Test RADIUS authentication with new customer
echo "🧪 Testing WiFi Authentication for Alice Wonder"
echo "================================================"
echo ""

AUTH_RESPONSE=$(curl -s -X POST "$API/radius/authenticate" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_wonder",
    "password": "alice_secure_pass_123"
  }')

echo "$AUTH_RESPONSE" | python3 -m json.tool
echo ""

# Check authentication status
AUTH_STATUS=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', ''))" 2>/dev/null)

if [ "$AUTH_STATUS" = "Access-Accept" ]; then
  echo "✅ WiFi Authentication SUCCESSFUL!"
  echo ""
  echo "🎉 New customer can now connect to WiFi hotspot!"
  echo ""
  echo "WiFi Connection Details:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Network: EasyISP_Free"
  echo "Username: alice_wonder"
  echo "Password: alice_secure_pass_123"
  echo "Connection Type: Static IP"
  echo "IP Address: 10.0.0.10"
  echo "MAC Address: AA:BB:CC:DD:EE:FF"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "❌ WiFi Authentication FAILED!"
  echo "Status: $AUTH_STATUS"
fi
echo ""

# Get WiFi access verification
echo "📊 Verifying WiFi Access Details"
echo "=================================="
echo ""

ACCESS_RESPONSE=$(curl -s -X GET "$API/radius/customer/$CUSTOMER_ID/wifi-access" \
  -H "Authorization: Bearer $TOKEN")

echo "$ACCESS_RESPONSE" | python3 -m json.tool
echo ""

echo "✅ Setup Complete!"
