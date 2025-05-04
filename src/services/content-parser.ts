/**
 * @fileOverview Service for parsing content from URLs or text.
 */

/**
 * Represents the parsed content.
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
   * Flag indicating if the content is from a source that couldn't be fully processed (e.g., YouTube).
   */
  isPlaceholder?: boolean;
}

// Basic regex to identify YouTube video URLs
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * Asynchronously parses content from a URL.
 * Attempts to fetch and extract text from general webpages.
 * Returns a placeholder for YouTube URLs as transcript fetching is complex.
 *
 * @param url The URL to parse.
 * @returns A promise that resolves to a ParsedContent object.
 * @throws Throws an error if fetching or basic parsing fails for non-YouTube URLs.
 */
export async function parseContent(url: string): Promise<ParsedContent> {
  console.log(`Attempting to parse content from URL: ${url}`);

  // Check for YouTube URL
  if (YOUTUBE_REGEX.test(url)) {
    console.log("YouTube URL detected. Transcript fetching not implemented.");
    return {
      title: "YouTube Video",
      body: `Content parsing for YouTube URL (${url}) is not yet supported. The AI will attempt to summarize based on the URL itself.`,
      isPlaceholder: true,
    };
  }

  // --- Handle general webpage URLs ---
  try {
    const response = await fetch(url, {
        headers: { // Add a basic User-Agent to mimic a browser
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        // Add timeout? Requires AbortController, more complex for now.
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
        // Attempt to read as text anyway, might be plain text
        console.warn(`URL content type is not HTML (${contentType}). Attempting to read as text.`);
        const textContent = await response.text();
         if (!textContent || textContent.trim().length < 10) {
              throw new Error("Fetched content is not HTML and contains little text.");
         }
         return { body: textContent.trim() }; // Return raw text if not HTML but has content
        // Original throw: throw new Error(`URL content type is not HTML (${contentType})`);
    }

    const html = await response.text();
    console.log(`Fetched HTML content (length: ${html.length}) from: ${url}`);

    // Basic HTML parsing (avoiding heavy server-side libraries for now)
    let title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Untitled';
    // Attempt to extract main content - very simplified, targets <p> tags
    // This is prone to errors and might grab unwanted text.
    const bodyMatches = html.match(/<p[^>]*>(.*?)<\/p>/igs); // 's' flag for dotall
    let bodyText = bodyMatches
        ? bodyMatches.map(p => p.replace(/<[^>]+>/g, '').trim()).join('\n\n') // Remove tags and join paragraphs
        : '';

    // Fallback: try to strip all tags if <p> tags didn't yield much
    if (!bodyText || bodyText.length < 100) {
        console.log("Minimal content from <p> tags, attempting full tag strip.");
        bodyText = html
            .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style blocks
            .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script blocks
            .replace(/<[^>]+>/g, ' ') // Replace all other tags with space
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
    }

     // Clean up title
     title = title.replace(/&[^;]+;/g, '').replace(/\s+/g, ' ').trim(); // Decode entities crudely, collapse space

    console.log(`Extracted Title: ${title}`);
    console.log(`Extracted Body Preview (first 100 chars): ${bodyText.substring(0, 100)}...`);

    if (!bodyText || bodyText.trim().length < 50) { // Increase threshold slightly
        console.warn("Extracted body text is very short after parsing.");
        // Decide whether to throw or return the short text
         // For now, return short text, summarizer might handle it
        // throw new Error("Failed to extract sufficient text content from the webpage.");
    }

    return {
      title: title || 'Untitled',
      body: bodyText.trim(),
    };

  } catch (error: any) {
    console.error(`Error parsing content from URL (${url}):`, error);
    // Re-throw a more specific error for the flow to catch
    throw new Error(`Failed to fetch or parse content from URL: ${error.message || 'Unknown error'}`);
  }
}