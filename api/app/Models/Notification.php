<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasUuids;

    protected $fillable = [
        'type',
        'title',
        'body',
        'data',
        'failure_key',
    ];

    protected $casts = [
        'data' => 'array',
    ];
}
