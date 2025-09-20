
/**
 * Converts a snake_case or kebab-case string to camelCase.
 * @param s The input string.
 * @returns The camelCased string.
 */
const toCamel = (s: string): string => {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

/**
 * Converts a camelCase string to snake_case.
 * @param s The input string.
 * @returns The snake_cased string.
 */
const toSnake = (s: string): string => {
  return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Creates a recursive function that converts all keys in an object (or array of objects).
 * @param converter The function to apply to each key (e.g., toCamel or toSnake).
 * @returns A new function that performs the deep conversion.
 */
const createKeyConverter = (converter: (s: string) => string) => {
  const convert = (data: any): any => {
    if (Array.isArray(data)) {
      return data.map(item => convert(item));
    }
    // Ensure it's a plain object, not a File or other class instance
    if (data && typeof data === 'object' && data.constructor === Object) {
      const newObj: { [key: string]: any } = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          newObj[converter(key)] = convert(data[key]);
        }
      }
      return newObj;
    }
    return data;
  };
  return convert;
};

/**
 * Recursively converts all keys of an object from snake_case to camelCase.
 */
export const keysToCamel = createKeyConverter(toCamel);

/**
 * Recursively converts all keys of an object from camelCase to snake_case.
 */
export const keysToSnake = createKeyConverter(toSnake);
