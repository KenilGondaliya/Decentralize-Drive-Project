import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

export default function AccessManager({ contract, setModalOpen, account, onAccessChange }) {

  const [address, setAddress] = useState("");
  const [accessList, setAccessList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [batchAddresses, setBatchAddresses] = useState("");
  const [activeTab, setActiveTab] = useState('single');

  const loadAccessList = useCallback(async () => {
    if (!contract) return;

    try {
      const list = await contract.getAccessList();
      // Filter out duplicates and format
      const uniqueList = list.filter((item, index, self) => 
        index === self.findIndex((t) => t.user === item.user)
      );
      setAccessList(uniqueList);
    } catch (error) {
      console.error("Error loading access list:", error);
    }
  }, [contract]);

  useEffect(() => {
    loadAccessList();
  }, [loadAccessList]);

  const grantAccess = async () => {
    if (!address) {
      setMessage({ type: 'error', text: 'Please enter an address' });
      return;
    }

    if (!ethers.isAddress(address)) {
      setMessage({ type: 'error', text: 'Invalid Ethereum address' });
      return;
    }

    if (address.toLowerCase() === account.toLowerCase()) {
      setMessage({ type: 'error', text: 'Cannot grant access to yourself' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const tx = await contract.grantAccess(address);
      await tx.wait();
      
      setMessage({ type: 'success', text: 'Access granted successfully!' });
      if (onAccessChange) onAccessChange();
      setAddress("");
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
  };

  const revokeAccess = async (userAddress) => {
    if (!window.confirm(`Revoke access for ${formatAddress(userAddress)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const tx = await contract.revokeAccess(userAddress);
      await tx.wait();
      
      setMessage({ type: 'success', text: 'Access revoked successfully!' });
      if (onAccessChange) onAccessChange();
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to revoke access' });
    } finally {
      setLoading(false);
    }
  };

  const batchGrantAccess = async () => {
    const addresses = batchAddresses
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => ethers.isAddress(addr) && addr.toLowerCase() !== account.toLowerCase());

    if (addresses.length === 0) {
      setMessage({ type: 'error', text: 'No valid addresses found' });
      return;
    }

    setLoading(true);
    try {
      const tx = await contract.batchGrantAccess(addresses);
      await tx.wait();
      
      setMessage({ type: 'success', text: `Access granted to ${addresses.length} users` });
      setBatchAddresses("");
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Batch grant failed' });
    } finally {
      setLoading(false);
    }
  };

  const batchRevokeAccess = async () => {
    const usersWithAccess = accessList
      .filter(item => item.access)
      .map(item => item.user);

    if (usersWithAccess.length === 0) {
      setMessage({ type: 'info', text: 'No users with access to revoke' });
      return;
    }

    if (!window.confirm(`Revoke access for all ${usersWithAccess.length} users?`)) {
      return;
    }

    setLoading(true);
    try {
      const tx = await contract.batchRevokeAccess(usersWithAccess);
      await tx.wait();
      
      setMessage({ type: 'success', text: 'Access revoked for all users' });
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Batch revoke failed' });
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  return (
    <>
      <div className="modal-header">
        <h3>
          <i className="fas fa-users-cog"></i>
          Manage Access
        </h3>
        <button className="close-btn" onClick={() => setModalOpen(false)}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          <i className={`fas fa-${
            message.type === 'success' ? 'check-circle' : 'exclamation-circle'
          }`}></i>
          {message.text}
        </div>
      )}

      <div className="access-tabs">
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            <i className="fas fa-user"></i>
            Single Grant
          </button>
          <button 
            className={`tab-btn ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <i className="fas fa-users"></i>
            Batch Grant
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'single' ? (
            <>
              <div className="form-group">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter Ethereum address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button 
                onClick={grantAccess} 
                className="btn grant-btn"
                disabled={loading || !address}
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    Grant Access
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <textarea
                  className="input-field"
                  placeholder="Enter addresses (one per line)"
                  value={batchAddresses}
                  onChange={(e) => setBatchAddresses(e.target.value)}
                  rows="4"
                  disabled={loading}
                />
                <p className="input-hint">
                  Enter one Ethereum address per line
                </p>
              </div>
              <div className="button-group">
                <button 
                  onClick={batchGrantAccess} 
                  className="btn grant-btn"
                  disabled={loading || !batchAddresses}
                >
                  <i className="fas fa-users"></i>
                  Grant to Multiple
                </button>
                {accessList.filter(item => item.access).length > 0 && (
                  <button 
                    onClick={batchRevokeAccess} 
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    <i className="fas fa-ban"></i>
                    Revoke All
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="access-list-section">
        <h4>
          <i className="fas fa-users"></i>
          People With Access ({accessList.filter(item => item.access).length})
        </h4>
        
        {accessList.length > 0 ? (
          <div className="access-list">
            {accessList.map((item, i) => (
              <div key={i} className={`access-item ${item.access ? 'allowed' : 'denied'}`}>
                <div className="access-info">
                  <span className="access-address" title={item.user}>
                    {formatAddress(item.user)}
                  </span>
                  <span className="access-date">
                    <i className="fas fa-clock"></i>
                    {formatDate(Number(item.grantedAt))}
                  </span>
                </div>
                <div className="access-actions">
                  <span className={`status-badge ${item.access ? 'status-allowed' : 'status-denied'}`}>
                    {item.access ? 'Allowed' : 'Not Allowed'}
                  </span>
                  {item.access && (
                    <button
                      onClick={() => revokeAccess(item.user)}
                      className="revoke-btn"
                      title="Revoke Access"
                      disabled={loading}
                    >
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state small">
            <i className="fas fa-users"></i>
            <p>No access grants yet</p>
            <small>Share access to let others view your files</small>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button 
          onClick={() => setModalOpen(false)} 
          className="btn btn-secondary"
          disabled={loading}
        >
          Close
        </button>
      </div>
    </>
  );
}