import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
const EmailController = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: EmailController.url(options),
    method: 'get',
})

EmailController.definition = {
    methods: ["get","head"],
    url: '/admin/emails',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
EmailController.url = (options?: RouteQueryOptions) => {
    return EmailController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
EmailController.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: EmailController.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
EmailController.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: EmailController.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
    const EmailControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: EmailController.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
        EmailControllerForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: EmailController.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\EmailController::__invoke
 * @see app/Http/Controllers/Admin/EmailController.php:20
 * @route '/admin/emails'
 */
        EmailControllerForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: EmailController.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    EmailController.form = EmailControllerForm
export default EmailController