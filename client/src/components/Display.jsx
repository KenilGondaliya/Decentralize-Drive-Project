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
      }));

      const activeFiles = processedFiles.filter((file) => !file.isDeleted);
      console.log("Active files:", activeFiles);

      // Check which files are NFTs
      if (nftContract) {
        console.log("Checking NFT status for files...");
        const totalNFTs = await nftContract.tokenCounter();
        console.log("Total NFTs minted:", totalNFTs.toString());
        
        for (let file of activeFiles) {
          try {
            // Try multiple ways to check if file is NFT
            const tokenId = await nftContract.fileToToken(file.url);
            const tokenIdNum = Number(tokenId);
            console.log(`File ${file.name} tokenId:`, tokenIdNum);
            
            if (tokenIdNum > 0) {
              file.isNFT = true;
              file.tokenId = tokenIdNum;
              console.log(`✅ File ${file.name} is NFT with tokenId: ${tokenIdNum}`);
            } else {
              console.log(`❌ File ${file.name} is not an NFT`);
            }
          } catch (err) {
            console.log(`Error checking NFT status for ${file.name}:`, err.message);
          }
        }
      }

      const sortedFiles = sortFiles(activeFiles, sortBy);
      setFiles(sortedFiles);

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
      await getFiles(); // Refresh to show NFT badge
    } catch (err) {
      console.error("Error minting NFT:", err);
      setMessage({ type: "error", text: err.message || "Failed to mint NFT" });
    } finally {
      setLoading(false);
    }
  };

  const transferNFT = async (tokenId) => {
    const to = prompt("Enter recipient address");
    if (!to) return;

    if (!ethers.isAddress(to)) {
      alert("Invalid address");
      return;
    }

    try {
      const tx = await nftContract.transferNFT(to, tokenId);
      await tx.wait();
      alert("NFT transferred successfully");
      getFiles();
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
                <span className="nft-badge" title="Minted as NFT">
                  <i className="fas fa-certificate"></i> NFT
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

                {!file.isNFT && (!otherAddress || otherAddress === account) && nftContract && (
                  <button
                    onClick={() => mintAsNFT(file)}
                    className="action-btn nft"
                    title="Mint as NFT"
                    disabled={loading}
                  >
                    <i className="fas fa-certificate"></i>
                  </button>
                )}

                {file.isNFT && file.tokenId && (
                  <button
                    onClick={() => transferNFT(file.tokenId)}
                    className="action-btn transfer"
                    title="Transfer NFT"
                  >
                    <i className="fas fa-exchange-alt"></i>
                  </button>
                )}

                {(!otherAddress || otherAddress === account) && (
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
                  <span className="nft-indicator">
                    <strong>NFT:</strong> Yes (Token ID: {previewFile.tokenId})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}