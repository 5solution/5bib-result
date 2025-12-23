/**
 * Retry an async operation multiple times with delay between attempts.
 *
 * @param fn - The async function to retry.
 * @param times - Maximum number of retry attempts.
 * @param timeout - Delay between retries in milliseconds.
 * @returns The result of the async function if successful.
 * @throws The last error after all retries fail.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times: number,
  timeout: number,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= times; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt < times) {
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    }
  }

  throw lastError;
}
