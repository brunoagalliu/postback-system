// File: pages/admin.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOffer, setSelectedOffer] = useState('all');

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

    const clearCache = async (offerId = null) => {
        try {
            const url = offerId 
                ? `/api/admin/clear-cache?offer_id=${encodeURIComponent(offerId)}`
                : '/api/admin/clear-cache';
            
            const response = await fetch(url, {
                method: 'POST'
            });
            const data = await response.json();

            if (response.ok) {
                const message = offerId 
                    ? `Cleared ${data.clearedRows} cached entries for offer ${offerId}`
                    : `Cleared ${data.clearedRows} total cached entries from global cache`;
                alert(message);
                fetchStats(); // Refresh stats
            } else {
                alert('Error: ' + (data.message || 'Failed to clear cache'));
            }
        } catch (err) {
            alert('Error clearing cache: ' + err.message);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const filteredCachedData = stats?.cachedByOfferAndClickid?.filter(item => 
        selectedOffer === 'all' || item.offer_id === selectedOffer
    ) || [];

    const filteredRecentPostbacks = stats?.recentPostbacks?.filter(item => 
        selectedOffer === 'all' || item.offer_id === selectedOffer
    ) || [];

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <Head>
                <title>Admin Dashboard - Offer Tracking</title>
                <meta name="description" content="Conversion tracking admin dashboard with offer support" />
            </Head>

            <header style={{ marginBottom: '30px' }}>
                <h1>Conversion Tracking Admin Dashboard</h1>
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
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                        gap: '20px',
                        marginBottom: '30px'
                    }}>
                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Total Cached Amount</h3>
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
                            <h3 style={{ margin: '0 0 10px 0' }}>Active Offers</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                                {stats.uniqueOffers}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Active Clickids</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                                {stats.uniqueClickids}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Total Postbacks</h3>
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
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Clickids</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Conversions</th>
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
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(offer.total_cached_amount).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {offer.unique_clickids}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {offer.total_conversions}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {new Date(offer.last_conversion).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => clearCache(offer.offer_id)}
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
                                                        Clear Cache
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Global Cache Management */}
                    <div style={{ 
                        background: '#f8f9fa', 
                        padding: '20px', 
                        borderRadius: '8px',
                        marginBottom: '30px'
                    }}>
                        <h3>Global Cache Management</h3>
                        <p style={{ marginBottom: '15px', color: '#666' }}>
                            Clear the entire global cache (all cached conversions from all offers and clickids)
                        </p>
                        <button 
                            onClick={() => clearCache()}
                            style={{
                                padding: '8px 16px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear All Cache
                        </button>
                    </div>

                    {/* Offer Filter */}
                    <div style={{ marginBottom: '20px' }}>
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

                    {/* Cached Conversions by Offer and Clickid */}
                    {filteredCachedData.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Cached Conversions by Offer & Clickid</h3>
                            <p style={{ color: '#666', marginBottom: '15px' }}>
                                Showing cached conversions for {selectedOffer === 'all' ? 'all offers' : `offer ${selectedOffer}`}
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Clickid</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Total Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Count</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCachedData.map((item, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                                    {item.offer_id}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                                                    {item.clickid}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(item.total_amount).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {item.conversion_count}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {new Date(item.last_updated).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Postback Statistics by Offer */}
                    {stats.postbacksByOffer && stats.postbacksByOffer.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Postback Statistics by Offer</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Total Postbacks</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Successful</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Success Rate</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Total Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Last Postback</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.postbacksByOffer.map((offer, index) => {
                                            const successRate = offer.total_postbacks > 0 ? 
                                                (offer.successful_postbacks / offer.total_postbacks) * 100 : 0;
                                            return (
                                                <tr key={index}>
                                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                                        {offer.offer_id}
                                                    </td>
                                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                        {offer.total_postbacks}
                                                    </td>
                                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                        {offer.successful_postbacks}
                                                    </td>
                                                    <td style={{ 
                                                        padding: '12px', 
                                                        border: '1px solid #dee2e6', 
                                                        textAlign: 'right',
                                                        color: successRate >= 90 ? '#28a745' : successRate >= 70 ? '#fd7e14' : '#dc3545'
                                                    }}>
                                                        {successRate.toFixed(1)}%
                                                    </td>
                                                    <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                        ${parseFloat(offer.total_amount).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                        {new Date(offer.last_postback).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Recent Postbacks */}
                    {filteredRecentPostbacks.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Recent Postbacks</h3>
                            <p style={{ color: '#666', marginBottom: '15px' }}>
                                Showing recent postbacks for {selectedOffer === 'all' ? 'all offers' : `offer ${selectedOffer}`}
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Clickid</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>Success</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecentPostbacks.map((postback, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                                    {postback.offer_id}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                                                    {postback.clickid}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(postback.amount).toFixed(2)}
                                                </td>
                                                <td style={{ 
                                                    padding: '12px', 
                                                    border: '1px solid #dee2e6', 
                                                    textAlign: 'center',
                                                    color: postback.success ? '#28a745' : '#dc3545',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {postback.success ? '✓' : '✗'}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {new Date(postback.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
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
                <h4>How the Offer System Works:</h4>
                <ul style={{ marginLeft: '20px', color: '#666' }}>
                    <li><strong>Per-Offer Caching:</strong> Conversions under $10 are cached separately for each offer</li>
                    <li><strong>Isolated Triggering:</strong> When a $10+ conversion occurs, only that offer's cache is used and cleared</li>
                    <li><strong>Individual Management:</strong> You can clear cache for specific offers or globally</li>
                    <li><strong>Detailed Tracking:</strong> All logs and postbacks include offer information for complete visibility</li>
                </ul>
            </footer>
        </div>
    );
}