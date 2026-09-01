<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Services\HotspotCustomerRadiusService;

class HotspotCustomer extends Model
{
    use HasFactory;

    protected $table = 'hotspot_customers';

    public function setRadiusUsernameAttribute($value)
    {
        $this->attributes['radius_username'] = $value === null ? null : strtoupper($value);
    }

    public function setRadiusPasswordAttribute($value)
    {
        $this->attributes['radius_password'] = $value === null ? null : strtoupper($value);
    }

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
        'voucher',
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

    protected static function booted()
    {
        static::deleting(function (HotspotCustomer $customer) {
            // Gather usernames tied to this sub_group (covers voucher, mpesa receipts, MACs)
            $usernames = DB::connection('radius')->table('radcheck')
                ->where('sub_group_id', $customer->id)
                ->pluck('username')
                ->toArray();

            // Include primary username and child usernames
            $usernames[] = $customer->radius_username;
            $childUsernames = $customer->subAccounts()->pluck('radius_username')->toArray();
            $usernames = array_values(array_filter(array_unique(array_merge($usernames, $childUsernames))));

            $radiusService = app(HotspotCustomerRadiusService::class);

            // Apply explicit deny and disconnect each username, then remove per-username rows
            foreach ($usernames as $username) {
                if (empty($username)) continue;

                try {
                    DB::connection('radius')->table('radcheck')->updateOrInsert(
                        ['username' => $username, 'attribute' => 'Auth-Type'],
                        ['op' => ':=', 'value' => 'Reject', 'sub_group_id' => $customer->id]
                    );
                } catch (\Throwable $e) {
                    // ignore
                }

                try {
                    $radiusService->disconnectCustomer($username, $customer->organization_id);
                } catch (\Throwable $e) {
                    // ignore
                }

                DB::connection('radius')->table('radpostauth')->where('username', $username)->delete();
                DB::connection('radius')->table('radacct')->where('username', $username)->delete();
            }

            // Finally remove group/policy rows for the sub_group
            DB::connection('radius')->table('radcheck')
                ->where('sub_group_id', $customer->id)
                ->delete();

            DB::connection('radius')->table('radreply')
                ->where('sub_group_id', $customer->id)
                ->delete();
        });
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
