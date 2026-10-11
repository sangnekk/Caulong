import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin/service-strings',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ServiceStringController::index
 * @see app/Http/Controllers/Admin/ServiceStringController.php:19
 * @route '/admin/service-strings'
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
* @see \App\Http\Controllers\Admin\ServiceStringController::store
 * @see app/Http/Controllers/Admin/ServiceStringController.php:31
 * @route '/admin/service-strings'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/admin/service-strings',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::store
 * @see app/Http/Controllers/Admin/ServiceStringController.php:31
 * @route '/admin/service-strings'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::store
 * @see app/Http/Controllers/Admin/ServiceStringController.php:31
 * @route '/admin/service-strings'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceStringController::store
 * @see app/Http/Controllers/Admin/ServiceStringController.php:31
 * @route '/admin/service-strings'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceStringController::store
 * @see app/Http/Controllers/Admin/ServiceStringController.php:31
 * @route '/admin/service-strings'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\Admin\ServiceStringController::update
 * @see app/Http/Controllers/Admin/ServiceStringController.php:38
 * @route '/admin/service-strings/{serviceString}'
 */
export const update = (args: { serviceString: number | { id: number } } | [serviceString: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/admin/service-strings/{serviceString}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::update
 * @see app/Http/Controllers/Admin/ServiceStringController.php:38
 * @route '/admin/service-strings/{serviceString}'
 */
update.url = (args: { serviceString: number | { id: number } } | [serviceString: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { serviceString: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { serviceString: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    serviceString: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        serviceString: typeof args.serviceString === 'object'
                ? args.serviceString.id
                : args.serviceString,
                }

    return update.definition.url
            .replace('{serviceString}', parsedArgs.serviceString.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ServiceStringController::update
 * @see app/Http/Controllers/Admin/ServiceStringController.php:38
 * @route '/admin/service-strings/{serviceString}'
 */
update.put = (args: { serviceString: number | { id: number } } | [serviceString: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Admin\ServiceStringController::update
 * @see app/Http/Controllers/Admin/ServiceStringController.php:38
 * @route '/admin/service-strings/{serviceString}'
 */
    const updateForm = (args: { serviceString: number | { id: number } } | [serviceString: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ServiceStringController::update
 * @see app/Http/Controllers/Admin/ServiceStringController.php:38
 * @route '/admin/service-strings/{serviceString}'
 */
        updateForm.put = (args: { serviceString: number | { id: number } } | [serviceString: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
const ServiceStringController = { index, store, update }

export default ServiceStringController