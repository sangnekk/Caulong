import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin/service-orders',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::index
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:20
 * @route '/admin/service-orders'
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
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
export const show = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/admin/service-orders/{serviceOrder}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
show.url = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { serviceOrder: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { serviceOrder: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    serviceOrder: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        serviceOrder: typeof args.serviceOrder === 'object'
                ? args.serviceOrder.id
                : args.serviceOrder,
                }

    return show.definition.url
            .replace('{serviceOrder}', parsedArgs.serviceOrder.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
show.get = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
show.head = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
    const showForm = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
        showForm.get = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::show
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:53
 * @route '/admin/service-orders/{serviceOrder}'
 */
        showForm.head = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    show.form = showForm
/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::update
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:82
 * @route '/admin/service-orders/{serviceOrder}'
 */
export const update = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/admin/service-orders/{serviceOrder}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::update
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:82
 * @route '/admin/service-orders/{serviceOrder}'
 */
update.url = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { serviceOrder: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { serviceOrder: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    serviceOrder: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        serviceOrder: typeof args.serviceOrder === 'object'
                ? args.serviceOrder.id
                : args.serviceOrder,
                }

    return update.definition.url
            .replace('{serviceOrder}', parsedArgs.serviceOrder.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceOrderController::update
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:82
 * @route '/admin/service-orders/{serviceOrder}'
 */
update.patch = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::update
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:82
 * @route '/admin/service-orders/{serviceOrder}'
 */
    const updateForm = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceOrderController::update
 * @see app/Http/Controllers/Admin/ServiceOrderController.php:82
 * @route '/admin/service-orders/{serviceOrder}'
 */
        updateForm.patch = (args: { serviceOrder: string | number | { id: string | number } } | [serviceOrder: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
const ServiceOrderController = { index, show, update }

export default ServiceOrderController