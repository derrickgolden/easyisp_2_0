<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrganizationPaymentGateway extends Model
{
    use HasFactory;

    protected $table = 'organization_payment_gateways';

    protected $fillable = [
        'organization_id',
        'provider',
        'config',
        'is_default',
        'active',
        'created_by',
    ];

    protected $casts = [
        'config' => 'array',
        'is_default' => 'boolean',
        'active' => 'boolean',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
