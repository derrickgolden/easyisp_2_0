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
        'total_amount',
        'status',
        'billed_at',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'snapshot_month' => 'date',
        'price_per_user' => 'decimal:2',
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
