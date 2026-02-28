<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'guard_name',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function users(): BelongsToMany
    {
        return parent::users();
    }
}
