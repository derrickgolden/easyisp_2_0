<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Permission;

class PermissionController extends Controller
{
    //
    public function index()
    {
        $permissions = Permission::where('guard_name', 'sanctum')
            ->orderBy('group') 
            ->get() 
            ->groupBy('group'); 

        return response()->json(['data' => $permissions]);
    }
}
