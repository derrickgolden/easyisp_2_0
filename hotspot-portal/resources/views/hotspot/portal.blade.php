@extends('layouts.app')

@section('content')

<div class="container">

    <div class="logo">

        @if($organization->business_logo)
            <img src="{{ $organization->business_logo }}">
        @endif

        <h2>{{ $organization->name }}</h2>

    </div>

    <form method="POST" action="/pay">

        @csrf

        @if(session('success'))
            <div class="success-box">
                <p>{{ session('success') }}</p>
            </div>
        @endif

        @if($errors->any())
            <div class="error-box">
                @foreach($errors->all() as $error)
                    <p>{{ $error }}</p>
                @endforeach
            </div>
        @endif

        <input type="hidden" name="site_id" value="{{ $site->id }}">
        <input type="hidden" name="mac" value="{{ $mac }}">
        <input type="hidden" name="ip" value="{{ $ip }}">

        <label>Phone Number</label>

        <input
            type="text"
            name="phone"
            placeholder="07XXXXXXXX"
            required
        >

        @error('phone')
            <span class="field-error">{{ $message }}</span>
        @enderror

        <h3>Select Package</h3>

        @foreach($packages as $package)

            <div class="package">

                <strong>
                    {{ $package->name }}
                </strong>

                <br>

                KES {{ number_format($package->price) }}

                <br><br>

                <input
                    type="radio"
                    name="package_id"
                    value="{{ $package->id }}"
                    required
                >
            </div>

        @endforeach

        @error('package_id')
            <span class="field-error">{{ $message }}</span>
        @enderror

        <button type="submit">
            Pay with M-Pesa
        </button>

    </form>

</div>

@endsection