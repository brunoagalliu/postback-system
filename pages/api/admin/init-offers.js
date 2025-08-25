// File: pages/api/admin/init-offers.js
import { initializeOffersTable } from '../../../lib/database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed' 
    });
  }

  try {
    await initializeOffersTable();
    
    return res.status(200).json({
      success: true,
      message: 'Offers table initialized successfully'
    });

  } catch (error) {
    console.error('Offers table initialization error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to initialize offers table'
    });
  }
}