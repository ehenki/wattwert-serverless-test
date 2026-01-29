'use client'

import Script from 'next/script'

const GoogleAnalytics = () => {
  return (
    <>
      <Script 
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-XXHB3PKQ2W" 
      />
      <Script 
        id="google-analytics" 
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXHB3PKQ2W');
        `}
      </Script>
    </>
  )
}

export default GoogleAnalytics