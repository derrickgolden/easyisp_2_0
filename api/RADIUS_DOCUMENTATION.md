# RADIUS WiFi Authentication System

## Overview

The EasyISP RADIUS system enables WiFi hotspot authentication for customers. When a customer connects to the WiFi network, their device sends their RADIUS credentials (username/password) which are verified against the database.

## How It Works

### 1. Customer Sign-Up Flow
```
User fills signup form → Create Customer Record → Generate RADIUS Credentials
                                                    (username + password)
```

### 2. WiFi Connection Flow
```
Customer Device → WiFi Hotspot → RADIUS Server → EasyISP API
                                 (authenticate)
                                 
If Credentials Valid & Account Active & Subscription Not Expired
→ Access Granted (internet access enabled)

Else
→ Access Denied (show error message)
```

## RADIUS Endpoints

### 1. Public Authentication (WiFi Access Points)
```
POST /api/radius/authenticate
Content-Type: application/json

{
  "username": "customer_radius_username",
  "password": "customer_radius_password"
}

Response (Success):
{
  "message": "Authentication successful",
  "status": "Access-Accept",
  "customer": {
    "id": 1,
    "name": "Jane Smith",
    "username": "janesmith",
    "ip_address": "10.0.0.2",
    "mac_address": "00:11:22:33:44:66",
    "package": {
      "name": "Premium Package",
      "speed_up": "10Mbps",
      "speed_down": "50Mbps"
    },
    "connection_type": "Static IP",
    "status": "active",
    "expiry_date": "2026-02-25"
  }
}

Response (Failure):
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

### 2. Get Customer Configuration
```
GET /api/radius/customer/{customerId}/config

Response:
{
  "customer": {
    "id": 1,
    "name": "Jane Smith",
    "radius_username": "janesmith",
    "radius_password": "securepass456",
    "ip_address": "10.0.0.2",
    "mac_address": "00:11:22:33:44:66"
  },
  "package": {
    "name": "Premium Package",
    "speed_up": "10Mbps",
    "speed_down": "50Mbps",
    "type": "time",
    "validity_days": 30
  },
  "site": {
    "name": "Main Site - Nairobi",
    "location": "Nairobi CBD",
    "ip_address": "192.168.1.1",
    "radius_secret": "secret456"
  }
}
```

### 3. Verify WiFi Access (Authenticated)
```
GET /api/radius/customer/{customerId}/wifi-access
Authorization: Bearer {token}

Response (Has Access):
{
  "has_access": true,
  "wifi_credentials": {
    "username": "janesmith",
    "password": "securepass456",
    "connection_type": "Static IP"
  },
  "network_config": {
    "ip_address": "10.0.0.2",
    "mac_address": "00:11:22:33:44:66",
    "site_ip": "192.168.1.1"
  },
  "package_details": {
    "name": "Premium Package",
    "speed_up": "10Mbps",
    "speed_down": "50Mbps"
  }
}

Response (No Access):
{
  "has_access": false,
  "reason": "Subscription expired"
}
```

## Test Data Available

Pre-seeded customers with active RADIUS credentials:

| Customer | Username | Password | Status | Package | Expiry |
|----------|----------|----------|--------|---------|--------|
| Jane Smith | janesmith | securepass456 | active | Premium | 2026-02-25 |
| John Doe | johndoe | securepass123 | active | Basic | 2026-02-20 |
| Bob Johnson | bobjohnson | securepass789 | active | Basic | 2026-02-20 |

## Testing RADIUS Authentication

### Via cURL

**Test valid credentials:**
```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "janesmith",
    "password": "securepass456"
  }'
```

Expected Response:
```json
{
  "message": "Authentication successful",
  "status": "Access-Accept",
  "customer": { ... }
}
```

**Test invalid password:**
```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "janesmith",
    "password": "wrongpassword"
  }'
```

Expected Response:
```json
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

**Test non-existent user:**
```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nonexistent",
    "password": "password"
  }'
```

Expected Response:
```json
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

### Via Frontend

1. Go to Dashboard
2. Look for "RADIUS WiFi Authentication Test" panel
3. Select a customer from dropdown
4. Click "Test WiFi Access"
5. See authentication result

## Customer Sign-Up to WiFi Access Flow

### 1. Admin Creates Customer via Frontend
```
CRM → Customers → Add New Customer
  - First Name: John
  - Last Name: Smith
  - Phone: +254712345678
  - Email: john@example.com
  - Package: Basic Package
  - RADIUS Username: johnsmith  ← AUTO-GENERATED or PROVIDED
  - RADIUS Password: xxxxxx     ← AUTO-GENERATED or PROVIDED
  - Status: active
  - Expiry Date: 2026-02-24
```

### 2. Customer Details Saved with RADIUS Credentials
```
Database Customer Table:
  id: 4
  first_name: John
  last_name: Smith
  phone: +254712345678
  email: john@example.com
  status: active
  expiry_date: 2026-02-24
  radius_username: johnsmith
  radius_password: xxxxxx
```

### 3. Customer Receives WiFi Access Details
```
Welcome to EasyISP WiFi!

Your WiFi Connection Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Network Name: EasyISP_Free
Username: johnsmith
Password: xxxxxx
Connection Type: PPPoE
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Customer Connects to WiFi
```
1. Device scans for WiFi networks
2. Sees "EasyISP_Free"
3. Clicks to connect
4. Enters username: johnsmith
5. Enters password: xxxxxx
6. Device connects to WiFi hotspot
```

### 5. WiFi Hotspot Authenticates
```
Access Point receives credentials:
  username: johnsmith
  password: xxxxxx

Sends to API:
  POST /api/radius/authenticate
  {"username": "johnsmith", "password": "xxxxxx"}

API checks:
  ✓ Username exists in database
  ✓ Password matches stored password
  ✓ Customer status = "active"
  ✓ Subscription not expired
  ✓ All checks pass!

API returns:
  {"status": "Access-Accept", "customer": {...}}

Access Point:
  → Grants internet access
  → Customer can browse the web!
```

## Business Logic

### Authentication Grants Access If:
✅ Username matches a customer
✅ Password is correct
✅ Customer status is "active"
✅ Subscription expiry date is in the future

### Authentication Denies Access If:
❌ Username doesn't exist
❌ Password is wrong
❌ Customer status is "suspended" or "expired"
❌ Subscription has expired
❌ Any validation fails

## Integration with Actual RADIUS Server

The current implementation is a simplified API-based authentication system. To integrate with a real RADIUS server (FreeRADIUS, etc):

1. **Configure FreeRADIUS:**
   - Add EasyISP API as a module
   - Configure authentication requests to call `/api/radius/authenticate`

2. **Network Setup:**
   - WiFi Access Points point to FreeRADIUS server
   - FreeRADIUS queries EasyISP API for authentication
   - Results returned to access points

3. **Advanced Features:**
   - Speed limits per package
   - Time-based access control
   - Bandwidth monitoring
   - Session tracking

## Security Considerations

- RADIUS passwords stored as plain text (should use hashing for production)
- API should use HTTPS in production
- Implement rate limiting on authentication endpoint
- Add audit logging for all authentication attempts
- Consider two-factor authentication

## Database Schema

```sql
customers table:
- id (primary key)
- first_name
- last_name
- email
- phone
- status (active, expired, suspended)
- expiry_date (subscription expiry)
- radius_username (unique)
- radius_password
- ip_address
- mac_address
- package_id (foreign key)
- site_id (foreign key)
```

## API Validation

- Username required (string)
- Password required (string)
- Both fields must be non-empty
- Returns appropriate HTTP codes:
  - 200: Success (may have Access-Accept or Access-Reject)
  - 401: Invalid credentials
  - 403: Account restrictions (suspended, expired)
  - 404: Not found
  - 422: Validation error
  - 500: Server error


<!-- Setting up radius for logs -->

# ALTER TABLE radius.radpostauth ADD COLUMN reason VARCHAR(255) DEFAULT NULL;

- /etc/freeradius/3.0/mods-config/sql/main/mysql/queries.conf
- Look for the # post-auth
- update the postauth_query
