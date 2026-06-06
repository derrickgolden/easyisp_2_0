<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use HasFactory;

    public function scopePortalFields($query)
    {
        return $query->select(['id', 'organization_id', 'name', 'price']);
    }

    protected $casts = [
        'price' => 'decimal:2',
        'id' => 'string',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
