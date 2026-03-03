import { useState } from "react";

export default function Display({ contract, account }) {
  const [images, setImages] = useState([]);
  const [otherAddress, setOtherAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const getData = async () => {
    if (!contract) {
      setMessage({ type: 'error', text: 'Contract not initialized' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const addressToCheck = otherAddress || account;
      const data = await contract.display(addressToCheck);
      setImages(data);
      
      if (data.length === 0) {
        setMessage({ type: 'info', text: 'No images found' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: "You don't have access to view these images" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Enter address to view (optional)"
          value={otherAddress}
          onChange={(e) => setOtherAddress(e.target.value)}
        />
        <button 
          onClick={getData} 
          className="btn btn-secondary"
          disabled={loading}
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <>
              <i className="fas fa-search"></i>
              Get Data
            </>
          )}
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          <i className={`fas fa-${message.type === 'info' ? 'info-circle' : 'exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {images.length > 0 ? (
        <div className="image-grid">
          {images.map((img, i) => (
            <div key={i} className="image-card">
              <img src={img} alt={`Upload ${i + 1}`} />
              <div style={{ padding: '0.5rem', textAlign: 'center' }}>
                <small>Image {i + 1}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && !message.text && (
          <div className="empty-state">
            <i className="fas fa-images"></i>
            <p>No images to display</p>
            <small>Upload some images to get started</small>
          </div>
        )
      )}
    </div>
  );
}