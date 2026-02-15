# RADIUS WiFi Authentication Testing Guide

## Quick Start: Test Existing Customers

### Pre-seeded Test Customers

The database is already populated with 3 test customers who have WiFi credentials:

| Customer Name | RADIUS Username | RADIUS Password | Status | Package | Expiry Date |
|---|---|---|---|---|---|
| Jane Smith | janesmith | securepass456 | active | Premium Package | 2026-02-25 |
| John Doe | johndoe | securepass123 | active | Basic Package | 2026-02-20 |
| Bob Johnson | bobjohnson | securepass789 | active | Basic Package | 2026-02-20 |

### Step 1: Test RADIUS Authentication (cURL Command)

**Test successful authentication:**

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "janesmith",
    "password": "securepass456"
  }'
```

**Expected Response:**
```json
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
```

---

**Test invalid password:**

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "janesmith",
    "password": "wrongpassword"
  }'
```

**Expected Response:**
```json
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

---

**Test non-existent user:**

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nonexistent",
    "password": "password"
  }'
```

**Expected Response:**
```json
{
  "message": "Authentication failed",
  "status": "Access-Reject"
}
```

---

**Test expired account:**

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "securepass123"
  }'
```

(Will succeed if account isn't actually expired, or will return Access-Reject if expiry date is past)

---

## Step 2: Test via Frontend (RadiusTestPanel)

The frontend has a RADIUS Testing Panel that provides a user interface for testing:

1. **Start Frontend Dev Server:**
   ```bash
   cd easyisp-frontend
   npm run dev
   ```

2. **Login to Dashboard:**
   - Go to http://localhost:3002
   - Login with test credentials (from Users table)

3. **Find RADIUS Test Panel:**
   - Look for "WiFi Authentication Test" section
   - Or navigate to `/radius-test` route

4. **Test a Customer:**
   - Select "Jane Smith" from customer dropdown
   - Click "Test WiFi Access"
   - View the authentication result

5. **Manual Credential Test:**
   - Enter username: `janesmith`
   - Enter password: `securepass456`
   - Click "Test Credentials"
   - See Access-Accept response

---

## Step 3: Create New Customer and Test WiFi Access

### Via API (cURL)

**First, get an authentication token:**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@easyisp.local",
    "password": "password"
  }'
```

**Response will include:**
```json
{
  "token": "xxxxx|yyyyyy",
  "user": { ... }
}
```

---

**Create a new customer:**

```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
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
    "expiry_date": "2026-03-24",
    "balance": 0,
    "radius_username": "alice_wonder",
    "radius_password": "alice_secure_pass_123",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "is_independent": true
  }'
```

**Response:**
```json
{
  "message": "Customer created successfully",
  "customer": {
    "id": 4,
    "first_name": "Alice",
    "last_name": "Wonder",
    "phone": "+254712345678",
    "email": "alice@example.com",
    "radius_username": "alice_wonder",
    "radius_password": "alice_secure_pass_123",
    "status": "active",
    "expiry_date": "2026-03-24",
    "connection_type": "Static IP",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "package": { ... },
    "site": { ... }
  }
}
```

---

**Test new customer RADIUS authentication:**

```bash
curl -X POST http://localhost:8000/api/radius/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_wonder",
    "password": "alice_secure_pass_123"
  }'
```

**Expected Response (Access-Accept):**
```json
{
  "message": "Authentication successful",
  "status": "Access-Accept",
  "customer": {
    "id": 4,
    "name": "Alice Wonder",
    "username": "alice_wonder",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "status": "active",
    "expiry_date": "2026-03-24"
  }
}
```

**🎉 Congratulations! WiFi authentication is working!**

---

## Step 4: Test Customer WiFi Access Verification

**After login, verify customer has WiFi access:**

```bash
curl -X GET http://localhost:8000/api/radius/customer/4/wifi-access \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response (if customer has access):**
```json
{
  "has_access": true,
  "wifi_credentials": {
    "username": "alice_wonder",
    "password": "alice_secure_pass_123",
    "connection_type": "Static IP"
  },
  "network_config": {
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "site_ip": "192.168.1.1"
  },
  "package_details": {
    "name": "Basic Package",
    "speed_up": "5Mbps",
    "speed_down": "20Mbps"
  }
}
```

---

## Step 5: Get Customer RADIUS Configuration

**Get full RADIUS config for customer:**

```bash
curl -X GET http://localhost:8000/api/radius/customer/4/config
```

**Response:**
```json
{
  "customer": {
    "id": 4,
    "name": "Alice Wonder",
    "radius_username": "alice_wonder",
    "radius_password": "alice_secure_pass_123",
    "ip_address": "10.0.0.10",
    "mac_address": "AA:BB:CC:DD:EE:FF"
  },
  "package": {
    "name": "Basic Package",
    "speed_up": "5Mbps",
    "speed_down": "20Mbps",
    "type": "time",
    "validity_days": 30
  },
  "site": {
    "name": "Main Site",
    "location": "Nairobi CBD",
    "ip_address": "192.168.1.1",
    "radius_secret": "secret123"
  }
}
```

---

## Testing Checklist

Use this checklist to verify RADIUS is working end-to-end:

- [ ] **Test 1: Existing Customer Login**
  - [ ] janesmith + securepass456 → Access-Accept
  - [ ] janesmith + wrongpass → Access-Reject
  
- [ ] **Test 2: Valid Customer, Invalid Password**
  - [ ] johndoe + securepass123 → Access-Accept
  - [ ] johndoe + wrongpass → Access-Reject

- [ ] **Test 3: Non-existent User**
  - [ ] randomuser + password → Access-Reject

- [ ] **Test 4: Create New Customer**
  - [ ] Create customer via API with RADIUS credentials
  - [ ] Verify customer stored in database
  - [ ] Verify radius_username and radius_password fields populated

- [ ] **Test 5: New Customer WiFi Auth**
  - [ ] Test new customer RADIUS credentials
  - [ ] Verify Access-Accept response
  - [ ] Verify customer data in response

- [ ] **Test 6: Customer WiFi Access Verification**
  - [ ] Call /radius/customer/{id}/wifi-access
  - [ ] Verify has_access = true
  - [ ] Verify wifi_credentials returned

- [ ] **Test 7: Expired Account**
  - [ ] Update customer expiry_date to past date
  - [ ] Attempt authentication
  - [ ] Verify Access-Reject response

- [ ] **Test 8: Suspended Account**
  - [ ] Update customer status to "suspended"
  - [ ] Attempt authentication
  - [ ] Verify Access-Reject response

---

## Troubleshooting

### Issue: "Customer not found" 

**Cause:** RADIUS username doesn't exist in database

**Solution:** 
- Check customer table: `SELECT * FROM customers WHERE radius_username = 'janesmith';`
- Verify customer was created with radius_username

---

### Issue: Authentication successful but WiFi still not working

**Cause:** WiFi Access Point not configured to use EasyISP API

**Solution:**
1. Configure WiFi AP to send auth requests to EasyISP API RADIUS endpoint
2. Or use FreeRADIUS as intermediary that forwards to EasyISP API

---

### Issue: "Access-Reject" for valid credentials

**Cause:** Customer status is not "active" or subscription is expired

**Solution:**
1. Check customer status: `SELECT status, expiry_date FROM customers WHERE id = 1;`
2. Update if needed: `UPDATE customers SET status = 'active', expiry_date = '2026-12-31' WHERE id = 1;`

---

### Issue: CORS error when testing from frontend

**Cause:** Frontend domain not allowed in CORS config

**Solution:**
- Add localhost:3002 to CORS whitelist in config/cors.php
- Restart backend server

---

## Performance Testing

### Test 100 Simultaneous Connections

```bash
for i in {1..100}; do
  curl -X POST http://localhost:8000/api/radius/authenticate \
    -H "Content-Type: application/json" \
    -d '{
      "username": "janesmith",
      "password": "securepass456"
    }' &
done
wait
```

### Expected Result:
- All requests should complete successfully
- Response time < 200ms per request
- No "Access-Reject" from server overload

---

## Next Steps

1. ✅ **RADIUS Authentication Working** - Customers can authenticate with credentials
2. 🔄 **Setup WiFi Access Point** - Configure AP to use EasyISP RADIUS endpoint
3. 📱 **Test Device Connection** - Connect phone/laptop to WiFi hotspot and authenticate
4. 📊 **Monitor Usage** - Track bandwidth and sessions in admin dashboard
5. 🔐 **Security Hardening** - Add rate limiting, password hashing, HTTPS enforcement

---

## API Reference Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/radius/authenticate` | POST | None | WiFi device authentication |
| `/api/radius/customer/{id}/config` | GET | None | Get customer RADIUS config |
| `/api/radius/customer/{id}/wifi-access` | GET | Bearer | Check if customer has WiFi access |
| `/api/radius/customer/{id}/verify` | POST | Bearer | Verify customer credentials |
| `/api/customers` | POST | Bearer | Create new customer with WiFi |
| `/api/customers/{id}` | GET | Bearer | Get customer with WiFi details |
| `/api/customers/{id}` | PUT | Bearer | Update customer (incl. RADIUS creds) |

