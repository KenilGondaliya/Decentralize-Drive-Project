import { useState, useEffect } from "react";

export default function Modal({ setModalOpen, contract, account }) {
  const [address, setAddress] = useState("");
  const [accessList, setAccessList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const grantAccess = async () => {
    if (!address) {
      setMessage({ type: 'error', text: 'Please enter an address' });
      return;
    }

    if (!contract) {
      setMessage({ type: 'error', text: 'Contract not initialized' });
      return;
    }

    if (address.toLowerCase() === account.toLowerCase()) {
      setMessage({ type: 'error', text: 'Cannot grant access to yourself' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Using grantAccess() as per your smart contract
      const tx = await contract.grantAccess(address);
      await tx.wait();
      setMessage({ type: 'success', text: 'Access granted successfully!' });
      setAddress("");
      
      // Refresh access list
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Transaction failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const revokeAccess = async (userAddress) => {
    if (!contract) return;

    try {
      const tx = await contract.revokeAccess(userAddress);
      await tx.wait();
      setMessage({ type: 'success', text: 'Access revoked successfully!' });
      await loadAccessList();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to revoke access' });
    }
  };

  const loadAccessList = async () => {
    if (contract) {
      try {
        // Using getAccessList() as per your contract
        const list = await contract.getAccessList();
        setAccessList(list);
      } catch (error) {
        console.error("Error loading access list:", error);
      }
    }
  };

  useEffect(() => {
    loadAccessList();
  }, [contract]);

  return (
    <>
      <div className="modal-header">
        <h3>
          <i className="fas fa-share-alt"></i>
          Share Access
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

      <div className="button-group">
        <button 
          onClick={grantAccess} 
          className="btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Granting...
            </>
          ) : (
            <>
              <i className="fas fa-check"></i>
              Grant Access
            </>
          )}
        </button>
        <button 
          onClick={() => setModalOpen(false)} 
          className="btn btn-secondary"
          disabled={loading}
        >
          <i className="fas fa-times"></i>
          Cancel
        </button>
      </div>

      <div className="access-list">
        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-users"></i>
          People With Access ({accessList.length})
        </h4>
        
        {accessList.length > 0 ? (
          accessList.map((item, i) => (
            <div key={i} className={`access-item ${item.access ? 'allowed' : 'denied'}`}>
              <span className="access-address">
                {item.user.slice(0, 6)}...{item.user.slice(-4)}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`access-status ${item.access ? 'status-allowed' : 'status-denied'}`}>
                  {item.access ? 'Allowed' : 'Not Allowed'}
                </span>
                {item.access && (
                  <button 
                    className="action-btn delete" 
                    style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}
                    onClick={() => revokeAccess(item.user)}
                    title="Revoke Access"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state small">
            <i className="fas fa-users"></i>
            <p>No access grants yet</p>
          </div>
        )}
      </div>
    </>
  );
}