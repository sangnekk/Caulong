<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_a_successful_response()
    {
        $response = $this->get(route('home'));

        $response->assertOk();
    }

    public function test_session_renewal_answers_with_the_session_cookie(): void
    {
        $this->get(route('session.renew'))->assertNoContent()->assertCookie(config('session.cookie'));
    }
}
