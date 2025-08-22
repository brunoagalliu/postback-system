// File: pages/api/admin/stats.js
import { getPool, getOfferStats } from '../../../lib/database.js';

export default async function handler(req, res) {
  try {
    const pool = getPool();

    // Get total cached amount across all offers
    const [globalCacheStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_cached_amount,
        COUNT(DISTINCT clickid) as unique_clickids,
        COUNT(DISTINCT offer_id) as unique_offers,
        COUNT(*) as total_cached_conversions
      FROM cached_conversions
    `);

    // Get postback statistics
    const [postbackStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_postbacks,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_postbacks,
        COALESCE(SUM(amount), 0) as total_postback_amount,
        COUNT(DISTINCT offer_id) as offers_with_postbacks
      FROM postback_history
    `);

    // Get offer-specific statistics
    const offerStats = await getOfferStats();

    // Get cached conversions grouped by offer and clickid (for reference)
    const [cachedByOfferAndClickid] = await pool.execute(`
      SELECT 
        offer_id,
        clickid,
        SUM(amount) as total_amount,
        COUNT(*) as conversion_count,
        MAX(created_at) as last_updated
      FROM cached_conversions
      GROUP BY offer_id, clickid
      ORDER BY offer_id, total_amount DESC
      LIMIT 50
    `);

    // Get recent postbacks
    const [recentPostbacks] = await pool.execute(`
      SELECT clickid, offer_id, amount, success, created_at
      FROM postback_history
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // Get postback statistics by offer
    const [postbacksByOffer] = await pool.execute(`
      SELECT 
        offer_id,
        COUNT(*) as total_postbacks,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_postbacks,
        COALESCE(SUM(amount), 0) as total_amount,
        MAX(created_at) as last_postback
      FROM postback_history
      GROUP BY offer_id
      ORDER BY total_amount DESC
    `);

    const totalPostbacks = postbackStats[0].total_postbacks;
    const successfulPostbacks = postbackStats[0].successful_postbacks;
    const successRate = totalPostbacks > 0 ? (successfulPostbacks / totalPostbacks) * 100 : 0;

    return res.status(200).json({
      // Global statistics
      totalCachedAmount: parseFloat(globalCacheStats[0].total_cached_amount),
      uniqueClickids: parseInt(globalCacheStats[0].unique_clickids),
      uniqueOffers: parseInt(globalCacheStats[0].unique_offers),
      totalCachedConversions: parseInt(globalCacheStats[0].total_cached_conversions),
      
      // Postback statistics
      totalPostbacks: parseInt(totalPostbacks),
      successfulPostbacks: parseInt(successfulPostbacks),
      successRate: successRate,
      totalPostbackAmount: parseFloat(postbackStats[0].total_postback_amount),
      offersWithPostbacks: parseInt(postbackStats[0].offers_with_postbacks),
      
      // Detailed breakdowns
      offerStats: offerStats,
      postbacksByOffer: postbacksByOffer,
      cachedByOfferAndClickid: cachedByOfferAndClickid,
      recentPostbacks: recentPostbacks
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to fetch admin statistics'
    });
  }
}