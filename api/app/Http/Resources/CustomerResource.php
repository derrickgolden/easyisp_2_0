<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */

    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'firstName' => $this->first_name,
            'lastName' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'houseNo' => $this->house_no,
            'apartment' => $this->apartment,
            'location' => $this->location,
            'connectionType' => $this->connection_type,
            'packageId' => (string) $this->package_id,
            'siteId' => $this->site_id ? (string) $this->site_id : null,
            'installationFee' => (float) $this->installation_fee,
            'status' => $this->status,
            'expiryDate' => $this->expiry_date,
            'extensionDate' => $this->extension_date,
            'balance' => (float) $this->balance,
            'createdAt' => $this->created_at->toISOString(),
            // Radius Credentials
            'radiusUsername' => $this->radius_username,
            'radiusPassword' => $this->radius_password,
            // Network Details
            'ipAddress' => $this->ip_address,
            'macAddress' => $this->mac_address,
            // Hierarchy
            'parentId' => $this->parent_id ? (string) $this->parent_id : null,
            'isIndependent' => (bool) $this->is_independent,
            
            // Online Status
            'isOnline' => (bool) ($this->is_online ?? false),

            // Only shows up if you called ->load('package') or used with()
            'package' => $this->whenLoaded('package'),
            'site' => $this->whenLoaded('site'),
            'parent' => new CustomerResource($this->whenLoaded('parent')),
            
            // You can even nest resources for subAccounts/parents
            'subAccounts' => CustomerResource::collection($this->whenLoaded('subAccounts')),
        ];
    }
}
