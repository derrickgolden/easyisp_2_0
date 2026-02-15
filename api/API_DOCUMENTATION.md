# EasyISP Backend API Documentation

## Overview
Complete ISP management backend API built with Laravel 10 with comprehensive customer, package, payment, and ticket management features.

## Features Implemented

### 1. Authentication & Users
- **Register**: `POST /api/auth/register` - Create new organization and admin user
- **Login**: `POST /api/auth/login` - Authenticate and get API token
- **Logout**: `POST /api/auth/logout` - Revoke current token
- **Profile**: `GET /api/auth/me` - Get current user details
- **User Management**: Full CRUD operations for users within organization

### 2. Organization Management
- **Get Organization**: `GET /api/organization` - Get current organization details
- **Update Organization**: `PUT /api/organization` - Update settings and tier
- **View Details**: `GET /api/organization/{id}` - Get specific organization

### 3. Customer Management
- **List Customers**: `GET /api/customers` - Paginated customer list
- **Create Customer**: `POST /api/customers` - Add new customer
- **View Customer**: `GET /api/customers/{id}` - Get customer details with relationships
- **Update Customer**: `PUT /api/customers/{id}` - Modify customer info
- **Delete Customer**: `DELETE /api/customers/{id}` - Remove customer
- **Features**:
  - Sub-account hierarchy support
  - RADIUS integration (username/password)
  - IP and MAC address management
  - Connection type selection (PPPoE, Static IP, DHCP)
  - Balance tracking
  - Expiry date management

### 4. Package Management
- **List Packages**: `GET /api/packages` - View all packages
- **Create Package**: `POST /api/packages` - Create new service package
- **Update Package**: `PUT /api/packages/{id}` - Modify package details
- **Delete Package**: `DELETE /api/packages/{id}` - Remove package
- **Features**:
  - Speed configurations (upload/download)
  - Price and validity settings
  - Data/Time-based billing types
  - Burst settings (limit, threshold, time)

### 5. Site Management
- **List Sites**: `GET /api/sites` - Get all sites
- **Create Site**: `POST /api/sites` - Add new site
- **Update Site**: `PUT /api/sites/{id}` - Modify site settings
- **Delete Site**: `DELETE /api/sites/{id}` - Remove site
- **Features**:
  - Location management
  - IP address configuration
  - RADIUS secret storage
  - Downtime notification settings

### 6. Role & Permission Management
- **List Roles**: `GET /api/roles` - View organizational roles
- **Create Role**: `POST /api/roles` - Define new role with permissions
- **Update Role**: `PUT /api/roles/{id}` - Modify role and permissions
- **Delete Role**: `DELETE /api/roles/{id}` - Remove role
- **Features**:
  - JSON-based permission arrays
  - Hierarchical user assignment
  - Prevents deletion of roles with assigned users

### 7. Payment Management
- **List Payments**: `GET /api/payments` - View all payments
- **Create Payment**: `POST /api/payments` - Record M-Pesa payment
- **Update Payment**: `PUT /api/payments/{id}` - Update payment status
- **Get Customer Payments**: `GET /api/payments/customer/{customerId}`
- **Features**:
  - M-Pesa code tracking
  - Automatic customer balance update
  - Transaction generation on payment
  - Payment status tracking (pending/completed/reversed)

### 8. Transaction Management
- **List Transactions**: `GET /api/transactions` - View all transactions
- **View Transaction**: `GET /api/transactions/{id}` - Get transaction details
- **Get Customer Transactions**: `GET /api/transactions/customer/{customerId}`
- **Features**:
  - Credit/debit tracking
  - Balance before/after recording
  - Reference ID linking
  - Category and method classification

### 9. Ticket/Support System
- **List Tickets**: `GET /api/tickets` - View all support tickets
- **Create Ticket**: `POST /api/tickets` - Create new support ticket
- **Update Ticket**: `PUT /api/tickets/{id}` - Update ticket status/priority
- **Delete Ticket**: `DELETE /api/tickets/{id}` - Remove ticket
- **Get Customer Tickets**: `GET /api/tickets/customer/{customerId}`
- **Features**:
  - Priority levels (low/medium/high/critical)
  - Status tracking (open/in-progress/closed)
  - Customer association
  - Description and subject fields

## Database Schema

### Tables
1. **organizations** - ISP organizations with subscription tiers
2. **users** - Staff users with hierarchical structure
3. **roles** - Role definitions with JSON permissions
4. **customers** - End customers with RADIUS credentials
5. **packages** - Service packages with speeds and pricing
6. **sites** - Network sites with RADIUS servers
7. **payments** - Payment records (M-Pesa focused)
8. **transactions** - Ledger entries for customer accounts
9. **tickets** - Support tickets and issues

## Relationships

- Organization → Many Users, Customers, Packages, Sites, Payments, Transactions, Tickets, Roles
- User → Belongs to Organization, Role, Parent User (hierarchical)
- Customer → Belongs to Organization, Package, Site, Parent Customer (sub-accounts)
- Payment → Belongs to Organization, Customer
- Transaction → Belongs to Organization, Customer
- Ticket → Belongs to Organization, Customer
- Role → Belongs to Organization, Has Many Users

## Test Data

The seeder creates:
- 1 Organization (Easy Tech ISP)
- 3 Users (Admin, Manager, Staff) with hierarchy
- 3 Roles (Admin, Manager, Staff) with different permissions
- 2 Sites (Nairobi, Mombasa)
- 3 Packages (Basic, Premium, Enterprise)
- 3 Customers including sub-account structure
- 2 Payments (completed M-Pesa transactions)
- 2 Transactions (customer account ledger)
- 3 Support Tickets (various priority levels)

## Test Credentials

**Admin User:**
- Email: `admin@easyisp.local`
- Password: `password123`

**Manager User:**
- Email: `manager@easyisp.local`
- Password: `password123`

**Staff User:**
- Email: `staff@easyisp.local`
- Password: `password123`

## Usage Examples

### Register New Organization
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "My ISP Co",
    "name": "John Admin",
    "email": "john@myisp.local",
    "password": "secure123",
    "password_confirmation": "secure123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@easyisp.local",
    "password": "password123"
  }'
```

### Create Customer (with auth token)
```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+254712345600",
    "email": "jane@example.com",
    "location": "Nairobi",
    "package_id": 1,
    "site_id": 1,
    "radius_username": "janedoe",
    "radius_password": "secure123",
    "expiry_date": "2026-02-23"
  }'
```

### Record Payment
```bash
curl -X POST http://localhost:8000/api/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "mpesa_code": "RDJ12345ABC",
    "amount": 500,
    "phone": "+254712345681",
    "sender_name": "John Doe"
  }'
```

### C2B Paybill Testing (Live)
To test in real life you must use Safaricom Daraja live credentials and a live Paybill short code.

**1) Register callback URLs (Daraja C2B Register URL)**
- Validation URL: `https://YOUR_DOMAIN/api/payments/c2b/validation`
- Confirmation URL: `https://YOUR_DOMAIN/api/payments/c2b/confirmation`

**2) Configure Paybill shortcode in organization settings**
Set the paybill shortcode under:
`settings.payment-gateway.paybill_short_code`

**3) Send a real Paybill payment**
Use the account reference as either:
- Customer ID (numeric)
- Customer RADIUS username

**4) Verify results**
- Known customer → payment is `completed`, balance updated, expired users auto-activated
- Unknown customer → payment is `pending`

**Optional review endpoints**
- List pending: `GET /api/payments/pending`
- Resolve pending: `POST /api/payments/{id}/resolve` with `{ "customer_id": 123 }`

### Create Support Ticket
```bash
curl -X POST http://localhost:8000/api/tickets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "subject": "Internet connection issue",
    "description": "Connection drops frequently",
    "priority": "high"
  }'
```

## API Pagination
All list endpoints support pagination with default of 15 items per page:
```bash
GET /api/customers?page=2
```

## Error Handling
- Validation errors return 422 with error details
- Not found errors return 404
- Server errors return 500
- Authentication errors return 401

## Authentication
All protected endpoints require Bearer token in Authorization header:
```
Authorization: Bearer {token}
```

Tokens are generated using Laravel Sanctum and are valid until revoked.

## Running the Backend

### Prerequisites
- PHP 8.1+
- Composer
- SQLite or MySQL

### Setup
```bash
cd easyisp-api
composer install
php artisan migrate:fresh --seed
php artisan serve --host=0.0.0.0 --port=8000
```

### Available Commands
```bash
php artisan migrate          # Run migrations
php artisan migrate:fresh    # Reset and run migrations
php artisan db:seed          # Seed test data
php artisan tinker           # Laravel REPL
```

## Features Summary
✅ Complete CRUD operations for all entities
✅ Role-based access control setup
✅ M-Pesa payment integration framework
✅ Customer hierarchy/sub-accounts
✅ RADIUS credential management
✅ Transaction ledger system
✅ Support ticket system
✅ Automatic balance updates on payments
✅ Comprehensive database relationships
✅ Test data seeding
✅ API authentication with Sanctum
✅ Validation on all endpoints

## Next Steps (Optional Enhancements)
- Add authorization policies (middleware)
- Implement rate limiting
- Add API documentation (Swagger/OpenAPI)
- Add webhook support for payment notifications
- Add RADIUS server integration
- Add email notifications
- Add audit logging
- Add customer notifications via SMS/Email
