// File: pages/api/admin/clear-cache.js
import { clearAllCachedConversions, clearCachedConversionsByOffer, logConversion } from '../../../lib/database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { offer_id } = req.query;

    let clearedRows;
    let message;

    if (offer_id) {
      // Clear cache for specific offer
      clearedRows = await clearCachedConversionsByOffer(offer_id);
      message = `Cleared cached conversions for offer ${offer_id}. Removed ${clearedRows} entries.`;

      // Log the offer-specific cache clear
      await logConversion({
        clickid: 'admin',
        offer_id: offer_id,
        action: 'manual_offer_cache_clear',
        message: `Admin manually cleared cached entries for offer ${offer_id}. Removed ${clearedRows} entries.`
      });
    } else {
      // Clear ALL cached conversions (global cache)
      clearedRows = await clearAllCachedConversions();
      message = `Cleared ALL cached conversions. Removed ${clearedRows} total entries from global cache.`;

      // Log the global cache clear
      await logConversion({
        clickid: 'admin',
        action: 'manual_global_cache_clear',
        message: `Admin manually cleared ALL cached entries. Removed ${clearedRows} total entries from global cache.`
      });
    }

    return res.status(200).json({
      success: true,
      clearedRows,
      message,
      offer_id: offer_id || 'all'
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to clear cache'
    });
  }
}