import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
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
const messages = {
    index: Object.assign(index, index),
store: Object.assign(store, store),
}

export default messages