// File: pages/api/cron/flush-cache.js
import { 
    getAllVerticals, 
    getPool, 
    logConversion, 
    logPostback 
  } from '../../../lib/database.js';
  
  export default async function handler(req, res) {
    // Vercel cron jobs are authenticated automatically
    // Only allow from Vercel cron
    if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
      return res.status(401).json({ error: 'Unauthorized' });
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
  
      // Log the cron job execution
      await logConversion({
        clickid: 'vercel-cron',
        action: 'daily_cache_flush',
        message: `Daily cache flush completed via Vercel cron. ${successCount}/${totalVerticals} verticals processed successfully. Eastern Time: ${new Date().toLocaleString("en-US", {timeZone: "America/New_York"})}`
      });
  
      return res.status(200).json({
        success: true,
        message: `Cache flush completed for ${successCount}/${totalVerticals} verticals`,
        results: results,
        timestamp: new Date().toISOString(),
        eastern_time: new Date().toLocaleString("en-US", {timeZone: "America/New_York"})
      });
  
    } catch (error) {
      console.error('Vercel cron job error:', error);
      
      await logConversion({
        clickid: 'vercel-cron',
        action: 'daily_cache_flush_error',
        message: `Daily cache flush failed via Vercel cron: ${error.message}`
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
          message: 'No cached conversions to flush'
        };
      }
  
      // Calculate total amount
      const totalAmount = cachedConversions.reduce((sum, conv) => sum + parseFloat(conv.amount), 0);
      
      // Use the oldest clickid for the postback (or could use newest)
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
        action: 'vercel_cron_cache_flush',
        message: `Vercel cron flushing ${cachedConversions.length} cached conversions for vertical "${vertical.name}". Total: $${totalAmount.toFixed(2)}, Cleared ${deleteResult.affectedRows} entries. Eastern Time: ${new Date().toLocaleString("en-US", {timeZone: "America/New_York"})}`
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
          action: 'vercel_cron_postback_success',
          message: `Vercel cron postback successful for vertical "${vertical.name}". Amount: $${totalAmount.toFixed(2)}, Response: ${responseText}`
        });
  
      } catch (error) {
        errorMessage = error.message;
        postbackSuccess = false;
  
        await logConversion({
          clickid: primaryClickid,
          offer_id: primaryOfferId,
          cached_amount: totalAmount,
          total_sent: totalAmount,
          action: 'vercel_cron_postback_failed',
          message: `Vercel cron postback failed for vertical "${vertical.name}". Amount: $${totalAmount.toFixed(2)}, Error: ${error.message}`
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