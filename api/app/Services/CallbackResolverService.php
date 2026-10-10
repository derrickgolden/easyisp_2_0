<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Organization;

class CallbackResolverService
{
    public function resolveCustomerFromCallback(int $organizationId, ?string $accountReference, string $phone): ?Customer
    {
        $query = Customer::where('organization_id', $organizationId);

        if (!empty($accountReference)) {
            $customer = (clone $query)
                ->whereRaw('LOWER(TRIM(radius_username)) = ?', [strtolower(trim($accountReference))])
                ->first();
            if ($customer) {
                return $customer;
            }

            if (preg_match('/(?:CUST|CUSTOMER)[-_ ]?(\d+)/i', (string) $accountReference, $matches)) {
                $customer = $query->where('id', (int) $matches[1])->first();
                if ($customer) {
                    return $customer;
                }
            }
        }

        return (clone $query)
            ->where('phone', $phone)
            ->latest('id')
            ->first();
    }

    public function resolveOrganizationFromCallback(?string $externalReference, string $phone): ?Organization
    {
        if (!empty($externalReference) && preg_match('/ORG-(\d+)-/i', $externalReference, $matches)) {
            $organization = Organization::find((int) $matches[1]);
            if ($organization) {
                return $organization;
            }
        }

        $customer = Customer::where('phone', $phone)->latest('id')->first();

        if ($customer) {
            return Organization::find($customer->organization_id);
        }

        return Organization::whereHas('users', function ($query) use ($phone) {
            $query->where('phone', $phone);
        })->first();
    }
}
