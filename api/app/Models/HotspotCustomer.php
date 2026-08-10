<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HotspotCustomer extends Model
{
    use HasFactory;

    protected $table = 'hotspot_customers';

    protected $fillable = [
        'organization_id',
        'parent_id',
        'site_id',
        'mac_address',
        'phone',
        'first_name',
        'last_name',
        'email',
        'location',
        'apartment',
        'house_no',
        'connection_type',
        'installation_fee',
        'package_id',
        'custom_package_price',
        'status',
        'expiry_date',
        'extension_date',
        'activated_at',
        'expiry_one_hour_warning_sent_at',
        'expiry_warning_sent_at',
        'expiry_ten_minutes_warning_sent_at',
        'balance',
        'paused_seconds_remaining',
        'is_independent',
        'radius_username',
        'radius_password',
        'ip_address',
        'mac_address',
        'host_name',
        'device_name',
        'browser_name',
        'os_platform',
        'password',
        'f_identity',
        'remember_token',
    ];

    protected $casts = [
        'expiry_date' => 'datetime',
        'extension_date' => 'datetime',
        'expiry_one_hour_warning_sent_at' => 'datetime',
        'expiry_warning_sent_at' => 'datetime',
        'expiry_ten_minutes_warning_sent_at' => 'datetime',
        'activated_at' => 'datetime',
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
        return $this->belongsTo(Package::class, 'package_id');
    }

    public function package()
    {
        return $this->belongsTo(HotspotPackage::class, 'package_id');
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    // Compatibility helper: SubscriptionService expects `subAccounts()` on Customer model
    public function subAccounts()
    {
        return $this->children();
    }

    public function getEffectivePackageAttribute()
    {
        if ($this->relationLoaded('package')) {
            return $this->getRelationValue('package');
        }

        return $this->package()->first();
    }

    public function getEffectivePackagePriceAttribute()
    {
        if ($this->custom_package_price !== null) {
            return (float) $this->custom_package_price;
        }

        if ($this->effective_package?->price !== null) {
            return (float) $this->effective_package->price;
        }

        return null;
    }
}
