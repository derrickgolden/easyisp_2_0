<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrganizationLicenseSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'snapshot_month',
        'active_users_count',
        'price_per_user',
        'active_pppoe_users_count',
        'price_per_pppoe_user',
        'pppoe_amount',
        'hotspot_payments',
        'hotspot_percentage',
        'hotspot_amount',
        'total_amount',
        'status',
        'billed_at',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'snapshot_month' => 'date',
        'price_per_user' => 'decimal:2',
        'price_per_pppoe_user' => 'decimal:2',
        'pppoe_amount' => 'decimal:2',
        'hotspot_payments' => 'decimal:2',
        'hotspot_percentage' => 'decimal:2',
        'hotspot_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'billed_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
