<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>EasyISP Customer Portal</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f5f7fb;
            color: #1f2937;
        }

        .container {
            width: min(100% - 32px, 700px);
            margin: 30px auto;
        }

        .header {
            margin-bottom: 20px;
        }

        .header h1 {
            margin: 0 0 5px;
        }

        .header p {
            margin: 0;
            color: #6b7280;
        }

        .card {
            background: white;
            border-radius: 14px;
            padding: 22px;
            margin-bottom: 16px;
            box-shadow: 0 4px 18px rgba(0,0,0,.06);
        }

        .package {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: center;
        }

        .package-name {
            font-size: 20px;
            font-weight: 700;
        }

        .price {
            font-size: 24px;
            font-weight: 700;
        }

        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 999px;
            background: #fee2e2;
            color: #991b1b;
            font-size: 13px;
            font-weight: 700;
        }

        .row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
        }

        .row:last-child {
            border-bottom: 0;
        }

        .btn {
            display: inline-block;
            width: 100%;
            padding: 14px;
            border: 0;
            border-radius: 10px;
            background: #111827;
            color: white;
            text-decoration: none;
            text-align: center;
            cursor: pointer;
            font-size: 16px;
            margin-top: 10px;
        }

        .btn-primary {
            background: #2563eb;
        }

        .alert {
            padding: 14px;
            border-radius: 10px;
            margin-bottom: 15px;
        }

        .success {
            background: #dcfce7;
            color: #166534;
        }

        .error {
            background: #fee2e2;
            color: #991b1b;
        }
    </style>
</head>

<body>

<div class="container">

    <div class="header">
        <h1>
            Welcome,
            {{ $customer['first_name'] ?? 'Customer' }}
        </h1>

        <p>
            EasyISP Customer Portal
        </p>
    </div>

    @if(session('success'))
        <div class="alert success">
            {{ session('success') }}
        </div>
    @endif

    @if(session('error'))
        <div class="alert error">
            {{ session('error') }}
        </div>
    @endif

    <div class="card">

        <span class="status">
            {{ strtoupper($customer['status'] ?? 'UNKNOWN') }}
        </span>

        <h2>Current Package</h2>

        @php
            $package = $customer['package'] ?? null;
        @endphp

        @if($package)

            <div class="package">

                <div>
                    <div class="package-name">
                        {{ $package['name'] ?? 'Package' }}
                    </div>

                    <div>
                        {{ $package['speed'] ?? '' }}
                    </div>
                </div>

                <div class="price">
                    KES
                    {{ number_format(
                        $package['price'] ?? 0
                    ) }}
                </div>

            </div>

        @else

            <p>
                No package information available.
            </p>

        @endif

    </div>


    <div class="card">

        <h2>Account</h2>

        <div class="row">
            <span>Username</span>
            <strong>
                {{ $customer['username'] ?? '-' }}
            </strong>
        </div>

        <div class="row">
            <span>Expiry</span>
            <strong>
                {{ $customer['expiry_date'] ?? '-' }}
            </strong>
        </div>

        <div class="row">
            <span>Balance</span>
            <strong>
                KES {{ number_format(
                    $customer['balance'] ?? 0
                ) }}
            </strong>
        </div>

    </div>


    <a
        href="{{ route('customer.packages') }}"
        class="btn btn-primary"
    >
        View Packages & Renew
    </a>

</div>

</body>
</html>