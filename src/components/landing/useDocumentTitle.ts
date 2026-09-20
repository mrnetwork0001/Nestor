import { useEffect } from "react";

/**
 * Sets the tab title while a page is mounted and puts the previous one back
 * afterwards, so pages that never set a title keep the default from index.html.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
