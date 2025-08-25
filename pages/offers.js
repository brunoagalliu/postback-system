// File: pages/offers.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function OffersManagement() {
    const [offers, setOffers] = useState([]);
    const [verticals, setVerticals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Modal states
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [editingOffer, setEditingOffer] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(null);

    const fetchOffers = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/admin/simple-offers');
            const data = await response.json();

            if (response.ok) {
                setOffers(data.offers);
            } else {
                setError(data.message || 'Failed to load offers');
            }
        } catch (err) {
            setError('Error loading offers: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const fetchVerticals = async () => {
        try {
            const response = await fetch('/api/admin/verticals');
            const data = await response.json();

            if (response.ok) {
                setVerticals(data.verticals);
            }
        } catch (err) {
            console.error('Error loading verticals:', err);
        }
    };

    const handleCreateOffer = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const offerData = {
            offer_id: formData.get('offer_id'),
            offer_name: formData.get('offer_name')
        };

        try {
            const response = await fetch('/api/admin/simple-offers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(offerData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setShowOfferModal(false);
                fetchOffers();
                
                // Auto-assign to vertical if selected
                const verticalId = formData.get('vertical_id');
                if (verticalId && verticalId !== '') {
                    await assignOfferToVertical(offerData.offer_id, verticalId);
                }
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error creating offer: ' + err.message);
        }
    };

    const handleUpdateOffer = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const offerData = {
            offer_id: editingOffer.offer_id,
            offer_name: formData.get('offer_name')
        };

        try {
            const response = await fetch('/api/admin/simple-offers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(offerData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setEditingOffer(null);
                setShowOfferModal(false);
                fetchOffers();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error updating offer: ' + err.message);
        }
    };

    const assignOfferToVertical = async (offerId, verticalId) => {
        try {
            const response = await fetch('/api/admin/assign-offer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offer_id: offerId, vertical_id: parseInt(verticalId) })
            });

            const result = await response.json();
            if (result.success) {
                fetchOffers(); // Refresh to show updated assignments
                setShowAssignModal(null);
                alert(result.message);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error assigning offer: ' + err.message);
        }
    };

    const handleDeleteOffer = async (offerId) => {
        try {
            const response = await fetch(`/api/admin/simple-offers?offer_id=${offerId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setShowDeleteConfirm(null);
                fetchOffers();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error deleting offer: ' + err.message);
        }
    };

    useEffect(() => {
        fetchOffers();
        fetchVerticals();
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <Head>
                <title>Offer Management - Conversion Tracking</title>
                <meta name="description" content="Manage offers and their assignments to verticals" />
            </Head>

            <header style={{ marginBottom: '30px' }}>
                <h1>Offer Management</h1>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={fetchOffers}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            background: '#0070f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'default' : 'pointer'
                        }}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button 
                        onClick={() => {
                            setEditingOffer(null);
                            setShowOfferModal(true);
                        }}
                        style={{
                            padding: '8px 16px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Create Offer
                    </button>
                    <a href="/admin" style={{ 
                        padding: '8px 16px',
                        background: '#6c757d',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        display: 'inline-block'
                    }}>
                        Back to Dashboard
                    </a>
                </div>
            </header>

            {error && (
                <div style={{ 
                    padding: '12px', 
                    background: '#fff0f0', 
                    color: '#d32f2f',
                    borderRadius: '4px',
                    marginBottom: '20px'
                }}>
                    {error}
                </div>
            )}

            {/* Summary Stats */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
                gap: '20px',
                marginBottom: '30px'
            }}>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Total Offers</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0070f3' }}>
                        {offers.length}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Assigned to Verticals</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                        {offers.filter(o => o.vertical_name).length}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>With Conversions</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                        {offers.filter(o => o.total_conversions > 0).length}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Total Cached</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                        ${offers.reduce((sum, o) => sum + o.total_cached_amount, 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Offers Table */}
            {offers.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        background: 'white'
                    }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer Name</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Assigned Vertical</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Conversions</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached Amount</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Last Activity</th>
                                <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offers.map((offer, index) => (
                                <tr key={index}>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                        {offer.offer_id}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                        {offer.offer_name || <span style={{ color: '#666', fontStyle: 'italic' }}>No name</span>}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                        {offer.vertical_name ? (
                                            <div>
                                                <strong>{offer.vertical_name}</strong>
                                                <div style={{ fontSize: '12px', color: '#666' }}>
                                                    ${parseFloat(offer.payout_threshold || 10).toFixed(2)} threshold
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                        {offer.total_conversions || 0}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                        ${parseFloat(offer.total_cached_amount || 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                        {offer.last_conversion ? new Date(offer.last_conversion).toLocaleString() : 'Never'}
                                    </td>
                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                            <button 
                                                onClick={() => {
                                                    setEditingOffer(offer);
                                                    setShowOfferModal(true);
                                                }}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: '#0070f3',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => setShowAssignModal(offer.offer_id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: '#28a745',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Assign
                                            </button>
                                            <button 
                                                onClick={() => setShowDeleteConfirm(offer.offer_id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {offers.length === 0 && !loading && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px' 
                }}>
                    <h3>No offers found</h3>
                    <p>Create your first offer to get started with conversion tracking.</p>
                </div>
            )}

            {/* Simple Offer Modal */}
            {showOfferModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        width: '500px',
                        maxWidth: '90vw'
                    }}>
                        <h3>{editingOffer ? 'Edit Offer' : 'Create New Offer'}</h3>
                        <form onSubmit={editingOffer ? handleUpdateOffer : handleCreateOffer}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Offer ID: *
                                </label>
                                <input
                                    type="text"
                                    name="offer_id"
                                    defaultValue={editingOffer?.offer_id || ''}
                                    disabled={!!editingOffer} // Can't change ID when editing
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: editingOffer ? '#f8f9fa' : 'white'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Offer Name: (optional)
                                </label>
                                <input
                                    type="text"
                                    name="offer_name"
                                    defaultValue={editingOffer?.offer_name || ''}
                                    placeholder="e.g., Weight Loss Campaign A"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            {!editingOffer && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                        Assign to Vertical: (optional)
                                    </label>
                                    <select
                                        name="vertical_id"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <option value="">Select a vertical...</option>
                                        {verticals.map(vertical => (
                                            <option key={vertical.id} value={vertical.id}>
                                                {vertical.name} (${vertical.payout_threshold})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowOfferModal(false);
                                        setEditingOffer(null);
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '8px 16px',
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingOffer ? 'Update Offer' : 'Create Offer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Vertical Modal */}
            {showAssignModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        width: '400px',
                        maxWidth: '90vw'
                    }}>
                        <h3>Assign Offer to Vertical</h3>
                        <p>Assigning offer: <strong>{showAssignModal}</strong></p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const verticalId = formData.get('vertical_id');
                            if (verticalId) {
                                assignOfferToVertical(showAssignModal, verticalId);
                            }
                        }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Select Vertical:
                                </label>
                                <select
                                    name="vertical_id"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <option value="">Select a vertical...</option>
                                    {verticals.map(vertical => (
                                        <option key={vertical.id} value={vertical.id}>
                                            {vertical.name} (${vertical.payout_threshold})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(null)}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '8px 16px',
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Assign
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        width: '400px',
                        maxWidth: '90vw'
                    }}>
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete offer <strong>{showDeleteConfirm}</strong>?</p>
                        <p style={{ color: '#dc3545', fontSize: '14px' }}>
                            This will also remove all cached conversions and vertical assignments for this offer.
                        </p>
                        
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(null)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteOffer(showDeleteConfirm)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Delete Offer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <footer style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4>Simple Offer Management:</h4>
                <ul style={{ marginLeft: '20px', color: '#666' }}>
                    <li><strong>Create Offers:</strong> Add offers with just ID and optional name</li>
                    <li><strong>Assign to Verticals:</strong> Set payout thresholds by assigning to verticals</li>
                    <li><strong>Track Performance:</strong> View conversions and cached amounts per offer</li>
                    <li><strong>Pre-Registration:</strong> Create offers before conversions start coming through</li>
                    <li><strong>Dashboard Integration:</strong> All offers will appear in your admin dashboard</li>
                </ul>
            </footer>
        </div>
    );
}