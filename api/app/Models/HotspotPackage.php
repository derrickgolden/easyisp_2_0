<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HotspotPackage extends Model
{
    use HasFactory;

    protected $table = 'packages';

    protected $fillable = [
        'organization_id',
        'name',
        'radius_group',
        'attributes',
        'speed_up',
        'speed_down',
        'price',
        'validity',
        'validity_type',
        'type',
        'data_limit_mb',
        'session_timeout',
        'idle_timeout',
        'shared_users',
        'expires_at',
        'mikrotik_profile',
        'is_voucher',
        'status',
        'burst_limit_up',
        'burst_limit_down',
        'burst_threshold_up',
        'burst_threshold_down',
        'burst_time',
        'priority',
        'min_limit_up',
        'min_limit_down',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'id' => 'string',
        'attributes' => 'array',
        'expires_at' => 'datetime',
        'is_voucher' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope('hotspot', function ($query) {
            $query->where('status', 'hotspot');
        });

        static::creating(function (self $model) {
            $model->status = 'hotspot';
        });
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
