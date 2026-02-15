# 🚀 QUICKSTART - EasyISP Full Stack

## Start the Application (2 commands)

**Terminal 1:**
```bash
cd /code/easyisp2.0/easyisp-api
php artisan serve --host=0.0.0.0 --port=8000
```

**Terminal 2:**
```bash
cd /code/easyisp2.0/easyisp-frontend
npm run dev
```

## Login & Access

- **URL:** http://localhost:3002
- **Email:** admin@easyisp.local
- **Password:** password123

## What's Working

✅ **Authentication** - Login with JWT tokens
✅ **Customers** - Full CRUD operations
✅ **Packages** - Create and manage packages
✅ **Sites** - Network site management
✅ **Payments** - Record and track payments
✅ **Transactions** - Full ledger history
✅ **Tickets** - Support ticket system
✅ **Users & Roles** - Access control
✅ **Real-time Data** - Auto-loaded after login
✅ **Beautiful UI** - Dark/light theme

## API Endpoints

All endpoints authenticated with JWT token in `Authorization: Bearer {token}` header

### Auth
```
POST   /api/auth/register        - Create account
POST   /api/auth/login           - Login
POST   /api/auth/logout          - Logout
GET    /api/auth/me              - Current user
```

### Customers
```
GET    /api/customers            - List all
POST   /api/customers            - Create
GET    /api/customers/{id}       - Get one
PUT    /api/customers/{id}       - Update
DELETE /api/customers/{id}       - Delete
```

### Packages
```
GET    /api/packages
POST   /api/packages
PUT    /api/packages/{id}
DELETE /api/packages/{id}
```

### Sites
```
GET    /api/sites
POST   /api/sites
PUT    /api/sites/{id}
DELETE /api/sites/{id}
```

### Payments
```
GET    /api/payments
GET    /api/payments/customer/{id}
POST   /api/payments
PUT    /api/payments/{id}
DELETE /api/payments/{id}
```

### Transactions
```
GET    /api/transactions
GET    /api/transactions/customer/{id}
GET    /api/transactions/{id}
```

### Tickets
```
GET    /api/tickets
GET    /api/tickets/customer/{id}
POST   /api/tickets
PUT    /api/tickets/{id}
DELETE /api/tickets/{id}
```

### Users
```
GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
```

### Roles
```
GET    /api/roles
POST   /api/roles
PUT    /api/roles/{id}
DELETE /api/roles/{id}
```

### Organization
```
GET    /api/organization
PUT    /api/organization
```

## Test Credentials (Pre-seeded)

| Role    | Email                | Password     |
|---------|----------------------|--------------|
| Admin   | admin@easyisp.local  | password123  |
| Manager | manager@easyisp.local| password123  |
| Staff   | staff@easyisp.local  | password123  |

## Test Data Included

- 1 Organization: "Easy Tech ISP"
- 3 Users with hierarchy
- 3 Roles: Admin, Manager, Staff
- 2 Network Sites (Nairobi, Mombasa)
- 3 Internet Packages (Basic, Premium, Enterprise)
- 3 Customers (with sub-account example)
- 2 Completed M-Pesa Payments
- 2 Transaction ledger entries
- 3 Support Tickets

## Reset Database

```bash
cd easyisp-api
php artisan migrate:fresh --seed
```

## Frontend Files

- **API Client:** `easyisp-frontend/src/services/apiService.ts`
- **Main App:** `easyisp-frontend/src/App.tsx`
- **Login Page:** `easyisp-frontend/src/pages/LoginPage.tsx`
- **Package:** `easyisp-frontend/package.json`

## Backend Files

- **API Routes:** `easyisp-api/routes/api.php`
- **Auth Controller:** `easyisp-api/app/Http/Controllers/Api/AuthController.php`
- **Models:** `easyisp-api/app/Models/`
- **Controllers:** `easyisp-api/app/Http/Controllers/Api/`
- **Config:** `easyisp-api/config/cors.php`
- **Database:** `easyisp-api/database/`

## Ports

- **Frontend:** 3002 (or next available)
- **API:** 8000

## Key Features

### Security
- ✅ JWT token authentication
- ✅ CORS enabled for frontend
- ✅ Password hashing
- ✅ Token-based API auth

### Data Validation
- ✅ Email uniqueness validation
- ✅ Required field validation
- ✅ Date format validation
- ✅ Numeric validation for prices

### Error Handling
- ✅ Validation error messages (422)
- ✅ Not found responses (404)
- ✅ Server error handling (500)
- ✅ Network error handling

### Database Features
- ✅ Foreign key constraints
- ✅ Cascade deletes
- ✅ Timestamps (created_at, updated_at)
- ✅ Custom relationships

## Usage Example

### 1. Register New Organization
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "My ISP",
    "name": "John Admin",
    "email": "john@myisp.local",
    "password": "secure123",
    "password_confirmation": "secure123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@easyisp.local",
    "password": "password123"
  }'
```

Response includes `token` - use this for authenticated requests.

### 3. Create Customer
```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+254712345678",
    "email": "john@example.com",
    "location": "Nairobi",
    "package_id": 1,
    "site_id": 1,
    "radius_username": "johndoe",
    "radius_password": "password123",
    "expiry_date": "2026-02-23"
  }'
```

## Documentation

- **Full API Docs:** [easyisp-api/API_DOCUMENTATION.md](easyisp-api/API_DOCUMENTATION.md)
- **Integration Guide:** [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **This Guide:** [QUICKSTART.md](QUICKSTART.md)

---

**Your EasyISP application is fully functional and ready to use! 🎉**
