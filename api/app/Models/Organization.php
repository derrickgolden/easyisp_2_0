<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'acronym',
        'subscription_tier',
        'status',
        'client_type',
        'balance',
        'mpesa_callback_token',
        'settings',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'settings' => 'array',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function packages()
    {
        return $this->hasMany(Package::class);
    }

    public function sites()
    {
        return $this->hasMany(Site::class);
    }

    public function roles()
    {
        return $this->hasMany(Role::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function licenseSnapshots()
    {
        return $this->hasMany(OrganizationLicenseSnapshot::class);
    }

    public function latestLicenseSnapshot()
    {
        return $this->hasOne(OrganizationLicenseSnapshot::class)->latestOfMany('snapshot_month');
    }

    public function paymentGateways()
    {
        return $this->hasMany(OrganizationPaymentGateway::class);
    }

    public function defaultPaymentGateway()
    {
        return $this->hasOne(OrganizationPaymentGateway::class)->where('is_default', true);
    }

    public function getPaymentGatewayConfig(?string $provider = null): array
    {
        $query = $this->paymentGateways()->where('active', true);

        if ($provider) {
            $query->where('provider', $provider);
        } else {
            $query->where('is_default', true);
        }

        $gateway = $query->first();

        if (!$gateway && $provider) {
            $gateway = $this->paymentGateways()->where('active', true)->where('provider', $provider)->first();
        }

        if (!$gateway && !$provider) {
            $gateway = $this->paymentGateways()->where('active', true)->first();
        }

        if ($gateway) {
            $cfg = (array) ($gateway->config ?? []);
            $cfg['provider'] = $gateway->provider;
            return $cfg;
        }

        // Fallback to legacy organization.settings.payment-gateway only if no DB gateway exists.
        $raw = $this->settings ?? [];
        $paymentGateway = data_get($raw, 'payment-gateway');
        if (is_array($paymentGateway)) {
            if ($provider) {
                $providerConfig = data_get($paymentGateway, $provider);
                if (is_array($providerConfig)) {
                    return array_merge($providerConfig, ['provider' => $provider]);
                }
            }

            return $paymentGateway;
        }

        if (is_string($paymentGateway)) {
            $decoded = json_decode($paymentGateway, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                if ($provider) {
                    $providerConfig = data_get($decoded, $provider);
                    if (is_array($providerConfig)) {
                        return array_merge($providerConfig, ['provider' => $provider]);
                    }
                }

                return $decoded;
            }
        }

        return [];
    }
}
