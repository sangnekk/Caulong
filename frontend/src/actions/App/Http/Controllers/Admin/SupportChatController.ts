import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin/support-chat',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\SupportChatController::index
 * @see app/Http/Controllers/Admin/SupportChatController.php:26
 * @route '/admin/support-chat'
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
* @see \App\Http\Controllers\Admin\SupportChatController::claim
 * @see app/Http/Controllers/Admin/SupportChatController.php:111
 * @route '/admin/support-chat/{conversation}/claim'
 */
export const claim = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: claim.url(args, options),
    method: 'post',
})

claim.definition = {
    methods: ["post"],
    url: '/admin/support-chat/{conversation}/claim',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\SupportChatController::claim
 * @see app/Http/Controllers/Admin/SupportChatController.php:111
 * @route '/admin/support-chat/{conversation}/claim'
 */
claim.url = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return claim.definition.url
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\SupportChatController::claim
 * @see app/Http/Controllers/Admin/SupportChatController.php:111
 * @route '/admin/support-chat/{conversation}/claim'
 */
claim.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: claim.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\SupportChatController::claim
 * @see app/Http/Controllers/Admin/SupportChatController.php:111
 * @route '/admin/support-chat/{conversation}/claim'
 */
    const claimForm = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: claim.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\SupportChatController::claim
 * @see app/Http/Controllers/Admin/SupportChatController.php:111
 * @route '/admin/support-chat/{conversation}/claim'
 */
        claimForm.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: claim.url(args, options),
            method: 'post',
        })
    
    claim.form = claimForm
/**
* @see \App\Http\Controllers\Admin\SupportChatController::reply
 * @see app/Http/Controllers/Admin/SupportChatController.php:135
 * @route '/admin/support-chat/{conversation}/reply'
 */
export const reply = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reply.url(args, options),
    method: 'post',
})

reply.definition = {
    methods: ["post"],
    url: '/admin/support-chat/{conversation}/reply',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\SupportChatController::reply
 * @see app/Http/Controllers/Admin/SupportChatController.php:135
 * @route '/admin/support-chat/{conversation}/reply'
 */
reply.url = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return reply.definition.url
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\SupportChatController::reply
 * @see app/Http/Controllers/Admin/SupportChatController.php:135
 * @route '/admin/support-chat/{conversation}/reply'
 */
reply.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reply.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\SupportChatController::reply
 * @see app/Http/Controllers/Admin/SupportChatController.php:135
 * @route '/admin/support-chat/{conversation}/reply'
 */
    const replyForm = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: reply.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\SupportChatController::reply
 * @see app/Http/Controllers/Admin/SupportChatController.php:135
 * @route '/admin/support-chat/{conversation}/reply'
 */
        replyForm.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: reply.url(args, options),
            method: 'post',
        })
    
    reply.form = replyForm
/**
* @see \App\Http\Controllers\Admin\SupportChatController::resolve
 * @see app/Http/Controllers/Admin/SupportChatController.php:155
 * @route '/admin/support-chat/{conversation}/resolve'
 */
export const resolve = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: resolve.url(args, options),
    method: 'post',
})

resolve.definition = {
    methods: ["post"],
    url: '/admin/support-chat/{conversation}/resolve',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\SupportChatController::resolve
 * @see app/Http/Controllers/Admin/SupportChatController.php:155
 * @route '/admin/support-chat/{conversation}/resolve'
 */
resolve.url = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return resolve.definition.url
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\SupportChatController::resolve
 * @see app/Http/Controllers/Admin/SupportChatController.php:155
 * @route '/admin/support-chat/{conversation}/resolve'
 */
resolve.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: resolve.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\SupportChatController::resolve
 * @see app/Http/Controllers/Admin/SupportChatController.php:155
 * @route '/admin/support-chat/{conversation}/resolve'
 */
    const resolveForm = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: resolve.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\SupportChatController::resolve
 * @see app/Http/Controllers/Admin/SupportChatController.php:155
 * @route '/admin/support-chat/{conversation}/resolve'
 */
        resolveForm.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: resolve.url(args, options),
            method: 'post',
        })
    
    resolve.form = resolveForm
/**
* @see \App\Http\Controllers\Admin\SupportChatController::close
 * @see app/Http/Controllers/Admin/SupportChatController.php:167
 * @route '/admin/support-chat/{conversation}/close'
 */
export const close = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: close.url(args, options),
    method: 'post',
})

close.definition = {
    methods: ["post"],
    url: '/admin/support-chat/{conversation}/close',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\SupportChatController::close
 * @see app/Http/Controllers/Admin/SupportChatController.php:167
 * @route '/admin/support-chat/{conversation}/close'
 */
close.url = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return close.definition.url
            .replace('{conversation}', parsedArgs.conversation.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\SupportChatController::close
 * @see app/Http/Controllers/Admin/SupportChatController.php:167
 * @route '/admin/support-chat/{conversation}/close'
 */
close.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: close.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\SupportChatController::close
 * @see app/Http/Controllers/Admin/SupportChatController.php:167
 * @route '/admin/support-chat/{conversation}/close'
 */
    const closeForm = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: close.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\SupportChatController::close
 * @see app/Http/Controllers/Admin/SupportChatController.php:167
 * @route '/admin/support-chat/{conversation}/close'
 */
        closeForm.post = (args: { conversation: number | { id: number } } | [conversation: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: close.url(args, options),
            method: 'post',
        })
    
    close.form = closeForm
const SupportChatController = { index, claim, reply, resolve, close }

export default SupportChatController