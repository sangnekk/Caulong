<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdvisorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Http::preventStrayRequests();
    }

    public function test_initial_page_waits_for_filters_without_external_requests(): void
    {
        $this->product('available');

        $this->get(route('advisor.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/advisor')->has('recommendations', 0)
            ->where('filters', ['budget' => null, 'style' => null, 'level' => null]));

        Http::assertNothingSent();
    }

    public function test_filters_activity_stock_budget_style_and_level_using_matching_variants(): void
    {
        $match = $this->product('match', [], ['price' => 500000]);
        $allLevels = $this->product('all-levels', ['skill_level' => 'all'], ['price' => 600000]);
        $this->product('inactive', ['is_active' => false], ['price' => 1]);
        $this->product('inactive-variant', [], ['is_active' => false, 'price' => 1]);
        $this->product('out-of-stock', [], ['stock' => 0, 'price' => 1]);
        $this->product('too-expensive', [], ['price' => 600001]);
        $this->product('wrong-style', ['play_style' => 'speed'], ['price' => 1]);
        $this->product('wrong-level', ['skill_level' => 'advanced'], ['price' => 1]);
        $this->product('no-variants', [], null);
        foreach ([['price' => 1, 'stock' => 0], ['price' => 1, 'is_active' => false], ['price' => 600001]] as $index => $variant) {
            $match->variants()->create(array_merge([
                'sku' => 'extra-'.$index, 'name' => 'Other', 'price' => 1, 'stock' => 5, 'is_active' => true,
            ], $variant));
        }

        $this->get('/advisor?budget=600000&style=attack&level=beginner')
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('shop/advisor')
            ->where('filters', ['budget' => 600000, 'style' => 'attack', 'level' => 'beginner'])
            ->has('recommendations', 2)
            ->where('recommendations.0.id', $match->id)
            ->where('recommendations.0.is_demo', true)
            ->has('recommendations.0.variants', 1)
            ->where('recommendations.0.variants.0.price', 500000)
            ->where('recommendations.1.id', $allLevels->id));

        Http::assertNothingSent();
    }

    public function test_returns_at_most_three_ordered_by_matching_price_then_id(): void
    {
        $this->product('higher', [], ['price' => 300]);
        $first = $this->product('first', ['play_style' => 'speed'], ['price' => 100]);
        $second = $this->product('second', ['skill_level' => 'advanced'], ['price' => 100]);
        $third = $this->product('third', [], ['price' => 200]);

        $this->get('/advisor?budget=300')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/advisor')->has('recommendations', 3)
            ->where('recommendations.0.id', $first->id)
            ->where('recommendations.1.id', $second->id)
            ->where('recommendations.2.id', $third->id));
    }

    public function test_returns_matching_sold_out_products_when_no_matches_are_in_stock(): void
    {
        $soldOut = $this->product('sold-out-attack', [
            'play_style' => 'attack', 'skill_level' => 'intermediate',
        ], ['price' => 500000, 'stock' => 0]);
        $this->product('over-budget-attack', [
            'play_style' => 'attack', 'skill_level' => 'intermediate',
        ], ['price' => 700000, 'stock' => 0]);

        $this->get('/advisor?budget=600000&style=attack&level=intermediate')
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('shop/advisor')
                ->has('recommendations', 1)
                ->where('recommendations.0.id', $soldOut->id)
                ->where('recommendations.0.variants.0.stock', 0));
    }

    public function test_zero_budget_is_submitted_and_empty_result_is_valid(): void
    {
        $this->product('not-free');

        $this->get('/advisor?budget=0&style=&level=')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('shop/advisor')->where('filters.budget', 0)->has('recommendations', 0));
    }

    public function test_rejects_invalid_filters(): void
    {
        foreach ([
            ['budget=-1', 'budget'], ['budget=1000000001', 'budget'], ['budget=1.5', 'budget'],
            ['budget=abc', 'budget'], ['budget[]=1', 'budget'], ['budget=', 'budget'],
            ['style=attack', 'budget'], ['budget=100&style=unknown', 'style'],
            ['budget=100&level=all', 'level'], ['budget=100&level[]=beginner', 'level'],
        ] as [$query, $field]) {
            $this->getJson('/advisor?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
        }
    }

    private function product(string $slug, array $attributes = [], ?array $variant = []): Product
    {
        $product = Product::create(array_merge([
            'name' => 'Demo '.$slug, 'slug' => $slug, 'description' => 'Test catalog product',
            'play_style' => 'attack', 'skill_level' => 'beginner', 'is_active' => true, 'is_demo' => true,
        ], $attributes));
        if ($variant !== null) {
            $product->variants()->create(array_merge([
                'sku' => $slug, 'name' => 'Standard', 'price' => 500000, 'stock' => 5, 'is_active' => true,
            ], $variant));
        }

        return $product;
    }
}
