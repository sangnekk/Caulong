import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin/imports',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ImportController::index
 * @see app/Http/Controllers/Admin/ImportController.php:27
 * @route '/admin/imports'
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
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
export const template = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: template.url(options),
    method: 'get',
})

template.definition = {
    methods: ["get","head"],
    url: '/admin/imports/template',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
template.url = (options?: RouteQueryOptions) => {
    return template.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
template.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: template.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
template.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: template.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
    const templateForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: template.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
        templateForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: template.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ImportController::template
 * @see app/Http/Controllers/Admin/ImportController.php:45
 * @route '/admin/imports/template'
 */
        templateForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: template.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    template.form = templateForm
/**
* @see \App\Http\Controllers\Admin\ImportController::store
 * @see app/Http/Controllers/Admin/ImportController.php:53
 * @route '/admin/imports'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/admin/imports',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::store
 * @see app/Http/Controllers/Admin/ImportController.php:53
 * @route '/admin/imports'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::store
 * @see app/Http/Controllers/Admin/ImportController.php:53
 * @route '/admin/imports'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::store
 * @see app/Http/Controllers/Admin/ImportController.php:53
 * @route '/admin/imports'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::store
 * @see app/Http/Controllers/Admin/ImportController.php:53
 * @route '/admin/imports'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\Admin\ImportController::retireDemo
 * @see app/Http/Controllers/Admin/ImportController.php:115
 * @route '/admin/imports/retire-demo'
 */
export const retireDemo = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: retireDemo.url(options),
    method: 'post',
})

retireDemo.definition = {
    methods: ["post"],
    url: '/admin/imports/retire-demo',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::retireDemo
 * @see app/Http/Controllers/Admin/ImportController.php:115
 * @route '/admin/imports/retire-demo'
 */
retireDemo.url = (options?: RouteQueryOptions) => {
    return retireDemo.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::retireDemo
 * @see app/Http/Controllers/Admin/ImportController.php:115
 * @route '/admin/imports/retire-demo'
 */
retireDemo.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: retireDemo.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::retireDemo
 * @see app/Http/Controllers/Admin/ImportController.php:115
 * @route '/admin/imports/retire-demo'
 */
    const retireDemoForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: retireDemo.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::retireDemo
 * @see app/Http/Controllers/Admin/ImportController.php:115
 * @route '/admin/imports/retire-demo'
 */
        retireDemoForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: retireDemo.url(options),
            method: 'post',
        })
    
    retireDemo.form = retireDemoForm
/**
* @see \App\Http\Controllers\Admin\ImportController::publishStocked
 * @see app/Http/Controllers/Admin/ImportController.php:38
 * @route '/admin/imports/publish-stocked'
 */
export const publishStocked = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: publishStocked.url(options),
    method: 'post',
})

publishStocked.definition = {
    methods: ["post"],
    url: '/admin/imports/publish-stocked',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::publishStocked
 * @see app/Http/Controllers/Admin/ImportController.php:38
 * @route '/admin/imports/publish-stocked'
 */
publishStocked.url = (options?: RouteQueryOptions) => {
    return publishStocked.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::publishStocked
 * @see app/Http/Controllers/Admin/ImportController.php:38
 * @route '/admin/imports/publish-stocked'
 */
publishStocked.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: publishStocked.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::publishStocked
 * @see app/Http/Controllers/Admin/ImportController.php:38
 * @route '/admin/imports/publish-stocked'
 */
    const publishStockedForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: publishStocked.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::publishStocked
 * @see app/Http/Controllers/Admin/ImportController.php:38
 * @route '/admin/imports/publish-stocked'
 */
        publishStockedForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: publishStocked.url(options),
            method: 'post',
        })
    
    publishStocked.form = publishStockedForm
/**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
export const show = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/admin/imports/{import}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
show.url = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { import: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    import: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        import: args.import,
                }

    return show.definition.url
            .replace('{import}', parsedArgs.import.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
show.get = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
show.head = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
    const showForm = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: show.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
        showForm.get = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Admin\ImportController::show
 * @see app/Http/Controllers/Admin/ImportController.php:85
 * @route '/admin/imports/{import}'
 */
        showForm.head = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: show.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    show.form = showForm
/**
* @see \App\Http\Controllers\Admin\ImportController::commit
 * @see app/Http/Controllers/Admin/ImportController.php:97
 * @route '/admin/imports/{import}'
 */
export const commit = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: commit.url(args, options),
    method: 'post',
})

commit.definition = {
    methods: ["post"],
    url: '/admin/imports/{import}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImportController::commit
 * @see app/Http/Controllers/Admin/ImportController.php:97
 * @route '/admin/imports/{import}'
 */
commit.url = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { import: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    import: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        import: args.import,
                }

    return commit.definition.url
            .replace('{import}', parsedArgs.import.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImportController::commit
 * @see app/Http/Controllers/Admin/ImportController.php:97
 * @route '/admin/imports/{import}'
 */
commit.post = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: commit.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Admin\ImportController::commit
 * @see app/Http/Controllers/Admin/ImportController.php:97
 * @route '/admin/imports/{import}'
 */
    const commitForm = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: commit.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Admin\ImportController::commit
 * @see app/Http/Controllers/Admin/ImportController.php:97
 * @route '/admin/imports/{import}'
 */
        commitForm.post = (args: { import: string | number } | [importParam: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: commit.url(args, options),
            method: 'post',
        })
    
    commit.form = commitForm
const ImportController = { index, template, store, retireDemo, publishStocked, show, commit }

export default ImportController