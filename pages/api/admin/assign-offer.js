// File: pages/api/admin/assign-offer.js
import { getPool, logConversion } from '../../../lib/database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed' 
    });
  }

  try {
    const { offer_id, vertical_id } = req.body;

    if (!offer_id || !vertical_id) {
      return res.status(400).json({
        success: false,
        message: 'Both offer_id and vertical_id are required'
      });
    }

    // Assign offer to vertical using direct database connection
    const connection = await getPool().getConnection();
    
    try {
      // Remove existing assignment first
      await connection.execute(
        'DELETE FROM offer_verticals WHERE offer_id = ?',
        [offer_id]
      );
      
      // Add new assignment
      await connection.execute(
        'INSERT INTO offer_verticals (offer_id, vertical_id) VALUES (?, ?)',
        [offer_id, parseInt(vertical_id)]
      );
    } finally {
      connection.release();
    }

    // Log the assignment
    await logConversion({
      clickid: 'admin',
      offer_id: offer_id,
      action: 'offer_vertical_assignment',
      message: `Admin assigned offer ${offer_id} to vertical ID ${vertical_id}`
    });

    return res.status(200).json({
      success: true,
      message: `Offer ${offer_id} assigned to vertical successfully`,
      offer_id,
      vertical_id: parseInt(vertical_id)
    });

  } catch (error) {
    console.error('Offer assignment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to assign offer to vertical'
    });
  }
}