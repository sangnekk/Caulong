import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
export const sitemap = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: sitemap.url(options),
    method: 'get',
})

sitemap.definition = {
    methods: ["get","head"],
    url: '/sitemap.xml',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
sitemap.url = (options?: RouteQueryOptions) => {
    return sitemap.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
sitemap.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: sitemap.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
sitemap.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: sitemap.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
    const sitemapForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: sitemap.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
        sitemapForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: sitemap.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SeoController::sitemap
 * @see app/Http/Controllers/SeoController.php:11
 * @route '/sitemap.xml'
 */
        sitemapForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: sitemap.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    sitemap.form = sitemapForm
/**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
export const robots = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: robots.url(options),
    method: 'get',
})

robots.definition = {
    methods: ["get","head"],
    url: '/robots.txt',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
robots.url = (options?: RouteQueryOptions) => {
    return robots.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
robots.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: robots.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
robots.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: robots.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
    const robotsForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: robots.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
        robotsForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: robots.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\SeoController::robots
 * @see app/Http/Controllers/SeoController.php:16
 * @route '/robots.txt'
 */
        robotsForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: robots.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    robots.form = robotsForm
const SeoController = { sitemap, robots }

export default SeoController