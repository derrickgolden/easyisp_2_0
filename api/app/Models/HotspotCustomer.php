<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HotspotCustomer extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'site_id',
        'mac_address',
        'phone_number',
        'current_package_id',
        'status',
        'last_ip_address',
        'activated_at',
        'expires_at',
        'last_seen_at',
    ];

    protected $casts = [
        'activated_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function currentPackage()
    {
        return $this->belongsTo(Package::class, 'current_package_id');
    }
}
