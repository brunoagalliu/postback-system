// File: pages/api/admin/check-database.js
import { getPool } from '../../../lib/database.js';

export default async function handler(req, res) {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();

    // Check which tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);

    const tableNames = tables.map(row => row.TABLE_NAME);

    // Check columns for each important table
    const tableChecks = {};

    for (const tableName of ['cached_conversions', 'conversion_logs', 'postback_history', 'verticals', 'offer_verticals']) {
      if (tableNames.includes(tableName)) {
        const [columns] = await connection.execute(`
          SHOW COLUMNS FROM ${tableName}
        `);
        tableChecks[tableName] = {
          exists: true,
          columns: columns.map(col => ({
            name: col.Field,
            type: col.Type,
            null: col.Null,
            key: col.Key,
            default: col.Default
          }))
        };
      } else {
        tableChecks[tableName] = {
          exists: false,
          columns: []
        };
      }
    }

    // Get sample data counts
    const dataCounts = {};
    for (const tableName of ['cached_conversions', 'conversion_logs', 'postback_history']) {
      if (tableNames.includes(tableName)) {
        try {
          const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          dataCounts[tableName] = count[0].count;
        } catch (error) {
          dataCounts[tableName] = `Error: ${error.message}`;
        }
      } else {
        dataCounts[tableName] = 'Table does not exist';
      }
    }

    connection.release();

    // Determine what needs to be done
    const recommendations = [];
    
    if (!tableChecks.cached_conversions.exists) {
      recommendations.push('Run database initialization - cached_conversions table missing');
    } else if (!tableChecks.cached_conversions.columns.some(col => col.name === 'offer_id')) {
      recommendations.push('Run database migration - offer_id column missing from cached_conversions');
    }

    if (!tableChecks.verticals?.exists) {
      recommendations.push('Run vertical migration - verticals table missing');
    }

    if (!tableChecks.offer_verticals?.exists) {
      recommendations.push('Run vertical migration - offer_verticals table missing');
    }

    return res.status(200).json({
      success: true,
      database_status: {
        tables: tableChecks,
        data_counts: dataCounts,
        recommendations: recommendations,
        all_tables: tableNames
      }
    });

  } catch (error) {
    console.error('Database check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      message: 'Failed to check database status'
    });
  }
}