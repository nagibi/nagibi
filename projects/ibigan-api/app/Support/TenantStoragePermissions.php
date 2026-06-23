<?php

declare(strict_types=1);

namespace App\Support;

final class TenantStoragePermissions
{
    private const TRAVERSAL_MODE = 0755;

    /**
     * Garante que o Nginx (usuário "other") consiga atravessar até app/public.
     */
    public static function ensureReadable(string $tenantStorageRoot): void
    {
        if (! is_dir($tenantStorageRoot)) {
            return;
        }

        foreach (self::traversalDirectories($tenantStorageRoot) as $directory) {
            if (! is_dir($directory)) {
                continue;
            }

            $mode = fileperms($directory) & 0777;

            if (($mode & 0005) === 0005) {
                continue;
            }

            @chmod($directory, self::TRAVERSAL_MODE);
        }
    }

    /**
     * @return list<string>
     */
    public static function traversalDirectories(string $tenantStorageRoot): array
    {
        return [
            $tenantStorageRoot,
            "{$tenantStorageRoot}/app",
            "{$tenantStorageRoot}/app/public",
        ];
    }

    /**
     * @return list<string>
     */
    public static function tenantStorageRoots(): array
    {
        $roots = glob(storage_path('tenant*'), GLOB_ONLYDIR) ?: [];

        return array_values(array_filter($roots, 'is_dir'));
    }
}
