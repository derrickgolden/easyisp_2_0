<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HotspotDevice extends Model
{
    protected $table = 'hotspot_devices';

    protected $fillable = [
        'device_token_hash',
        'current_mac',
        'previous_mac',
        'customer_id',
        'last_seen_at',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
    ];
}
