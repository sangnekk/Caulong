import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
export const show = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/orders/{order}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
show.url = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { order: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'public_id' in args) {
            args = { order: args.public_id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    order: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        order: typeof args.order === 'object'
                ? args.order.public_id
                : args.order,
                }

    return show.definition.url
            .replace('{order}', parsedArgs.order.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
show.get = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
show.head = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
    const showForm = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
        showForm.get = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\CheckoutController::show
 * @see app/Http/Controllers/CheckoutController.php:71
 * @route '/orders/{order}'
 */
        showForm.head = (args: { order: string | { public_id: string } } | [order: string | { public_id: string } ] | string | { public_id: string }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    show.form = showForm
const orders = {
    show: Object.assign(show, show),
}

export default orders