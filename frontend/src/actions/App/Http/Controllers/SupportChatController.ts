import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/support-chat/messages',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:43
 * @route '/support-chat/messages'
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
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
export const context = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: context.url(options),
    method: 'get',
})

context.definition = {
    methods: ["get","head"],
    url: '/support-chat/context',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
context.url = (options?: RouteQueryOptions) => {
    return context.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
context.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: context.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
context.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: context.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
    const contextForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: context.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
        contextForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: context.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:18
 * @route '/support-chat/context'
 */
        contextForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: context.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    context.form = contextForm
/**
* @see \App\Http\Controllers\SupportChatController::store
 * @see app/Http/Controllers/SupportChatController.php:53
 * @route '/support-chat/messages'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/support-chat/messages',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\SupportChatController::store
 * @see app/Http/Controllers/SupportChatController.php:53
 * @route '/support-chat/messages'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::store
 * @see app/Http/Controllers/SupportChatController.php:53
 * @route '/support-chat/messages'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\SupportChatController::store
 * @see app/Http/Controllers/SupportChatController.php:53
 * @route '/support-chat/messages'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::store
 * @see app/Http/Controllers/SupportChatController.php:53
 * @route '/support-chat/messages'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
const SupportChatController = { index, context, store }

export default SupportChatController