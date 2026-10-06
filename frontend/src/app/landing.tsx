'use client';

import dynamic from 'next/dynamic';

// The landing decides its opening in the browser (whether the intro plays, WebGL, reduced
// motion), so it is rendered there only, as it always was; the server sends its <head>.
export default dynamic(() => import('@/views/welcome'), { ssr: false });
