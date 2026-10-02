import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
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
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::brand
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
export const brand = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: brand.url(options),
    method: 'post',
})

brand.definition = {
    methods: ["post"],
    url: '/admin/brands',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::brand
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
brand.url = (options?: RouteQueryOptions) => {
    return brand.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::brand
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
brand.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: brand.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\TaxonomyController::brand
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
    const brandForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: brand.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::brand
 * @see app/Http/Controllers/Admin/TaxonomyController.php:36
 * @route '/admin/brands'
 */
        brandForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: brand.url(options),
            method: 'post',
        })
    
    brand.form = brandForm
/**
* @see \App\Http\Controllers\Admin\TaxonomyController::category
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
export const category = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: category.url(options),
    method: 'post',
})

category.definition = {
    methods: ["post"],
    url: '/admin/categories',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::category
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
category.url = (options?: RouteQueryOptions) => {
    return category.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\TaxonomyController::category
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
category.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: category.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\TaxonomyController::category
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
    const categoryForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: category.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\TaxonomyController::category
 * @see app/Http/Controllers/Admin/TaxonomyController.php:41
 * @route '/admin/categories'
 */
        categoryForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: category.url(options),
            method: 'post',
        })
    
    category.form = categoryForm
const TaxonomyController = { index, brand, category }

export default TaxonomyController