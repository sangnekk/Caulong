import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin/taxonomies',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::index
 * @see app/Http/Controllers/Admin/TaxonomyController.php:17
 * @route '/admin/taxonomies'
 */
        indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    index.form = indexForm
const taxonomies = {
    index: Object.assign(index, index),
}

export default taxonomies