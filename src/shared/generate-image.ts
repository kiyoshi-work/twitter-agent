import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import OpenAI from 'openai';

dotenv.config();

const openAiApiKey = process.env.OPEN_AI_API_KEY;
const client = new OpenAI({
  apiKey: openAiApiKey,
});

interface NumberResponse {
  numbers: number[];
}

interface ImageSearchParams {
  q: string;
  categories: string;
  format: string;
}

async function searchImages(query: string, numImages = 9): Promise<string[]> {
  const searxngUrl = 'http://localhost:32768/search';
  const params: ImageSearchParams = {
    q: query,
    categories: 'images',
    format: 'json',
  };

  let attempt = 0;
  const validUrls: string[] = [];

  while (attempt < 5 && validUrls.length < numImages) {
    try {
      const response = await axios.get(searxngUrl, { params });
      const images = response.data.results;

      for (const img of images) {
        if (validUrls.length >= numImages) break;

        const url = img.img_src;
        try {
          await axios.get(url, { timeout: 5000 });
          validUrls.push(url);
        } catch {
          // Skip invalid URLs
        }
      }
    } catch (error) {
      console.error(`Error fetching images: ${error}`);
    }

    attempt++;
  }

  return validUrls;
}

async function cropAndResizeImage(
  url: string,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer | null> {
  try {
    const image = await loadImage(url);
    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    const width = image.width;
    const height = (image.width * 2) / 3; // Maintain 2:3 ratio
    const yOffset = (image.height - height) / 2;

    ctx.drawImage(
      image,
      0,
      yOffset,
      width,
      height,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    return canvas.toBuffer('image/jpeg');
  } catch (error) {
    console.error(`Error processing image: ${error}`);
    return null;
  }
}

async function combineImages(
  imageUrls: string[],
  targetWidth: number,
  targetHeight: number,
  padding = 20,
): Promise<Buffer> {
  const canvas = createCanvas(
    (targetWidth + padding) * 3,
    (targetHeight + padding) * 3,
  );
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const x = j * (targetWidth + padding);
      const y = i * (targetHeight + padding);

      try {
        const image = await cropAndResizeImage(
          imageUrls[index],
          targetWidth,
          targetHeight,
        );
        if (image) {
          const img = await loadImage(image);
          ctx.drawImage(img, x, y);

          // Add index number
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(x + 20, y + 20, 15, 0, 2 * Math.PI);
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.font = 'Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((index + 1).toString(), x + 20, y + 20);
        }
      } catch {
        // Skip failed images
      }
    }
  }

  return canvas.toBuffer('image/jpeg');
}

async function encodeImage(filePath: string): Promise<string> {
  const data = await fs.promises.readFile(filePath);
  return data.toString('base64');
}

export async function chooseThumbnailImage(
  title: string,
  content: string,
): Promise<string[]> {
  const imageUrls = await searchImages(title);
  console.log('Image URLs:', imageUrls);

  if (imageUrls.length === 0) {
    return [];
  }

  const combinedImageBuffer = await combineImages(imageUrls, 300, 200);
  const base64Image = combinedImageBuffer.toString('base64'); // Convert to Base64

  try {
    const response = await client.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Choose three suitable images for a given tweet content. Avoid images with text.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
            CONTENT: ${content}
          `,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'number_schema',
          schema: {
            type: 'object',
            properties: {
              numbers: {
                description: "The list of selected images' numbers",
                type: 'array',
                items: {
                  type: 'integer',
                },
              },
            },
            additionalProperties: false,
          },
        },
      },
    });

    if (response.choices[0].message.parsed) {
      const chosenNumbers: NumberResponse = response.choices[0].message.parsed;
      console.log('Chosen numbers:', response.choices[0].message.parsed);

      return chosenNumbers.numbers.map((index) => imageUrls[index - 1]);
    } else {
      console.error('Failed to parse the response for chosen numbers.');
      return imageUrls;
    }
  } catch (error) {
    console.error(`Error with OpenAI API: ${error}`);
    return imageUrls;
  }
}
export async function generateText(context: string, prompt: string) {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: context,
      },
    ],
  });
  return completion.choices[0].message;
}

export async function generateImage(content: string) {
  const prompt = `
    You are a helpful AI assistant. Your task is to create a sentence that summarize a given text paragraph 
    and that sentence will be used to search for a funny meme image on the internet. 
    Given the text from user, be creative to generate a short sentence of maximum 50 characters and only return that setence to the user.
    `;
  const title = await generateText(content, prompt);
  console.log('Title: ', title.content);
  const thumbnailUrls = await chooseThumbnailImage(title?.content, content);
  console.log('Chosen Thumbnails:', thumbnailUrls);
  return await Promise.all(
    thumbnailUrls.map((url) => convertImageUrlToBuffer(url)),
  );
}

async function convertImageUrlToBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer', // Ensure we get the data as a buffer
    });

    const data = Buffer.from(response.data); // Convert the response data to a Buffer
    const mediaType = response.headers['content-type']; // Get the media type from the response headers

    return {
      data,
      mediaType,
    };
  } catch (error) {
    console.error('Error fetching the image:', error);
    throw error; // Rethrow the error for further handling
  }
}
