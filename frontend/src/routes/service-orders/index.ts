import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\ServiceOrderController::store
 * @see app/Http/Controllers/ServiceOrderController.php:34
 * @route '/service-orders'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/service-orders',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServiceOrderController::store
 * @see app/Http/Controllers/ServiceOrderController.php:34
 * @route '/service-orders'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServiceOrderController::store
 * @see app/Http/Controllers/ServiceOrderController.php:34
 * @route '/service-orders'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\ServiceOrderController::store
 * @see app/Http/Controllers/ServiceOrderController.php:34
 * @route '/service-orders'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\ServiceOrderController::store
 * @see app/Http/Controllers/ServiceOrderController.php:34
 * @route '/service-orders'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
export const show = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/service-orders/{serviceOrder}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
show.url = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { serviceOrder: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'public_id' in args) {
            args = { serviceOrder: args.public_id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    serviceOrder: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        serviceOrder: typeof args.serviceOrder === 'object'
                ? args.serviceOrder.public_id
                : args.serviceOrder,
                }

    return show.definition.url
            .replace('{serviceOrder}', parsedArgs.serviceOrder.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
show.get = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
show.head = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
    const showForm = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
        showForm.get = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\ServiceOrderController::show
 * @see app/Http/Controllers/ServiceOrderController.php:78
 * @route '/service-orders/{serviceOrder}'
 */
        showForm.head = (args: { serviceOrder: string | { public_id: string } } | [serviceOrder: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    show.form = showForm
const serviceOrders = {
    store: Object.assign(store, store),
show: Object.assign(show, show),
}

export default serviceOrders