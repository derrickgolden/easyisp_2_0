<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HotspotCustomerResource extends JsonResource
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
            'customPackagePrice' => $this->custom_package_price !== null ? (float) $this->custom_package_price : null,
            'effectivePackagePrice' => $this->effective_package_price !== null ? (float) $this->effective_package_price : null,
            'siteId' => $this->site_id ? (string) $this->site_id : null,
            'installationFee' => (float) $this->installation_fee,
            'status' => $this->status,
            'expiryDate' => $this->expiry_date,
            'extensionDate' => $this->extension_date,
            'activatedAt' => $this->activated_at,
            'connectedSites' => $this->connected_sites,
            'balance' => (float) $this->balance,
            'createdAt' => $this->created_at->toISOString(),
            // Radius Credentials
            'radiusUsername' => $this->radius_username,
            'radiusPassword' => $this->radius_password,
            // Network Details
            'ipAddress' => $this->ip_address,
            'macAddress' => $this->mac_address,
            'deviceName' => $this->device_name,
            'browserName' => $this->browser_name,
            // Hierarchy
            'parentId' => $this->parent_id ? (string) $this->parent_id : null,
            'isIndependent' => (bool) $this->is_independent,
            
            // Online Status
            'isOnline' => (bool) ($this->is_online ?? false),
            'onlineStatus' => $this->online_status ?? ((bool) ($this->is_online ?? false) ? 'online' : 'offline'),
            'nasIpAddress' => $this->radius_nas_ip ?? null,
            'hostName' => $this->host_name,

            // Only shows up if you called ->load('package') or used with()
            'package' => $this->whenLoaded('package'),
            'site' => $this->whenLoaded('site'),
            'parent' => new HotspotCustomerResource($this->whenLoaded('parent')),
            
            // You can even nest resources for subAccounts/parents
            'subAccounts' => HotspotCustomerResource::collection($this->whenLoaded('subAccounts')),
        ];
    }
}
