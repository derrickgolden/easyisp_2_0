<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HotspotTransaction extends Model
{
    use HasFactory;

    protected $table = 'hotspot_transactions';

    protected $fillable = [
        'organization_id',
        'customer_id',
        'amount',
        'type',
        'category',
        'method',
        'description',
        'balance_before',
        'balance_after',
        'reference_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_before' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function customer()
    {
        return $this->belongsTo(HotspotCustomer::class, 'customer_id');
    }
}
