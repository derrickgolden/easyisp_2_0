<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles {
        hasPermissionTo as protected spatieHasPermissionTo;
        checkPermissionTo as protected spatieCheckPermissionTo;
        hasAnyPermission as protected spatieHasAnyPermission;
        hasRole as protected spatieHasRole;
        hasAnyRole as protected spatieHasAnyRole;
    }

    protected $guard_name = 'sanctum';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'organization_id',
        'parent_id',
        'role_id',
        'name',
        'email',
        'phone',
        'password',
        'is_super_admin',
        'status',
        'last_login',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'last_login' => 'datetime',
        'is_super_admin' => 'boolean',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function parent()
    {
        return $this->belongsTo(User::class, 'parent_id');
    }

    public function subordinates()
    {
        return $this->hasMany(User::class, 'parent_id');
    }

    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return $this->spatieHasPermissionTo($permission, $guardName);
    }

    public function checkPermissionTo($permission, $guardName = null): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return $this->spatieCheckPermissionTo($permission, $guardName);
    }

    public function hasAnyPermission(...$permissions): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return $this->spatieHasAnyPermission(...$permissions);
    }

    public function hasRole($roles, ?string $guard = null): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return $this->spatieHasRole($roles, $guard);
    }

    public function hasAnyRole(...$roles): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return $this->spatieHasAnyRole(...$roles);
    }
}
