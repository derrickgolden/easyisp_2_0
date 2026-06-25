<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HotspotPayment extends Model
{
    use HasFactory;

    protected $table = 'hotspot_payments';

    protected $fillable = [
        'organization_id',
        'site_id',
        'package_id',
        'phone',
        'mac_address',
        'ip_address',
        'amount',
        'account_reference',
        'checkout_request_id',
        'mpesa_receipt',
        'status',
        'expires_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'expires_at' => 'datetime',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }
}
