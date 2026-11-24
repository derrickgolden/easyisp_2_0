<?php

namespace App\Console\Commands;

use App\Models\Organization;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendLicensePaymentReminders extends Command
{
    protected $signature = 'license:send-payment-reminders';

    protected $description = 'Email daily reminders to organizations with unpaid license bills';

    public function handle(): int
    {
        $today = now()->toDateString();
        $organizations = Organization::query()
            ->whereHas('licenseSnapshots', fn ($query) => $query->where('status', 'billed'))
            ->where(function ($query) use ($today): void {
                $query->whereNull('license_reminder_sent_at')
                    ->orWhereDate('license_reminder_sent_at', '<', $today);
            })
            ->with([
                'licenseSnapshots' => fn ($query) => $query
                    ->where('status', 'billed')
                    ->orderBy('snapshot_month'),
                'users' => fn ($query) => $query
                    ->where('is_super_admin', true)
                    ->whereNotNull('email')
                    ->where('email', '<>', ''),
            ])
            ->get();

        $sendFailed = false;

        foreach ($organizations as $organization) {
            if ($organization->users->isEmpty()) {
                Log::warning('License payment reminder skipped: organization has no super-admin email.', [
                    'organization_id' => $organization->id,
                ]);

                continue;
            }

            $organizationSendFailed = false;
            $bills = $organization->licenseSnapshots;
            $outstandingAmount = $bills->sum(fn ($bill) => (float) $bill->total_amount);
            $billLines = $bills->map(fn ($bill) => sprintf(
                '- %s: %s',
                $bill->snapshot_month?->format('F Y') ?? 'License bill',
                number_format((float) $bill->total_amount, 2)
            ))->implode("\n");
            $body = sprintf(
                "Hello,\n\nOur records show that your organization, %s, has unpaid license bill(s):\n%s\n\n"
                ."Outstanding balance: %s\n\n"
                .'Please sign in to your account and complete payment. We will continue sending this reminder '
                ."daily until all outstanding license bills are paid.\n",
                $organization->name,
                $billLines,
                number_format($outstandingAmount, 2)
            );

            foreach ($organization->users as $user) {
                try {
                    Mail::raw($body, function ($message) use ($user, $organization): void {
                        $message->to($user->email)
                            ->subject("Unpaid license payment: {$organization->name}");
                    });
                } catch (\Throwable $exception) {
                    $sendFailed = true;
                    $organizationSendFailed = true;
                    Log::error('Failed to send organization license payment reminder.', [
                        'organization_id' => $organization->id,
                        'user_id' => $user->id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }

            if (! $organizationSendFailed) {
                $organization->license_reminder_sent_at = $today;
                $organization->save();
                $this->info("Payment reminder sent for organization {$organization->id}.");
            }
        }

        return $sendFailed ? self::FAILURE : self::SUCCESS;
    }
}
