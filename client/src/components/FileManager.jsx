import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function FileManager({ contract, setModalOpen, account, onFileUpdate }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingFile, setEditingFile] = useState(null);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    if (!contract) return;
    
    setLoading(true);
    try {
      const data = await contract.getFiles(account);
      const activeFiles = data
        .map((file, index) => ({ ...file, id: index }))
        .filter(file => !file.isDeleted);
      setFiles(activeFiles);
    } catch (error) {
      console.error("Error loading files:", error);
      setMessage({ type: 'error', text: 'Failed to load files' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFile = async (fileId) => {
    if (!newUrl && !newName) {
      setMessage({ type: 'error', text: 'Please enter new URL or name' });
      return;
    }

    setLoading(true);
    try {
      const tx = await contract.updateFile(
        fileId,
        newUrl || editingFile.url,
        newName || editingFile.name
      );
      await tx.wait();
      
      setMessage({ type: 'success', text: 'File updated successfully' });
      setEditingFile(null);
      setNewUrl("");
      setNewName("");
      await loadFiles();
      if (onFileUpdate) onFileUpdate();
    } catch (error) {
      console.error("Error updating file:", error);
      setMessage({ type: 'error', text: error.message || 'Failed to update file' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    setLoading(true);
    try {
      const tx = await contract.removeFile(fileId);
      await tx.wait();
      
      setMessage({ type: 'success', text: 'File deleted successfully' });
      await loadFiles();
      if (onFileUpdate) onFileUpdate();
    } catch (error) {
      console.error("Error deleting file:", error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete file' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <div className="modal-header">
        <h3>
          <i className="fas fa-cog"></i>
          Manage Files
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

      <div className="file-manager-content">
        {loading && !editingFile ? (
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading files...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="file-list">
            {files.map((file) => (
              <div key={file.id} className="file-manager-item">
                {editingFile && editingFile.id === file.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="New URL"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="New Name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <div className="edit-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleUpdateFile(file.id)}
                        disabled={loading}
                      >
                        <i className="fas fa-save"></i> Save
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingFile(null);
                          setNewUrl("");
                          setNewName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="file-info">
                      <div className="file-icon">
                        <i className="fas fa-file"></i>
                      </div>
                      <div className="file-details">
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
                    </div>
                    <div className="file-actions">
                      <button 
                        className="action-btn edit"
                        onClick={() => setEditingFile(file)}
                        title="Edit File"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={() => handleDeleteFile(file.id)}
                        title="Delete File"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <p>No files found</p>
          </div>
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

// Helper function
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}