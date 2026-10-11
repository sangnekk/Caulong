import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
* @see \App\Http\Controllers\AccountController::update
 * @see app/Http/Controllers/AccountController.php:74
 * @route '/account'
 */
export const update = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/account',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\AccountController::update
 * @see app/Http/Controllers/AccountController.php:74
 * @route '/account'
 */
update.url = (options?: RouteQueryOptions) => {
    return update.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AccountController::update
 * @see app/Http/Controllers/AccountController.php:74
 * @route '/account'
 */
update.patch = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\AccountController::update
 * @see app/Http/Controllers/AccountController.php:74
 * @route '/account'
 */
    const updateForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\AccountController::update
 * @see app/Http/Controllers/AccountController.php:74
 * @route '/account'
 */
        updateForm.patch = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\AccountController::password
 * @see app/Http/Controllers/AccountController.php:93
 * @route '/account/password'
 */
export const password = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: password.url(options),
    method: 'put',
})

password.definition = {
    methods: ["put"],
    url: '/account/password',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\AccountController::password
 * @see app/Http/Controllers/AccountController.php:93
 * @route '/account/password'
 */
password.url = (options?: RouteQueryOptions) => {
    return password.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AccountController::password
 * @see app/Http/Controllers/AccountController.php:93
 * @route '/account/password'
 */
password.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: password.url(options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\AccountController::password
 * @see app/Http/Controllers/AccountController.php:93
 * @route '/account/password'
 */
    const passwordForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: password.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\AccountController::password
 * @see app/Http/Controllers/AccountController.php:93
 * @route '/account/password'
 */
        passwordForm.put = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: password.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    password.form = passwordForm
/**
* @see \App\Http\Controllers\AccountController::destroy
 * @see app/Http/Controllers/AccountController.php:105
 * @route '/account'
 */
export const destroy = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/account',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\AccountController::destroy
 * @see app/Http/Controllers/AccountController.php:105
 * @route '/account'
 */
destroy.url = (options?: RouteQueryOptions) => {
    return destroy.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AccountController::destroy
 * @see app/Http/Controllers/AccountController.php:105
 * @route '/account'
 */
destroy.delete = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\AccountController::destroy
 * @see app/Http/Controllers/AccountController.php:105
 * @route '/account'
 */
    const destroyForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: destroy.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\AccountController::destroy
 * @see app/Http/Controllers/AccountController.php:105
 * @route '/account'
 */
        destroyForm.delete = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: destroy.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    destroy.form = destroyForm
/**
* @see \App\Http\Controllers\MarketingConsentController::marketing
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
export const marketing = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: marketing.url(options),
    method: 'patch',
})

marketing.definition = {
    methods: ["patch"],
    url: '/account/marketing',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\MarketingConsentController::marketing
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
marketing.url = (options?: RouteQueryOptions) => {
    return marketing.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MarketingConsentController::marketing
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
marketing.patch = (options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: marketing.url(options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\MarketingConsentController::marketing
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
    const marketingForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: marketing.url({
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\MarketingConsentController::marketing
 * @see app/Http/Controllers/MarketingConsentController.php:18
 * @route '/account/marketing'
 */
        marketingForm.patch = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: marketing.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    marketing.form = marketingForm
const account = {
    update: Object.assign(update, update),
password: Object.assign(password, password),
destroy: Object.assign(destroy, destroy),
marketing: Object.assign(marketing, marketing),
}

export default account