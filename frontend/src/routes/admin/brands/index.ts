import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/admin/brands',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
const brands = {
    store: Object.assign(store, store),
}

export default brands