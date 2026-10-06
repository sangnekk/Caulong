import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
import messages from './messages'
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
const supportChat = {
    messages: Object.assign(messages, messages),
context: Object.assign(context, context),
}

export default supportChat