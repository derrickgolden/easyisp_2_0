<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class OnlineUsersUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $users;
    /**
     * Create a new event instance.
     */
    public function __construct($users)
    {
        $this->users = $users;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('mikrotik.online-users'),
        ];
        // return [
        //     new PrivateChannel('channel-name'),
        // ];
    }

    public function broadcastAs()
    {
        return 'online.users.updated';
    }

    public function broadcastVia()
    {
        return ['reverb'];
    }
}
