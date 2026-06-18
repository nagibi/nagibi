<?php

namespace App\Providers;

use App\Models\Central\CentralUser;
use App\Support\DevToolsAccess;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    public function register(): void
    {
        $this->hideSensitiveRequestDetails();

        $isLocal = $this->app->environment('local');
        $recordAll = (bool) config('telescope.record_all', false);

        Telescope::filter(function (IncomingEntry $entry) use ($isLocal, $recordAll) {
            if ($isLocal || $recordAll) {
                return true;
            }

            return $entry->isReportableException()
                || $entry->isFailedRequest()
                || $entry->isFailedJob()
                || $entry->isScheduledTask()
                || $entry->hasMonitoredTag();
        });
    }

    protected function hideSensitiveRequestDetails(): void
    {
        if ($this->app->environment('local')) {
            return;
        }

        Telescope::hideRequestParameters(['_token']);

        Telescope::hideRequestHeaders([
            'cookie',
            'x-csrf-token',
            'x-xsrf-token',
        ]);
    }

    protected function gate(): void
    {
        Gate::define('viewTelescope', function ($user = null) {
            if (DevToolsAccess::userCanAccess($user)) {
                return true;
            }

            $centralUserId = session('dev_tools_central_user_id');

            if (! is_numeric($centralUserId)) {
                return false;
            }

            return DevToolsAccess::userCanAccess(
                CentralUser::query()->find((int) $centralUserId),
            );
        });
    }

    protected function authorization(): void
    {
        $this->gate();

        Telescope::auth(function ($request) {
            if (app()->environment('local')) {
                return true;
            }

            if (Gate::check('viewTelescope', [Auth::guard('web')->user()])) {
                return true;
            }

            $centralUserId = session('dev_tools_central_user_id');

            if (! is_numeric($centralUserId)) {
                return false;
            }

            return DevToolsAccess::userCanAccess(
                CentralUser::query()->find((int) $centralUserId),
            );
        });
    }
}
