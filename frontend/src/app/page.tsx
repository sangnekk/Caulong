import { laravelPage } from '@/lib/laravel/page';
import Landing from './landing';

// The landing renders in the browser; its title, description and address are in the HTML the
// server sends all the same: laravelPage writes them from what Laravel says about the page.
export default laravelPage(Landing);
