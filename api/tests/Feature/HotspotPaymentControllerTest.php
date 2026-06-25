<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\HotspotPaymentController;
use Tests\TestCase;

class HotspotPaymentControllerTest extends TestCase
{
    public function test_hotspot_payment_controller_class_exists(): void
    {
        $this->assertTrue(class_exists(HotspotPaymentController::class));
    }
}
