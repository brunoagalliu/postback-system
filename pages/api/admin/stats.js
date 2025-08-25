// File: pages/api/admin/stats.js
import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: false
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function checkTableExists(connection, tableName) {
  try {
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `, [tableName]);
    return tables.length > 0;
  } catch (error) {
    return false;
  }
}

async function checkColumnExists(connection, tableName, columnName) {
  try {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ? 
      AND COLUMN_NAME = ?
    `, [tableName, columnName]);
    return columns.length > 0;
  } catch (error) {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const pool = getPool();

    // Check if basic tables exist
    const connection = await pool.getConnection();
    const cachedConversionsExists = await checkTableExists(connection, 'cached_conversions');
    const postbackHistoryExists = await checkTableExists(connection, 'postback_history');
    const verticalsExists = await checkTableExists(connection, 'verticals');
    const offerVerticalsExists = await checkTableExists(connection, 'offer_verticals');
    
    // Check if offer_id column exists in cached_conversions
    const offerIdExists = cachedConversionsExists ? 
      await checkColumnExists(connection, 'cached_conversions', 'offer_id') : false;

    connection.release();

    if (!cachedConversionsExists || !postbackHistoryExists) {
      return res.status(500).json({
        error: 'Database not properly initialized',
        message: 'Please run database initialization first',
        missing_tables: {
          cached_conversions: !cachedConversionsExists,
          postback_history: !postbackHistoryExists,
          verticals: !verticalsExists,
          offer_verticals: !offerVerticalsExists
        }
      });
    }

    if (!offerIdExists) {
      return res.status(500).json({
        error: 'Database migration needed',
        message: 'Please run the database migration to add offer_id columns',
        migration_needed: true
      });
    }

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

    // Initialize response with basic stats
    const totalPostbacks = postbackStats[0].total_postbacks;
    const successfulPostbacks = postbackStats[0].successful_postbacks;
    const successRate = totalPostbacks > 0 ? (successfulPostbacks / totalPostbacks) * 100 : 0;

    let response = {
      // Global statistics
      totalCachedAmount: parseFloat(globalCacheStats[0].total_cached_amount),
      uniqueClickids: parseInt(globalCacheStats[0].unique_clickids),
      uniqueOffers: parseInt(globalCacheStats[0].unique_offers),
      totalVerticals: 0,
      totalCachedConversions: parseInt(globalCacheStats[0].total_cached_conversions),
      
      // Postback statistics
      totalPostbacks: parseInt(totalPostbacks),
      successfulPostbacks: parseInt(successfulPostbacks),
      successRate: successRate,
      totalPostbackAmount: parseFloat(postbackStats[0].total_postback_amount),
      offersWithPostbacks: parseInt(postbackStats[0].offers_with_postbacks),
      
      // Default empty arrays (will be populated if verticals exist)
      offerStats: [],
      verticalStats: [],
      postbacksByOffer: [],
      cachedByOfferAndClickid: [],
      recentPostbacks: []
    };

    // Try to get vertical count if verticals table exists
    if (verticalsExists) {
      try {
        const [verticalCount] = await pool.execute(`
          SELECT COUNT(*) as total_verticals FROM verticals
        `);
        response.totalVerticals = parseInt(verticalCount[0].total_verticals);
      } catch (error) {
        console.log('Could not get vertical count:', error.message);
      }
    }

    // Get offer-specific statistics - Enhanced to show ALL offers (with and without conversions)
    try {
      if (verticalsExists && offerVerticalsExists) {
        // First get all offers with conversions
        const [offersWithConversions] = await pool.execute(`
          SELECT 
            cc.offer_id,
            v.name as vertical_name,
            v.payout_threshold,
            COUNT(DISTINCT cc.clickid) as unique_clickids,
            SUM(cc.amount) as total_cached_amount,
            COUNT(cc.id) as total_conversions,
            MAX(cc.created_at) as last_conversion
          FROM cached_conversions cc
          LEFT JOIN offer_verticals ov ON cc.offer_id = ov.offer_id
          LEFT JOIN verticals v ON ov.vertical_id = v.id
          GROUP BY cc.offer_id, v.name, v.payout_threshold
          ORDER BY total_cached_amount DESC
        `);

        // Then get all assigned offers (even without conversions)
        const [allAssignedOffers] = await pool.execute(`
          SELECT DISTINCT
            ov.offer_id,
            v.name as vertical_name,
            v.payout_threshold
          FROM offer_verticals ov
          JOIN verticals v ON ov.vertical_id = v.id
        `);

        // Merge the two datasets
        const offerStatsMap = new Map();
        
        // Add offers with conversions
        offersWithConversions.forEach(offer => {
          offerStatsMap.set(offer.offer_id, {
            offer_id: offer.offer_id,
            vertical_name: offer.vertical_name,
            payout_threshold: offer.payout_threshold,
            unique_clickids: offer.unique_clickids || 0,
            total_cached_amount: parseFloat(offer.total_cached_amount || 0),
            total_conversions: offer.total_conversions || 0,
            last_conversion: offer.last_conversion
          });
        });

        // Add assigned offers without conversions
        allAssignedOffers.forEach(offer => {
          if (!offerStatsMap.has(offer.offer_id)) {
            offerStatsMap.set(offer.offer_id, {
              offer_id: offer.offer_id,
              vertical_name: offer.vertical_name,
              payout_threshold: offer.payout_threshold,
              unique_clickids: 0,
              total_cached_amount: 0,
              total_conversions: 0,
              last_conversion: null
            });
          }
        });

        // Convert map to array and sort
        response.offerStats = Array.from(offerStatsMap.values())
          .sort((a, b) => b.total_cached_amount - a.total_cached_amount);

      } else {
        // Fallback for when verticals don't exist
        const [basicOfferStats] = await pool.execute(`
          SELECT 
            offer_id,
            COUNT(DISTINCT clickid) as unique_clickids,
            SUM(amount) as total_cached_amount,
            COUNT(*) as total_conversions,
            MAX(created_at) as last_conversion
          FROM cached_conversions 
          GROUP BY offer_id
          ORDER BY total_cached_amount DESC
        `);
        response.offerStats = basicOfferStats.map(offer => ({
          ...offer,
          vertical_name: null,
          payout_threshold: 10.00,
          total_cached_amount: parseFloat(offer.total_cached_amount || 0)
        }));
      }
    } catch (error) {
      console.log('Could not get offer stats:', error.message);
      response.offerStats = [];
    }

    // Get vertical statistics if possible
    if (verticalsExists && offerVerticalsExists) {
      try {
        const [verticalStats] = await pool.execute(`
          SELECT 
            v.id,
            v.name,
            v.payout_threshold,
            v.description,
            COUNT(DISTINCT ov.offer_id) as total_offers,
            COUNT(DISTINCT cc.clickid) as unique_clickids,
            COALESCE(SUM(cc.amount), 0) as total_cached_amount,
            COUNT(cc.id) as total_conversions,
            COUNT(DISTINCT ph.id) as total_postbacks,
            COUNT(CASE WHEN ph.success = 1 THEN 1 END) as successful_postbacks,
            MAX(cc.created_at) as last_conversion
          FROM verticals v
          LEFT JOIN offer_verticals ov ON v.id = ov.vertical_id
          LEFT JOIN cached_conversions cc ON ov.offer_id = cc.offer_id
          LEFT JOIN postback_history ph ON ov.offer_id = ph.offer_id
          GROUP BY v.id, v.name, v.payout_threshold, v.description
          ORDER BY total_cached_amount DESC
        `);
        response.verticalStats = verticalStats;
      } catch (error) {
        console.log('Could not get vertical stats:', error.message);
      }
    }

    // Get cached conversions grouped by offer and clickid
    try {
      if (verticalsExists && offerVerticalsExists) {
        const [cachedByOfferAndClickid] = await pool.execute(`
          SELECT 
            cc.offer_id,
            cc.clickid,
            v.name as vertical_name,
            SUM(cc.amount) as total_amount,
            COUNT(*) as conversion_count,
            MAX(cc.created_at) as last_updated
          FROM cached_conversions cc
          LEFT JOIN offer_verticals ov ON cc.offer_id = ov.offer_id
          LEFT JOIN verticals v ON ov.vertical_id = v.id
          GROUP BY cc.offer_id, cc.clickid, v.name
          ORDER BY cc.offer_id, total_amount DESC
          LIMIT 50
        `);
        response.cachedByOfferAndClickid = cachedByOfferAndClickid;
      } else {
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
        response.cachedByOfferAndClickid = cachedByOfferAndClickid;
      }
    } catch (error) {
      console.log('Could not get cached conversions:', error.message);
    }

    // Get recent postbacks
    try {
      if (verticalsExists && offerVerticalsExists) {
        const [recentPostbacks] = await pool.execute(`
          SELECT 
            ph.clickid, 
            ph.offer_id, 
            ph.amount, 
            ph.success, 
            ph.created_at,
            v.name as vertical_name
          FROM postback_history ph
          LEFT JOIN offer_verticals ov ON ph.offer_id = ov.offer_id
          LEFT JOIN verticals v ON ov.vertical_id = v.id
          ORDER BY ph.created_at DESC
          LIMIT 20
        `);
        response.recentPostbacks = recentPostbacks;
      } else {
        const [recentPostbacks] = await pool.execute(`
          SELECT clickid, offer_id, amount, success, created_at
          FROM postback_history
          ORDER BY created_at DESC
          LIMIT 20
        `);
        response.recentPostbacks = recentPostbacks;
      }
    } catch (error) {
      console.log('Could not get recent postbacks:', error.message);
    }

    // Get postback statistics by offer
    try {
      if (verticalsExists && offerVerticalsExists) {
        const [postbacksByOffer] = await pool.execute(`
          SELECT 
            ph.offer_id,
            v.name as vertical_name,
            COUNT(*) as total_postbacks,
            COUNT(CASE WHEN ph.success = 1 THEN 1 END) as successful_postbacks,
            COALESCE(SUM(ph.amount), 0) as total_amount,
            MAX(ph.created_at) as last_postback
          FROM postback_history ph
          LEFT JOIN offer_verticals ov ON ph.offer_id = ov.offer_id
          LEFT JOIN verticals v ON ov.vertical_id = v.id
          GROUP BY ph.offer_id, v.name
          ORDER BY total_amount DESC
        `);
        response.postbacksByOffer = postbacksByOffer;
      } else {
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
        response.postbacksByOffer = postbacksByOffer;
      }
    } catch (error) {
      console.log('Could not get postbacks by offer:', error.message);
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      message: 'Failed to fetch admin statistics',
      sqlMessage: error.sqlMessage || null
    });
  }
}