/**
 * A simple, centralized logger for the frontend application.
 * Provides styled, color-coded console outputs for different log levels
 * to make debugging and tracing application flow easier.
 */

// Define styles for different log levels to make them visually distinct
const styles = {
  api: 'background: #6c5ce7; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'background: #0984e3; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  warn: 'background: #f9ca24; color: #333; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  error: 'background: #d63031; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
};

const Logger = {
  /**
   * Logs API request/response messages.
   * @param message The primary log message.
   * @param data Optional data object to log (e.g., request body, response JSON).
   */
  api: (message: string, data?: any): void => {
    console.log(`%cAPI%c ${message}`, styles.api, '', data || '');
  },

  /**
   * Logs general informational messages.
   * @param message The primary log message.
   * @param data Optional data object to log.
   */
  info: (message: string, data?: any): void => {
    console.log(`%cINFO%c ${message}`, styles.info, '', data || '');
  },

  /**
   * Logs warning messages.
   * @param message The primary log message.
   * @param data Optional data object to log.
   */
  warn: (message: string, data?: any): void => {
    console.warn(`%cWARN%c ${message}`, styles.warn, '', data || '');
  },

  /**
   * Logs error messages.
   * @param message The primary log message.
   * @param error Optional error object or additional data.
   */
  error: (message: string, error?: any): void => {
    console.error(`%cERROR%c ${message}`, styles.error, '', error || '');
  },
};

export default Logger;
