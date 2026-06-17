<?php

declare(strict_types=1);

use App\Events\NotificationsInvalidated;
use App\Support\Broadcaster;
use Illuminate\Support\Facades\Log;

it('ignora falhas de broadcast sem lançar exceção', function (): void {
    Log::spy();

    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        'broadcasting.connections.reverb.options.port' => 1,
        'broadcasting.connections.reverb.options.scheme' => 'http',
        'broadcasting.connections.reverb.options.useTLS' => false,
    ]);

    Broadcaster::safe(new NotificationsInvalidated(1));

    Log::shouldHaveReceived('warning')->once();
});

it('não tenta broadcast quando a conexão padrão é null', function (): void {
    Log::spy();

    config(['broadcasting.default' => 'null']);

    Broadcaster::safe(new NotificationsInvalidated(1));

    Log::shouldNotHaveReceived('warning');
});
