// File: pages/admin.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [verticals, setVerticals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOffer, setSelectedOffer] = useState('all');
    const [selectedVertical, setSelectedVertical] = useState('all');
    
    // Modal states
    const [showVerticalModal, setShowVerticalModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [editingVertical, setEditingVertical] = useState(null);
    const [assigningOffer, setAssigningOffer] = useState(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            if (response.ok) {
                setStats(data);
            } else {
                setError(data.message || 'Failed to load stats');
            }
        } catch (err) {
            setError('Error loading stats: ' + (err.message || 'Unknown error'));
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

    const handleCreateVertical = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const verticalData = {
            name: formData.get('name'),
            payout_threshold: parseFloat(formData.get('payout_threshold')),
            description: formData.get('description')
        };

        try {
            const response = await fetch('/api/admin/verticals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verticalData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setShowVerticalModal(false);
                fetchVerticals();
                fetchStats();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error creating vertical: ' + err.message);
        }
    };

    const handleUpdateVertical = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const verticalData = {
            id: editingVertical.id,
            name: formData.get('name'),
            payout_threshold: parseFloat(formData.get('payout_threshold')),
            description: formData.get('description')
        };

        try {
            const response = await fetch('/api/admin/verticals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verticalData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setEditingVertical(null);
                setShowVerticalModal(false);
                fetchVerticals();
                fetchStats();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error updating vertical: ' + err.message);
        }
    };

    const handleAssignOffer = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const assignmentData = {
            offer_id: assigningOffer,
            vertical_id: parseInt(formData.get('vertical_id'))
        };

        try {
            const response = await fetch('/api/admin/assign-offer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignmentData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                setAssigningOffer(null);
                setShowAssignModal(false);
                fetchStats();
                fetchVerticals();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            alert('Error assigning offer: ' + err.message);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchVerticals();
        const interval = setInterval(() => {
            fetchStats();
            fetchVerticals();
        }, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const filteredCachedData = stats?.cachedByOfferAndClickid?.filter(item => {
        const offerMatch = selectedOffer === 'all' || item.offer_id === selectedOffer;
        const verticalMatch = selectedVertical === 'all' || item.vertical_name === selectedVertical;
        return offerMatch && verticalMatch;
    }) || [];

    const filteredRecentPostbacks = stats?.recentPostbacks?.filter(item => {
        const offerMatch = selectedOffer === 'all' || item.offer_id === selectedOffer;
        const verticalMatch = selectedVertical === 'all' || item.vertical_name === selectedVertical;
        return offerMatch && verticalMatch;
    }) || [];

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
            <Head>
                <title>Admin Dashboard - Vertical & Offer Tracking</title>
                <meta name="description" content="Conversion tracking admin dashboard with vertical and offer support" />
            </Head>

            <header style={{ marginBottom: '30px' }}>
                <h1>Conversion Tracking Admin Dashboard</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={fetchStats}
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
                        {loading ? 'Loading...' : 'Refresh Stats'}
                    </button>
                    <button 
                        onClick={() => {
                            setEditingVertical(null);
                            setShowVerticalModal(true);
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
                        Create Vertical
                    </button>
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

            {stats && (
                <div>
                    {/* Global Summary Stats */}
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
                            <h3 style={{ margin: '0 0 10px 0' }}>Total Cached</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0070f3' }}>
                                ${stats.totalCachedAmount.toFixed(2)}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Verticals</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                                {stats.totalVerticals}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Offers</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                                {stats.uniqueOffers}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Clickids</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>
                                {stats.uniqueClickids}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Postbacks</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                                {stats.totalPostbacks}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Success Rate</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
                                {stats.successRate.toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Vertical Statistics */}
                    {verticals && verticals.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Vertical Performance</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Vertical</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Threshold</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Offers</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Postbacks</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Success Rate</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {verticals.map((vertical, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                                    {vertical.name}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(vertical.payout_threshold).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {vertical.total_offers}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${vertical.total_cached_amount.toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {vertical.total_postbacks}
                                                </td>
                                                <td style={{ 
                                                    padding: '12px', 
                                                    border: '1px solid #dee2e6', 
                                                    textAlign: 'right',
                                                    color: vertical.success_rate >= 90 ? '#28a745' : 
                                                           vertical.success_rate >= 70 ? '#fd7e14' : '#dc3545'
                                                }}>
                                                    {vertical.success_rate.toFixed(1)}%
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingVertical(vertical);
                                                            setShowVerticalModal(true);
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
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Offer Statistics */}
                    {stats.offerStats && stats.offerStats.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Performance by Offer</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Vertical</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Threshold</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Clickids</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Last Activity</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.offerStats.map((offer, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                                    {offer.offer_id}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {offer.vertical_name || 'Unassigned'}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(offer.payout_threshold || 10).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(offer.total_cached_amount || 0).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {offer.unique_clickids}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {offer.last_conversion ? new Date(offer.last_conversion).toLocaleString() : 'Never'}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => {
                                                            setAssigningOffer(offer.offer_id);
                                                            setShowAssignModal(true);
                                                        }}
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
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div>
                            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by Vertical:</label>
                            <select 
                                value={selectedVertical} 
                                onChange={(e) => setSelectedVertical(e.target.value)}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            >
                                <option value="all">All Verticals</option>
                                {verticals.map(vertical => (
                                    <option key={vertical.id} value={vertical.name}>
                                        {vertical.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by Offer:</label>
                            <select 
                                value={selectedOffer} 
                                onChange={(e) => setSelectedOffer(e.target.value)}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            >
                                <option value="all">All Offers</option>
                                {stats.offerStats?.map(offer => (
                                    <option key={offer.offer_id} value={offer.offer_id}>
                                        {offer.offer_id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Rest of the tables with filtered data would continue here... */}
                    
                </div>
            )}

            {/* Vertical Modal */}
            {showVerticalModal && (
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
                        <h3>{editingVertical ? 'Edit Vertical' : 'Create New Vertical'}</h3>
                        <form onSubmit={editingVertical ? handleUpdateVertical : handleCreateVertical}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Vertical Name:
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    defaultValue={editingVertical?.name || ''}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Payout Threshold ($):
                                </label>
                                <input
                                    type="number"
                                    name="payout_threshold"
                                    step="0.01"
                                    min="0.01"
                                    defaultValue={editingVertical?.payout_threshold || 10.00}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                    Description:
                                </label>
                                <textarea
                                    name="description"
                                    defaultValue={editingVertical?.description || ''}
                                    rows="3"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowVerticalModal(false);
                                        setEditingVertical(null);
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
                                    {editingVertical ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Offer Modal */}
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
                        <p>Assigning offer: <strong>{assigningOffer}</strong></p>
                        <form onSubmit={handleAssignOffer}>
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
                                    onClick={() => {
                                        setShowAssignModal(false);
                                        setAssigningOffer(null);
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
                                    Assign
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                <a href="/logs" style={{ 
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    marginRight: '10px'
                }}>
                    View Detailed Logs
                </a>
            </div>

            <footer style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4>How the Vertical System Works:</h4>
                <ul style={{ marginLeft: '20px', color: '#666' }}>
                    <li><strong>Vertical Management:</strong> Create verticals to categorize your offers by niche or campaign type</li>
                    <li><strong>Custom Thresholds:</strong> Set different payout thresholds per vertical (default: $10.00)</li>
                    <li><strong>Offer Assignment:</strong> Assign offers to verticals to inherit the vertical's payout threshold</li>
                    <li><strong>Per-Vertical Caching:</strong> Conversions under the threshold are cached per offer within each vertical</li>
                    <li><strong>Automatic Processing:</strong> When threshold is reached, cached amounts are automatically used and postback sent</li>
                    <li><strong>Isolated Tracking:</strong> Each vertical operates independently with its own rules and metrics</li>
                </ul>
            </footer>
        </div>
    );
}