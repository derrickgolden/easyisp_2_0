<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'acronym',
        'subscription_tier',
        'status',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function packages()
    {
        return $this->hasMany(Package::class);
    }

    public function sites()
    {
        return $this->hasMany(Site::class);
    }

    public function roles()
    {
        return $this->hasMany(Role::class);
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
}
