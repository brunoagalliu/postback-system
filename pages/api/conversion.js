import {
  initializeDatabase,
  addCachedConversion,
  getCachedTotalByOffer,
  removeCachedConversionsByOffer,
  getVerticalPayoutThreshold,
  logConversion,
  logPostback
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
    
    // Get cached total for this specific offer
    const cachedTotal = await getCachedTotalByOffer(offer_id);
    
    // Get payout threshold for this offer's vertical (defaults to 10.00 if no vertical assigned)
    const payoutThreshold = await getVerticalPayoutThreshold(offer_id);
    
    await logConversion({
      clickid,
      offer_id,
      original_amount: sumValue,
      cached_amount: cachedTotal,
      action: 'cache_loaded',
      message: `Offer ${offer_id} cached total: $${cachedTotal.toFixed(2)}, New conversion: $${sumValue.toFixed(2)}, Payout threshold: $${payoutThreshold.toFixed(2)}`
    });
    
    if (sumValue < payoutThreshold) {
      await addCachedConversion(clickid, offer_id, sumValue);
      const newCachedTotal = await getCachedTotalByOffer(offer_id);
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: newCachedTotal,
        action: 'cached_conversion',
        message: `Cached sub-$${payoutThreshold.toFixed(2)} conversion ($${sumValue.toFixed(2)}) for offer ${offer_id}. New offer total cached: $${newCachedTotal.toFixed(2)}`
      });
      
      return res.status(200).send("1");
    }
    
    const totalToSend = sumValue + cachedTotal;
    const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(clickid)}&sum=${encodeURIComponent(totalToSend)}&offer_id=${encodeURIComponent(offer_id)}`;
    
    await logConversion({
      clickid,
      offer_id,
      original_amount: sumValue,
      cached_amount: cachedTotal,
      total_sent: totalToSend,
      action: 'preparing_postback',
      message: `Preparing to send postback to RedTrack for offer ${offer_id}. Total: $${totalToSend.toFixed(2)} (Current conversion: $${sumValue.toFixed(2)} + Offer cache: $${cachedTotal.toFixed(2)}) - Triggered by $${payoutThreshold.toFixed(2)} threshold`
    });
    
    if (cachedTotal > 0) {
      const removedRows = await removeCachedConversionsByOffer(offer_id);
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'offer_cache_used',
        message: `Used and removed ${removedRows} cached entries for offer ${offer_id}. Total sent: $${totalToSend.toFixed(2)}`
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
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'postback_success',
        message: `Postback successful for offer ${offer_id}. Response: ${responseText}`
      });
      
    } catch (error) {
      errorMessage = error.message;
      
      await logConversion({
        clickid,
        offer_id,
        original_amount: sumValue,
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'postback_failed',
        message: `Error sending postback for offer ${offer_id}: ${error.message}`
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