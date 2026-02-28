<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;

class SetPermissionsTeam
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user() ?? auth()->user();
        if ($user) {
            $organizationId = $user->organization_id;
            app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);
        }

        return $next($request);
    }
}