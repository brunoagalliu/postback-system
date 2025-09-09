// File: pages/api/conversion.js - Clean version without auto-flush
import {
  initializeDatabase,
  addCachedConversion,
  getCachedTotalByOffer,
  getVerticalPayoutThreshold,
  getOfferVertical,
  logConversion,
  logPostback,
  getSimpleOfferById
 } from '../../lib/database.js';
 
 // Function to validate RedTrack clickid format
 function isValidClickid(clickid) {
   if (!clickid || typeof clickid !== 'string') {
     return false;
   }
   
   // RedTrack clickids are exactly 24 characters long
   // and contain alphanumeric characters (0-9, a-z, A-Z)
   const clickidRegex = /^[0-9a-zA-Z]{24}$/;
   return clickidRegex.test(clickid);
 }
 
 // Function to validate offer ID
 function isValidOfferId(offer_id) {
   if (!offer_id || typeof offer_id !== 'string') {
     return false;
   }
   
   // Offer ID should be alphanumeric and reasonable length (1-50 characters)
   // Allow letters, numbers, hyphens, and underscores
   const offerIdRegex = /^[a-zA-Z0-9_-]{1,50}$/;
   return offerIdRegex.test(offer_id);
 }
 
 // Function to get all cached amount for offers in the same vertical
 async function getCachedTotalByVertical(offer_id) {
   const { getPool } = await import('../../lib/database.js');
   const connection = await getPool().getConnection();
   
   try {
     const [rows] = await connection.execute(`
       SELECT COALESCE(SUM(cc.amount), 0) as total
       FROM cached_conversions cc
       JOIN offer_verticals ov1 ON cc.offer_id = ov1.offer_id
       JOIN offer_verticals ov2 ON ov1.vertical_id = ov2.vertical_id
       WHERE ov2.offer_id = ?
     `, [offer_id]);
     
     return parseFloat(rows[0].total);
   } finally {
     connection.release();
   }
 }
 
 // Function to clear cache for all offers in the same vertical
 async function clearCacheByVertical(offer_id) {
   const { getPool } = await import('../../lib/database.js');
   const connection = await getPool().getConnection();
   
   try {
     const [result] = await connection.execute(`
       DELETE cc FROM cached_conversions cc
       JOIN offer_verticals ov1 ON cc.offer_id = ov1.offer_id
       JOIN offer_verticals ov2 ON ov1.vertical_id = ov2.vertical_id
       WHERE ov2.offer_id = ?
     `, [offer_id]);
     
     return result.affectedRows;
   } finally {
     connection.release();
   }
 }
 
 // Function to get all offers in the same vertical
 async function getOffersInSameVertical(offer_id) {
   const { getPool } = await import('../../lib/database.js');
   const connection = await getPool().getConnection();
   
   try {
     const [rows] = await connection.execute(`
       SELECT DISTINCT ov1.offer_id
       FROM offer_verticals ov1
       JOIN offer_verticals ov2 ON ov1.vertical_id = ov2.vertical_id
       WHERE ov2.offer_id = ?
     `, [offer_id]);
     
     return rows.map(row => row.offer_id);
   } finally {
     connection.release();
   }
 }
 
 export default async function handler(req, res) {
  try {
    await initializeDatabase();
    
    const { clickid, sum, offer_id } = req.query;
    const sumValue = parseFloat(sum || 0);
    
    await logConversion({
      clickid,
      offer_id,
      original_amount: sumValue,
      action: 'request_received',
      message: `Request received: clickid=${clickid}, offer_id=${offer_id}, sum=${sum}`
    });
    
    // Validate clickid format
    if (!isValidClickid(clickid)) {
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        action: 'invalid_clickid',
        message: `Invalid clickid format rejected: '${clickid}' (must be 24 alphanumeric characters)`
      });
      return res.status(200).send("0");
    }
    
    // Validate offer_id
    if (!isValidOfferId(offer_id)) {
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        action: 'invalid_offer_id',
        message: `Invalid offer_id format rejected: '${offer_id}' (must be 1-50 alphanumeric characters, hyphens, or underscores)`
      });
      return res.status(200).send("0");
    }
    
    // Validate sum value
    if (sumValue <= 0) {
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        action: 'validation_failed',
        message: `Invalid sum value rejected: clickid=${clickid}, offer_id=${offer_id}, sum=${sum}`
      });
      return res.status(200).send("0");
    }

    // Check if offer exists in our system
    const offerExists = await getSimpleOfferById(offer_id);
    
    if (!offerExists) {
      // UNKNOWN OFFER: Fire postback directly without caching
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        action: 'unknown_offer_direct_fire',
        message: `Unknown offer ${offer_id} - firing postback directly without caching. Amount: $${sumValue.toFixed(2)}`
      });

      const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(clickid)}&sum=${encodeURIComponent(sumValue)}&offer_id=${encodeURIComponent(offer_id)}`;
      
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
          clickid,
          offer_id,
          original_amount: sumValue,
          total_sent: sumValue,
          action: 'unknown_offer_postback_success',
          message: `Direct postback successful for unknown offer ${offer_id}. Amount: $${sumValue.toFixed(2)}, Response: ${responseText}`
        });
        
      } catch (error) {
        errorMessage = error.message;
        
        await logConversion({
          clickid,
          offer_id,
          original_amount: sumValue,
          total_sent: sumValue,
          action: 'unknown_offer_postback_failed',
          message: `Direct postback failed for unknown offer ${offer_id}. Amount: $${sumValue.toFixed(2)}, Error: ${error.message}`
        });
      }
      
      await logPostback(clickid, offer_id, sumValue, redtrackUrl, postbackSuccess, responseText, errorMessage);
      
      if (postbackSuccess) {
        return res.status(200).send("2");
      } else {
        return res.status(200).send("3");
      }
    }

    // KNOWN OFFER: Process normally with caching system
    
    // Get payout threshold for this offer's vertical (defaults to 10.00 if no vertical assigned)
    const payoutThreshold = await getVerticalPayoutThreshold(offer_id);
    
    // Get vertical info for logging
    const verticalInfo = await getOfferVertical(offer_id);
    const verticalName = verticalInfo ? verticalInfo.name : 'Unassigned';
    
    // Get cached total for ALL offers in the same vertical
    const verticalCachedTotal = await getCachedTotalByVertical(offer_id);
    
    await logConversion({
      clickid,
      offer_id,
      original_amount: sumValue,
      cached_amount: verticalCachedTotal,
      action: 'known_offer_cache_loaded',
      message: `Known offer: ${offerExists.offer_name || offer_id}. Vertical "${verticalName}" cached total: $${verticalCachedTotal.toFixed(2)}, New conversion: $${sumValue.toFixed(2)}, Payout threshold: $${payoutThreshold.toFixed(2)}`
    });
    
    if (sumValue < payoutThreshold) {
      await addCachedConversion(clickid, offer_id, sumValue);
      const newVerticalCachedTotal = await getCachedTotalByVertical(offer_id);
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: newVerticalCachedTotal,
        action: 'cached_conversion',
        message: `Cached sub-$${payoutThreshold.toFixed(2)} conversion ($${sumValue.toFixed(2)}) for offer ${offer_id} (${offerExists.offer_name || 'No name'}). New vertical "${verticalName}" total cached: $${newVerticalCachedTotal.toFixed(2)}`
      });
      
      return res.status(200).send("1");
    }
    
    // When threshold is reached, sum ALL cached conversions from the same vertical
    const totalToSend = sumValue + verticalCachedTotal;
    const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(clickid)}&sum=${encodeURIComponent(totalToSend)}&offer_id=${encodeURIComponent(offer_id)}`;
    
    // Get list of all offers in the same vertical for logging
    const offersInVertical = await getOffersInSameVertical(offer_id);
    
    await logConversion({
      clickid,
      offer_id,
      original_amount: sumValue,
      cached_amount: verticalCachedTotal,
      total_sent: totalToSend,
      action: 'preparing_postback',
      message: `Preparing to send postback to RedTrack for offer ${offer_id} (${offerExists.offer_name || 'No name'}) in vertical "${verticalName}". Total: $${totalToSend.toFixed(2)} (Current conversion: $${sumValue.toFixed(2)} + Vertical cache: $${verticalCachedTotal.toFixed(2)}) - Triggered by $${payoutThreshold.toFixed(2)} threshold. Offers in vertical: ${offersInVertical.join(', ')}`
    });
    
    if (verticalCachedTotal > 0) {
      const clearedRows = await clearCacheByVertical(offer_id);
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: verticalCachedTotal,
        total_sent: totalToSend,
        action: 'vertical_cache_cleared',
        message: `Vertical "${verticalName}" cache cleared before postback. Removed ${clearedRows} cached entries from ALL offers in vertical (${offersInVertical.join(', ')}). Total sent: $${totalToSend.toFixed(2)}`
      });
    }
    
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
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: verticalCachedTotal,
        total_sent: totalToSend,
        action: 'postback_success',
        message: `Postback successful for offer ${offer_id} (${offerExists.offer_name || 'No name'}) in vertical "${verticalName}". Response: ${responseText}`
      });
      
    } catch (error) {
      errorMessage = error.message;
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: verticalCachedTotal,
        total_sent: totalToSend,
        action: 'postback_failed',
        message: `Error sending postback for offer ${offer_id} (${offerExists.offer_name || 'No name'}) in vertical "${verticalName}": ${error.message}`
      });
    }
    
    await logPostback(clickid, offer_id, totalToSend, redtrackUrl, postbackSuccess, responseText, errorMessage);
    
    if (postbackSuccess) {
      return res.status(200).send("2");
    } else {
      return res.status(200).send("3");
    }
    
  } catch (error) {
    console.error('Database error:', error);
    
    try {
      await logConversion({
        clickid: req.query.clickid,
        offer_id: req.query.offer_id,
        action: 'system_error',
        message: `System error: ${error.message}`
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return res.status(200).send("4");
  }
 }