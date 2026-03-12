<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SiteResource extends JsonResource
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
            'organization_id' => $this->organization_id,
            'organization_name' => $this->organization?->name,
            'name' => $this->name,
            'location' => $this->location,
            'routers_count' => 1,
            'status' => $this->is_online ? 'online' : 'offline',
            'ip_address' => $this->ip_address,
            'mikrotik_username' => $this->mikrotik_username,
            'mikrotik_password' => $this->mikrotik_password,
            'mikrotik_port' => $this->mikrotik_port,
            'notify_on_down' => (bool) $this->notify_on_down,
            'last_seen' => $this->last_seen
                ? (is_string($this->last_seen)
                    ? \Illuminate\Support\Carbon::parse($this->last_seen)->toISOString()
                    : $this->last_seen->toISOString())
                : null,
        ];
    }
}