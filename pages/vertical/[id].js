// File: pages/vertical/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function VerticalDetails() {
    const router = useRouter();
    const { id } = router.query;
    
    const [verticalData, setVerticalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchVerticalDetails = async () => {
        if (!id) return;
        
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`/api/admin/vertical-details?vertical_id=${id}`);
            const data = await response.json();

            if (response.ok) {
                setVerticalData(data);
            } else {
                setError(data.message || 'Failed to load vertical details');
            }
        } catch (err) {
            setError('Error loading vertical details: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerticalDetails();
    }, [id]);

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Loading vertical details...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px' }}>
                <div style={{ 
                    padding: '12px', 
                    background: '#fff0f0', 
                    color: '#d32f2f',
                    borderRadius: '4px',
                    marginBottom: '20px'
                }}>
                    {error}
                </div>
                <button onClick={() => router.back()}>Go Back</button>
            </div>
        );
    }

    if (!verticalData) {
        return <div style={{ padding: '20px' }}>No data available</div>;
    }

    const { vertical, summary, offers, recent_cache_entries } = verticalData;

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <Head>
                <title>{vertical.name} - Vertical Details</title>
                <meta name="description" content={`Cache breakdown for ${vertical.name} vertical`} />
            </Head>

            {/* Header */}
            <header style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
                    <button 
                        onClick={() => router.back()}
                        style={{
                            padding: '8px 16px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back
                    </button>
                    <h1 style={{ margin: 0 }}>Vertical: {vertical.name}</h1>
                </div>
                
                <div style={{ color: '#666', fontSize: '14px' }}>
                    <strong>Threshold:</strong> ${parseFloat(vertical.payout_threshold).toFixed(2)} | 
                    <strong> Description:</strong> {vertical.description || 'No description'}
                </div>
            </header>

            {/* Summary Stats */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
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
                        ${summary.total_cached_amount.toFixed(2)}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Total Offers</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                        {summary.total_offers}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Offers with Cache</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                        {summary.offers_with_cache}
                    </p>
                </div>
                <div style={{ 
                    padding: '20px', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Cached Conversions</h3>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                        {summary.total_cached_conversions}
                    </p>
                </div>
            </div>

            {/* Offers Breakdown Table */}
            <div style={{ marginBottom: '30px' }}>
                <h3>Cache Breakdown by Offer</h3>
                {offers.length > 0 ? (
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
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached Amount</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cached Conversions</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Cache Entries</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Oldest Cache</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Newest Cache</th>
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
                                        <td style={{ 
                                            padding: '12px', 
                                            border: '1px solid #dee2e6', 
                                            textAlign: 'right',
                                            fontWeight: 'bold',
                                            color: offer.cached_amount > 0 ? '#0070f3' : '#666'
                                        }}>
                                            ${offer.cached_amount.toFixed(2)}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                            {offer.cached_conversions}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                            {offer.total_cache_entries}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                            {offer.oldest_cache ? new Date(offer.oldest_cache).toLocaleString() : '-'}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                            {offer.newest_cache ? new Date(offer.newest_cache).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '40px', 
                        background: '#f8f9fa', 
                        borderRadius: '8px' 
                    }}>
                        <p>No offers found in this vertical.</p>
                    </div>
                )}
            </div>

            {/* Recent Cache Entries */}
            {recent_cache_entries.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <h3>Recent Cache Entries (Last 100)</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            background: 'white'
                        }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa' }}>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Timestamp</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer ID</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Offer Name</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Click ID</th>
                                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent_cache_entries.map((entry, index) => (
                                    <tr key={index}>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                            {new Date(entry.created_at).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                                            {entry.offer_id}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                            {entry.offer_name || <span style={{ color: '#666', fontStyle: 'italic' }}>No name</span>}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px' }}>
                                            {entry.clickid}
                                        </td>
                                        <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                                            ${entry.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                <button 
                    onClick={fetchVerticalDetails}
                    style={{
                        padding: '10px 20px',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '10px'
                    }}
                >
                    Refresh Data
                </button>
                <a href="/admin" style={{ 
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px'
                }}>
                    Back to Dashboard
                </a>
            </div>

            <footer style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4>Understanding This View:</h4>
                <ul style={{ marginLeft: '20px', color: '#666' }}>
                    <li><strong>Cached Amount:</strong> Total amount waiting to be sent for each offer</li>
                    <li><strong>Cached Conversions:</strong> Number of unique click IDs with cached amounts</li>
                    <li><strong>Cache Entries:</strong> Total number of individual cache records (can be multiple per click ID)</li>
                    <li><strong>Threshold:</strong> When any offer in this vertical reaches ${parseFloat(vertical.payout_threshold).toFixed(2)}, all cached amounts are sent</li>
                    <li><strong>Recent Entries:</strong> Shows the most recent cache activity across all offers in this vertical</li>
                </ul>
            </footer>
        </div>
    );
}