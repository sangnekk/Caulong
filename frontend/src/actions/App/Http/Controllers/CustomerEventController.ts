import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CustomerEventController::__invoke
 * @see app/Http/Controllers/CustomerEventController.php:18
 * @route '/events'
 */
const CustomerEventController = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: CustomerEventController.url(options),
    method: 'post',
})

CustomerEventController.definition = {
    methods: ["post"],
    url: '/events',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CustomerEventController::__invoke
 * @see app/Http/Controllers/CustomerEventController.php:18
 * @route '/events'
 */
CustomerEventController.url = (options?: RouteQueryOptions) => {
    return CustomerEventController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CustomerEventController::__invoke
 * @see app/Http/Controllers/CustomerEventController.php:18
 * @route '/events'
 */
CustomerEventController.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: CustomerEventController.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\CustomerEventController::__invoke
 * @see app/Http/Controllers/CustomerEventController.php:18
 * @route '/events'
 */
    const CustomerEventControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: CustomerEventController.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CustomerEventController::__invoke
 * @see app/Http/Controllers/CustomerEventController.php:18
 * @route '/events'
 */
        CustomerEventControllerForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: CustomerEventController.url(options),
            method: 'post',
        })
    
    CustomerEventController.form = CustomerEventControllerForm
export default CustomerEventController