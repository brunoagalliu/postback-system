// File: pages/api/admin/verticals.js
import { 
  createVertical, 
  updateVertical, 
  getAllVerticals, 
  getVerticalStats
} from '../../../lib/database.js';

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case 'GET':
        // Get all verticals with stats
        const verticals = await getAllVerticals();
        const verticalStats = await getVerticalStats();
        
        // Merge basic vertical info with stats
        const mergedVerticals = verticals.map(vertical => {
          const stats = verticalStats.find(stat => stat.id === vertical.id);
          return {
            ...vertical,
            total_offers: stats?.total_offers || 0,
            unique_clickids: stats?.unique_clickids || 0,
            total_cached_amount: parseFloat(stats?.total_cached_amount || 0),
            total_conversions: stats?.total_conversions || 0,
            total_postbacks: stats?.total_postbacks || 0,
            successful_postbacks: stats?.successful_postbacks || 0,
            success_rate: stats?.total_postbacks > 0 ? 
              (stats.successful_postbacks / stats.total_postbacks * 100) : 0,
            last_conversion: stats?.last_conversion || null
          };
        });

        return res.status(200).json({
          success: true,
          verticals: mergedVerticals
        });

      case 'POST':
        // Create new vertical
        const { name, payout_threshold, description } = req.body;
        
        if (!name) {
          return res.status(400).json({
            success: false,
            message: 'Vertical name is required'
          });
        }

        const threshold = parseFloat(payout_threshold) || 10.00;
        if (threshold <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Payout threshold must be greater than 0'
          });
        }

        const verticalId = await createVertical(name, threshold, description || '');

        return res.status(200).json({
          success: true,
          message: `Vertical "${name}" created successfully`,
          vertical_id: verticalId
        });

      case 'PUT':
        // Update existing vertical
        const { id, name: updateName, payout_threshold: updateThreshold, description: updateDescription } = req.body;
        
        if (!id || !updateName) {
          return res.status(400).json({
            success: false,
            message: 'Vertical ID and name are required'
          });
        }

        const newThreshold = parseFloat(updateThreshold) || 10.00;
        if (newThreshold <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Payout threshold must be greater than 0'
          });
        }

        const affectedRows = await updateVertical(id, updateName, newThreshold, updateDescription || '');

        if (affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Vertical not found'
          });
        }

        return res.status(200).json({
          success: true,
          message: `Vertical "${updateName}" updated successfully`
        });

      default:
        return res.status(405).json({
          success: false,
          message: 'Method not allowed'
        });
    }

  } catch (error) {
    console.error('Vertical management error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to manage verticals'
    });
  }
}