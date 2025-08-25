// File: lib/database.js
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
  // Disable SSL since GoDaddy server doesn't support it
  ssl: false
};

// Create connection pool
let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Initialize database tables
export async function initializeDatabase() {
  const connection = await getPool().getConnection();
  
  try {
    // Create cached_conversions table with offer_id
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cached_conversions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clickid VARCHAR(255) NOT NULL,
        offer_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clickid (clickid),
        INDEX idx_offer_id (offer_id),
        INDEX idx_offer_clickid (offer_id, clickid),
        INDEX idx_created_at (created_at)
      )
    `);

    // Create conversion_logs table with offer_id
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS conversion_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clickid VARCHAR(255),
        offer_id VARCHAR(255),
        original_amount DECIMAL(10,2),
        cached_amount DECIMAL(10,2),
        total_sent DECIMAL(10,2),
        action VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clickid (clickid),
        INDEX idx_offer_id (offer_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // Create postback_history table with offer_id
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS postback_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clickid VARCHAR(255) NOT NULL,
        offer_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        postback_url TEXT,
        success BOOLEAN DEFAULT FALSE,
        response_text TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clickid (clickid),
        INDEX idx_offer_id (offer_id),
        INDEX idx_success (success),
        INDEX idx_created_at (created_at)
      )
    `);

    // Create verticals table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS verticals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        payout_threshold DECIMAL(10,2) NOT NULL DEFAULT 10.00,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      )
    `);

    // Create offer_verticals table to map offers to verticals
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS offer_verticals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id VARCHAR(255) NOT NULL,
        vertical_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vertical_id) REFERENCES verticals(id) ON DELETE CASCADE,
        UNIQUE KEY unique_offer_vertical (offer_id, vertical_id),
        INDEX idx_offer_id (offer_id),
        INDEX idx_vertical_id (vertical_id)
      )
    `);

    console.log('Database tables initialized successfully with verticals support');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Simple offers table initialization
export async function initializeSimpleOffersTable() {
  const connection = await getPool().getConnection();
  
  try {
    // Create simple offers table with just the essentials
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id VARCHAR(255) NOT NULL UNIQUE,
        offer_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_offer_id (offer_id)
      )
    `);

    console.log('Simple offers table initialized successfully');
    
  } catch (error) {
    console.error('Error initializing simple offers table:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Simple offer CRUD functions
export async function createSimpleOffer(offer_id, offer_name = '') {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'INSERT INTO offers (offer_id, offer_name) VALUES (?, ?)',
      [offer_id, offer_name]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function updateSimpleOffer(offer_id, offer_name) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'UPDATE offers SET offer_name = ? WHERE offer_id = ?',
      [offer_name, offer_id]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

export async function deleteSimpleOffer(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    // Clean up related data first
    await connection.execute('DELETE FROM cached_conversions WHERE offer_id = ?', [offer_id]);
    await connection.execute('DELETE FROM postback_history WHERE offer_id = ?', [offer_id]);
    await connection.execute('DELETE FROM conversion_logs WHERE offer_id = ?', [offer_id]);
    await connection.execute('DELETE FROM offer_verticals WHERE offer_id = ?', [offer_id]);
    
    // Delete the offer
    const [result] = await connection.execute(
      'DELETE FROM offers WHERE offer_id = ?',
      [offer_id]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

export async function getAllSimpleOffers() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        o.offer_id,
        o.offer_name,
        v.name as vertical_name,
        v.id as vertical_id,
        v.payout_threshold,
        COUNT(DISTINCT cc.clickid) as total_conversions,
        COALESCE(SUM(cc.amount), 0) as total_cached_amount,
        COUNT(DISTINCT ph.id) as total_postbacks,
        MAX(cc.created_at) as last_conversion
      FROM offers o
      LEFT JOIN offer_verticals ov ON o.offer_id = ov.offer_id
      LEFT JOIN verticals v ON ov.vertical_id = v.id
      LEFT JOIN cached_conversions cc ON o.offer_id = cc.offer_id
      LEFT JOIN postback_history ph ON o.offer_id = ph.offer_id
      GROUP BY o.offer_id, o.offer_name, v.name, v.id, v.payout_threshold
      ORDER BY o.offer_id
    `);
    
    return rows.map(row => ({
      ...row,
      total_cached_amount: parseFloat(row.total_cached_amount)
    }));
  } finally {
    connection.release();
  }
}

export async function getSimpleOfferById(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        o.offer_id,
        o.offer_name,
        v.name as vertical_name,
        v.id as vertical_id
      FROM offers o
      LEFT JOIN offer_verticals ov ON o.offer_id = ov.offer_id
      LEFT JOIN verticals v ON ov.vertical_id = v.id
      WHERE o.offer_id = ?
    `, [offer_id]);
    
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

/*
// REMOVED: Auto-create offer if it doesn't exist (no longer needed)
export async function getOrCreateSimpleOffer(offer_id) {
  const existing = await getSimpleOfferById(offer_id);
  if (existing) return existing;
  
  // Create basic offer entry
  await createSimpleOffer(offer_id, `Offer ${offer_id}`);
  return await getSimpleOfferById(offer_id);
}
*/

// Vertical management functions
export async function createVertical(name, payoutThreshold = 10.00, description = '') {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'INSERT INTO verticals (name, payout_threshold, description) VALUES (?, ?, ?)',
      [name, payoutThreshold, description]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function updateVertical(verticalId, name, payoutThreshold, description = '') {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'UPDATE verticals SET name = ?, payout_threshold = ?, description = ? WHERE id = ?',
      [name, payoutThreshold, description, verticalId]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

export async function getAllVerticals() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM verticals ORDER BY name'
    );
    return rows;
  } finally {
    connection.release();
  }
}

export async function getVerticalByName(name) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM verticals WHERE name = ?',
      [name]
    );
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

export async function assignOfferToVertical(offerId, verticalId) {
  const connection = await getPool().getConnection();
  
  try {
    // Remove existing assignment first
    await connection.execute(
      'DELETE FROM offer_verticals WHERE offer_id = ?',
      [offerId]
    );
    
    // Add new assignment
    const [result] = await connection.execute(
      'INSERT INTO offer_verticals (offer_id, vertical_id) VALUES (?, ?)',
      [offerId, verticalId]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function getOfferVertical(offerId) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT v.* FROM verticals v
      JOIN offer_verticals ov ON v.id = ov.vertical_id
      WHERE ov.offer_id = ?
    `, [offerId]);
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

export async function getVerticalPayoutThreshold(offerId) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT v.payout_threshold FROM verticals v
      JOIN offer_verticals ov ON v.id = ov.vertical_id
      WHERE ov.offer_id = ?
    `, [offerId]);
    
    // Return vertical threshold or default 10.00
    return rows[0] ? parseFloat(rows[0].payout_threshold) : 10.00;
  } finally {
    connection.release();
  }
}

// Cached conversions management
export async function addCachedConversion(clickid, offer_id, amount) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'INSERT INTO cached_conversions (clickid, offer_id, amount) VALUES (?, ?, ?)',
      [clickid, offer_id, amount]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function getCachedTotalByOffer(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cached_conversions WHERE offer_id = ?',
      [offer_id]
    );
    return parseFloat(rows[0].total);
  } finally {
    connection.release();
  }
}

export async function getGlobalCachedTotal() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cached_conversions'
    );
    return parseFloat(rows[0].total);
  } finally {
    connection.release();
  }
}

export async function removeCachedConversionsByOffer(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'DELETE FROM cached_conversions WHERE offer_id = ?',
      [offer_id]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

export async function clearAllCachedConversions() {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'DELETE FROM cached_conversions'
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

export async function clearCachedConversionsByOffer(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      'DELETE FROM cached_conversions WHERE offer_id = ?',
      [offer_id]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

// Function to get total cached amount for all offers in the same vertical
export async function getCachedTotalByVertical(offer_id) {
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
export async function clearCacheByVertical(offer_id) {
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
export async function getOffersInSameVertical(offer_id) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT DISTINCT ov1.offer_id, v.name as vertical_name
      FROM offer_verticals ov1
      JOIN offer_verticals ov2 ON ov1.vertical_id = ov2.vertical_id
      JOIN verticals v ON ov1.vertical_id = v.id
      WHERE ov2.offer_id = ?
    `, [offer_id]);
    
    return {
      offers: rows.map(row => row.offer_id),
      vertical_name: rows[0]?.vertical_name || 'Unknown'
    };
  } finally {
    connection.release();
  }
}

// Backward compatibility function (deprecated, but kept for legacy)
export async function getCachedTotal(clickid) {
  return await getGlobalCachedTotal();
}

// Logging functions
export async function logConversion(data) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      `INSERT INTO conversion_logs 
       (clickid, offer_id, original_amount, cached_amount, total_sent, action, message) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.clickid || null,
        data.offer_id || null,
        data.original_amount || null,
        data.cached_amount || null,
        data.total_sent || null,
        data.action || '',
        data.message || ''
      ]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function logPostback(clickid, offer_id, amount, postback_url, success, response_text = null, error_message = null) {
  const connection = await getPool().getConnection();
  
  try {
    const [result] = await connection.execute(
      `INSERT INTO postback_history 
       (clickid, offer_id, amount, postback_url, success, response_text, error_message) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clickid, offer_id, amount, postback_url, success, response_text, error_message]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function getRecentLogs(limit = 100) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(
      `SELECT * FROM conversion_logs 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    connection.release();
  }
}

// Statistics and reporting functions
export async function getOfferStats() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
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
    return rows;
  } finally {
    connection.release();
  }
}

export async function getVerticalStats() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
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
    return rows;
  } finally {
    connection.release();
  }
}

export async function getCachedConversionsByOffer(offer_id, limit = 50) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        clickid,
        SUM(amount) as total_amount,
        COUNT(*) as conversion_count,
        MAX(created_at) as last_updated
      FROM cached_conversions 
      WHERE offer_id = ?
      GROUP BY clickid
      ORDER BY total_amount DESC
      LIMIT ?
    `, [offer_id, limit]);
    return rows;
  } finally {
    connection.release();
  }
}

export async function getPostbackHistoryByOffer(offer_id, limit = 20) {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT * FROM postback_history 
      WHERE offer_id = ?
      ORDER BY created_at DESC 
      LIMIT ?
    `, [offer_id, limit]);
    return rows;
  } finally {
    connection.release();
  }
}