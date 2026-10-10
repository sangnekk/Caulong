import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
export const show = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/email/unsubscribe/{user}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
show.url = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { user: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { user: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    user: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        user: typeof args.user === 'object'
                ? args.user.id
                : args.user,
                }

    return show.definition.url
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
show.get = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
show.head = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
    const showForm = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
        showForm.get = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\MarketingConsentController::show
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
        showForm.head = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:49
 * @route '/email/unsubscribe/{user}'
 */
export const unsubscribe = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: unsubscribe.url(args, options),
    method: 'post',
})

unsubscribe.definition = {
    methods: ["post"],
    url: '/email/unsubscribe/{user}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:49
 * @route '/email/unsubscribe/{user}'
 */
unsubscribe.url = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { user: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { user: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    user: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        user: typeof args.user === 'object'
                ? args.user.id
                : args.user,
                }

    return unsubscribe.definition.url
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:49
 * @route '/email/unsubscribe/{user}'
 */
unsubscribe.post = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: unsubscribe.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:49
 * @route '/email/unsubscribe/{user}'
 */
    const unsubscribeForm = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: unsubscribe.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:49
 * @route '/email/unsubscribe/{user}'
 */
        unsubscribeForm.post = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: unsubscribe.url(args, options),
            method: 'post',
        })
    
    unsubscribe.form = unsubscribeForm
/**
* @see \App\Http\Controllers\MarketingConsentController::update
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
export const update = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/account/marketing',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\MarketingConsentController::update
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
update.url = (options?: RouteQueryOptions) => {
    return update.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MarketingConsentController::update
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
update.patch = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\MarketingConsentController::update
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
    const updateForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\MarketingConsentController::update
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
        updateForm.patch = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
const MarketingConsentController = { show, unsubscribe, update }

export default MarketingConsentController