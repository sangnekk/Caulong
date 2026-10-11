import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
const PrivacyController = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: PrivacyController.url(options),
    method: 'get',
})

PrivacyController.definition = {
    methods: ["get","head"],
    url: '/privacy',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
PrivacyController.url = (options?: RouteQueryOptions) => {
    return PrivacyController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
PrivacyController.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: PrivacyController.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
PrivacyController.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: PrivacyController.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
    const PrivacyControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: PrivacyController.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
        PrivacyControllerForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: PrivacyController.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\PrivacyController::__invoke
 * @see app/Http/Controllers/PrivacyController.php:25
 * @route '/privacy'
 */
        PrivacyControllerForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: PrivacyController.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    PrivacyController.form = PrivacyControllerForm
export default PrivacyController