<?php

declare(strict_types=1);

use App\Support\SocialOAuthUrl;
use Illuminate\Http\Request;

it('monta redirect uri do oauth a partir do host da requisicao', function (): void {
    $request = Request::create('http://192.168.27.103/api/central/v1/auth/google', 'GET');

    expect(SocialOAuthUrl::redirectUri($request, 'google'))
        ->toBe('http://192.168.27.103/api/v1/auth/google/callback');
});

it('monta frontend url do oauth a partir do host da requisicao', function (): void {
    $request = Request::create('http://192.168.27.103/api/central/v1/auth/google', 'GET');

    expect(SocialOAuthUrl::frontendUrl($request))
        ->toBe('http://192.168.27.103');
});

it('redireciona oauth central com redirect_uri do host da requisicao', function (): void {
    $response = $this->get('http://192.168.27.103/api/central/v1/auth/google');

    $response->assertRedirect();
    expect($response->headers->get('Location'))
        ->toContain('redirect_uri=http%3A%2F%2F192.168.27.103%2Fapi%2Fv1%2Fauth%2Fgoogle%2Fcallback');
});
