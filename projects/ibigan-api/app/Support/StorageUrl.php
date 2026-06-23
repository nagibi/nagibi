<?php

declare(strict_types=1);

namespace App\Support;

final class StorageUrl
{
    public static function equipamentoFoto(?string $path, string $patrimonio): string
    {
        $url = self::public($path);

        if ($url !== null) {
            return $url;
        }

        return 'https://picsum.photos/96/96?random='.((crc32($patrimonio) % 1000) + 1);
    }

    public static function public(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        if (preg_match('#^https://picsum\.photos\?random=(\d+)$#', $path, $matches)) {
            return 'https://picsum.photos/96/96?random='.$matches[1];
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return self::normalizeTenancyAssetUrl($path);
        }

        return self::localPublicUrl($path);
    }

    private static function normalizeTenancyAssetUrl(string $url): string
    {
        if (! preg_match('#/tenancy/assets/storage/(.+)$#', $url, $matches)) {
            return $url;
        }

        if (! tenancy()->initialized) {
            return $url;
        }

        $tenantKey = tenant()->getTenantKey();

        return self::tenantPublicUrl($tenantKey, $matches[1]);
    }

    private static function localPublicUrl(string $path): string
    {
        $path = ltrim($path, '/');

        if (tenancy()->initialized) {
            return self::tenantPublicUrl((string) tenant()->getTenantKey(), $path);
        }

        return '/storage/'.$path;
    }

    private static function tenantPublicUrl(string $tenantKey, string $path): string
    {
        return '/storage/tenant'.$tenantKey.'/app/public/'.ltrim($path, '/');
    }
}
