import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
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
 * @see app/Http/Controllers/SupportChatController.php:48
 * @route '/support-chat/messages'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
 * @route '/support-chat/messages'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
 * @route '/support-chat/messages'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
 * @route '/support-chat/messages'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
 * @route '/support-chat/messages'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SupportChatController::index
 * @see app/Http/Controllers/SupportChatController.php:48
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
 * @see app/Http/Controllers/SupportChatController.php:23
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
 * @see app/Http/Controllers/SupportChatController.php:23
 * @route '/support-chat/context'
 */
context.url = (options?: RouteQueryOptions) => {
    return context.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:23
 * @route '/support-chat/context'
 */
context.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: context.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:23
 * @route '/support-chat/context'
 */
context.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: context.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:23
 * @route '/support-chat/context'
 */
    const contextForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: context.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:23
 * @route '/support-chat/context'
 */
        contextForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: context.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SupportChatController::context
 * @see app/Http/Controllers/SupportChatController.php:23
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
/**
* @see \App\Http\Controllers\SupportChatController::code
 * @see app/Http/Controllers/SupportChatController.php:85
 * @route '/support-chat/code'
 */
export const code = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: code.url(options),
    method: 'post',
})

code.definition = {
    methods: ["post"],
    url: '/support-chat/code',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\SupportChatController::code
 * @see app/Http/Controllers/SupportChatController.php:85
 * @route '/support-chat/code'
 */
code.url = (options?: RouteQueryOptions) => {
    return code.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::code
 * @see app/Http/Controllers/SupportChatController.php:85
 * @route '/support-chat/code'
 */
code.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: code.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\SupportChatController::code
 * @see app/Http/Controllers/SupportChatController.php:85
 * @route '/support-chat/code'
 */
    const codeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: code.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::code
 * @see app/Http/Controllers/SupportChatController.php:85
 * @route '/support-chat/code'
 */
        codeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: code.url(options),
            method: 'post',
        })
    
    code.form = codeForm
/**
* @see \App\Http\Controllers\SupportChatController::lookup
 * @see app/Http/Controllers/SupportChatController.php:97
 * @route '/support-chat/lookup'
 */
export const lookup = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: lookup.url(options),
    method: 'post',
})

lookup.definition = {
    methods: ["post"],
    url: '/support-chat/lookup',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\SupportChatController::lookup
 * @see app/Http/Controllers/SupportChatController.php:97
 * @route '/support-chat/lookup'
 */
lookup.url = (options?: RouteQueryOptions) => {
    return lookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::lookup
 * @see app/Http/Controllers/SupportChatController.php:97
 * @route '/support-chat/lookup'
 */
lookup.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: lookup.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\SupportChatController::lookup
 * @see app/Http/Controllers/SupportChatController.php:97
 * @route '/support-chat/lookup'
 */
    const lookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: lookup.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::lookup
 * @see app/Http/Controllers/SupportChatController.php:97
 * @route '/support-chat/lookup'
 */
        lookupForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: lookup.url(options),
            method: 'post',
        })
    
    lookup.form = lookupForm
/**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
export const show = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/support-chat/conversations/{conversation}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
show.url = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { conversation: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { conversation: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    conversation: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        conversation: typeof args.conversation === 'object'
                ? args.conversation.id
                : args.conversation,
                }

    return show.definition.url
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
show.get = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
show.head = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
    const showForm = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
        showForm.get = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SupportChatController::show
 * @see app/Http/Controllers/SupportChatController.php:116
 * @route '/support-chat/conversations/{conversation}'
 */
        showForm.head = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    show.form = showForm
const SupportChatController = { index, context, store, code, lookup, show }

export default SupportChatController