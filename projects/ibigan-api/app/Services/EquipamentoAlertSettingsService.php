<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\EquipamentoAlertSetting;
use Illuminate\Support\Facades\Cache;

final class EquipamentoAlertSettingsService
{
    /**
     * Retorna o valor configurado pelo tenant para $key, ou $default
     * (geralmente vindo de config('equipamento.alerts.*')) se não houver
     * override. Cacheado por tenant durante o request para evitar N
     * queries quando o scanner lê várias chaves em sequência.
     */
    public function get(string $key, int|float $default): int|float
    {
        $value = $this->allOverrides()[$key] ?? null;

        if ($value === null) {
            return $default;
        }

        return is_float($default) ? (float) $value : (int) $value;
    }

    public function set(string $key, int|float|string $value): void
    {
        EquipamentoAlertSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => (string) $value],
        );

        $this->forgetCache();
    }

    public function forget(string $key): void
    {
        EquipamentoAlertSetting::query()->where('key', $key)->delete();

        $this->forgetCache();
    }

    /**
     * @return array<string, string>
     */
    public function allOverrides(): array
    {
        $cacheKey = $this->cacheKey();

        return Cache::remember($cacheKey, now()->addMinutes(10), function (): array {
            return EquipamentoAlertSetting::query()
                ->pluck('value', 'key')
                ->all();
        });
    }

    private function cacheKey(): string
    {
        // tenancy()->tenant?->getTenantKey() garante a chave de cache
        // isolada por tenant mesmo se o cache driver for compartilhado
        // entre bancos (ex: Redis central). Ajuste se seu cache já for
        // particionado automaticamente por tenant.
        $tenantId = tenancy()->initialized ? tenancy()->tenant?->getTenantKey() : 'central';

        return "equipamento:alert_settings:{$tenantId}";
    }

    private function forgetCache(): void
    {
        Cache::forget($this->cacheKey());
    }
}
