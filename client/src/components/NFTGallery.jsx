import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";

export default function NFTGallery({ nftContract, uploadContract, account, provider, onTransfer }) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

  
  const formatAddress = (addr) => {
    if (!addr) return "Unknown";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (nftContract && account) {
      loadNFTs();
    }
  }, [nftContract, account]);

  const loadNFTs = async () => {
    if (!nftContract) return;

    setLoading(true);
    try {
      const total = await nftContract.tokenCounter();
      console.log("Loading NFTs, total:", total.toString());
      
      const nftList = [];

      for (let i = 0; i < total; i++) {
        try {
          const tokenId = i;
          const owner = await nftContract.ownerOf(tokenId);
          
          // Get token URI
          const tokenURI = await nftContract.tokenURI(tokenId);
          
          // Fetch metadata
          const metadataUrl = tokenURI.replace("ipfs://", GATEWAY_URL);
          const metadataRes = await axios.get(metadataUrl);
          const metadata = metadataRes.data;

          // Get NFT info from contract
          const info = await nftContract.nftInfo(tokenId);

          // Fix the image URL - convert ipfs:// to https://
          if (metadata.image && metadata.image.startsWith("ipfs://")) {
            metadata.image = metadata.image.replace("ipfs://", GATEWAY_URL);
          }

          nftList.push({
            tokenId,
            owner,
            metadata,
            info: {
              creator: info.creator,
              fileUrl: info.fileUrl,
              mintedAt: Number(info.mintedAt)
            }
          });
          
          console.log(`Loaded NFT #${tokenId}: Owner=${owner}`);
        } catch (err) {
          console.error(`Error loading NFT ${i}:`, err);
        }
      }

      setNfts(nftList);
    } catch (error) {
      console.error("Error loading NFTs:", error);
      setMessage({ type: "error", text: "Failed to load NFTs" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (tokenId) => {
    try {
      const historyData = await nftContract.getHistory(tokenId);
      const formattedHistory = historyData.map(item => ({
        owner: item.owner,
        timestamp: Number(item.timestamp)
      }));
      setHistory(formattedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const handleNFTClick = async (nft) => {
    setSelectedNFT(nft);
    await loadHistory(nft.tokenId);
    setShowHistory(true);
  };

  const transferNFT = async (tokenId, fileUrl, fileName, fileType, fileSize) => {
    const to = prompt("Enter recipient address");
    if (!to) return;

    if (!ethers.isAddress(to)) {
      alert("Invalid address");
      return;
    }

    if (to.toLowerCase() === account.toLowerCase()) {
      alert("Cannot transfer to yourself");
      return;
    }

    setTransferring(true);
    try {
      console.log(`Transferring NFT ${tokenId} to ${to}`);
      
      // Step 1: Transfer the NFT
      const tx = await nftContract.transferNFT(to, tokenId);
      console.log("Transaction sent:", tx.hash);
      
      await tx.wait();
      console.log("NFT Transfer confirmed");
      
      // Step 2: If uploadContract exists, grant access and add file for the new owner
      if (uploadContract) {
        try {
          console.log(`Granting access to new owner ${to}`);
          const accessTx = await uploadContract.grantAccess(to);
          await accessTx.wait();
          console.log("Access granted successfully");
        } catch (accessErr) {
          console.log("Note: Could not grant access", accessErr);
        }
        
        // Step 3: Add the file to the new owner's file list in Upload contract
        try {
          console.log("Adding file to new owner's gallery...");
          
          // Check if the file already exists for the new owner
          let fileExists = false;
          try {
            const newOwnerFiles = await uploadContract.getFiles(to);
            fileExists = newOwnerFiles.some(f => f.url === fileUrl);
          } catch (checkErr) {
            console.log("Error checking existing files:", checkErr);
          }
          
          if (!fileExists) {
            // Add the file to the new owner's file list
            const addTx = await uploadContract.addFile(
              fileUrl,
              fileName,
              fileType || "application/octet-stream",
              fileSize
            );
            await addTx.wait();
            console.log("File added to new owner's gallery");
          } else {
            console.log("File already exists in new owner's gallery");
          }
        } catch (addErr) {
          console.error("Error adding file to new owner:", addErr);
        }
      }
      
      alert(`NFT transferred successfully to ${formatAddress(to)}!`);
      
      // Refresh the NFT list
      setTimeout(async () => {
        await loadNFTs();
        if (onTransfer) onTransfer();
      }, 3000);
      
    } catch (err) {
      console.error(err);
      alert("Transfer failed: " + err.message);
    } finally {
      setTransferring(false);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isImage = (url) => {
    if (!url) return false;
    return url.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i) !== null || 
           url.includes('ipfs') || 
           url.includes('gateway');
  };

  const isVideo = (url) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) !== null;
  };

  const getImageUrl = (url) => {
    if (!url) return "https://via.placeholder.com/300?text=No+Image";
    if (url.startsWith("ipfs://")) {
      return url.replace("ipfs://", GATEWAY_URL);
    }
    return url;
  };

  const canTransfer = (nft) => {
    return nft.owner?.toLowerCase() === account?.toLowerCase();
  };

  return (
    <div className="nft-gallery-container">
      <div className="nft-header">
        <h2>
          <i className="fas fa-image"></i>
          NFT Gallery {nfts.length > 0 && `(${nfts.length})`}
        </h2>
        <button 
          onClick={loadNFTs} 
          className="btn btn-secondary refresh-btn"
          disabled={loading || transferring}
        >
          <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          Refresh
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          <i className={`fas fa-${
            message.type === "info" ? "info-circle" : "exclamation-circle"
          }`}></i>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading NFTs...</p>
        </div>
      ) : nfts.length > 0 ? (
        <div className="nfts-grid">
          {nfts.map((nft) => (
            <div 
              key={nft.tokenId} 
              className="nft-card"
            >
              <div className="nft-preview" onClick={() => handleNFTClick(nft)}>
                {nft.metadata.image ? (
                  <img 
                    src={getImageUrl(nft.metadata.image)}
                    alt={nft.metadata.name || `NFT #${nft.tokenId}`}
                    onError={(e) => {
                      console.log("Image failed to load:", nft.metadata.image);
                      e.target.onerror = null;
                      e.target.src = "https://via.placeholder.com/300?text=Image+Error";
                    }}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="nft-icon">
                    <i className="fas fa-image"></i>
                    <p>No Image</p>
                  </div>
                )}
              </div>
              <div className="nft-info">
                <h4>{nft.metadata.name || `NFT #${nft.tokenId}`}</h4>
                <div className="nft-meta">
                  <span title={nft.owner}>
                    <i className="fas fa-user"></i>
                    {formatAddress(nft.owner)}
                  </span>
                  <span>
                    <i className="fas fa-calendar"></i>
                    {formatDate(nft.info.mintedAt)}
                  </span>
                </div>
                
                {/* Owner badge and transfer button */}
                <div className="nft-actions" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '10px'
                }}>
                  {nft.owner.toLowerCase() === account.toLowerCase() ? (
                    <>
                      <span className="owner-badge" style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <i className="fas fa-check-circle"></i> You own this
                      </span>
                      <button
                        onClick={() => transferNFT(
                          nft.tokenId,
                          nft.info.fileUrl,
                          nft.metadata.name || `NFT #${nft.tokenId}`,
                          nft.metadata.file_type || 'application/octet-stream',
                          nft.metadata.file_size || 0
                        )}
                        className="action-btn transfer"
                        title="Transfer NFT"
                        disabled={transferring}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <i className="fas fa-exchange-alt"></i> Transfer
                      </button>
                    </>
                  ) : (
                    <span className="owner-badge" style={{
                      background: '#6b7280',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <i className="fas fa-user"></i> Owned by {formatAddress(nft.owner)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-images"></i>
          <h3>No NFTs Found</h3>
          <p>Upload files and mint them as NFTs to see them here</p>
        </div>
      )}

      {showHistory && selectedNFT && (
        <div className="history-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h3>
                <i className="fas fa-history"></i>
                Ownership History
              </h3>
              <button 
                className="close-btn"
                onClick={() => setShowHistory(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="nft-details">
              <h4>{selectedNFT.metadata.name || `NFT #${selectedNFT.tokenId}`}</h4>
              {selectedNFT.metadata.description && (
                <p className="nft-description">{selectedNFT.metadata.description}</p>
              )}
              <p>
                <strong>Token ID:</strong> {selectedNFT.tokenId}
              </p>
              <p>
                <strong>Creator:</strong> {formatAddress(selectedNFT.info.creator)}
              </p>
              <p>
                <strong>Current Owner:</strong> {formatAddress(selectedNFT.owner)}
                {selectedNFT.owner.toLowerCase() === account.toLowerCase() && " (You)"}
              </p>
              <p>
                <strong>File URL:</strong> 
                <a 
                  href={getImageUrl(selectedNFT.info.fileUrl)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ marginLeft: '5px' }}
                >
                  {selectedNFT.info.fileUrl.substring(0, 30)}...
                </a>
              </p>
            </div>

            <div className="nft-image-preview" style={{ padding: '1rem', textAlign: 'center' }}>
              <img 
                src={getImageUrl(selectedNFT.metadata.image)} 
                alt={selectedNFT.metadata.name}
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/300?text=Image+Not+Available";
                }}
              />
            </div>

            <div className="history-timeline">
              <h4 style={{ marginBottom: '1rem' }}>Ownership Timeline</h4>
              {history.length > 0 ? (
                history.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-marker"></div>
                    <div className="history-info">
                      <span className="history-owner">
                        <i className="fas fa-user"></i>
                        {formatAddress(item.owner)}
                      </span>
                      <span className="history-date">
                        <i className="fas fa-clock"></i>
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-history">No ownership history available</p>
              )}
            </div>

            <div className="history-footer" style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end',
              padding: '1rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              {selectedNFT.owner.toLowerCase() === account.toLowerCase() && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowHistory(false);
                    transferNFT(
                      selectedNFT.tokenId,
                      selectedNFT.info.fileUrl,
                      selectedNFT.metadata.name,
                      selectedNFT.metadata.file_type,
                      selectedNFT.metadata.file_size
                    );
                  }}
                  disabled={transferring}
                >
                  <i className="fas fa-exchange-alt"></i> Transfer NFT
                </button>
              )}
              <button 
                className="btn btn-secondary"
                onClick={() => window.open(getImageUrl(selectedNFT.metadata.image), '_blank')}
              >
                <i className="fas fa-eye"></i> View Full Image
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => window.open(getImageUrl(selectedNFT.info.fileUrl), '_blank')}
              >
                <i className="fas fa-download"></i> Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}