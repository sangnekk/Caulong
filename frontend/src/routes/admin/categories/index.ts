import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/admin/categories',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::store
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
const categories = {
    store: Object.assign(store, store),
}

export default categories