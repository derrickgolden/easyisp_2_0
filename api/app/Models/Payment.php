<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'customer_id',
        'mpesa_code',
        'amount',
        'bill_ref',
        'phone',
        'sender_name',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
