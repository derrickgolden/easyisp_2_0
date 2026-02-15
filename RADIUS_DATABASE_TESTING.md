# RADIUS Database Integration - Testing Guide

## Overview

The EasyISP system now connects directly to your RADIUS database using FreeRADIUS schema tables:
- `radcheck` - User authentication credentials
- `radreply` - User reply attributes
- `radusergroup` - User to group mappings
- `radgroupcheck` - Group check attributes
- `radgroupreply` - Group reply attributes (bandwidth limits, session timeouts)
- `radpostauth` - Authentication logging

## Setup Steps

### 1. Configure RADIUS Database Connection

Your `.env` file should already have:
```env
DB_RADIUS_HOST=127.0.0.1
DB_RADIUS_PORT=3306
DB_RADIUS_DATABASE=radius
DB_RADIUS_USERNAME=root
DB_RADIUS_PASSWORD=your_password
```

### 2. Sync Existing Customers to RADIUS

**Via Artisan Command:**
```bash
cd easyisp-api
php artisan radius:sync-customers

# Force re-sync (delete and recreate all):
php artisan radius:sync-customers --force
```

**Via API (POST):**
```bash
# Sync all customers
curl -X POST http://localhost:8000/api/radius/sync-all-customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Response:
{
  "message": "Customer sync completed",
  "synced": 3,
  "skipped": 0,
  "failed": 0,
  "total": 3
}
```

**Sync single customer:**
```bash
curl -X POST http://localhost:8000/api/radius/sync-customer/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Response:
{
  "message": "Customer synced to RADIUS successfully",
  "customer_id": 1,
  "radius_username": "johndoe"
}
```

### 3. Check RADIUS Status

```bash
curl -X GET http://localhost:8000/api/radius/customer-status/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "customer_id": 1,
  "radius_username": "johndoe",
  "synced_to_radius": true,
  "check_attributes": [
    {
      "id": 1,
      "username": "johndoe",
      "attribute": "User-Password",
      "op": ":=",
      "value": "securepass123"
    },
    {
      "id": 2,
      "username": "johndoe",
      "attribute": "Framed-IP-Address",
      "op": "==",
      "value": "10.0.0.1"
    }
  ],
  "reply_attributes": [
    {
      "id": 1,
      "username": "johndoe",
      "attribute": "Framed-IP-Address",
      "op": ":=",
      "value": "10.0.0.1"
    },
    {
      "id": 2,
      "username": "johndoe",
      "attribute": "Framed-IP-Netmask",
      "op": ":=",
      "value": "255.255.255.0"
    },
    {
      "id": 3,
      "username": "johndoe",
      "attribute": "Service-Type",
      "op": ":=",
      "value": "Framed-User"
    }
  ],
  "groups": [
    {
      "groupname": "basic_package",
      "priority": 1
    }
  ],
  "customer": {
    "name": "John Doe",
    "status": "active",
    "expiry_date": "2026-02-22T00:00:00.000000Z",
    "package": "Basic Package"
  }
}
```

## Testing RADIUS Authentication

### Test 1: Valid Customer Authentication

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "securepass123"
  }'

# Response (Access-Accept):
{
  "message": "Authentication successful",
  "status": "Access-Accept",
  "user": {
    "username": "johndoe",
    "profile": null,
    "group": [
      {
        "groupname": "basic_package",
        "priority": 1
      }
    ]
  },
  "attributes": {
    "check": [
      {
        "id": 1,
        "username": "johndoe",
        "attribute": "User-Password",
        "op": ":=",
        "value": "securepass123"
      },
      {
        "id": 2,
        "username": "johndoe",
        "attribute": "Framed-IP-Address",
        "op": "==",
        "value": "10.0.0.1"
      }
    ],
    "reply": [
      {
        "id": 1,
        "username": "johndoe",
        "attribute": "Framed-IP-Address",
        "op": ":=",
        "value": "10.0.0.1"
      },
      {
        "id": 2,
        "username": "johndoe",
        "attribute": "Framed-IP-Netmask",
        "op": ":=",
        "value": "255.255.255.0"
      },
      {
        "id": 3,
        "username": "johndoe",
        "attribute": "Service-Type",
        "op": ":=",
        "value": "Framed-User"
      }
    ],
    "group_reply": [
      {
        "id": 1,
        "groupname": "basic_package",
        "attribute": "Session-Timeout",
        "op": ":=",
        "value": "3600"
      }
    ]
  },
  "customer_info": {
    "id": 1,
    "name": "John Doe",
    "ip_address": "10.0.0.1",
    "mac_address": "00:11:22:33:44:55",
    "package": {
      "name": "Basic Package",
      "speed_up": "5Mbps",
      "speed_down": "20Mbps"
    },
    "connection_type": "PPPoE"
  }
}
```

### Test 2: Invalid Password

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "wrongpassword"
  }'

# Response (Access-Reject):
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

### Test 3: Non-existent User

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nonexistent",
    "password": "password"
  }'

# Response (Access-Reject):
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

## Direct RADIUS Database Queries

You can verify data directly in the RADIUS database:

```sql
-- View all users
SELECT * FROM radcheck WHERE attribute = 'User-Password';

-- View specific user
SELECT * FROM radcheck WHERE username = 'johndoe';

-- View user groups
SELECT * FROM radusergroup WHERE username = 'johndoe';

-- View group bandwidth limits
SELECT * FROM radgroupreply WHERE groupname = 'basic_package';

-- View authentication logs
SELECT * FROM radpostauth ORDER BY authdate DESC LIMIT 10;
```

## Create New Customer with RADIUS

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@easyisp.local",
    "password": "password"
  }' | jq -r '.token')

# Create customer
curl -X POST http://localhost:8000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Alice",
    "last_name": "Wonder",
    "phone": "+254712345678",
    "email": "alice@example.com",
    "location": "Nairobi",
    "package_id": 1,
    "site_id": 1,
    "connection_type": "Static IP",
    "expiry_date": "2026-12-31",
    "balance": 0,
    "radius_username": "alice_wonder",
    "radius_password": "alice_secure_pass_123",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "is_independent": true
  }'

# Sync customer to RADIUS
curl -X POST http://localhost:8000/api/radius/sync-customer/4 \
  -H "Authorization: Bearer $TOKEN"

# Test authentication
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_wonder",
    "password": "alice_secure_pass_123"
  }'
```

## API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/radius/authenticate` | POST | None | Public WiFi authentication |
| `/api/radius/config/{username}` | GET | None | Get user RADIUS config |
| `/api/radius/verify/{username}` | POST | Bearer | Verify credentials |
| `/api/radius/wifi-access/{username}` | GET | Bearer | Check WiFi access |
| `/api/radius/create-user` | POST | Bearer | Create RADIUS user |
| `/api/radius/update-password/{username}` | PUT | Bearer | Update password |
| `/api/radius/users` | GET | Bearer | List all users |
| `/api/radius/groups` | GET | Bearer | List all groups |
| `/api/radius/user/{username}` | DELETE | Bearer | Delete user |
| `/api/radius/sync-customer/{customerId}` | POST | Bearer | Sync one customer |
| `/api/radius/sync-all-customers` | POST | Bearer | Sync all customers |
| `/api/radius/customer-status/{customerId}` | GET | Bearer | Check sync status |

## Troubleshooting

### Issue: "RADIUS database error"

**Check RADIUS database connection:**
```bash
mysql -h 127.0.0.1 -u root -p radius -e "SHOW TABLES;"
```

### Issue: Users not authenticating

**Verify user exists in RADIUS:**
```bash
mysql -h 127.0.0.1 -u root -p radius -e "SELECT * FROM radcheck WHERE username='johndoe';"
```

### Issue: Customer synced but not authenticating

**Check RADIUS log:**
```bash
# View recent authentications
mysql -h 127.0.0.1 -u root -p radius -e "SELECT * FROM radpostauth ORDER BY authdate DESC LIMIT 5;"
```

## Automation: Auto-sync on Customer Creation

The system automatically syncs customers to RADIUS when they're created with `radius_username` and `radius_password`.

To enable this, add to `CustomerController.store()`:
```php
// After customer is created
if ($customer->radius_username && $customer->radius_password) {
    $radiusService->createUser($customer->radius_username, $customer->radius_password);
    if ($customer->package) {
        $groupName = strtolower(str_replace(' ', '_', $customer->package->name));
        $radiusService->assignUserToGroup($customer->radius_username, $groupName);
    }
}
```

## Next Steps

1. ✅ RADIUS database configured
2. ✅ RadiusService updated for FreeRADIUS schema
3. ✅ Customer sync endpoints created
4. 🔄 Create Group-based bandwidth policies
5. 🔄 Setup WiFi Access Point to use EasyISP RADIUS
6. 🔄 Configure accounting (radacct) for session tracking
7. 🔄 Setup RADIUS failover and clustering

