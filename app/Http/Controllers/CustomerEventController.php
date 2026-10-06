<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\CartService;
use App\Services\CustomerEvents;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Events the browser reports once a page is really on screen (CustomerEvents::FROM_BROWSER).
 * The browser only names what happened; figures come from this server, not from the request.
 */
class CustomerEventController extends Controller
{
    public function __invoke(Request $request, CustomerEvents $events, CartService $cart): Response
    {
        $data = $request->validate([
            'name' => ['required', Rule::in(CustomerEvents::FROM_BROWSER)],
            'product' => ['exclude_unless:name,product_view', 'required', 'integer', 'min:1'],
            'q' => ['exclude_unless:name,search', 'required', 'string', 'max:100'],
            // How many products the search listed: a count the page shows, nothing more.
            'results' => ['exclude_unless:name,search', 'nullable', 'integer', 'between:0,100000'],
        ]);

        if ($data['name'] === 'product_view') {
            if (Product::query()->active()->whereKey($data['product'])->exists()) {
                $events->record($request, 'product_view', (int) $data['product']);
            }
        } elseif ($data['name'] === 'search') {
            $events->record($request, 'search', metadata: [
                'q' => mb_strtolower(trim($data['q'])),
                'results' => isset($data['results']) ? (int) $data['results'] : null,
            ]);
        } else {
            $summary = $cart->summary($request);
            if ($summary['count'] > 0) {
                $events->record($request, 'checkout_started', metadata: ['items' => $summary['count'], 'subtotal' => $summary['subtotal']]);
            }
        }

        return response()->noContent();
    }
}
