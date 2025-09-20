/**
 * This file contains default values and constants used throughout the application.
 * Centralizing them here makes them easy to find and change.
 */

/**
 * Default page dimensions to be used as a fallback when the analysis JSON
 * does not provide them. This is crucial for ensuring the PDF highlighting feature
 * works reliably even with incomplete data.
 * 
 * Dimensions are in inches for a standard US Letter size page.
 */
export const DEFAULT_PAGE_DIMENSIONS = {
  width: 8.5,
  height: 11.0,
};
