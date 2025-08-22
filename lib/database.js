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

    console.log('Database tables initialized successfully with offer support');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Database helper functions
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

// Backward compatibility functions
export async function getCachedTotal(clickid) {
  // For backward compatibility, return global total
  return await getGlobalCachedTotal();
}

export async function clearCachedConversions(clickid) {
  // For backward compatibility, clear all cache
  return await clearAllCachedConversions();
}

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

// New offer-specific functions
export async function getOfferStats() {
  const connection = await getPool().getConnection();
  
  try {
    const [rows] = await connection.execute(`
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