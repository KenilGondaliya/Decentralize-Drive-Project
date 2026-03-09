import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import axios from "axios";

export default function Display({ uploadContract, nftContract, account, onFileChange }) {
  const [files, setFiles] = useState([]);
  const [otherAddress, setOtherAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [previewFile, setPreviewFile] = useState(null);
  const [sortBy, setSortBy] = useState("date");

  const GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

  // Helper function to format address
  const formatAddress = (addr) => {
    if (!addr) return "Unknown";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get all NFTs and their owners from the NFT contract
  const getAllNFTs = async () => {
    if (!nftContract) return new Map();
    
    try {
      const total = await nftContract.tokenCounter();
      console.log("Total NFTs in contract:", total.toString());
      
      const nftMap = new Map();
      
      for (let i = 0; i < total; i++) {
        try {
          const owner = await nftContract.ownerOf(i);
          const info = await nftContract.nftInfo(i);
          
          // Store in map with fileUrl as key
          nftMap.set(info.fileUrl, {
            tokenId: i,
            owner: owner,
            fileUrl: info.fileUrl
          });
          
          console.log(`NFT #${i}: Owner=${owner}, File=${info.fileUrl}`);
        } catch (err) {
          console.error(`Error getting NFT ${i}:`, err);
        }
      }
      
      return nftMap;
    } catch (err) {
      console.error("Error getting all NFTs:", err);
      return new Map();
    }
  };

  const getFiles = useCallback(async () => {
    if (!uploadContract || !account) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const addressToCheck = otherAddress || account;

      if (otherAddress && !ethers.isAddress(otherAddress)) {
        setMessage({ type: "error", text: "Invalid Ethereum address" });
        setLoading(false);
        return;
      }

      // Check access if viewing someone else's files
      if (otherAddress && otherAddress !== account) {
        try {
          const hasAccess = await uploadContract.checkAccess(otherAddress, account);
          if (!hasAccess) {
            setMessage({
              type: "error",
              text: "You don't have access to view these files",
            });
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error checking access:", error);
        }
      }

      // Get files from Upload contract
      const data = await uploadContract.getFiles(addressToCheck);
      console.log("Raw files data:", data);

      let processedFiles = data.map((file, index) => ({
        url: file.url,
        name: file.name,
        fileType: file.fileType,
        timestamp: Number(file.timestamp),
        size: Number(file.size),
        isDeleted: file.isDeleted,
        id: index,
        isNFT: false,
        tokenId: null,
        nftOwner: null,
      }));

      const activeFiles = processedFiles.filter((file) => !file.isDeleted);
      console.log("Active files:", activeFiles);

      // Get all NFTs from the NFT contract
      if (nftContract && activeFiles.length > 0) {
        console.log("Checking NFT status for files...");
        
        // Get all NFTs at once for efficiency
        const nftMap = await getAllNFTs();
        console.log("NFT Map:", Array.from(nftMap.entries()));
        
        // Update each file with NFT info if it exists in the map
        const filesWithNFTStatus = activeFiles.map(file => {
          const nftInfo = nftMap.get(file.url);
          
          if (nftInfo) {
            console.log(`File ${file.name} is NFT #${nftInfo.tokenId} owned by ${nftInfo.owner}`);
            return {
              ...file,
              isNFT: true,
              tokenId: nftInfo.tokenId,
              nftOwner: nftInfo.owner
            };
          } else {
            console.log(`File ${file.name} is not an NFT`);
            return {
              ...file,
              isNFT: false,
              tokenId: null,
              nftOwner: null
            };
          }
        });
        
        setFiles(sortFiles(filesWithNFTStatus, sortBy));
      } else {
        setFiles(sortFiles(activeFiles, sortBy));
      }

      if (activeFiles.length === 0 && !otherAddress) {
        setMessage({ type: "info", text: "No files found" });
      }
    } catch (error) {
      console.error("Error in getFiles:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to load files",
      });
    } finally {
      setLoading(false);
    }
  }, [uploadContract, nftContract, account, otherAddress, sortBy]);

  const sortFiles = (filesArray, sortMethod) => {
    const sorted = [...filesArray];
    switch (sortMethod) {
      case "name":
        return sorted.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );
      case "size":
        return sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
      case "date":
      default:
        return sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  };

  useEffect(() => {
    if (account && uploadContract) {
      getFiles();
    }
  }, [account, uploadContract, getFiles]);

  const mintAsNFT = async (file) => {
    if (!nftContract) {
      alert("NFT contract not initialized");
      return;
    }

    setLoading(true);
    try {
      console.log("Minting NFT for file:", file);
      
      const metadata = {
        name: file.name,
        description: `NFT version of ${file.name}`,
        image: file.url,
        file_url: file.url,
        file_type: file.fileType,
        file_size: file.size,
        uploaded_at: new Date(file.timestamp * 1000).toISOString()
      };

      console.log("Uploading metadata to Pinata...");
      const metadataRes = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        {
          headers: {
            pinata_api_key: "80000672308d07d88748",
            pinata_secret_api_key: "c237205f4f9b49ec937167509bfa8b9c283ea8b7e7895fb2759438873fd03d72"
          }
        }
      );

      const metadataCID = metadataRes.data.IpfsHash;
      const metadataURI = `ipfs://${metadataCID}`;
      console.log("Metadata URI:", metadataURI);

      console.log("Calling mintFileNFT...");
      const tx = await nftContract.mintFileNFT(metadataURI, file.url);
      console.log("Transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      setMessage({ type: "success", text: "NFT minted successfully!" });
      
      // Wait for blockchain to update and refresh
      setTimeout(async () => {
        await getFiles();
      }, 3000);
      
    } catch (err) {
      console.error("Error minting NFT:", err);
      setMessage({ type: "error", text: err.message || "Failed to mint NFT" });
    } finally {
      setLoading(false);
    }
  };

  const transferNFT = async (tokenId, fileUrl) => {
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

    try {
      console.log(`Transferring NFT ${tokenId} to ${to}`);
      const tx = await nftContract.transferNFT(to, tokenId);
      console.log("Transaction sent:", tx.hash);
      
      await tx.wait();
      console.log("Transfer confirmed");
      
      // After successful transfer, grant access to the new owner
      // so they can see this file in their gallery
      try {
        console.log(`Granting access to new owner ${to} for the file`);
        const accessTx = await uploadContract.grantAccess(to);
        await accessTx.wait();
        console.log("Access granted successfully");
      } catch (accessErr) {
        console.log("Note: Could not auto-grant access (might already have it)", accessErr);
      }
      
      alert("NFT transferred successfully! The new owner can now see this file in their gallery.");
      
      // Wait for blockchain to update and refresh
      setTimeout(async () => {
        await getFiles();
      }, 3000);
      
    } catch (err) {
      console.error(err);
      alert("Transfer failed: " + err.message);
    }
  };

  const handlePreview = (file) => {
    setPreviewFile(file);
  };

  const handleDelete = async (fileId) => {
    if (!uploadContract) return;

    if (!window.confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const tx = await uploadContract.removeFile(fileId);
      await tx.wait();
      
      setMessage({ type: "success", text: "File deleted successfully" });
      await getFiles();
      if (onFileChange) onFileChange();

      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to delete file" });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType) => {
    const type = (fileType || "").toLowerCase();
    if (type.startsWith("image/")) return "fa-image";
    if (type.startsWith("video/")) return "fa-video";
    if (type.startsWith("audio/")) return "fa-music";
    if (type.includes("pdf")) return "fa-file-pdf";
    if (type.includes("word") || type.includes("document")) return "fa-file-word";
    if (type.includes("zip") || type.includes("compressed")) return "fa-file-archive";
    if (type.includes("text")) return "fa-file-alt";
    return "fa-file";
  };

  const isImage = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("image/");
  };

  const isVideo = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("video/");
  };

  const isAudio = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("audio/");
  };

  const canMintNFT = (file) => {
    return !file.isNFT && (!otherAddress || otherAddress === account) && nftContract;
  };

  const canTransferNFT = (file) => {
    // Can transfer if:
    // 1. File is an NFT
    // 2. Current user is the owner of this NFT
    // 3. Not viewing someone else's files
    return file.isNFT && 
           file.tokenId !== null && 
           file.tokenId !== undefined && 
           file.nftOwner && 
           file.nftOwner.toLowerCase() === account?.toLowerCase() &&
           (!otherAddress || otherAddress === account);
  };

  const canDelete = (file) => {
    return !otherAddress || otherAddress === account;
  };

  return (
    <div className="display-container">
      <div className="display-controls">
        <div className="search-box">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="input-field"
            placeholder="Enter address to view (optional)"
            value={otherAddress}
            onChange={(e) => setOtherAddress(e.target.value)}
          />
        </div>

        <div className="sort-controls">
          <select 
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
          <button
            onClick={getFiles}
            className="btn btn-secondary refresh-btn"
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          <i
            className={`fas fa-${
              message.type === "info"
                ? "info-circle"
                : message.type === "success"
                ? "check-circle"
                : "exclamation-circle"
            }`}
          ></i>
          {message.text}
        </div>
      )}

      {files.length > 0 ? (
        <div className="files-grid">
          {files.map((file, index) => (
            <div key={index} className="file-card">
              {file.isNFT && (
                <span className="nft-badge" title={`NFT #${file.tokenId}`}>
                  <i className="fas fa-certificate"></i> NFT #{file.tokenId}
                </span>
              )}
              <div
                className={`file-preview ${
                  !isImage(file.fileType) ? "file-icon" : ""
                }`}
                onClick={() => handlePreview(file)}
              >
                {isImage(file.fileType) ? (
                  <img
                    src={file.url}
                    alt={file.name || "Image"}
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                      const parent = e.target.parentNode;
                      if (parent) {
                        parent.innerHTML = '<i class="fas fa-image" style="font-size: 3rem;"></i>';
                      }
                    }}
                  />
                ) : isVideo(file.fileType) ? (
                  <video src={file.url} />
                ) : (
                  <i
                    className={`fas ${getFileIcon(file.fileType)}`}
                    style={{ fontSize: "3rem" }}
                  ></i>
                )}
              </div>

              <div className="file-info">
                <h4 title={file.name || "Unnamed file"}>
                  {file.name
                    ? file.name.length > 20
                      ? file.name.substring(0, 20) + "..."
                      : file.name
                    : "Unnamed file"}
                </h4>
                <div className="file-meta">
                  <span>
                    <i className="fas fa-calendar"></i>
                    {file.timestamp
                      ? new Date(
                          Number(file.timestamp) * 1000,
                        ).toLocaleDateString()
                      : "Unknown"}
                  </span>
                  <span>
                    <i className="fas fa-database"></i>
                    {formatFileSize(Number(file.size))}
                  </span>
                </div>
                {file.isNFT && file.nftOwner && (
                  <div className="nft-owner" style={{ fontSize: '11px', marginTop: '5px', color: '#666' }}>
                    <i className="fas fa-user"></i> Owner: {file.nftOwner.toLowerCase() === account?.toLowerCase() 
                      ? "You" 
                      : formatAddress(file.nftOwner)}
                  </div>
                )}
              </div>

              <div className="file-actions">
                <button
                  onClick={() => handlePreview(file)}
                  className="action-btn preview"
                  title="Preview"
                >
                  <i className="fas fa-eye"></i>
                </button>

                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn download"
                  title="Download"
                >
                  <i className="fas fa-download"></i>
                </a>

                {canMintNFT(file) && (
                  <button
                    onClick={() => mintAsNFT(file)}
                    className="action-btn nft"
                    title="Mint as NFT"
                    disabled={loading}
                  >
                    <i className="fas fa-certificate"></i>
                  </button>
                )}

                {canTransferNFT(file) && (
                  <button
                    onClick={() => transferNFT(file.tokenId, file.url)}
                    className="action-btn transfer"
                    title="Transfer NFT"
                  >
                    <i className="fas fa-exchange-alt"></i>
                  </button>
                )}

                {canDelete(file) && (
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(file.id)}
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading &&
        !message.text && (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>No Files Yet</h3>
            <p>Upload your first file to get started</p>
          </div>
        )
      )}

      {previewFile && (
        <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewFile.name || "Unnamed file"}</h3>
              <button
                className="close-btn"
                onClick={() => setPreviewFile(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="preview-body">
              {isImage(previewFile.fileType) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name || "Preview"}
                  style={{ maxWidth: "100%", maxHeight: "60vh" }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/400?text=Image+Error";
                  }}
                />
              ) : isVideo(previewFile.fileType) ? (
                <video
                  controls
                  src={previewFile.url}
                  style={{ maxWidth: "100%", maxHeight: "60vh" }}
                />
              ) : isAudio(previewFile.fileType) ? (
                <audio controls src={previewFile.url} />
              ) : (
                <div className="file-icon-large">
                  <i
                    className={`fas ${getFileIcon(previewFile.fileType)}`}
                    style={{ fontSize: "5rem" }}
                  ></i>
                  <p>File Type: {previewFile.fileType || "Unknown"}</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    <i className="fas fa-download"></i> Download
                  </a>
                </div>
              )}
            </div>

            <div className="preview-footer">
              <div className="file-details">
                <span>
                  <strong>Type:</strong> {previewFile.fileType || "Unknown"}
                </span>
                <span>
                  <strong>Size:</strong>{" "}
                  {formatFileSize(Number(previewFile.size))}
                </span>
                <span>
                  <strong>Uploaded:</strong>{" "}
                  {previewFile.timestamp
                    ? new Date(
                        Number(previewFile.timestamp) * 1000,
                      ).toLocaleString()
                    : "Unknown"}
                </span>
                {previewFile.isNFT && (
                  <>
                    <span className="nft-indicator">
                      <strong>NFT:</strong> Yes (Token ID: {previewFile.tokenId})
                    </span>
                    <span>
                      <strong>Owner:</strong> {previewFile.nftOwner?.toLowerCase() === account?.toLowerCase() 
                        ? "You" 
                        : formatAddress(previewFile.nftOwner)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}