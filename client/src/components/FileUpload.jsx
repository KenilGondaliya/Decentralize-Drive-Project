import { useState } from "react";
import axios from "axios";

export default function FileUpload({ contract, account }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }
    
    if (!contract) {
      setMessage({ type: 'error', text: 'Contract not initialized' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resFile = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            pinata_api_key: "80000672308d07d88748",
            pinata_secret_api_key: "c237205f4f9b49ec937167509bfa8b9c283ea8b7e7895fb2759438873fd03d72",
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const ImgHash = `https://gateway.pinata.cloud/ipfs/${resFile.data.IpfsHash}`;
      const tx = await contract.add(ImgHash);
      await tx.wait();

      setMessage({ type: 'success', text: 'File uploaded successfully!' });
      setFile(null);
      
      // Reset file input
      e.target.reset();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {message.text && (
        <div className={`message ${message.type}`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <input
          type="file"
          className="file-input"
          disabled={!account || uploading}
          onChange={(e) => setFile(e.target.files[0])}
          accept="image/*"
        />
        {file && (
          <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
            Selected: {file.name}
          </small>
        )}
      </div>

      <button 
        type="submit" 
        className="btn" 
        disabled={!account || uploading}
      >
        {uploading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            Uploading...
          </>
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt"></i>
            Upload File
          </>
        )}
      </button>

      {!account && (
        <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>
          <i className="fas fa-exclamation-triangle"></i>
          Please connect your wallet to upload files
        </p>
      )}
    </form>
  );
}