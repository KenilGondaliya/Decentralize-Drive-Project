import { useState, useEffect } from "react";

export default function Modal({ setModalOpen, contract }) {
  const [address, setAddress] = useState("");
  const [accessList, setAccessList] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const share = async () => {
    if (!address) {
      setMessage({ type: 'error', text: 'Please enter an address' });
      return;
    }

    if (!contract) {
      setMessage({ type: 'error', text: 'Contract not initialized' });
      return;
    }

    setSharing(true);
    setMessage({ type: '', text: '' });

    try {
      const tx = await contract.allow(address);
      await tx.wait();
      setMessage({ type: 'success', text: 'Access granted successfully!' });
      setAddress("");
      
      // Refresh access list
      const list = await contract.shareAccess();
      setAccessList(list);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Transaction failed. Please try again.' });
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    const loadAccessList = async () => {
      if (contract) {
        try {
          const list = await contract.shareAccess();
          setAccessList(list);
        } catch (error) {
          console.error("Error loading access list:", error);
        }
      }
    };

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
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
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
          disabled={sharing}
        />
      </div>

      <div className="button-group">
        <button 
          onClick={share} 
          className="btn"
          disabled={sharing}
        >
          {sharing ? (
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
          disabled={sharing}
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
              <span className={`access-status ${item.access ? 'status-allowed' : 'status-denied'}`}>
                {item.access ? 'Allowed' : 'Not Allowed'}
              </span>
            </div>
          ))
        ) : (
          <p style={{ color: '#999', textAlign: 'center' }}>
            No access grants yet
          </p>
        )}
      </div>
    </>
  );
}