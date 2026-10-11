import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\OrderController::confirm
 * @see app/Http/Controllers/Admin/OrderController.php:178
 * @route '/admin/orders/{order}/payments/{payment}/confirm'
 */
export const confirm = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: confirm.url(args, options),
    method: 'post',
})

confirm.definition = {
    methods: ["post"],
    url: '/admin/orders/{order}/payments/{payment}/confirm',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\OrderController::confirm
 * @see app/Http/Controllers/Admin/OrderController.php:178
 * @route '/admin/orders/{order}/payments/{payment}/confirm'
 */
confirm.url = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    order: args[0],
                    payment: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        order: typeof args.order === 'object'
                ? args.order.id
                : args.order,
                                payment: typeof args.payment === 'object'
                ? args.payment.id
                : args.payment,
                }

    return confirm.definition.url
            .replace('{order}', parsedArgs.order.toString())
            .replace('{payment}', parsedArgs.payment.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\OrderController::confirm
 * @see app/Http/Controllers/Admin/OrderController.php:178
 * @route '/admin/orders/{order}/payments/{payment}/confirm'
 */
confirm.post = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: confirm.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\OrderController::confirm
 * @see app/Http/Controllers/Admin/OrderController.php:178
 * @route '/admin/orders/{order}/payments/{payment}/confirm'
 */
    const confirmForm = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: confirm.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\OrderController::confirm
 * @see app/Http/Controllers/Admin/OrderController.php:178
 * @route '/admin/orders/{order}/payments/{payment}/confirm'
 */
        confirmForm.post = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: confirm.url(args, options),
            method: 'post',
        })
    
    confirm.form = confirmForm
/**
* @see \App\Http\Controllers\Admin\OrderController::refund
 * @see app/Http/Controllers/Admin/OrderController.php:186
 * @route '/admin/orders/{order}/payments/{payment}/refund'
 */
export const refund = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: refund.url(args, options),
    method: 'post',
})

refund.definition = {
    methods: ["post"],
    url: '/admin/orders/{order}/payments/{payment}/refund',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\OrderController::refund
 * @see app/Http/Controllers/Admin/OrderController.php:186
 * @route '/admin/orders/{order}/payments/{payment}/refund'
 */
refund.url = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    order: args[0],
                    payment: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        order: typeof args.order === 'object'
                ? args.order.id
                : args.order,
                                payment: typeof args.payment === 'object'
                ? args.payment.id
                : args.payment,
                }

    return refund.definition.url
            .replace('{order}', parsedArgs.order.toString())
            .replace('{payment}', parsedArgs.payment.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\OrderController::refund
 * @see app/Http/Controllers/Admin/OrderController.php:186
 * @route '/admin/orders/{order}/payments/{payment}/refund'
 */
refund.post = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: refund.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\OrderController::refund
 * @see app/Http/Controllers/Admin/OrderController.php:186
 * @route '/admin/orders/{order}/payments/{payment}/refund'
 */
    const refundForm = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: refund.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\OrderController::refund
 * @see app/Http/Controllers/Admin/OrderController.php:186
 * @route '/admin/orders/{order}/payments/{payment}/refund'
 */
        refundForm.post = (args: { order: number | { id: number }, payment: string | number | { id: string | number } } | [order: number | { id: number }, payment: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: refund.url(args, options),
            method: 'post',
        })
    
    refund.form = refundForm
const payments = {
    confirm: Object.assign(confirm, confirm),
refund: Object.assign(refund, refund),
}

export default payments