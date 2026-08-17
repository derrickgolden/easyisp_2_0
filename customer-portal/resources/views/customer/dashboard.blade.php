<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Portal - {{ $customer['first_name'] ?? 'Account' }}</title>
    <!-- Inter Font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <!-- <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"> -->

    <style>
        :root {
            --mpesa-green: #25d366;
            --mpesa-dark: #128c7e;
            --brand-primary: #10b981;
            --brand-primary-hover: #059669;
            --bg-body: #f3f4f6;
            --text-main: #1f2937;
            --text-muted: #6b7280;
            --card-bg: #ffffff;
            --border-color: #e5e7eb;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            /* font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; */
            background-color: var(--bg-body);
            color: var(--text-main);
            line-height: 1.5;
            padding: 20px 12px;
        }

        .portal-wrapper {
            max-width: 480px;
            margin: 0 auto;
        }

        /* Top Header */
        .portal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 0 4px;
        }

        .portal-brand h1 {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
        }

        .portal-brand p {
            font-size: 13px;
            color: var(--text-muted);
        }

        .badge-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-expired, .status-unknown {
            background-color: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }

        .status-active {
            background-color: #ecfdf5;
            color: #059669;
            border: 1px solid #a7f3d0;
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: currentColor;
        }

        /* Alert Messages */
        .alert {
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 14px;
            margin-bottom: 16px;
            font-weight: 500;
        }
        .alert-success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
        .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

        /* General Card */
        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.02);
            border: 1px solid var(--border-color);
        }

        /* Package Details */
        .package-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px dashed var(--border-color);
        }

        .package-title {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
        }

        .package-speed {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .package-price {
            font-size: 22px;
            font-weight: 800;
            color: var(--brand-primary);
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            padding: 6px 0;
            color: var(--text-muted);
        }

        .info-row strong {
            color: var(--text-main);
        }

        /* STK Push Form */
        .stk-card {
            border: 2px solid #a7f3d0;
            background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
        }

        .stk-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            font-weight: 700;
            color: #065f46;
            margin-bottom: 12px;
        }

        .stk-title img {
            height: 22px;
        }

        .form-group {
            margin-bottom: 14px;
        }

        .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.025em;
        }

        .input-phone {
            width: 100%;
            padding: 12px 14px;
            font-size: 16px;
            font-weight: 600;
            border: 1.5px solid var(--border-color);
            border-radius: 10px;
            outline: none;
            transition: all 0.2s ease;
            background-color: #ffffff;
        }

        .input-phone:focus {
            border-color: var(--brand-primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
        }

        .btn-stk {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 10px;
            background-color: var(--brand-primary);
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-stk:hover {
            background-color: var(--brand-primary-hover);
        }

        /* Manual Payment Box */
        .manual-pay-box {
            background-color: #f9fafb;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            margin-top: 10px;
        }

        .manual-pay-title {
            font-size: 14px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .pay-detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
        }

        .pay-detail-card {
            background: #ffffff;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px;
            position: relative;
        }

        .pay-detail-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
        }

        .pay-detail-value {
            font-size: 15px;
            font-weight: 700;
            color: #111827;
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .btn-copy {
            background: #f3f4f6;
            border: none;
            color: var(--text-muted);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            font-weight: 600;
        }

        .btn-copy:hover {
            background: #e5e7eb;
            color: var(--text-main);
        }

        .manual-instructions {
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.4;
        }

        .manual-instructions ol {
            padding-left: 18px;
            margin-top: 6px;
        }

        .btn-outline {
            display: block;
            width: 100%;
            padding: 12px;
            border: 1.5px solid var(--border-color);
            border-radius: 10px;
            background: white;
            color: var(--text-main);
            text-align: center;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            margin-top: 12px;
            transition: all 0.2s ease;
        }

        .btn-outline:hover {
            background: #f9fafb;
            border-color: #d1d5db;
        }

        /* Toast Popup for Copying */
        #toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #111827;
            color: #fff;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 1000;
        }
    </style>
</head>
<body>

<div class="portal-wrapper">

    <!-- Portal Top Header -->
    <div class="portal-header">
        <div class="portal-brand">
            <h1>Hi, {{ $customer['first_name'] ?? 'Subscriber' }}</h1>
            <p>EasyISP Network Access</p>
        </div>
        
        @php
            $status = strtolower($customer['status'] ?? 'unknown');
        @endphp
        <span class="badge-status status-{{ $status }}">
            <span class="status-dot"></span>
            {{ strtoupper($status) }}
        </span>
    </div>

    <!-- Alert Notifications -->
    @if(session('success'))
        <div class="alert alert-success">
            {{ session('success') }}
        </div>
    @endif

    @if(session('error'))
        <div class="alert alert-error">
            {{ session('error') }}
        </div>
    @endif

    <!-- Current Package Overview -->
    <div class="card">
        @php
            $package = $customer['package'] ?? null;
        @endphp

        @if($package)
            <div class="package-header">
                <div>
                    <div class="package-title">{{ $package['name'] ?? 'Internet Package' }}</div>
                    <div class="package-speed">{{ $package['speed'] ?? 'High Speed Internet' }}</div>
                </div>
                <div class="package-price">
                    <small style="font-size: 12px; font-weight: 500;">KES</small> 
                    {{ number_format($package['price'] ?? 0) }}
                </div>
            </div>

            <div class="info-row">
                <span>Account/Username</span>
                <strong>{{ $customer['radius_username'] ?? $customer['username'] ?? '-' }}</strong>
            </div>
            @if(isset($customer['expiry_date']))
            <div class="info-row">
                <span>Current Expiry</span>
                <strong>{{ $customer['expiry_date'] }}</strong>
            </div>
            @endif
        @else
            <p style="color: var(--text-muted); font-size: 14px; text-align: center;">
                No active package selected.
            </p>
        @endif
    </div>

    <!-- Express M-Pesa STK Push Form -->
    <div class="card stk-card">
        <div class="stk-title">
            <span>⚡ Express M-Pesa Renewal</span>
        </div>

        <form method="POST" action="{{ route('customer.pay') }}" id="stkForm">
            @csrf

            <input type="hidden" name="package_id" value="{{ $customer['package']['id'] ?? '' }}">
            <input type="hidden" name="amount" value="{{ $customer['package']['price'] ?? 0 }}">
            <input type="hidden" name="radius_username" value="{{ $customer['radius_username'] ?? '' }}">
            <input type="hidden" name="account_reference" value="{{ $customer['radius_username'] ?? '' }}">

            <div class="form-group">
                <label class="form-label">M-Pesa Phone Number</label>
                <input 
                    type="tel" 
                    name="phone" 
                    class="input-phone" 
                    placeholder="e.g. 0712345678" 
                    value="{{ $customer['phone'] ?? '' }}" 
                    required
                >
            </div>

            <button type="submit" class="btn-stk" id="stkBtn">
                <span>Pay KES {{ number_format($customer['package']['price'] ?? 0) }} via M-Pesa</span>
            </button>
        </form>
    </div>

    <!-- Manual Payment Section (Fallback/Later Payment) -->
    <div class="card">
        <div class="manual-pay-title">
            <span>Pay Later via M-Pesa Menu</span>
            <small style="font-size: 11px; color: var(--text-muted); font-weight: normal;">Manual Option</small>
        </div>

        <div class="pay-detail-grid">
            <!-- Paybill / Till Number -->
            <div class="pay-detail-card">
                <div class="pay-detail-label">
                    {{ $payment_gateway['type'] ?? 'Paybill' }}
                </div>
                <div class="pay-detail-value">
                    <span id="paybillVal">{{ $payment_gateway['paybill'] ?? '123456' }}</span>
                    <button class="btn-copy" onclick="copyText('paybillVal')">Copy</button>
                </div>
            </div>

            <!-- Account Reference -->
            <div class="pay-detail-card">
                <div class="pay-detail-label">Account No.</div>
                <div class="pay-detail-value">
                    <span id="accountVal">{{ $customer['radius_username'] ?? 'ACC001' }}</span>
                    <button class="btn-copy" onclick="copyText('accountVal')">Copy</button>
                </div>
            </div>
        </div>

        <div class="manual-instructions">
            <strong>How to pay manually:</strong>
            <ol>
                <li>Go to M-Pesa menu > <strong>Lipa na M-Pesa</strong>.</li>
                <li>Select <strong>Pay Bill</strong> and enter Business No. <strong>{{ $payment_gateway['paybill'] ?? '123456' }}</strong>.</li>
                <li>Enter Account No. <strong>{{ $customer['radius_username'] ?? 'ACC001' }}</strong>.</li>
                <li>Enter Amount <strong>KES {{ number_format($customer['package']['price'] ?? 0) }}</strong> and enter PIN.</li>
            </ol>
        </div>
    </div>

    <!-- Action Link -->
    <!-- <a href="{{ route('customer.packages') }}" class="btn-outline">
        Change / View Available Packages
    </a> -->

</div>

<!-- Copy Toast Notification -->
<div id="toast">Copied to clipboard!</div>

<script>
    // Copy to Clipboard Utility
    function copyText(elementId) {
        const text = document.getElementById(elementId).innerText;
        navigator.clipboard.writeText(text).then(() => {
            const toast = document.getElementById('toast');
            toast.style.opacity = '1';
            setTimeout(() => {
                toast.style.opacity = '0';
            }, 2000);
        });
    }

    // Submit state feedback
    document.getElementById('stkForm')?.addEventListener('submit', function() {
        const btn = document.getElementById('stkBtn');
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.innerHTML = '<span>Sending STK Push Prompt...</span>';
    });
</script>

</body>
</html>