// @/lib/analytics.ts

// This interface declaration is necessary for TypeScript to recognize the gtag function on the window object.
declare global {
  interface Window {
    gtag: (param1: string, param2: string, param3: object) => void;
  }
}

/**
 * Sends a custom event to Google Analytics.
 * @param {string} action - The action of the event (e.g., 'click').
 * @param {string} category - The category of the event (e.g., 'navigation').
 * @param {string} label - The label for the event (e.g., 'next_button').
 * @param {number} [value] - An optional numeric value for the event.
 */
export const trackEvent = (action: string, category: string, label: string, value?: number) => {
  // Check if the gtag function is available (it should be if the user consented to cookies)
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  } else {
    // Fallback for development or if gtag isn't loaded
    console.log(`GA Event (not sent): ${action}, ${category}, ${label}, ${value || ''}`);
  }
};
