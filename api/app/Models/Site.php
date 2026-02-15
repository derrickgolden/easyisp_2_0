<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Site extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'location',
        'ip_address',
        'radius_secret',
        'notify_on_down',
        'is_online',
        'last_seen',
    ];

    protected $casts = [
        'notify_on_down' => 'boolean',
        'is_online' => 'boolean',
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
