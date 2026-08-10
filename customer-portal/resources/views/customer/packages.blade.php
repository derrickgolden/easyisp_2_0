<!DOCTYPE html>
<html lang="en">
<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>Internet Packages - EasyISP</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f5f7fb;
        }

        .container {
            width: min(100% - 32px, 900px);
            margin: 25px auto;
        }

        .header {
            margin-bottom: 20px;
        }

        .packages {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(240px, 1fr));

            gap: 16px;
        }

        .card {
            background: white;
            padding: 20px;
            border-radius: 14px;
            box-shadow: 0 4px 18px rgba(0,0,0,.06);
        }

        .current {
            border: 2px solid #2563eb;
            background: #f0f9ff;
        }

        .name {
            font-size: 20px;
            font-weight: 700;
        }

        .speed {
            color: #6b7280;
            margin-top: 8px;
        }

        .price {
            font-size: 28px;
            font-weight: 700;
            margin: 18px 0;
        }

        button {
            width: 100%;
            border: 0;
            padding: 13px;
            border-radius: 9px;
            background: #2563eb;
            color: white;
            cursor: pointer;
            font-size: 15px;
        }

        button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }

        input {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .current-label {
            color: #34860d;
            font-size: 18px;
            font-weight: 700;
        }

    </style>

</head>

<body>

<div class="container">

    <div class="header">

        <h1>
            Internet Packages
        </h1>

        <p>
            Current package:
            <strong>
                {{ $customer['package']['name'] ?? 'None' }}
            </strong>
        </p>

    </div>


    <div class="packages">

        @foreach($packages as $package)

            @php
                $current =
                    ($customer['package_id'] ?? null)
                    == ($package['id'] ?? null);
            @endphp

            <div class="card {{ $current ? 'current' : '' }}">

                @if($current)
                    <div class="current-label">
                        CURRENT PACKAGE
                    </div>
                @endif

                <div class="name">
                    {{ $package['name'] ?? 'Package' }}
                </div>

                <div class="speed">
                    {{ $package['speed'] ?? '' }}
                </div>

                <div class="price">
                    KES
                    {{ number_format(
                        $package['price'] ?? 0
                    ) }}
                </div>


                @if(!$current)

                    <form
                        method="POST"
                        action="{{ route('customer.pay') }}"
                    >

                        @csrf

                        <input
                            type="hidden"
                            name="package_id"
                            value="{{ $package['id'] }}"
                        >

                        <input
                            type="tel"
                            name="phone"
                            placeholder="M-Pesa phone number"
                            value="{{ $customer['phone'] ?? '' }}"
                            required
                        >

                        <button type="submit">
                            Pay & Activate
                        </button>

                    </form>

                @else

                    <form
                        method="POST"
                        action="{{ route('customer.pay') }}"
                    >

                        @csrf

                        <input
                            type="hidden"
                            name="package_id"
                            value="{{ $package['id'] }}"
                        >

                        <input
                            type="tel"
                            name="phone"
                            placeholder="M-Pesa phone number"
                            value="{{ $customer['phone'] ?? '' }}"
                            required
                        >

                        <button type="submit" style="background: #3b694a; font-size: 20px; font-weight: 600;" >
                            Renew Current Package
                        </button>

                    </form>

                @endif

            </div>

        @endforeach

    </div>

</div>

</body>
</html>