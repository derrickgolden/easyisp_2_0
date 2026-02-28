<?php

namespace App\Http\Middleware;

use App\Models\SystemAdmin;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class GrantAllPermissionsForAdmins
{
    public function handle(Request $request, Closure $next)
    {
        Gate::before(function ($user, $ability) {
            if ($user instanceof User && $user->is_super_admin) {
                return true;
            }

            if ($user instanceof SystemAdmin) {
                return true;
            }

            return null;
        });

        return $next($request);
    }
}
