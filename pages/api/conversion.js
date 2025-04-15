// File: pages/api/conversion.js
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export default async function handler(req, res) {
  // Get query parameters
  const { clickid, sum } = req.query;
  const sumValue = parseFloat(sum || 0);

  // Validate input
  if (!clickid || sumValue <= 0) {
    return res.status(200).send("Invalid or missing data.");
  }

  // Path to cache file (stored in tmp directory which is writable in most serverless environments)
  const cacheFile = path.join('/tmp', 'conversion_cache.json');
  
  // Load existing cache
  let cache = { cached_total: 0 };
  try {
    // Check if file exists
    if (fs.existsSync(cacheFile)) {
      const fileContent = await fsPromises.readFile(cacheFile, 'utf8');
      cache = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
    // Continue with empty cache if there's an error
  }

  // If under $2, add to cache and exit
  if (sumValue < 2) {
    cache.cached_total += sumValue;
    await fsPromises.writeFile(cacheFile, JSON.stringify(cache));
    return res.status(200).send(`Cached sub-$2 conversion. Total cached: ${cache.cached_total}`);
  }

  // This conversion is $2+, add cached total (if any), and fire postback
  const totalToSend = sumValue + (cache.cached_total || 0);
  const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(clickid)}&sum=${encodeURIComponent(totalToSend)}`;

  // Send postback
  try {
    const response = await fetch(redtrackUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending postback:', error);
    // Continue even if postback fails
  }

  // Clear the cache
  await fsPromises.writeFile(cacheFile, JSON.stringify({ cached_total: 0 }));
  
  return res.status(200).send(`Fired postback to RedTrack with total: ${totalToSend} (clickid: ${clickid})`);
}