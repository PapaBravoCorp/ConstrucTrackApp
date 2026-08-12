import { useEffect } from 'react';

const APP_NAME = 'ConstrucTrack';

/**
 * Sets `document.title` to the given page title with app suffix.
 * Restores the app name when the component unmounts.
 *
 * @example usePageTitle('Dashboard')  → "Dashboard — ConstrucTrack"
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const formattedTitle = title ? `${title} — ${APP_NAME}` : APP_NAME;
    document.title = formattedTitle;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
