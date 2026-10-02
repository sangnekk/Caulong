import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
const ReportController = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: ReportController.url(options),
    method: 'get',
})

ReportController.definition = {
    methods: ["get","head"],
    url: '/admin/reports',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
ReportController.url = (options?: RouteQueryOptions) => {
    return ReportController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
ReportController.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: ReportController.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
ReportController.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: ReportController.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
    const ReportControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: ReportController.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
        ReportControllerForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: ReportController.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ReportController::__invoke
 * @see app/Http/Controllers/Admin/ReportController.php:33
 * @route '/admin/reports'
 */
        ReportControllerForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: ReportController.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    ReportController.form = ReportControllerForm
export default ReportController