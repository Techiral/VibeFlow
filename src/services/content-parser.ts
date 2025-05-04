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
    console.log(`YouTube URL detected (Video ID: ${videoId}). Direct transcript fetching is not implemented.`);
    // Refined placeholder message
    return {
      title: `YouTube Video (ID: ${videoId})`, // Include ID in title
      body: `Note: Direct YouTube transcript fetching is not available in VibeFlow.\nThe AI will generate content based on the video's title, URL, and any accessible metadata. The quality may vary depending on available information.`,
      isPlaceholder: true,
    };
  }

  // --- Handle general webpage URLs ---
  try {
    console.log(`Fetching general URL: ${url}`);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}. Check if the URL is correct and publicly accessible.`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
        console.warn(`URL content type might not be HTML (${contentType}). Reading as text.`);
        const textContent = await response.text();
         if (!textContent || textContent.trim().length < 50) {
              console.error(`Fetched non-HTML content from ${url} is too short.`);
              throw new Error(`Fetched content is not HTML and contains very little text. Unable to parse effectively.`);
         }
         console.log(`Successfully read non-HTML text content from ${url}`);
         return { title: 'Web Content (Non-HTML)', body: textContent.trim() };
    }

    // Proceed with HTML parsing
    const html = await response.text();
    console.log(`Fetched HTML content (length: ${html.length}) from: ${url}`);

    let title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || 'Untitled Webpage';
    let bodyText = '';

    // Try specific semantic tags first
    const mainContent = html.match(/<main[^>]*>(.*?)<\/main>/is)?.[1];
    const articleContent = html.match(/<article[^>]*>(.*?)<\/article>/is)?.[1];

    if (mainContent) {
        bodyText = mainContent;
        console.log("Extracted content from <main> tag.");
    } else if (articleContent) {
        bodyText = articleContent;
        console.log("Extracted content from <article> tag.");
    } else {
        // Fallback: try to extract from common content divs, then paragraphs
        const contentDiv = html.match(/<div[^>]+(?:id|class)\s*=\s*["'](?:content|main-content|post-body|entry-content)["'][^>]*>(.*?)<\/div>/is)?.[1];
        if (contentDiv) {
            bodyText = contentDiv;
            console.log("Extracted content from common content div.");
        } else {
            console.log("Falling back to extracting <p> tags.");
            const pMatches = html.match(/<p[^>]*>(.*?)<\/p>/igs);
            bodyText = pMatches ? pMatches.join('\n\n') : ''; // Join paragraphs
        }
    }

    // Clean up extracted body text
    bodyText = bodyText
        .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags and content
        .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags and content
        .replace(/<nav[^>]*>.*?<\/nav>/gis, '') // Remove nav tags
        .replace(/<header[^>]*>.*?<\/header>/gis, '') // Remove header tags
        .replace(/<footer[^>]*>.*?<\/footer>/gis, '') // Remove footer tags
        .replace(/<aside[^>]*>.*?<\/aside>/gis, '') // Remove aside tags
        .replace(/<form[^>]*>.*?<\/form>/gis, '') // Remove form tags
        .replace(/<[^>]+>/g, ' ') // Replace remaining HTML tags with a space
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s\s+/g, ' ') // Collapse multiple whitespace chars
        .trim();

     // Further clean up title
     title = title
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/\|.*?$/, '') // Remove text after | (often site name)
        .replace(/-.*?$/, '') // Remove text after - (often site name)
        .trim();

    console.log(`Cleaned Title: ${title}`);
    console.log(`Cleaned Body Preview (first 200 chars): ${bodyText.substring(0, 200)}...`);

    if (!bodyText || bodyText.length < 100) {
        console.warn("Extracted body text is very short after parsing/cleaning.");
        return {
            title: title || 'Web Content (Short)',
            body: bodyText || `Could only extract very limited text content from ${url}. Summarization quality may be affected.`,
            isPlaceholder: true
        };
    }

    return {
      title: title,
      body: bodyText,
      isPlaceholder: false,
    };

  } catch (error: any) {
    console.error(`Error parsing content from URL (${url}):`, error);
    // Return a placeholder with the error message for the AI to potentially use
    return {
        title: `Error Parsing URL`,
        body: `Failed to fetch or parse content from the URL: ${url}. Error: ${error.message || 'Unknown error'}. The AI will attempt to generate content based on the URL itself.`,
        isPlaceholder: true,
    };
  }
}
