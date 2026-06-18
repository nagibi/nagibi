<?php

declare(strict_types=1);

namespace App\Prometheus;

use Illuminate\Http\Request;
use Ninebit\LaravelPrometheus\Contracts\HttpLabelProvider;
use Symfony\Component\HttpFoundation\Response;

final class TenantHttpLabelProvider implements HttpLabelProvider
{
    public function labelNames(): array
    {
        // BuiltInMetric HTTP metrics only support route, method, status.
        // Tenant is encoded in the route label as "{tenant}|{route}".
        return ['route', 'method', 'status'];
    }

    public function labelValues(Request $request, Response $response): array
    {
        return [
            $this->resolveTenantId($request).'|'.$this->resolveRouteName($request),
            $request->getMethod(),
            (string) $response->getStatusCode(),
        ];
    }

    private function resolveTenantId(Request $request): string
    {
        if (tenancy()->initialized) {
            return (string) tenant()->getTenantKey();
        }

        $header = $request->header('X-Tenant-ID');

        return $header !== null && $header !== '' ? (string) $header : 'central';
    }

    private function resolveRouteName(Request $request): string
    {
        $route = $request->route();

        if ($route?->getName()) {
            return $route->getName();
        }

        if ($route) {
            return $route->uri();
        }

        return 'unnamed';
    }
}
