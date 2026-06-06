<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Site extends Model
{
    use HasFactory;

    public function scopePortalFields($query)
    {
        return $query->select(['id', 'organization_id', 'ip_address']);
    }

    protected $casts = [
        'is_online' => 'boolean',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
