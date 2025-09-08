// File: pages/api/admin/vertical-details.js
import { getPool } from '../../../lib/database.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed' 
    });
  }

  try {
    const { vertical_id } = req.query;
    
    if (!vertical_id) {
      return res.status(400).json({
        success: false,
        message: 'vertical_id parameter is required'
      });
    }

    const connection = await getPool().getConnection();
    
    try {
      // Get vertical info
      const [verticalInfo] = await connection.execute(`
        SELECT * FROM verticals WHERE id = ?
      `, [vertical_id]);

      if (verticalInfo.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vertical not found'
        });
      }

      // Get all offers in this vertical with their cached amounts
      const [offerDetails] = await connection.execute(`
        SELECT 
          o.offer_id,
          o.offer_name,
          COALESCE(SUM(cc.amount), 0) as cached_amount,
          COUNT(DISTINCT cc.clickid) as cached_conversions,
          COUNT(cc.id) as total_cache_entries,
          MIN(cc.created_at) as oldest_cache,
          MAX(cc.created_at) as newest_cache
        FROM offers o
        JOIN offer_verticals ov ON o.offer_id = ov.offer_id
        LEFT JOIN cached_conversions cc ON o.offer_id = cc.offer_id
        WHERE ov.vertical_id = ?
        GROUP BY o.offer_id, o.offer_name
        ORDER BY cached_amount DESC, o.offer_id
      `, [vertical_id]);

      // Get detailed cached conversions breakdown
      const [cacheBreakdown] = await connection.execute(`
        SELECT 
          cc.offer_id,
          cc.clickid,
          cc.amount,
          cc.created_at,
          o.offer_name
        FROM cached_conversions cc
        JOIN offer_verticals ov ON cc.offer_id = ov.offer_id
        JOIN offers o ON cc.offer_id = o.offer_id
        WHERE ov.vertical_id = ?
        ORDER BY cc.created_at DESC
        LIMIT 100
      `, [vertical_id]);

      // Calculate totals
      const totalCachedAmount = offerDetails.reduce((sum, offer) => sum + parseFloat(offer.cached_amount), 0);
      const totalCachedConversions = offerDetails.reduce((sum, offer) => sum + parseInt(offer.cached_conversions), 0);
      const totalOffers = offerDetails.length;
      const offersWithCache = offerDetails.filter(offer => parseFloat(offer.cached_amount) > 0).length;

      return res.status(200).json({
        success: true,
        vertical: verticalInfo[0],
        summary: {
          total_offers: totalOffers,
          offers_with_cache: offersWithCache,
          total_cached_amount: totalCachedAmount,
          total_cached_conversions: totalCachedConversions
        },
        offers: offerDetails.map(offer => ({
          ...offer,
          cached_amount: parseFloat(offer.cached_amount),
          cached_conversions: parseInt(offer.cached_conversions),
          total_cache_entries: parseInt(offer.total_cache_entries)
        })),
        recent_cache_entries: cacheBreakdown.map(entry => ({
          ...entry,
          amount: parseFloat(entry.amount)
        }))
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Vertical details error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch vertical details'
    });
  }
}