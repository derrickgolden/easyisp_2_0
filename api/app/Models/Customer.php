<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'parent_id',
        'package_id',
        'site_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'location',
        'apartment',
        'house_no',
        'connection_type',
        'installation_fee',
        'status',
        'expiry_date',
        'extension_date',
        'balance',
        'is_independent',
        'radius_username',
        'radius_password',
        'ip_address',
        'mac_address',
    ];

    protected $casts = [
        'installation_fee' => 'decimal:2',
        'expiry_date' => 'datetime',
        'extension_date' => 'datetime',
        'balance' => 'decimal:2',
        'is_independent' => 'boolean',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function parent()
    {
        return $this->belongsTo(Customer::class, 'parent_id');
    }

    public function subAccounts()
    {
        return $this->hasMany(Customer::class, 'parent_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function getFullNameAttribute()
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function getExpiryDateAttribute($value)
    {
        if ($value) {
            return \Carbon\Carbon::parse($value)->format('Y-m-d H:i:s');
        }
        return $value;
    }

    public function getExtensionDateAttribute($value)
    {
        if ($value) {
            return \Carbon\Carbon::parse($value)->format('Y-m-d H:i:s');
        }
        return $value;
    }
}
