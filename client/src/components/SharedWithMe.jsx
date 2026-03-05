import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function SharedWithMe({ contract, setModalOpen, account }) {
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedOwner, setSelectedOwner] = useState("");

  useEffect(() => {
    loadSharedFiles();
  }, []);

  const loadSharedFiles = async () => {
    if (!contract) return;
    
    setLoading(true);
    try {
      // Note: You'll need to implement a way to track shared files
      // This is a placeholder - you might want to emit events and index them
      setMessage({ type: 'info', text: 'This feature requires event indexing' });
    } catch (error) {
      console.error("Error loading shared files:", error);
      setMessage({ type: 'error', text: 'Failed to load shared files' });
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async (owner) => {
    if (!owner || !ethers.isAddress(owner)) {
      setMessage({ type: 'error', text: 'Invalid address' });
      return;
    }

    setLoading(true);
    try {
      const hasAccess = await contract.checkAccess(owner, account);
      
      if (hasAccess) {
        const files = await contract.getFiles(owner);
        const activeFiles = files
          .map((file, index) => ({ ...file, owner, fileId: index }))
          .filter(file => !file.isDeleted);
        
        setSharedFiles(activeFiles);
        setMessage({ type: 'success', text: `Found ${activeFiles.length} shared files` });
      } else {
        setMessage({ type: 'error', text: "You don't have access to this user's files" });
        setSharedFiles([]);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setMessage({ type: 'error', text: 'Failed to check access' });
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

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="modal-header">
        <h3>
          <i className="fas fa-users"></i>
          Shared With Me
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

      <div className="shared-content">
        <div className="search-section">
          <p className="section-label">Enter the address of the user who shared files with you:</p>
          <div className="search-box">
            <input
              type="text"
              className="input-field"
              placeholder="Enter owner address"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
            />
            <button 
              className="btn btn-primary"
              onClick={() => checkAccess(selectedOwner)}
              disabled={loading || !selectedOwner}
            >
              {loading ? <i className="fas fa-spinner fa-spin"></i> : 'View Files'}
            </button>
          </div>
        </div>

        {sharedFiles.length > 0 ? (
          <div className="shared-files-list">
            <h4>Files shared by {formatAddress(selectedOwner)}</h4>
            <div className="files-grid">
              {sharedFiles.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-preview file-icon">
                    <i className={`fas ${getFileIcon(file.fileType)}`}></i>
                  </div>
                  <div className="file-info">
                    <h4 title={file.name}>{file.name}</h4>
                    <div className="file-meta">
                      <span>
                        <i className="fas fa-calendar"></i>
                        {formatDate(file.timestamp)}
                      </span>
                      <span>
                        <i className="fas fa-database"></i>
                        {formatFileSize(Number(file.size))}
                      </span>
                    </div>
                  </div>
                  <div className="file-actions">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="action-btn preview"
                      title="View"
                    >
                      <i className="fas fa-eye"></i>
                    </a>
                    <a 
                      href={file.url} 
                      download={file.name}
                      className="action-btn download"
                      title="Download"
                    >
                      <i className="fas fa-download"></i>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !loading && !message.text && (
            <div className="empty-state">
              <i className="fas fa-share-alt"></i>
              <p>Enter an address to view shared files</p>
              <small>You need to have access granted by the owner</small>
            </div>
          )
        )}
      </div>

      <div className="modal-footer">
        <button 
          onClick={() => setModalOpen(false)} 
          className="btn btn-secondary"
        >
          Close
        </button>
      </div>
    </>
  );
}

function getFileIcon(fileType) {
  const type = (fileType || '').toLowerCase();
  if (type.startsWith('image/')) return 'fa-image';
  if (type.startsWith('video/')) return 'fa-video';
  if (type.startsWith('audio/')) return 'fa-music';
  if (type.includes('pdf')) return 'fa-file-pdf';
  if (type.includes('word') || type.includes('document')) return 'fa-file-word';
  if (type.includes('zip') || type.includes('compressed')) return 'fa-file-archive';
  if (type.includes('text')) return 'fa-file-alt';
  return 'fa-file';
}