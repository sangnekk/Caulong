<?php

namespace App\Http\Controllers;

use App\Services\SeoService;
use Illuminate\Http\Response;

/** The two files search engines ask a site for (the storefront passes both requests on). */
class SeoController extends Controller
{
    public function sitemap(SeoService $seo): Response
    {
        return response($seo->sitemap(), 200, ['Content-Type' => 'application/xml; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    public function robots(SeoService $seo): Response
    {
        return response($seo->robots(), 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }
}
