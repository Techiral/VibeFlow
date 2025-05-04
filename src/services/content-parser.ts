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
   * The main text body of the content. Could be extracted text, a placeholder, or an error message.
   */
  body: string;
  /**
   * Flag indicating if the content is a placeholder (e.g., for YouTube) or resulted from a parsing error.
   */
  isPlaceholder?: boolean;
}

// Basic regex to identify YouTube video URLs more reliably
const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * Asynchronously parses content from a URL.
 * Attempts to fetch and extract text from general webpages.
 * Provides a more informative placeholder for YouTube URLs.
 *
 * @param url The URL to parse.
 * @returns A promise that resolves to a ParsedContent object.
 * @throws Throws an error if fetching or basic parsing fails critically for non-YouTube URLs.
 */
export async function parseContent(url: string): Promise<ParsedContent> {
  console.log(`Attempting to parse content from URL: ${url}`);

  // Check for YouTube URL
  const youtubeMatch = url.match(YOUTUBE_REGEX);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    console.log(`YouTube URL detected (Video ID: ${videoId}). Transcript fetching not implemented.`);
    return {
      title: "YouTube Video",
      body: `Fetching transcripts for YouTube videos (ID: ${videoId}) is complex and not currently supported by VibeFlow's basic parser.\n\nThe AI will attempt to generate posts based on the video's URL and potentially available metadata if accessible.`,
      isPlaceholder: true,
    };
  }

  // --- Handle general webpage URLs ---
  try {
    const response = await fetch(url, {
        headers: { // Add a basic User-Agent to mimic a browser
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', // Be more specific about accepted types
            'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow', // Follow redirects
        // Add timeout? Requires AbortController, more complex for now.
    });

    if (!response.ok) {
       // Provide more context in the error message
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}. Please check if the URL is correct and publicly accessible.`);
    }

    const contentType = response.headers.get('content-type');
    // Check if content type indicates HTML
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
        console.warn(`URL content type might not be HTML (${contentType}). Attempting to read as text.`);
        const textContent = await response.text();
         // Check if the extracted text is meaningful
         if (!textContent || textContent.trim().length < 50) { // Increased threshold
              throw new Error(`Fetched content is not HTML and contains very little text. Unable to parse effectively.`);
         }
         // If it's not HTML but has text, return it as is.
         return { title: 'Web Content (Non-HTML)', body: textContent.trim() };
    }

    // Proceed with HTML parsing
    const html = await response.text();
    console.log(`Fetched HTML content (length: ${html.length}) from: ${url}`);

    // Basic HTML parsing (can be improved with libraries like cheerio if needed on server)
    let title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || 'Untitled Webpage';
    // A more robust attempt to get main content (simple approach)
    // 1. Try <main> tag
    let bodyText = html.match(/<main[^>]*>(.*?)<\/main>/is)?.[1] || '';
    // 2. If no <main>, try <article> tag
    if (!bodyText) {
      bodyText = html.match(/<article[^>]*>(.*?)<\/article>/is)?.[1] || '';
    }
    // 3. If still nothing, fallback to joining <p> tags (as before)
    if (!bodyText) {
        const bodyMatches = html.match(/<p[^>]*>(.*?)<\/p>/igs);
        bodyText = bodyMatches ? bodyMatches.map(p => p.replace(/<[^>]+>/g, '').trim()).join('\n\n') : '';
    }

    // Clean up extracted body text: remove scripts, styles, excessive whitespace
    bodyText = bodyText
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ') // Replace remaining tags with spaces
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/\s\s+/g, ' ') // Collapse multiple whitespace characters
        .trim();

     // Clean up title further (e.g., remove common site name suffixes)
     title = title.replace(/&[^;]+;/g, '').replace(/\s+/g, ' ').replace(/\|.*?$/, '').trim(); // Remove text after |

    console.log(`Extracted Title: ${title}`);
    console.log(`Extracted Body Preview (first 150 chars): ${bodyText.substring(0, 150)}...`);

    // Check if the extracted body is substantial enough
    if (!bodyText || bodyText.length < 100) { // Use a reasonable length threshold
        console.warn("Extracted body text is very short after parsing. The URL might be complex, use dynamic rendering, or lack substantial text content.");
        // Return the short text but flag as placeholder/potential issue
        return {
            title: title || 'Web Content (Short)',
            body: bodyText || `Could only extract very little text from ${url}. Summarization might be limited.`,
            isPlaceholder: true
        };
    }

    return {
      title: title,
      body: bodyText,
      isPlaceholder: false, // Successfully parsed substantial content
    };

  } catch (error: any) {
    console.error(`Error parsing content from URL (${url}):`, error);
    // Re-throw a more specific error for the flow to catch, including the original message
    throw new Error(`Failed to parse content from URL. ${error.message || 'Unknown error'}`);
  }
}
