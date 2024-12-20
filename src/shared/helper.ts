export function parseString(str: string) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return [];
  }
}

export function chunk<T>(array: T[], chunkSize: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunked.push(array.slice(i, i + chunkSize));
  }

  return chunked;
}

export function generateSlug(input: string) {
  const words = input?.trim()?.split(' ');
  // Create a new string starting with "output"
  let newString = '';
  // Iterate through each word in the original string
  for (let i = 0; i < words.length; i++) {
    if (i === 0) {
      newString = words[i];
      continue;
    }
    newString += '-' + words[i];
  }
  return (
    newString
      .toLowerCase()
      .replace(/[^\w\s]/gi, '-')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/ /g, '-') +
    '-' +
    new Date().getTime().toString()
  );
}

/**
 * Truncate text to fit within the Twitter character limit, ensuring it ends at a complete sentence.
 */

const MAX_TWEET_LENGTH = 270;

export function truncateToCompleteSentence(text: string): string {
  if (text.length <= MAX_TWEET_LENGTH) {
    return text;
  }

  // Attempt to truncate at the last period within the limit
  const truncatedAtPeriod = text.slice(
    0,
    text.lastIndexOf('.', MAX_TWEET_LENGTH) + 1,
  );
  if (truncatedAtPeriod.trim().length > 0) {
    return truncatedAtPeriod.trim();
  }

  // If no period is found, truncate to the nearest whitespace
  const truncatedAtSpace = text.slice(
    0,
    text.lastIndexOf(' ', MAX_TWEET_LENGTH),
  );
  if (truncatedAtSpace.trim().length > 0) {
    return truncatedAtSpace.trim() + '...';
  }

  // Fallback: Hard truncate and add ellipsis
  return text.slice(0, MAX_TWEET_LENGTH - 3).trim() + '...';
}
