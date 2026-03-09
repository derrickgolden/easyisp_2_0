<?php

namespace App\Events;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Broadcasting\Channel;

class CustomerTrafficUpdated implements ShouldBroadcastNow
{
    public $customerId;
    public $rx;
    public $tx;

    public function __construct($customerId, $rx, $tx)
    {
        $this->customerId = $customerId;
        $this->rx = $rx;
        $this->tx = $tx;
    }

    public function broadcastOn()
    {
        return new Channel('customer.traffic.' . $this->customerId);
    }
}
