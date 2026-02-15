<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'speed_up',
        'speed_down',
        'price',
        'validity_days',
        'type',
        'burst_limit_up',
        'burst_limit_down',
        'burst_threshold_up',
        'burst_threshold_down',
        'burst_time',
        'priority',     // Add this
        'min_limit_up', // Add this
        'min_limit_down'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'id' => 'string',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }
}
