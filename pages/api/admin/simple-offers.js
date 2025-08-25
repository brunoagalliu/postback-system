// File: pages/api/admin/simple-offers.js
import { 
  createSimpleOffer, 
  updateSimpleOffer, 
  deleteSimpleOffer, 
  getAllSimpleOffers,
  logConversion
} from '../../../lib/database.js';

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case 'GET':
        // Get all offers
        const offers = await getAllSimpleOffers();
        return res.status(200).json({
          success: true,
          offers
        });

      case 'POST':
        // Create new offer
        const { offer_id, offer_name } = req.body;
        
        if (!offer_id) {
          return res.status(400).json({
            success: false,
            message: 'Offer ID is required'
          });
        }

        // Validate offer_id format
        const offerIdRegex = /^[a-zA-Z0-9_-]{1,50}$/;
        if (!offerIdRegex.test(offer_id)) {
          return res.status(400).json({
            success: false,
            message: 'Offer ID must be 1-50 alphanumeric characters, hyphens, or underscores'
          });
        }

        try {
          await createSimpleOffer(offer_id, offer_name || '');
          
          // Log the offer creation
          await logConversion({
            clickid: 'admin',
            offer_id: offer_id,
            action: 'offer_created',
            message: `Admin created offer: ${offer_name || offer_id} (${offer_id})`
          });

          return res.status(200).json({
            success: true,
            message: `Offer "${offer_id}" created successfully`
          });
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
              success: false,
              message: 'Offer ID already exists'
            });
          }
          throw error;
        }

      case 'PUT':
        // Update existing offer
        const { offer_id: updateOfferId, offer_name: updateOfferName } = req.body;
        
        if (!updateOfferId) {
          return res.status(400).json({
            success: false,
            message: 'Offer ID is required'
          });
        }

        const affectedRows = await updateSimpleOffer(updateOfferId, updateOfferName || '');

        if (affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Offer not found'
          });
        }

        // Log the offer update
        await logConversion({
          clickid: 'admin',
          offer_id: updateOfferId,
          action: 'offer_updated',
          message: `Admin updated offer: ${updateOfferName || updateOfferId} (${updateOfferId})`
        });

        return res.status(200).json({
          success: true,
          message: `Offer "${updateOfferId}" updated successfully`
        });

      case 'DELETE':
        // Delete offer
        const { offer_id: deleteOfferId } = req.query;
        
        if (!deleteOfferId) {
          return res.status(400).json({
            success: false,
            message: 'Offer ID is required'
          });
        }

        const deletedRows = await deleteSimpleOffer(deleteOfferId);

        if (deletedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Offer not found'
          });
        }

        // Log the offer deletion
        await logConversion({
          clickid: 'admin',
          offer_id: deleteOfferId,
          action: 'offer_deleted',
          message: `Admin deleted offer: ${deleteOfferId}`
        });

        return res.status(200).json({
          success: true,
          message: `Offer ${deleteOfferId} deleted successfully`
        });

      default:
        return res.status(405).json({
          success: false,
          message: 'Method not allowed'
        });
    }

  } catch (error) {
    console.error('Simple offer management error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to manage offers'
    });
  }
}