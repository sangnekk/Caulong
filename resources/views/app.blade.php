{{-- Pages are drawn by the Next.js app in frontend/, which asks this server for each page's data.
     A browser only sees this view when it opens the Laravel address itself. --}}
@php
    $frontend = rtrim(config('app.frontend_url'), '/').request()->getRequestUri();
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>{{ config('app.name', 'Laravel') }}</title>
    </head>
    <body style="font-family: system-ui, sans-serif; max-width: 34rem; margin: 15vh auto; padding: 0 1.5rem; line-height: 1.6">
        <h1 style="font-size: 1.25rem">{{ config('app.name', 'Laravel') }}</h1>
        <p>Đây là máy chủ dữ liệu. Giao diện của shop chạy ở địa chỉ khác:</p>
        <p><a href="{{ $frontend }}">{{ $frontend }}</a></p>
    </body>
</html>
