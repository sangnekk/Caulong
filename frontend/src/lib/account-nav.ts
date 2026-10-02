import { usePage } from '@inertiajs/react';
import { Compass, LayoutGrid, ShoppingBag } from 'lucide-react';
import type { NavItem } from '@/types';
import type { ShopSharedProps } from '@/types/commerce';

/** Account pages lead back into the shop (and to /admin for admins), not to a dashboard. */
export function useAccountNav(): NavItem[] {
    const { shop } = usePage<ShopSharedProps>().props;
    return [
        { title: 'Cửa hàng', href: '/products', icon: ShoppingBag },
        { title: 'Gợi ý chọn vợt', href: '/advisor', icon: Compass },
        ...(shop?.is_admin
            ? [{ title: 'Quản trị', href: '/admin', icon: LayoutGrid }]
            : []),
    ];
}
