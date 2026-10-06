import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
const RecommendationController = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: RecommendationController.url(options),
    method: 'get',
})

RecommendationController.definition = {
    methods: ["get","head"],
    url: '/recommendations',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
RecommendationController.url = (options?: RouteQueryOptions) => {
    return RecommendationController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
RecommendationController.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: RecommendationController.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
RecommendationController.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: RecommendationController.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
    const RecommendationControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: RecommendationController.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
        RecommendationControllerForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: RecommendationController.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\RecommendationController::__invoke
 * @see app/Http/Controllers/RecommendationController.php:21
 * @route '/recommendations'
 */
        RecommendationControllerForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: RecommendationController.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    RecommendationController.form = RecommendationControllerForm
export default RecommendationController