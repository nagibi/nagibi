<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TwoFactorMethod;
use App\Notifications\ResetPasswordNotification;
use App\Search\TenantSearchable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements HasMedia
{
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use TenantSearchable;
    use InteractsWithMedia;
    use LogsActivity;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'cpf',
        'password',
        'phone',
        'birth_date',
        'gender',
        'bio',
        'status',
        'is_super_admin',
        'is_active',
        'is_platform_user',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'two_factor_method',
        'last_login_at',
        'last_login_ip',
        'last_login_device',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_method' => TwoFactorMethod::class,
            'is_super_admin' => 'boolean',
            'is_active' => 'boolean',
            'is_platform_user' => 'boolean',
            'birth_date' => 'date',
            'last_login_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logAll();
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('avatar')
            ->singleFile()
            ->useDisk('public')
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function avatarUrl(): ?string
    {
        $media = $this->getFirstMedia('avatar');

        if ($media === null) {
            return null;
        }

        $url = $media->getUrl();
        $version = $media->updated_at?->getTimestamp() ?? $media->id;

        return str_contains($url, '?')
            ? "{$url}&v={$version}"
            : "{$url}?v={$version}";
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(self::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(self::class, 'updated_by');
    }

    // Sanctum guard para API
    protected $guard_name = 'sanctum';

    protected function defaultSearchableAs(): string
    {
        return 'users';
    }

    /**
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => 'user',
            'title' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatarUrl(),
            'searchable_by' => 'usuario-visualizar',
        ];
    }

    public function shouldBeSearchable(): bool
    {
        return ! $this->is_platform_user;
    }

    public function isActiveAccount(): bool
    {
        return (bool) $this->is_active && $this->status === 'active';
    }

    /**
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->where('status', 'active');
    }

    public function routeNotificationForMail(): ?string
    {
        if (! $this->isActiveAccount()) {
            return null;
        }

        $email = $this->email;

        return is_string($email) && trim($email) !== '' ? $email : null;
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification((string) $token));
    }
}
