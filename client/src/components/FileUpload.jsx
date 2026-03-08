import { useState, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";

export default function FileUpload({
  uploadContract,
  nftContract,
  account,
  provider,
  onUploadSuccess,
}) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [mintAsNFT, setMintAsNFT] = useState(false);

  const PINATA_API_KEY = "80000672308d07d88748";
  const PINATA_SECRET_KEY =
    "c237205f4f9b49ec937167509bfa8b9c283ea8b7e7895fb2759438873fd03d72";
  const GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const validateAndSetFile = (selectedFile) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      setMessage({
        type: "error",
        text: "File too large. Maximum size is 50MB.",
      });
      return;
    }

    setFile(selectedFile);
    setMessage({ type: "success", text: `Selected: ${selectedFile.name}` });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const uploadToPinata = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedBy: account,
        timestamp: Date.now().toString(),
        size: file.size.toString(),
        type: file.type,
      },
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    try {
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_KEY,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setProgress(percentCompleted);
            }
          },
        },
      );

      return response.data.IpfsHash;
    } catch (error) {
      console.error("Pinata upload error:", error);
      throw new Error(
        "Failed to upload to IPFS. Please check your Pinata keys.",
      );
    }
  };

  const mintNFT = async (fileUrl, fileName, fileType, fileSize) => {
    if (!nftContract) {
      throw new Error("NFT contract not initialized");
    }

    // Create metadata for NFT
    const metadata = {
      name: fileName,
      description: `NFT version of ${fileName}`,
      image: fileUrl,
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSize,
      uploaded_at: new Date().toISOString(),
      uploaded_by: account
    };

    const metadataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY
        }
      }
    );

    const metadataCID = metadataRes.data.IpfsHash;
    const metadataURI = `ipfs://${metadataCID}`;

    const tx = await nftContract.mintFileNFT(metadataURI, fileUrl);
    await tx.wait();

    return metadataCID;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage({ type: "error", text: "Please select a file" });
      return;
    }

    if (!uploadContract) {
      setMessage({ type: "error", text: "Upload contract not initialized" });
      return;
    }

    if (!account) {
      setMessage({ type: "error", text: "Please connect your wallet" });
      return;
    }

    setUploading(true);
    setMessage({ type: "", text: "" });
    setProgress(0);

    try {
      // Upload to IPFS via Pinata
      const ipfsHash = await uploadToPinata(file);
      const fileUrl = `${GATEWAY_URL}${ipfsHash}`;

      // Add file info to blockchain
      const tx = await uploadContract.addFile(
        fileUrl,
        file.name,
        file.type || "application/octet-stream",
        file.size,
      );
      await tx.wait();

      setMessage({
        type: "success",
        text: "File uploaded successfully!",
      });

      // Mint as NFT if option is selected
      if (mintAsNFT && nftContract) {
        try {
          const metadataCID = await mintNFT(fileUrl, file.name, file.type, file.size);
          setMessage({
            type: "success",
            text: `File uploaded and minted as NFT! IPFS: ${ipfsHash}`,
          });
        } catch (nftError) {
          console.error("NFT minting error:", nftError);
          setMessage({
            type: "warning",
            text: `File uploaded but NFT minting failed: ${nftError.message}`,
          });
        }
      }

      if (onUploadSuccess) onUploadSuccess();

      setFile(null);
      setProgress(100);
      setMintAsNFT(false);
      
      e.target.reset();

      setTimeout(() => {
        setMessage({ type: "", text: "" });
        setProgress(0);
      }, 5000);
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({
        type: "error",
        text: error.message || "Upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setFile(null);
    setMessage({ type: "", text: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      {message.text && (
        <div className={`message ${message.type}`}>
          <i
            className={`fas fa-${
              message.type === "success"
                ? "check-circle"
                : message.type === "warning"
                ? "exclamation-triangle"
                : message.type === "info"
                ? "info-circle"
                : "exclamation-circle"
            }`}
          ></i>
          {message.text}
          {message.type === "success" && (
            <button
              type="button"
              className="message-close"
              onClick={() => setMessage({ type: "", text: "" })}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      )}

      <div
        className={`upload-area ${dragActive ? "drag-active" : ""} ${
          !account ? "disabled" : ""
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          className="file-input"
          disabled={!account || uploading}
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
        />

        <label htmlFor="file-input" className="upload-label">
          <i className="fas fa-cloud-upload-alt upload-icon"></i>
          <h3>Drag & Drop or Click to Upload</h3>
          <p>Supported: Images, Videos, Audio, PDF, Documents (Max 50MB)</p>
        </label>

        {file && (
          <div className="selected-file">
            <i className="fas fa-file"></i>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">
                ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              className="remove-file"
              onClick={removeSelectedFile}
              disabled={uploading}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {uploading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="progress-text">{progress}% Uploaded to IPFS</span>
          </div>
        )}
      </div>

      {nftContract && (
        <div className="checkbox-option">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={mintAsNFT}
              onChange={(e) => setMintAsNFT(e.target.checked)}
              disabled={uploading || !file}
            />
            <span>
              <i className="fas fa-certificate"></i>
              Mint as NFT after upload
            </span>
          </label>
        </div>
      )}

      <button
        type="submit"
        className="btn upload-btn"
        disabled={!account || uploading || !file}
      >
        {uploading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            Uploading to IPFS...
          </>
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt"></i>
            {mintAsNFT ? "Upload & Mint NFT" : "Upload to IPFS"}
          </>
        )}
      </button>

      {!account && (
        <div className="warning-message">
          <i className="fas fa-exclamation-triangle"></i>
          Please connect your wallet to upload files
        </div>
      )}
    </form>
  );
}