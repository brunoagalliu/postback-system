// File: pages/api/admin/manual-flush.js
import { 
    getAllVerticals, 
    getPool, 
    logConversion, 
    logPostback 
  } from '../../../lib/database.js';
  
  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        success: false,
        message: 'Method not allowed' 
      });
    }
  
    try {
      const results = [];
      
      // Get all verticals
      const verticals = await getAllVerticals();
      
      for (const vertical of verticals) {
        try {
          const verticalResult = await flushVerticalCache(vertical);
          results.push(verticalResult);
        } catch (error) {
          console.error(`Error flushing cache for vertical ${vertical.name}:`, error);
          results.push({
            vertical: vertical.name,
            success: false,
            error: error.message
          });
        }
      }
  
      const successCount = results.filter(r => r.success).length;
      const totalVerticals = results.length;
      const flushedVerticals = results.filter(r => r.action === 'cache_flushed').length;
  
      // Log the manual flush execution
      await logConversion({
        clickid: 'admin-manual',
        action: 'manual_cache_flush',
        message: `Manual cache flush executed by admin. ${successCount}/${totalVerticals} verticals processed successfully. ${flushedVerticals} had cache to flush. Eastern Time: ${new Date().toLocaleString("en-US", {timeZone: "America/New_York"})}`
      });
  
      return res.status(200).json({
        success: true,
        message: `Manual flush completed for ${successCount}/${totalVerticals} verticals`,
        flushed_verticals: flushedVerticals,
        results: results,
        timestamp: new Date().toISOString(),
        eastern_time: new Date().toLocaleString("en-US", {timeZone: "America/New_York"})
      });
  
    } catch (error) {
      console.error('Manual flush error:', error);
      
      await logConversion({
        clickid: 'admin-manual',
        action: 'manual_cache_flush_error',
        message: `Manual cache flush failed: ${error.message}`
      });
  
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  async function flushVerticalCache(vertical) {
    const connection = await getPool().getConnection();
    
    try {
      // Get all cached conversions for this vertical
      const [cachedConversions] = await connection.execute(`
        SELECT 
          cc.clickid,
          cc.offer_id,
          cc.amount,
          cc.created_at
        FROM cached_conversions cc
        JOIN offer_verticals ov ON cc.offer_id = ov.offer_id
        WHERE ov.vertical_id = ?
        ORDER BY cc.created_at ASC
      `, [vertical.id]);
  
      if (cachedConversions.length === 0) {
        return {
          vertical: vertical.name,
          success: true,
          action: 'no_cache',
          message: 'No cached conversions to flush',
          conversions_count: 0,
          total_amount: 0
        };
      }
  
      // Calculate total amount
      const totalAmount = cachedConversions.reduce((sum, conv) => sum + parseFloat(conv.amount), 0);
      
      // Use the oldest clickid for the postback
      const primaryClickid = cachedConversions[0].clickid;
      const primaryOfferId = cachedConversions[0].offer_id;
  
      // Create postback URL
      const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(primaryClickid)}&sum=${encodeURIComponent(totalAmount)}&offer_id=${encodeURIComponent(primaryOfferId)}`;
  
      // Clear the cache for this vertical first
      const [deleteResult] = await connection.execute(`
        DELETE cc FROM cached_conversions cc
        JOIN offer_verticals ov ON cc.offer_id = ov.offer_id
        WHERE ov.vertical_id = ?
      `, [vertical.id]);
  
      // Log the flush action
      await logConversion({
        clickid: primaryClickid,
        offer_id: primaryOfferId,
        cached_amount: totalAmount,
        total_sent: totalAmount,
        action: 'manual_cache_flush',
        message: `Manual admin flush of ${cachedConversions.length} cached conversions for vertical "${vertical.name}". Total: $${totalAmount.toFixed(2)}, Cleared ${deleteResult.affectedRows} entries. Eastern Time: ${new Date().toLocaleString("en-US", {timeZone: "America/New_York"})}`
      });
  
      // Fire the postback
      let postbackSuccess = false;
      let responseText = '';
      let errorMessage = null;
  
      try {
        const response = await fetch(redtrackUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        responseText = await response.text();
        postbackSuccess = true;
  
        await logConversion({
          clickid: primaryClickid,
          offer_id: primaryOfferId,
          cached_amount: totalAmount,
          total_sent: totalAmount,
          action: 'manual_postback_success',
          message: `Manual flush postback successful for vertical "${vertical.name}". Amount: $${totalAmount.toFixed(2)}, Response: ${responseText}`
        });
  
      } catch (error) {
        errorMessage = error.message;
        postbackSuccess = false;
  
        await logConversion({
          clickid: primaryClickid,
          offer_id: primaryOfferId,
          cached_amount: totalAmount,
          total_sent: totalAmount,
          action: 'manual_postback_failed',
          message: `Manual flush postback failed for vertical "${vertical.name}". Amount: $${totalAmount.toFixed(2)}, Error: ${error.message}`
        });
      }
  
      // Log the postback attempt
      await logPostback(primaryClickid, primaryOfferId, totalAmount, redtrackUrl, postbackSuccess, responseText, errorMessage);
  
      return {
        vertical: vertical.name,
        success: postbackSuccess,
        action: 'cache_flushed',
        conversions_count: cachedConversions.length,
        total_amount: totalAmount,
        primary_clickid: primaryClickid,
        primary_offer_id: primaryOfferId,
        postback_success: postbackSuccess,
        message: `Flushed ${cachedConversions.length} conversions, total $${totalAmount.toFixed(2)}`
      };
  
    } finally {
      connection.release();
    }
  }