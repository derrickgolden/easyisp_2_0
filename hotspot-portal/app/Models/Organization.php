<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    use HasFactory;

    public function scopePortalFields($query)
    {
        return $query->select(['id', 'name', 'settings']);
    }

    public function getBusinessLogoAttribute()
    {
        return data_get($this->settings, 'general.business_logo');
    }

    public function getLogoAttribute()
    {
        return $this->business_logo;
    }

    protected $casts = [
        'balance' => 'decimal:2',
        'settings' => 'array',
    ];

    public function packages()
    {
        return $this->hasMany(Package::class);
    }

    public function sites()
    {
        return $this->hasMany(Site::class);
    }
}
