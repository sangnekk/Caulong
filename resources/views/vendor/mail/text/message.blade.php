@props(['unsubscribe' => null])
<x-mail::layout>
    {{-- Header --}}
    <x-slot:header>
        <x-mail::header :url="\App\Support\Frontend::url('/')">
            {{ config('app.name') }}
        </x-mail::header>
    </x-slot:header>

    {{-- Body --}}
    {{ $slot }}

    {{-- Subcopy --}}
    @isset($subcopy)
        <x-slot:subcopy>
            <x-mail::subcopy>
                {{ $subcopy }}
            </x-mail::subcopy>
        </x-slot:subcopy>
    @endisset

    {{-- Footer --}}
    <x-slot:footer>
        <x-mail::footer>
            © {{ date('Y') }} {{ config('app.name') }}
@if ($unsubscribe)

Bạn nhận email này vì đã đăng ký nhận ưu đãi của cửa hàng. Ngừng nhận email ưu đãi: {{ $unsubscribe }}
@endif
        </x-mail::footer>
    </x-slot:footer>
</x-mail::layout>
