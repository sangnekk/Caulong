import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/cart',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\CartController::index
 * @see app/Http/Controllers/CartController.php:17
 * @route '/cart'
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
* @see \App\Http\Controllers\CartController::store
 * @see app/Http/Controllers/CartController.php:22
 * @route '/cart/items'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/cart/items',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CartController::store
 * @see app/Http/Controllers/CartController.php:22
 * @route '/cart/items'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::store
 * @see app/Http/Controllers/CartController.php:22
 * @route '/cart/items'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\CartController::store
 * @see app/Http/Controllers/CartController.php:22
 * @route '/cart/items'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CartController::store
 * @see app/Http/Controllers/CartController.php:22
 * @route '/cart/items'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\CartController::update
 * @see app/Http/Controllers/CartController.php:40
 * @route '/cart/items/{variant}'
 */
export const update = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/cart/items/{variant}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\CartController::update
 * @see app/Http/Controllers/CartController.php:40
 * @route '/cart/items/{variant}'
 */
update.url = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { variant: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    variant: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        variant: args.variant,
                }

    return update.definition.url
            .replace('{variant}', parsedArgs.variant.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::update
 * @see app/Http/Controllers/CartController.php:40
 * @route '/cart/items/{variant}'
 */
update.patch = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\CartController::update
 * @see app/Http/Controllers/CartController.php:40
 * @route '/cart/items/{variant}'
 */
    const updateForm = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CartController::update
 * @see app/Http/Controllers/CartController.php:40
 * @route '/cart/items/{variant}'
 */
        updateForm.patch = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\CartController::destroy
 * @see app/Http/Controllers/CartController.php:54
 * @route '/cart/items/{variant}'
 */
export const destroy = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/cart/items/{variant}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CartController::destroy
 * @see app/Http/Controllers/CartController.php:54
 * @route '/cart/items/{variant}'
 */
destroy.url = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { variant: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    variant: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        variant: args.variant,
                }

    return destroy.definition.url
            .replace('{variant}', parsedArgs.variant.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::destroy
 * @see app/Http/Controllers/CartController.php:54
 * @route '/cart/items/{variant}'
 */
destroy.delete = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\CartController::destroy
 * @see app/Http/Controllers/CartController.php:54
 * @route '/cart/items/{variant}'
 */
    const destroyForm = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: destroy.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CartController::destroy
 * @see app/Http/Controllers/CartController.php:54
 * @route '/cart/items/{variant}'
 */
        destroyForm.delete = (args: { variant: string | number } | [variant: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: destroy.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    destroy.form = destroyForm
/**
* @see \App\Http\Controllers\CartController::applyCoupon
 * @see app/Http/Controllers/CartController.php:71
 * @route '/cart/coupon'
 */
export const applyCoupon = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: applyCoupon.url(options),
    method: 'post',
})

applyCoupon.definition = {
    methods: ["post"],
    url: '/cart/coupon',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CartController::applyCoupon
 * @see app/Http/Controllers/CartController.php:71
 * @route '/cart/coupon'
 */
applyCoupon.url = (options?: RouteQueryOptions) => {
    return applyCoupon.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::applyCoupon
 * @see app/Http/Controllers/CartController.php:71
 * @route '/cart/coupon'
 */
applyCoupon.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: applyCoupon.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\CartController::applyCoupon
 * @see app/Http/Controllers/CartController.php:71
 * @route '/cart/coupon'
 */
    const applyCouponForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: applyCoupon.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CartController::applyCoupon
 * @see app/Http/Controllers/CartController.php:71
 * @route '/cart/coupon'
 */
        applyCouponForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: applyCoupon.url(options),
            method: 'post',
        })
    
    applyCoupon.form = applyCouponForm
/**
* @see \App\Http\Controllers\CartController::removeCoupon
 * @see app/Http/Controllers/CartController.php:93
 * @route '/cart/coupon'
 */
export const removeCoupon = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: removeCoupon.url(options),
    method: 'delete',
})

removeCoupon.definition = {
    methods: ["delete"],
    url: '/cart/coupon',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CartController::removeCoupon
 * @see app/Http/Controllers/CartController.php:93
 * @route '/cart/coupon'
 */
removeCoupon.url = (options?: RouteQueryOptions) => {
    return removeCoupon.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CartController::removeCoupon
 * @see app/Http/Controllers/CartController.php:93
 * @route '/cart/coupon'
 */
removeCoupon.delete = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: removeCoupon.url(options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\CartController::removeCoupon
 * @see app/Http/Controllers/CartController.php:93
 * @route '/cart/coupon'
 */
    const removeCouponForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: removeCoupon.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CartController::removeCoupon
 * @see app/Http/Controllers/CartController.php:93
 * @route '/cart/coupon'
 */
        removeCouponForm.delete = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: removeCoupon.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    removeCoupon.form = removeCouponForm
const CartController = { index, store, update, destroy, applyCoupon, removeCoupon }

export default CartController