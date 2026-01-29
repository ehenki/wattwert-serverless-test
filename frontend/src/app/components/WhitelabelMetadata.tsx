'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { WhitelabelData } from './database/getWhitelabelData';

export default function WhitelabelMetadata() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const storedData = localStorage.getItem('whitelabel_data');
      if (storedData) {
        const data: WhitelabelData = JSON.parse(storedData);
        
        // Update Favicon
        if (data.logo_url) {
          const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
          link.type = 'image/x-icon';
          link.rel = 'shortcut icon';
          link.href = data.logo_url;
          document.getElementsByTagName('head')[0].appendChild(link);
        }

        // Update Title
        if (data.name) {
          // Small timeout to ensure we override Next.js default title update
          setTimeout(() => {
            document.title = data.name ? `Schnellaufmaß von ${data.name}` : 'Schnellaufmaß';
          }, 100);
        }
      }
    } catch (e) {
      console.error("Failed to update metadata from whitelabel data", e);
    }
  }, [pathname, searchParams]);

  return null;
}
