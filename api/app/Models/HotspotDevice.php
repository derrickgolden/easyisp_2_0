<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\HotspotCustomer;

class HotspotDevice extends Model
{
    protected $table = 'hotspot_devices';

    protected $fillable = [
        'device_token_hash',
        'current_mac',
        'previous_mac',
        'customer_id',
        'organization_id',
        'last_seen_at',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::saving(function (HotspotDevice $device) {
            // If organization_id is missing but we have a customer_id, backfill it from the customer.
            if (empty($device->organization_id) && !empty($device->customer_id)) {
                $customer = HotspotCustomer::find($device->customer_id);
                if ($customer && isset($customer->organization_id)) {
                    $device->organization_id = $customer->organization_id;
                }
            }
        });
    }
}
