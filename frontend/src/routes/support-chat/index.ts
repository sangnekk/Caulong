import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
import messages from './messages'
import conversations from './conversations'
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
const supportChat = {
    messages: Object.assign(messages, messages),
context: Object.assign(context, context),
code: Object.assign(code, code),
lookup: Object.assign(lookup, lookup),
conversations: Object.assign(conversations, conversations),
}

export default supportChat