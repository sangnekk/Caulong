import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
import unsubscribeAffe48 from './unsubscribe'
/**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
export const unsubscribe = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: unsubscribe.url(args, options),
    method: 'get',
})

unsubscribe.definition = {
    methods: ["get","head"],
    url: '/email/unsubscribe/{user}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
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
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
unsubscribe.get = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: unsubscribe.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
unsubscribe.head = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: unsubscribe.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
    const unsubscribeForm = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: unsubscribe.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
        unsubscribeForm.get = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: unsubscribe.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\MarketingConsentController::unsubscribe
 * @see app/Http/Controllers/MarketingConsentController.php:37
 * @route '/email/unsubscribe/{user}'
 */
        unsubscribeForm.head = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: unsubscribe.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    unsubscribe.form = unsubscribeForm
const email = {
    unsubscribe: Object.assign(unsubscribe, unsubscribeAffe48),
}

export default email