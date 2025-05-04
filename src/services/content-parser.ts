/**
 * @fileOverview Service for parsing content. (URL parsing removed)
 */

/**
 * Represents the parsed content. (Simplified)
 */
export interface ParsedContent {
  /**
   * The title of the content (optional).
   */
  title?: string;
  /**
   * The main text body of the content.
   */
  body: string;
  /**
   * Flag indicating if the content is a placeholder (e.g., for YouTube) or resulted from a parsing error.
   */
  isPlaceholder?: boolean;
}


/**
 * Asynchronously parses content. Currently only handles direct text.
 * URL parsing functionality has been removed.
 *
 * @param input The text content to "parse".
 * @returns A promise that resolves to a ParsedContent object.
 * @throws Throws an error if the input is not valid text (though this is less likely now).
 */
export async function parseContent(input: string): Promise<ParsedContent> {
  console.log(`"Parsing" text content (length: ${input.length})`);

  // No URL handling anymore. Assume input is always text.
  if (typeof input !== 'string' || !input.trim()) {
      console.error("Invalid input: Content must be a non-empty string.");
      // Return an error-like structure for consistency, though summarizeContent should handle empty input.
      return {
          title: "Invalid Input",
          body: "Input content cannot be empty.",
          isPlaceholder: true, // Mark as placeholder/error
      };
  }

  // Return the input text directly in the ParsedContent structure
  return {
    body: input.trim(), // Trim whitespace
    isPlaceholder: false,
  };
}
