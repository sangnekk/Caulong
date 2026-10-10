<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class RouteHelpersTest extends TestCase
{
    /**
     * The front end's route helpers (written by "npm run routes") are used on whatever address
     * the shop is opened on, so they must hold paths. An address forced on Laravel's URL
     * generator in the console would be written into every one of them.
     */
    public function test_generated_route_helpers_hold_paths_not_addresses(): void
    {
        $withAddress = [];
        foreach (['frontend/src/routes', 'frontend/src/actions'] as $directory) {
            foreach (File::allFiles(base_path($directory)) as $file) {
                if (preg_match('~url: [\'"`][a-z][a-z0-9+.-]*://~i', $file->getContents())) {
                    $withAddress[] = $file->getRelativePathname();
                }
            }
        }

        $this->assertSame([], $withAddress, 'Route helpers contain absolute URLs. Find what forces the URL origin in the console, then run "npm run routes".');
        $this->assertStringStartsWith('/', route('products.index', absolute: false));
    }
}
