import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
 * @see routes/web.php:13
 * @route '/session'
 */
export const renew = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: renew.url(options),
    method: 'get',
})

renew.definition = {
    methods: ["get","head"],
    url: '/session',
} satisfies RouteDefinition<["get","head"]>

/**
 * @see routes/web.php:13
 * @route '/session'
 */
renew.url = (options?: RouteQueryOptions) => {
    return renew.definition.url + queryParams(options)
}

/**
 * @see routes/web.php:13
 * @route '/session'
 */
renew.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: renew.url(options),
    method: 'get',
})
/**
 * @see routes/web.php:13
 * @route '/session'
 */
renew.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: renew.url(options),
    method: 'head',
})

    /**
 * @see routes/web.php:13
 * @route '/session'
 */
    const renewForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: renew.url(options),
        method: 'get',
    })

            /**
 * @see routes/web.php:13
 * @route '/session'
 */
        renewForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: renew.url(options),
            method: 'get',
        })
            /**
 * @see routes/web.php:13
 * @route '/session'
 */
        renewForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: renew.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    renew.form = renewForm
const session = {
    renew: Object.assign(renew, renew),
}

export default session